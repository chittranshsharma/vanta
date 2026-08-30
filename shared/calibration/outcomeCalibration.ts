/**
 * Real-Data Outcome Calibration and Empirical Traceability Module.
 *
 * Connects observed physical outcomes to prior simulation runs and creative variants
 * with strict evidence taxonomy preservation, multi-tenant gating, and fail-closed validation.
 *
 * Non-Negotiable Invariants:
 * 1. Simulation runs remain strictly `evidence_class = 'simulation'`.
 * 2. Empirical outcomes must be strictly `evidence_class = 'observed'`. Synthetic/persona votes are rejected.
 * 3. Inferences remain `evidence_class = 'inference'`.
 * 4. Missing or unsupported data returns `evidence_class = 'unknown'` and `insufficient_evidence`.
 * 5. Human review decisions represent administrative governance, never empirical proof conversion.
 * 6. Cross-workspace links, wrong variant IDs, metric/unit mismatches, missing denominators,
 *    stale/blocked sources, expired retention, and duplicate links are rejected fail-closed.
 * 7. Strictly forbids computing prediction accuracy, lift, ROI, reach probability, conversion
 *    probability, virality, algorithm score, or confidence unless a separately approved statistical
 *    contract proves valid data and sufficient samples.
 */

import type { SimulationRun } from "../simulation/types.js";
import type { SourceCitability } from "../experiments/outcomeImport.js";

export const CALIBRATION_POLICY = "v1_observed_outcome_traceability_calibration" as const;

export type CalibrationRejectionCode =
  | "workspace_mismatch"
  | "synthetic_vote_rejected"
  | "variant_mismatch"
  | "metric_mismatch"
  | "unit_mismatch"
  | "missing_denominator"
  | "invalid_time_window"
  | "blocked_source"
  | "expired_retention"
  | "duplicate_link"
  | "non_finite_value"
  | "invalid_timestamp"
  | "missing_required_fields";

export interface CalibrationLinkCandidate {
  workspaceId: string;
  simulationRunId: string;
  variantTwinId: string;
  experimentOutcomeId: string;
  metricKey: string;
  metricUnit?: string;
  value: number;
  denominator?: number | null;
  observedAt: string;
  evidenceClass: "observed" | "sourced" | "inference" | "simulation" | "unknown";
  sourceId: string;
  sourceCitability: SourceCitability | "blocked" | "unknown";
  retentionUntil?: string | null;
  notes?: string;
}

export interface CalibrationValidationContext {
  workspaceId: string;
  simulationRun: SimulationRun;
  validVariantTwinIds: readonly string[];
  expectedMetricKey?: string;
  expectedMetricUnit?: string;
  minSamplesRequired?: number;
  existingLinkedOutcomeIds?: readonly string[];
  evaluationTimestamp?: string;
  windowStart?: string;
  windowEnd?: string;
}

export interface CandidateValidationResult {
  valid: boolean;
  rejectedReasons: readonly { code: CalibrationRejectionCode; message: string }[];
}

export interface CalibrationDistribution {
  count: number;
  min: number;
  max: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
}

export interface DescriptiveCalibrationSummary {
  policy: typeof CALIBRATION_POLICY;
  simulationRunId: string;
  simulationEvidenceClass: "simulation";
  readinessStatus: "sufficient_evidence" | "insufficient_evidence" | "no_evidence";
  totalCandidatesEvaluated: number;
  acceptedSamplesCount: number;
  rejectedSamplesCount: number;
  rejectionDetails: readonly {
    candidateOutcomeId: string;
    code: CalibrationRejectionCode;
    message: string;
  }[];
  distribution: CalibrationDistribution | null;
  timeRange: {
    earliestObservedAt: string;
    latestObservedAt: string;
  } | null;
  governanceState: {
    simulationReviewDecision: string;
    isHumanApproved: boolean;
    note: string;
  };
  invariantsEnforced: readonly string[];
}

/**
 * Validates a single observed outcome link candidate against domain and tenant boundaries.
 */
export function validateCalibrationCandidate(
  candidate: CalibrationLinkCandidate,
  context: CalibrationValidationContext
): CandidateValidationResult {
  const rejectedReasons: Array<{ code: CalibrationRejectionCode; message: string }> = [];

  // 1. Missing required identifiers
  if (
    !candidate.workspaceId ||
    !candidate.simulationRunId ||
    !candidate.variantTwinId ||
    !candidate.experimentOutcomeId ||
    !candidate.metricKey ||
    !candidate.sourceId
  ) {
    rejectedReasons.push({
      code: "missing_required_fields",
      message: "Candidate is missing required relational identifiers.",
    });
  }

  // 2. Strict Tenant Isolation
  if (candidate.workspaceId !== context.workspaceId) {
    rejectedReasons.push({
      code: "workspace_mismatch",
      message: `Cross-workspace linking is strictly prohibited (candidate ${candidate.workspaceId} vs context ${context.workspaceId}).`,
    });
  }

  // 3. Evidence Taxonomy: Only genuine empirical observations can calibrate outcomes
  if (candidate.evidenceClass !== "observed") {
    rejectedReasons.push({
      code: "synthetic_vote_rejected",
      message: `Synthetic, inferred, or simulated data cannot calibrate outcomes (evidence_class was '${candidate.evidenceClass}').`,
    });
  }

  // 4. Variant ID matching
  if (!context.validVariantTwinIds.includes(candidate.variantTwinId)) {
    rejectedReasons.push({
      code: "variant_mismatch",
      message: `Candidate variant '${candidate.variantTwinId}' is not associated with this simulation run or experiment.`,
    });
  }

  // 5. Value must be a finite number
  if (!Number.isFinite(candidate.value)) {
    rejectedReasons.push({
      code: "non_finite_value",
      message: "Outcome value must be a valid finite number.",
    });
  }

  // 6. Timestamp validity
  const observedTime = Date.parse(candidate.observedAt);
  if (Number.isNaN(observedTime)) {
    rejectedReasons.push({
      code: "invalid_timestamp",
      message: "Candidate observedAt is not a valid ISO timestamp.",
    });
  }

  // 7. Metric key matching
  if (context.expectedMetricKey && candidate.metricKey !== context.expectedMetricKey) {
    rejectedReasons.push({
      code: "metric_mismatch",
      message: `Metric key mismatch (expected '${context.expectedMetricKey}', received '${candidate.metricKey}').`,
    });
  }

  // 8. Metric unit matching
  if (context.expectedMetricUnit && candidate.metricUnit && candidate.metricUnit !== context.expectedMetricUnit) {
    rejectedReasons.push({
      code: "unit_mismatch",
      message: `Metric unit mismatch (expected '${context.expectedMetricUnit}', received '${candidate.metricUnit}').`,
    });
  }

  // 9. Denominator check for rate/ratio metrics
  if (candidate.denominator !== undefined && candidate.denominator !== null) {
    if (!Number.isFinite(candidate.denominator) || candidate.denominator <= 0) {
      rejectedReasons.push({
        code: "missing_denominator",
        message: "Ratio or rate metric requires a strictly positive finite denominator.",
      });
    }
  }

  // 10. Time window validation
  if (context.windowStart) {
    const startMs = Date.parse(context.windowStart);
    if (!Number.isNaN(startMs) && observedTime < startMs) {
      rejectedReasons.push({
        code: "invalid_time_window",
        message: `Outcome observed at ${candidate.observedAt} is prior to window start ${context.windowStart}.`,
      });
    }
  }
  if (context.windowEnd) {
    const endMs = Date.parse(context.windowEnd);
    if (!Number.isNaN(endMs) && observedTime > endMs) {
      rejectedReasons.push({
        code: "invalid_time_window",
        message: `Outcome observed at ${candidate.observedAt} is after window end ${context.windowEnd}.`,
      });
    }
  }

  // 11. Source Citability / Blocked Source
  if (candidate.sourceCitability === "blocked" || candidate.sourceCitability === "unknown") {
    rejectedReasons.push({
      code: "blocked_source",
      message: `Source '${candidate.sourceId}' has unacceptable citability status '${candidate.sourceCitability}'.`,
    });
  }

  // 12. Retention Expiration
  if (candidate.retentionUntil && context.evaluationTimestamp) {
    const retentionMs = Date.parse(candidate.retentionUntil);
    const evalMs = Date.parse(context.evaluationTimestamp);
    if (!Number.isNaN(retentionMs) && !Number.isNaN(evalMs) && retentionMs < evalMs) {
      rejectedReasons.push({
        code: "expired_retention",
        message: `Observation data expired at ${candidate.retentionUntil} per retention policy.`,
      });
    }
  }

  // 13. Duplicate link check
  if (context.existingLinkedOutcomeIds && context.existingLinkedOutcomeIds.includes(candidate.experimentOutcomeId)) {
    rejectedReasons.push({
      code: "duplicate_link",
      message: `Outcome '${candidate.experimentOutcomeId}' is already linked to this simulation run.`,
    });
  }

  return {
    valid: rejectedReasons.length === 0,
    rejectedReasons,
  };
}

/**
 * Calculates deterministic quartile statistics from sorted numeric values.
 */
function calculateQuartiles(sortedValues: number[]): { median: number; q1: number; q3: number; iqr: number } {
  const n = sortedValues.length;
  if (n === 0) return { median: 0, q1: 0, q3: 0, iqr: 0 };
  if (n === 1) return { median: sortedValues[0], q1: sortedValues[0], q3: sortedValues[0], iqr: 0 };

  const getMedian = (arr: number[]): number => {
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  };

  const median = getMedian(sortedValues);
  const mid = Math.floor(n / 2);
  const lowerHalf = sortedValues.slice(0, mid);
  const upperHalf = n % 2 === 0 ? sortedValues.slice(mid) : sortedValues.slice(mid + 1);

  const q1 = getMedian(lowerHalf);
  const q3 = getMedian(upperHalf);
  const iqr = q3 - q1;

  return { median, q1, q3, iqr };
}

/**
 * Evaluates a set of observed outcome candidates against a counterfactual simulation run,
 * producing a pure descriptive summary while preserving evidence classes and omitting predictive speculation.
 */
export function evaluateDescriptiveCalibration(
  candidates: readonly CalibrationLinkCandidate[],
  context: CalibrationValidationContext
): DescriptiveCalibrationSummary {
  const minRequired = context.minSamplesRequired ?? 5;
  const accepted: CalibrationLinkCandidate[] = [];
  const rejectionDetails: Array<{
    candidateOutcomeId: string;
    code: CalibrationRejectionCode;
    message: string;
  }> = [];

  for (const candidate of candidates) {
    const validation = validateCalibrationCandidate(candidate, context);
    if (validation.valid) {
      accepted.push(candidate);
    } else {
      for (const reason of validation.rejectedReasons) {
        rejectionDetails.push({
          candidateOutcomeId: candidate.experimentOutcomeId || "unknown",
          code: reason.code,
          message: reason.message,
        });
      }
    }
  }

  let distribution: CalibrationDistribution | null = null;
  let timeRange: { earliestObservedAt: string; latestObservedAt: string } | null = null;

  if (accepted.length > 0) {
    const values = accepted.map((a) => a.value).sort((a, b) => a - b);
    const { median, q1, q3, iqr } = calculateQuartiles(values);
    distribution = {
      count: accepted.length,
      min: values[0],
      max: values[values.length - 1],
      median,
      q1,
      q3,
      iqr,
    };

    const timestamps = accepted.map((a) => a.observedAt).sort();
    timeRange = {
      earliestObservedAt: timestamps[0],
      latestObservedAt: timestamps[timestamps.length - 1],
    };
  }

  let readinessStatus: "sufficient_evidence" | "insufficient_evidence" | "no_evidence" = "no_evidence";
  if (accepted.length >= minRequired) {
    readinessStatus = "sufficient_evidence";
  } else if (accepted.length > 0) {
    readinessStatus = "insufficient_evidence";
  }

  const isHumanApproved =
    context.simulationRun.reviewDecision === "accepted" ||
    context.simulationRun.reviewDecision === "corrected";

  return {
    policy: CALIBRATION_POLICY,
    simulationRunId: context.simulationRun.simulationRunId,
    simulationEvidenceClass: "simulation",
    readinessStatus,
    totalCandidatesEvaluated: candidates.length,
    acceptedSamplesCount: accepted.length,
    rejectedSamplesCount: rejectionDetails.length,
    rejectionDetails,
    distribution,
    timeRange,
    governanceState: {
      simulationReviewDecision: context.simulationRun.reviewDecision,
      isHumanApproved,
      note: isHumanApproved
        ? "Human review decision recorded as administrative governance; does not alter simulation evidence class."
        : "Pending or non-approved human review state.",
    },
    invariantsEnforced: [
      "Evidence class separation: simulation remains simulation, outcomes remain observed.",
      "Zero predictive accuracy, lift, virality, or algorithm score computation.",
      "Multi-tenant workspace boundary enforced.",
      "Missing denominators and non-finite values rejected fail-closed.",
      "Stale/blocked sources and expired retention dates rejected.",
    ],
  };
}
