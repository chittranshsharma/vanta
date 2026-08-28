/**
 * Counterfactual Simulation Engine and Council Coordinator.
 *
 * Executes the six-role analysis subgraph:
 * discovery -> creative_analyst -> claim_auditor -> experiment_designer -> evidence_arbiter -> evaluator
 * Followed by the mandatory human_reviewer governance gate.
 *
 * Invariant: Outputs are strictly evidence_class = 'simulation'.
 * Invariant: Human approval records review_decision = 'accepted' but never converts
 * simulation to observed empirical truth.
 */

import type { AgentRole } from "../agents/graph";
import type { ReviewDecision } from "../agents/council";
import { applyCounterfactualMutations } from "./mutations";
import { validateSimulationRunRequest, type SimulationRunRequest } from "./validator";
import type { SimulationRun } from "./types";

export interface SimulationExecutionResult {
  success: boolean;
  errors: readonly string[];
  simulationRun: SimulationRun | null;
}

export interface SimulationReviewResult {
  updatedSimulationRun: SimulationRun;
  auditEvent: {
    action: string;
    actor_user_id: string;
    workspace_id: string;
    metadata: Record<string, unknown>;
  };
}

/** Six-role analysis subgraph for counterfactual simulation */
export const SIMULATION_ANALYSIS_ROLES: readonly AgentRole[] = [
  "discovery",
  "creative_analyst",
  "claim_auditor",
  "experiment_designer",
  "evidence_arbiter",
  "evaluator",
] as const;

/** Roles skipped in simulation execution */
export const SIMULATION_SKIPPED_ROLES: readonly AgentRole[] = [
  "audience_researcher",
  "compliance_reviewer",
  "localization_reviewer",
  "performance_analyst",
] as const;

/**
 * Executes a counterfactual simulation run under the six-role Council analysis subgraph.
 */
export function executeCounterfactualSimulation(
  request: SimulationRunRequest
): SimulationExecutionResult {
  // Step 1: Pre-flight validation and tenant boundaries
  const validation = validateSimulationRunRequest(request);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      simulationRun: null,
    };
  }

  // Step 2: Apply bounded mutations and calculate structural deltas
  const mutationResult = applyCounterfactualMutations(
    request.baselineSnapshot,
    request.mutations,
    request.approvedClaims ?? []
  );

  if (!mutationResult.success || !mutationResult.simulatedVariant) {
    return {
      success: false,
      errors: mutationResult.errors,
      simulationRun: null,
    };
  }

  const now = new Date().toISOString();
  const runId = `sim-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const simulationRun: SimulationRun = {
    simulationRunId: runId,
    workspaceId: request.workspaceId,
    actorUserId: request.actorUserId,
    sourceTwinId: request.baselineSnapshot.twinId,
    sourceTwinVersion: request.baselineSnapshot.twinVersion,
    hypothesis: request.hypothesis,
    mutations: request.mutations,
    controls: request.controls ?? [],
    status: "completed",
    // CRITICAL INVARIANT: Evidence class is strictly 'simulation'
    evidenceClass: "simulation",
    // CRITICAL INVARIANT: Empirical validation is strictly 'unknown' in v1 until real tests exist
    observedValidation: "unknown",
    // Governance state starts unreviewed; requires explicit human review gate
    reviewDecision: "unreviewed",
    reviewedByUserId: null,
    reviewedAt: null,
    uncertaintyNote:
      "Simulated variant produced under hypothetical parameter modifications. Structural metrics (WPM, scene timings, claim density) are calculated deterministically and do not constitute empirical audience retention, conversion, or algorithm distribution.",
    simulatedVariant: mutationResult.simulatedVariant,
    councilExecution: {
      analysisRolesRun: SIMULATION_ANALYSIS_ROLES,
      analysisRolesSkipped: SIMULATION_SKIPPED_ROLES,
      governanceRole: "human_reviewer",
      executedAt: now,
    },
    createdAt: now,
    completedAt: now,
  };

  return {
    success: true,
    errors: [],
    simulationRun,
  };
}

/**
 * Applies the mandatory human review gate to an existing simulation run.
 * Invariant: Human acceptance preserves evidence_class = 'simulation' (never promotes to 'observed').
 */
export function applySimulationReview(
  simulationRun: SimulationRun,
  decision: ReviewDecision,
  reviewerUserId: string,
  reason?: string
): SimulationReviewResult {
  const now = new Date().toISOString();

  const updatedSimulationRun: SimulationRun = {
    ...simulationRun,
    reviewDecision: decision,
    reviewedByUserId: reviewerUserId,
    reviewedAt: now,
    // CRITICAL INVARIANT: Evidence class remains 'simulation'!
    evidenceClass: "simulation",
  };

  const auditEvent = {
    action: "simulation.run_reviewed",
    actor_user_id: reviewerUserId,
    workspace_id: simulationRun.workspaceId,
    metadata: {
      simulation_run_id: simulationRun.simulationRunId,
      source_twin_id: simulationRun.sourceTwinId,
      decision,
      prior_decision: simulationRun.reviewDecision,
      evidence_class: "simulation",
      has_reason: Boolean(reason && reason.trim().length > 0),
    },
  };

  return {
    updatedSimulationRun,
    auditEvent,
  };
}
