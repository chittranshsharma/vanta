/**
 * Authenticated Service Boundary and Client for Counterfactual Simulation Lab.
 *
 * Provides transactional server-side persistence via SECURITY DEFINER RPCs,
 * fail-closed reads, review governance gates, and post-hoc outcome linkage.
 *
 * Invariants:
 * - Simulation records remain evidence_class = 'simulation'.
 * - History and mutations are immutable; cancellation is a status transition.
 * - Simulations never write to experiment_outcomes or post_observations.
 * - Traceability linkages connect real outcomes without variance/lift calculation.
 */

import type { Database, Json } from "../types/database.types";
import { isSupabaseConfigured, supabase } from "./supabase";
import {
  executeCounterfactualSimulation,
  type SimulationExecutionResult,
} from "../../shared/simulation/engine";
import type {
  CounterfactualMutation,
  CreativeTwinVersionSnapshot,
} from "../../shared/simulation/types";
import type { ApprovedBrandClaimContext } from "../../shared/simulation/mutations";
import { idempotencyKey, type JobType } from "../../shared/jobs/policy";

export type SimulationRunRow = Database["public"]["Tables"]["simulation_runs"]["Row"];
export type SimulationMutationRow = Database["public"]["Tables"]["simulation_mutations"]["Row"];
export type SimulationResultRow = Database["public"]["Tables"]["simulation_results"]["Row"];
export type SimulationReviewEventRow = Database["public"]["Tables"]["simulation_review_events"]["Row"];
export type SimulationObservedLinkRow = Database["public"]["Tables"]["simulation_observed_links"]["Row"];

export type SimulationReviewDecision =
  | "unreviewed"
  | "needs_human"
  | "accepted"
  | "rejected"
  | "corrected";

export type SimulationRunStatus =
  | "draft"
  | "queued"
  | "running"
  | "completed"
  | "blocked"
  | "failed"
  | "cancelled";

export type Result<T> = { data: T; error: null } | { data: null; error: string };

const NOT_CONFIGURED = "Supabase is not configured.";

export interface CreatePersistentSimulationInput {
  workspaceId: string;
  actorUserId: string;
  baselineSnapshot: CreativeTwinVersionSnapshot;
  twinVersionId: string;
  hypothesis: string;
  mutations: readonly CounterfactualMutation[];
  controls?: readonly string[];
  approvedClaims?: readonly ApprovedBrandClaimContext[];
  idempotencyKey?: string;
  provenance?: Record<string, unknown>;
}

export interface SimulationRunDetail {
  run: SimulationRunRow;
  mutations: SimulationMutationRow[];
  results: SimulationResultRow | null;
  reviewEvents: SimulationReviewEventRow[];
  observedLinks: SimulationObservedLinkRow[];
}

/**
 * Creates and persists a counterfactual simulation run atomically.
 * Executes deterministic domain mutations and writes run, mutations, results, and initial review event
 * in a single server-side transaction.
 */
export async function createPersistentSimulationRun(
  input: CreatePersistentSimulationInput
): Promise<Result<{ simulationRunId: string; idempotentReplay: boolean; execution: SimulationExecutionResult }>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  // Step 1: Execute deterministic domain engine
  const execution = executeCounterfactualSimulation({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    baselineSnapshot: input.baselineSnapshot,
    hypothesis: input.hypothesis,
    mutations: input.mutations,
    controls: input.controls ?? [],
    approvedClaims: input.approvedClaims ?? [],
  });

  if (!execution.success || !execution.simulationRun) {
    return {
      data: null,
      error: `Simulation execution failed: ${execution.errors.join("; ")}`,
    };
  }

  const simRun = execution.simulationRun;
  const variant = simRun.simulatedVariant;

  // Format mutations payload for SQL JSONB
  const mutationsPayload: Json = input.mutations.map((m, idx) => ({
    sequence_order: idx,
    mutation_type: m.type,
    target_scene_index: "targetSceneIndex" in m ? m.targetSceneIndex : 0,
    rationale: m.rationale,
    payload: m as unknown as Json,
  }));

  const resultsPayload: Json = {
    simulated_scenes: variant.simulatedScenes as unknown as Json,
    structural_delta: variant.structuralDelta as unknown as Json,
    council_execution: simRun.councilExecution as unknown as Json,
    warnings: variant.structuralDelta.warnings as unknown as Json,
  };

  const idKey = input.idempotencyKey ?? `sim:${input.workspaceId}:${input.baselineSnapshot.twinId}:${input.baselineSnapshot.twinVersion}:${Date.now()}`;

  // Step 2: Atomic transaction via SECURITY DEFINER RPC
  const { data, error } = await supabase.rpc("create_simulation_run_atomic", {
    p_workspace_id: input.workspaceId,
    p_twin_id: input.baselineSnapshot.twinId,
    p_twin_version_id: input.twinVersionId,
    p_twin_version: input.baselineSnapshot.twinVersion,
    p_hypothesis: input.hypothesis,
    p_mutations: mutationsPayload,
    p_results: resultsPayload,
    p_assumptions: variant.assumptions as unknown as Json,
    p_limitations: variant.limitations as unknown as Json,
    p_controls: (input.controls ?? []) as unknown as Json,
    p_idempotency_key: idKey,
    p_provenance: (input.provenance ?? {}) as unknown as Json,
    p_uncertainty_note: simRun.uncertaintyNote,
  });

  if (error) return { data: null, error: error.message };

  const res = data as { success?: boolean; simulation_run_id?: string; idempotent_replay?: boolean };
  if (!res.success || !res.simulation_run_id) {
    return { data: null, error: "Failed to persist simulation run: server returned unsuccessful result." };
  }

  return {
    data: {
      simulationRunId: res.simulation_run_id,
      idempotentReplay: Boolean(res.idempotent_replay),
      execution,
    },
    error: null,
  };
}

/**
 * Lists simulation runs for a workspace with optional filters.
 */
export async function listSimulationRuns(
  workspaceId: string,
  filter?: {
    twinId?: string;
    status?: SimulationRunStatus;
    reviewDecision?: SimulationReviewDecision;
    limit?: number;
  }
): Promise<Result<SimulationRunRow[]>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  let query = supabase
    .from("simulation_runs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (filter?.twinId) {
    query = query.eq("twin_id", filter.twinId);
  }
  if (filter?.status) {
    query = query.eq("status", filter.status);
  }
  if (filter?.reviewDecision) {
    query = query.eq("review_decision", filter.reviewDecision);
  }
  if (filter?.limit && filter.limit > 0) {
    query = query.limit(filter.limit);
  }

  const { data, error } = await query;
  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}

/**
 * Fetches complete details of a simulation run including mutations, results, reviews, and trace links.
 */
export async function fetchSimulationRunDetails(
  workspaceId: string,
  simulationRunId: string
): Promise<Result<SimulationRunDetail>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  const [runRes, mutRes, resRes, revRes, linkRes] = await Promise.all([
    supabase
      .from("simulation_runs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("id", simulationRunId)
      .maybeSingle(),
    supabase
      .from("simulation_mutations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("simulation_run_id", simulationRunId)
      .order("sequence_order", { ascending: true }),
    supabase
      .from("simulation_results")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("simulation_run_id", simulationRunId)
      .maybeSingle(),
    supabase
      .from("simulation_review_events")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("simulation_run_id", simulationRunId)
      .order("created_at", { ascending: false }),
    supabase
      .from("simulation_observed_links")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("simulation_run_id", simulationRunId)
      .order("created_at", { ascending: false }),
  ]);

  if (runRes.error) return { data: null, error: runRes.error.message };
  if (!runRes.data) return { data: null, error: `Simulation run ${simulationRunId} not found.` };
  if (mutRes.error) return { data: null, error: mutRes.error.message };
  if (resRes.error) return { data: null, error: resRes.error.message };
  if (revRes.error) return { data: null, error: revRes.error.message };
  if (linkRes.error) return { data: null, error: linkRes.error.message };

  return {
    data: {
      run: runRes.data,
      mutations: mutRes.data ?? [],
      results: resRes.data ?? null,
      reviewEvents: revRes.data ?? [],
      observedLinks: linkRes.data ?? [],
    },
    error: null,
  };
}

/**
 * Applies a human governance decision to a simulation run via atomic RPC.
 * Invariant: Preserves evidence_class = 'simulation'.
 */
export async function reviewSimulationRun(input: {
  workspaceId: string;
  simulationRunId: string;
  decision: SimulationReviewDecision;
  rationale?: string;
  metadata?: Record<string, unknown>;
}): Promise<
  Result<{
    simulationRunId: string;
    previousDecision: string;
    newDecision: SimulationReviewDecision;
    idempotentNoOp: boolean;
  }>
> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase.rpc("review_simulation_run_atomic", {
    p_workspace_id: input.workspaceId,
    p_simulation_run_id: input.simulationRunId,
    p_decision: input.decision,
    p_rationale: input.rationale ?? undefined,
    p_metadata: (input.metadata ?? {}) as Json,
  });

  if (error) return { data: null, error: error.message };

  const res = data as {
    success?: boolean;
    simulation_run_id?: string;
    previous_decision?: string;
    new_decision?: string;
    idempotent_no_op?: boolean;
  };

  if (!res.success) {
    return { data: null, error: "Review update refused by server." };
  }

  return {
    data: {
      simulationRunId: res.simulation_run_id || input.simulationRunId,
      previousDecision: res.previous_decision || "",
      newDecision: (res.new_decision as SimulationReviewDecision) || input.decision,
      idempotentNoOp: Boolean(res.idempotent_no_op),
    },
    error: null,
  };
}

/**
 * Links an empirical experiment outcome to a prior simulation for post-hoc traceability.
 * Invariant: Traceability only—never calculates lift, variance, or accuracy.
 */
export async function linkSimulationObservedOutcome(input: {
  workspaceId: string;
  simulationRunId: string;
  experimentOutcomeId: string;
  note?: string;
  metadata?: Record<string, unknown>;
}): Promise<
  Result<{
    linkId: string;
    simulationRunId: string;
    experimentOutcomeId: string;
    idempotentReplay: boolean;
  }>
> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase.rpc("link_simulation_observed_outcome_atomic", {
    p_workspace_id: input.workspaceId,
    p_simulation_run_id: input.simulationRunId,
    p_experiment_outcome_id: input.experimentOutcomeId,
    p_note: input.note ?? undefined,
    p_metadata: (input.metadata ?? {}) as Json,
  });

  if (error) return { data: null, error: error.message };

  const res = data as {
    success?: boolean;
    link_id?: string;
    simulation_run_id?: string;
    experiment_outcome_id?: string;
    idempotent_replay?: boolean;
  };

  if (!res.success || !res.link_id) {
    return { data: null, error: "Link creation refused by server." };
  }

  return {
    data: {
      linkId: res.link_id,
      simulationRunId: res.simulation_run_id || input.simulationRunId,
      experimentOutcomeId: res.experiment_outcome_id || input.experimentOutcomeId,
      idempotentReplay: Boolean(res.idempotent_replay),
    },
    error: null,
  };
}

/**
 * Transitions the status of a simulation run (or cancels it).
 */
export async function transitionSimulationRunStatus(input: {
  workspaceId: string;
  simulationRunId: string;
  targetStatus: SimulationRunStatus;
  reason?: string;
}): Promise<
  Result<{
    simulationRunId: string;
    status: SimulationRunStatus;
    idempotentNoOp: boolean;
  }>
> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase.rpc("transition_simulation_run_status_atomic", {
    p_workspace_id: input.workspaceId,
    p_simulation_run_id: input.simulationRunId,
    p_target_status: input.targetStatus,
    p_reason: input.reason ?? undefined,
  });

  if (error) return { data: null, error: error.message };

  const res = data as {
    success?: boolean;
    simulation_run_id?: string;
    status?: string;
    idempotent_no_op?: boolean;
  };

  if (!res.success) {
    return { data: null, error: "Status transition refused by server." };
  }

  return {
    data: {
      simulationRunId: res.simulation_run_id || input.simulationRunId,
      status: (res.status as SimulationRunStatus) || input.targetStatus,
      idempotentNoOp: Boolean(res.idempotent_no_op),
    },
    error: null,
  };
}

/**
 * Enqueues a background simulation job after verifying daily workspace quota.
 */
export async function enqueueSimulationJob(input: {
  workspaceId: string;
  jobType: Extract<
    JobType,
    | "simulation_validate"
    | "simulation_execute"
    | "simulation_review_ready"
    | "simulation_observed_link"
  >;
  payload: Record<string, unknown>;
}): Promise<Result<{ jobId: string }>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  // Step 1: Atomic quota consumption
  const { data: quotaAllowed, error: quotaError } = await supabase.rpc("consume_quota", {
    p_workspace_id: input.workspaceId,
    p_kind: "job_enqueue",
    p_count: 1,
  });

  if (quotaError) return { data: null, error: `Quota check failed: ${quotaError.message}` };
  if (!quotaAllowed) return { data: null, error: "Daily job enqueue quota exhausted for this workspace." };

  // Step 2: Build deterministic idempotency key
  const idKey = idempotencyKey(input.jobType, {
    workspace_id: input.workspaceId,
    ...input.payload,
  } as Record<string, string | number | boolean | null>);

  // Step 3: Insert job record
  const { data: jobData, error: jobError } = await supabase
    .from("jobs")
    .insert({
      workspace_id: input.workspaceId,
      job_type: input.jobType,
      payload: input.payload as Json,
      idempotency_key: idKey,
      status: "queued",
    })
    .select("id")
    .single();

  if (jobError) return { data: null, error: `Failed to enqueue job: ${jobError.message}` };

  return {
    data: { jobId: jobData.id },
    error: null,
  };
}
