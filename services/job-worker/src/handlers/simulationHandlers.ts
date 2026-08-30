/**
 * Background Job Handlers for Counterfactual Simulation Lab.
 *
 * Implements handlers for:
 * 1. simulation_validate: validates baseline twin, mutations, and workspace claim references.
 * 2. simulation_execute: computes deterministic structural deltas and commits results safely.
 * 3. simulation_review_ready: transitions governance state to needs_human and logs review request event.
 * 4. simulation_observed_link: links empirical experiment outcome for post-hoc traceability.
 *
 * Invariants:
 * - Handlers do not report completion until persistent state is committed.
 * - Evidence class strictly preserved as 'simulation'.
 * - No performance/virality/lift predictions.
 * - Strict multi-tenant isolation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobHandler } from "../loop.js";
import {
  applyCounterfactualMutations,
  type ApprovedBrandClaimContext,
} from "../../../../shared/simulation/mutations.js";
import type {
  CounterfactualMutation,
  CreativeTwinVersionSnapshot,
} from "../../../../shared/simulation/types.js";

/**
 * Handler: simulation_validate
 */
export function makeSimulationValidateHandler(supabase: SupabaseClient): JobHandler {
  return async (job) => {
    const payload = job.payload as {
      twin_id?: string;
      twin_version_id?: string;
      hypothesis?: string;
      mutations?: CounterfactualMutation[];
    };

    if (!payload.twin_id || !payload.twin_version_id) {
      return {
        ok: false,
        failure: { kind: "permanent", message: "twin_id and twin_version_id are required", code: "bad_payload" },
      };
    }

    // 1. Verify twin and twin version exist in this workspace
    const { data: twinVersion, error: tvError } = await supabase
      .from("creative_twin_versions")
      .select("id, twin_id, workspace_id, version_number, snapshot")
      .eq("id", payload.twin_version_id)
      .eq("twin_id", payload.twin_id)
      .eq("workspace_id", job.workspace_id)
      .maybeSingle();

    if (tvError) {
      return {
        ok: false,
        failure: { kind: "transient", message: `Database error: ${tvError.message}`, code: "db_error" },
      };
    }

    if (!twinVersion) {
      return {
        ok: false,
        failure: { kind: "permanent", message: "Twin version not found in workspace", code: "not_found" },
      };
    }

    // 2. If claim substitution mutations exist, verify they reference approved claims in the same workspace
    const mutations = payload.mutations ?? [];
    for (const m of mutations) {
      if (m.type === "claim_substitution") {
        const { data: claim, error: claimError } = await supabase
          .from("brand_claims")
          .select("id, workspace_id, claim_type, review_status")
          .eq("id", m.substituteBrandClaimId)
          .eq("workspace_id", job.workspace_id)
          .maybeSingle();

        if (claimError) {
          return {
            ok: false,
            failure: { kind: "transient", message: `Database error reading claim: ${claimError.message}`, code: "db_error" },
          };
        }

        if (!claim || claim.claim_type !== "approved" || claim.review_status !== "approved") {
          return {
            ok: false,
            failure: {
              kind: "permanent",
              message: `Substitute claim "${m.substituteBrandClaimId}" is not approved or does not belong to workspace`,
              code: "unapproved_claim",
            },
          };
        }
      }
    }

    return {
      ok: true,
      result: {
        valid: true,
        workspace_id: job.workspace_id,
        twin_id: payload.twin_id,
        twin_version_id: payload.twin_version_id,
        mutation_count: mutations.length,
      },
    };
  };
}

/**
 * Handler: simulation_execute
 */
export function makeSimulationExecuteHandler(supabase: SupabaseClient): JobHandler {
  return async (job) => {
    const payload = job.payload as {
      simulation_run_id?: string;
      twin_id?: string;
      twin_version_id?: string;
      mutations?: CounterfactualMutation[];
    };

    const runId = payload.simulation_run_id;
    if (!runId || !payload.twin_id || !payload.twin_version_id) {
      return {
        ok: false,
        failure: { kind: "permanent", message: "simulation_run_id, twin_id, and twin_version_id are required", code: "bad_payload" },
      };
    }

    // 1. Fetch baseline snapshot
    const { data: twinVersion, error: tvError } = await supabase
      .from("creative_twin_versions")
      .select("id, twin_id, workspace_id, version_number, snapshot")
      .eq("id", payload.twin_version_id)
      .eq("twin_id", payload.twin_id)
      .eq("workspace_id", job.workspace_id)
      .maybeSingle();

    if (tvError) {
      return {
        ok: false,
        failure: { kind: "transient", message: `Database error: ${tvError.message}`, code: "db_error" },
      };
    }

    if (!twinVersion || !twinVersion.snapshot) {
      return {
        ok: false,
        failure: { kind: "permanent", message: "Twin version snapshot not found", code: "not_found" },
      };
    }

    const baselineSnapshot = twinVersion.snapshot as unknown as CreativeTwinVersionSnapshot;

    // 2. Fetch approved claims for substitution verification
    const { data: claimsData } = await supabase
      .from("brand_claims")
      .select("id, workspace_id, claim_text, claim_type, review_status, proof_points:brand_proof_points(id)")
      .eq("workspace_id", job.workspace_id)
      .eq("claim_type", "approved")
      .eq("review_status", "approved");

    const approvedClaims: ApprovedBrandClaimContext[] = (
      (claimsData ?? []) as Array<{
        id: string;
        workspace_id: string;
        claim_text: string;
        claim_type: string;
        review_status: string;
        proof_points?: Array<{ id: string }>;
      }>
    ).map((c) => ({
      id: c.id,
      workspaceId: c.workspace_id,
      claimText: c.claim_text,
      claimType: c.claim_type,
      reviewStatus: c.review_status,
      proofPointId: c.proof_points?.[0]?.id ?? "",
    }));

    // 3. Execute mutations
    const mutationResult = applyCounterfactualMutations(
      baselineSnapshot,
      payload.mutations ?? [],
      approvedClaims
    );

    if (!mutationResult.success || !mutationResult.simulatedVariant) {
      return {
        ok: false,
        failure: {
          kind: "permanent",
          message: `Mutation application failed: ${mutationResult.errors.join("; ")}`,
          code: "mutation_failed",
        },
      };
    }

    const variant = mutationResult.simulatedVariant;

    // 4. Insert simulation results in database if not already present
    const { data: existingResult } = await supabase
      .from("simulation_results")
      .select("id")
      .eq("simulation_run_id", runId)
      .eq("workspace_id", job.workspace_id)
      .maybeSingle();

    if (!existingResult) {
      const userRes = await supabase.auth.getUser();
      const actorId = userRes.data?.user?.id ?? null;

      const { error: resultError } = await supabase
        .from("simulation_results")
        .insert({
          workspace_id: job.workspace_id,
          simulation_run_id: runId,
          simulated_scenes: variant.simulatedScenes as unknown as Record<string, unknown>[],
          structural_delta: variant.structuralDelta as unknown as Record<string, unknown>,
          warnings: variant.structuralDelta.warnings as unknown as string[],
          created_by: actorId,
        });

      if (resultError) {
        return {
          ok: false,
          failure: { kind: "transient", message: `Failed to commit results: ${resultError.message}`, code: "db_error" },
        };
      }
    }

    // 5. Update run status to completed via atomic transition RPC
    const { error: statusError } = await supabase.rpc("transition_simulation_run_status_atomic", {
      p_workspace_id: job.workspace_id,
      p_simulation_run_id: runId,
      p_target_status: "completed",
    });

    if (statusError) {
      return {
        ok: false,
        failure: { kind: "transient", message: `Failed to update status: ${statusError.message}`, code: "db_error" },
      };
    }

    return {
      ok: true,
      result: {
        simulation_run_id: runId,
        status: "completed",
        duration_delta: variant.structuralDelta.durationDeltaSeconds,
        wpm_delta: variant.structuralDelta.wpmDelta,
        mutations_applied: variant.mutationsAppliedCount,
      },
    };
  };
}

/**
 * Handler: simulation_review_ready
 */
export function makeSimulationReviewReadyHandler(supabase: SupabaseClient): JobHandler {
  return async (job) => {
    const payload = job.payload as { simulation_run_id?: string };
    const runId = payload.simulation_run_id;

    if (!runId) {
      return {
        ok: false,
        failure: { kind: "permanent", message: "simulation_run_id is required", code: "bad_payload" },
      };
    }

    const { data: run, error: runError } = await supabase
      .from("simulation_runs")
      .select("id, workspace_id, review_decision, status")
      .eq("id", runId)
      .eq("workspace_id", job.workspace_id)
      .maybeSingle();

    if (runError) {
      return {
        ok: false,
        failure: { kind: "transient", message: `Database error: ${runError.message}`, code: "db_error" },
      };
    }

    if (!run) {
      return {
        ok: false,
        failure: { kind: "permanent", message: "Simulation run not found", code: "not_found" },
      };
    }

    if (run.review_decision === "unreviewed") {
      // Transition to needs_human via atomic review RPC
      const { error: updateError } = await supabase.rpc("review_simulation_run_atomic", {
        p_workspace_id: job.workspace_id,
        p_simulation_run_id: runId,
        p_decision: "needs_human",
        p_rationale: "Automated simulation execution complete. Ready for human governance review.",
        p_metadata: { worker_triggered: true },
      });

      if (updateError) {
        return {
          ok: false,
          failure: { kind: "transient", message: `Failed to update review status: ${updateError.message}`, code: "db_error" },
        };
      }
    }

    return {
      ok: true,
      result: {
        simulation_run_id: runId,
        review_decision: "needs_human",
      },
    };
  };
}

/**
 * Handler: simulation_observed_link
 */
export function makeSimulationObservedLinkHandler(supabase: SupabaseClient): JobHandler {
  return async (job) => {
    const payload = job.payload as {
      simulation_run_id?: string;
      experiment_outcome_id?: string;
      note?: string;
    };

    if (!payload.simulation_run_id || !payload.experiment_outcome_id) {
      return {
        ok: false,
        failure: { kind: "permanent", message: "simulation_run_id and experiment_outcome_id are required", code: "bad_payload" },
      };
    }

    const { data, error } = await supabase.rpc("link_simulation_observed_outcome_atomic", {
      p_workspace_id: job.workspace_id,
      p_simulation_run_id: payload.simulation_run_id,
      p_experiment_outcome_id: payload.experiment_outcome_id,
      p_note: payload.note ?? undefined,
      p_metadata: { worker_linked: true },
    });

    if (error) {
      return {
        ok: false,
        failure: { kind: "transient", message: `RPC error: ${error.message}`, code: "rpc_error" },
      };
    }

    const res = data as { success?: boolean; link_id?: string; idempotent_replay?: boolean };
    if (!res.success) {
      return {
        ok: false,
        failure: { kind: "permanent", message: "Server refused link creation", code: "refused" },
      };
    }

    return {
      ok: true,
      result: {
        link_id: res.link_id,
        simulation_run_id: payload.simulation_run_id,
        experiment_outcome_id: payload.experiment_outcome_id,
        idempotent_replay: Boolean(res.idempotent_replay),
      },
    };
  };
}
