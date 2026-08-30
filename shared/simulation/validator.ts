/**
 * Request Validator and Safety Gate for Counterfactual Simulation Lab.
 *
 * Ensures multi-tenant isolation, baseline integrity, bounded mutations,
 * and quota availability before any execution or model invocation.
 */

import type { CounterfactualMutation, CreativeTwinVersionSnapshot } from "./types.js";
import type { ApprovedBrandClaimContext } from "./mutations.js";

export interface SimulationRunRequest {
  workspaceId: string;
  actorUserId: string;
  baselineSnapshot: CreativeTwinVersionSnapshot;
  hypothesis: string;
  mutations: readonly CounterfactualMutation[];
  controls: readonly string[];
  approvedClaims?: readonly ApprovedBrandClaimContext[];
  quotaAvailable?: boolean;
}

export interface SimulationValidationResult {
  valid: boolean;
  errors: readonly string[];
}

export function validateSimulationRunRequest(
  request: SimulationRunRequest
): SimulationValidationResult {
  const errors: string[] = [];

  if (!request.workspaceId || request.workspaceId.trim().length === 0) {
    errors.push("Missing workspace identifier.");
  }

  if (!request.actorUserId || request.actorUserId.trim().length === 0) {
    errors.push("Missing actor user identifier.");
  }

  if (!request.hypothesis || request.hypothesis.trim().length === 0) {
    errors.push("An explicit counterfactual hypothesis is required.");
  } else if (request.hypothesis.length > 500) {
    errors.push("Hypothesis exceeds maximum length of 500 characters.");
  }

  if (!request.baselineSnapshot) {
    errors.push("Missing baseline Creative Twin snapshot.");
    return { valid: false, errors };
  }

  // Cross-tenant baseline verification
  if (
    request.workspaceId &&
    request.baselineSnapshot.workspaceId &&
    request.baselineSnapshot.workspaceId !== request.workspaceId
  ) {
    errors.push(
      `Cross-tenant baseline rejected: snapshot workspace "${request.baselineSnapshot.workspaceId}" does not match context workspace "${request.workspaceId}".`
    );
  }

  if (!request.baselineSnapshot.scenes || request.baselineSnapshot.scenes.length === 0) {
    errors.push("Baseline Creative Twin must contain at least one scene.");
  }

  if (!request.mutations || request.mutations.length === 0) {
    errors.push("At least one counterfactual mutation must be declared.");
  } else if (request.mutations.length > 5) {
    errors.push(`Maximum 5 mutations allowed per run. Declared: ${request.mutations.length}.`);
  }

  // Verify claim substitution references belong to same workspace
  if (request.mutations) {
    for (const mut of request.mutations) {
      if (mut.type === "claim_substitution") {
        const claim = (request.approvedClaims ?? []).find((c) => c.id === mut.substituteBrandClaimId);
        if (claim && claim.workspaceId !== request.workspaceId) {
          errors.push(
            `Cross-tenant claim rejected: claim "${mut.substituteBrandClaimId}" belongs to workspace "${claim.workspaceId}", not "${request.workspaceId}".`
          );
        }
      }
    }
  }

  // Fail closed if model quota is exhausted
  if (request.quotaAvailable === false) {
    errors.push("Workspace model quota exhausted or reset pending. Execution halted before model call.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
