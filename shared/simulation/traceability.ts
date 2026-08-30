/**
 * Post-Hoc Observed Traceability Module for Counterfactual Simulation Lab.
 *
 * Connects real physical experiment outcomes to prior simulation runs for provenance and traceability.
 * Invariant: Traceability only in v1—strictly forbids computing accuracy, variance, lift,
 * or prediction error against simulated estimates.
 * Invariant: Preserves the simulation run's evidence_class = 'simulation'.
 */

import type { SimulationObservedTrace, SimulationRun } from "./types.js";

export interface CreateTraceLinkRequest {
  simulationRun: SimulationRun;
  experimentOutcomeId: string;
  actorUserId: string;
}

export interface TraceLinkResult {
  success: boolean;
  errors: readonly string[];
  traceLink: SimulationObservedTrace | null;
  updatedSimulationRun: SimulationRun | null;
}

/**
 * Creates a post-hoc traceability link between an existing simulation run and an empirical outcome.
 */
export function createObservedTraceLink(
  request: CreateTraceLinkRequest
): TraceLinkResult {
  const { simulationRun, experimentOutcomeId, actorUserId } = request;

  if (!simulationRun) {
    return {
      success: false,
      errors: ["Missing simulation run to link."],
      traceLink: null,
      updatedSimulationRun: null,
    };
  }

  if (!experimentOutcomeId || experimentOutcomeId.trim().length === 0) {
    return {
      success: false,
      errors: ["Missing experimentOutcomeId."],
      traceLink: null,
      updatedSimulationRun: null,
    };
  }

  if (!actorUserId || actorUserId.trim().length === 0) {
    return {
      success: false,
      errors: ["Missing actorUserId."],
      traceLink: null,
      updatedSimulationRun: null,
    };
  }

  const traceId = `trace-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const traceLink: SimulationObservedTrace = {
    traceId,
    simulationRunId: simulationRun.simulationRunId,
    experimentOutcomeId,
    linkedByUserId: actorUserId,
    linkedAt: now,
  };

  // Clone simulation run and update observedValidation status while keeping evidence_class = 'simulation'
  const updatedSimulationRun: SimulationRun = {
    ...simulationRun,
    observedValidation: "linked",
    // CRITICAL INVARIANT: Evidence class remains strictly 'simulation'!
    evidenceClass: "simulation",
  };

  return {
    success: true,
    errors: [],
    traceLink,
    updatedSimulationRun,
  };
}
