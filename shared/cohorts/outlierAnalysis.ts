/**
 * Cohort-Relative Descriptive Outlier Analyzer — Pure Domain Module
 *
 * Invariants:
 *  - Pure, deterministic, and synchronous: zero database queries, zero network calls, zero AI model inference.
 *  - Admits ONLY normalized records with evidence_class = 'observed'.
 *  - Strict epistemic boundary: does NOT generate "viral scores", predictions, performance forecasts,
 *    causal explanations, winner designations, or statistical confidence over synthetic data.
 *  - Fails closed with typed 'insufficient_evidence' whenever sample size, citability, retention,
 *    metric comparability, denominator, or provenance requirements are unmet.
 *  - Preserves exact source/evidence provenance for every analyzed and flagged record.
 */

export const OUTLIER_POLICY_VERSION = "v1_tukey_median_iqr";
export const DEFAULT_MIN_COMPARABLE_OBSERVATIONS = 15;

export type CitabilityStatus =
  | "verified"
  | "citable_unverified"
  | "citable_stale"
  | "blocked"
  | "disconnected";

export interface ObservedCohortRecord {
  id: string;
  sourceId: string;
  evidenceClass: "observed" | "sourced" | "inference" | "simulation" | "unknown";
  metricKey: string;
  unit: string;
  calculationMethod: string;
  value: number;
  observedAt: string; // ISO-8601 string
  citability: CitabilityStatus;
  retentionUntil?: string | null; // ISO-8601 string or null
  denominator?: number | null;
  requiresDenominator?: boolean;
  provenance?: Record<string, unknown>;
}

export interface OutlierAnalysisOptions {
  cohortId: string;
  expectedMetricKey: string;
  expectedUnit: string;
  expectedCalculationMethod: string;
  minComparableObservations?: number; // default: 15
  referenceTime?: string; // ISO-8601 string for retention checks; defaults to now
  timeWindow?: {
    start: string; // ISO-8601 string
    end: string; // ISO-8601 string
  };
}

export interface RejectedRecordSummary {
  id: string;
  sourceId?: string;
  reason: string;
}

export interface DescriptiveStatistics {
  sampleSize: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  outlierThreshold: number;
  policy: string;
  zeroIqrHandled: boolean;
}

export interface FlaggedOutlierRecord {
  id: string;
  sourceId: string;
  evidenceClass: "observed";
  metricKey: string;
  unit: string;
  calculationMethod: string;
  value: number;
  observedAt: string;
  citability: CitabilityStatus;
  denominator: number | null;
  deltaAboveMedian: number;
  deltaAboveThreshold: number;
  provenance: Record<string, unknown>;
}

export interface ObservationWindow {
  earliest: string;
  latest: string;
}

export interface OutlierAnalysisSuccess {
  status: "success";
  cohortId: string;
  metricDefinition: {
    metricKey: string;
    unit: string;
    calculationMethod: string;
  };
  statistics: DescriptiveStatistics;
  observationWindow: ObservationWindow;
  flaggedOutliers: FlaggedOutlierRecord[];
  flaggedCount: number;
  rejectedRecords: RejectedRecordSummary[];
  knownGaps: string[];
}

export interface OutlierAnalysisInsufficientEvidence {
  status: "insufficient_evidence";
  cohortId: string;
  metricDefinition: {
    metricKey: string;
    unit: string;
    calculationMethod: string;
  };
  reason: string;
  validObservationCount: number;
  requiredMinimum: number;
  rejectedRecords: RejectedRecordSummary[];
  knownGaps: string[];
}

export type OutlierAnalysisResult =
  | OutlierAnalysisSuccess
  | OutlierAnalysisInsufficientEvidence;

/**
 * Calculates the median of an already sorted array of numbers.
 */
function calculateSortedMedian(sorted: number[]): number {
  const len = sorted.length;
  if (len === 0) return 0;
  const mid = Math.floor(len / 2);
  if (len % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Computes Tukey's hinges quartiles (Q1, Median, Q3) from a sorted array of numbers.
 * Method:
 *  - Odd length: Median is the center element; lower half is elements strictly before median;
 *    upper half is elements strictly after median.
 *  - Even length: Median is average of two center elements; lower half is first half;
 *    upper half is second half.
 *  - Q1 = median(lower half), Q3 = median(upper half).
 */
export function computeQuartiles(sorted: number[]): {
  median: number;
  q1: number;
  q3: number;
  iqr: number;
} {
  const len = sorted.length;
  if (len === 0) {
    return { median: 0, q1: 0, q3: 0, iqr: 0 };
  }

  const median = calculateSortedMedian(sorted);
  const mid = Math.floor(len / 2);

  let lowerHalf: number[];
  let upperHalf: number[];

  if (len % 2 === 1) {
    lowerHalf = sorted.slice(0, mid);
    upperHalf = sorted.slice(mid + 1);
  } else {
    lowerHalf = sorted.slice(0, mid);
    upperHalf = sorted.slice(mid);
  }

  const q1 = lowerHalf.length > 0 ? calculateSortedMedian(lowerHalf) : median;
  const q3 = upperHalf.length > 0 ? calculateSortedMedian(upperHalf) : median;
  const iqr = q3 - q1;

  return { median, q1, q3, iqr };
}

/**
 * Pure analyzer for cohort-relative descriptive outliers.
 */
export function analyzeCohortOutliers(
  records: ObservedCohortRecord[],
  options: OutlierAnalysisOptions
): OutlierAnalysisResult {
  const minRequired =
    options.minComparableObservations ?? DEFAULT_MIN_COMPARABLE_OBSERVATIONS;
  const metricDef = {
    metricKey: options.expectedMetricKey,
    unit: options.expectedUnit,
    calculationMethod: options.expectedCalculationMethod,
  };

  const refTime = options.referenceTime
    ? new Date(options.referenceTime).getTime()
    : Date.now();

  const timeWindowStart = options.timeWindow?.start
    ? new Date(options.timeWindow.start).getTime()
    : null;
  const timeWindowEnd = options.timeWindow?.end
    ? new Date(options.timeWindow.end).getTime()
    : null;

  if (
    (timeWindowStart !== null && Number.isNaN(timeWindowStart)) ||
    (timeWindowEnd !== null && Number.isNaN(timeWindowEnd)) ||
    (timeWindowStart !== null &&
      timeWindowEnd !== null &&
      timeWindowStart > timeWindowEnd)
  ) {
    return {
      status: "insufficient_evidence",
      cohortId: options.cohortId,
      metricDefinition: metricDef,
      reason: "Configured analysis time window is invalid or corrupted.",
      validObservationCount: 0,
      requiredMinimum: minRequired,
      rejectedRecords: [],
      knownGaps: ["Invalid time window bounds specified in options."],
    };
  }

  const rejectedRecords: RejectedRecordSummary[] = [];
  const validRecords: ObservedCohortRecord[] = [];
  const seenIds = new Set<string>();

  for (const record of records) {
    // Deduplication check: idempotent handling of duplicate IDs
    if (!record.id || record.id.trim() === "") {
      rejectedRecords.push({
        id: "unknown_id",
        sourceId: record.sourceId,
        reason: "Record missing unique identifier.",
      });
      continue;
    }

    if (seenIds.has(record.id)) {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: "Duplicate observation identifier in input batch.",
      });
      continue;
    }
    seenIds.add(record.id);

    // 1. Evidence class gate: ONLY 'observed' is admitted
    if (record.evidenceClass !== "observed") {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Admissibility rejection: evidence_class must be 'observed', found '${record.evidenceClass}'. Simulation, inference, and synthetic data are excluded.`,
      });
      continue;
    }

    // 2. Metric definition comparability checks
    if (record.metricKey !== options.expectedMetricKey) {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Metric key mismatch: expected '${options.expectedMetricKey}', got '${record.metricKey}'.`,
      });
      continue;
    }

    if (record.unit !== options.expectedUnit) {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Unit mismatch: expected '${options.expectedUnit}', got '${record.unit}'.`,
      });
      continue;
    }

    if (record.calculationMethod !== options.expectedCalculationMethod) {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Calculation method mismatch: expected '${options.expectedCalculationMethod}', got '${record.calculationMethod}'.`,
      });
      continue;
    }

    // 3. Source identity and citability checks
    if (!record.sourceId || record.sourceId.trim() === "") {
      rejectedRecords.push({
        id: record.id,
        reason: "Missing source identity: observation lacks traceable source_id.",
      });
      continue;
    }

    if (record.citability === "blocked" || record.citability === "disconnected") {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Source citability status '${record.citability}' prohibits inclusion in verified cohort analysis.`,
      });
      continue;
    }

    // 4. Retention check
    if (record.retentionUntil) {
      const retentionMs = new Date(record.retentionUntil).getTime();
      if (!Number.isNaN(retentionMs) && retentionMs < refTime) {
        rejectedRecords.push({
          id: record.id,
          sourceId: record.sourceId,
          reason: `Observation retention period expired on ${record.retentionUntil}.`,
        });
        continue;
      }
    }

    // 5. Value validity
    if (typeof record.value !== "number" || !Number.isFinite(record.value)) {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Non-finite metric value: ${String(record.value)}.`,
      });
      continue;
    }

    // 6. Denominator / sample size metadata
    if (record.requiresDenominator) {
      if (
        record.denominator === null ||
        record.denominator === undefined ||
        typeof record.denominator !== "number" ||
        !Number.isFinite(record.denominator) ||
        record.denominator <= 0
      ) {
        rejectedRecords.push({
          id: record.id,
          sourceId: record.sourceId,
          reason:
            "Required rate metric denominator is missing, non-finite, or non-positive.",
        });
        continue;
      }
    }

    // 7. Observation timestamp and time window check
    const obsTime = new Date(record.observedAt).getTime();
    if (Number.isNaN(obsTime)) {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Corrupted observed_at timestamp: '${record.observedAt}'.`,
      });
      continue;
    }

    if (timeWindowStart !== null && obsTime < timeWindowStart) {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Observation observed_at (${record.observedAt}) precedes window start (${options.timeWindow?.start}).`,
      });
      continue;
    }

    if (timeWindowEnd !== null && obsTime > timeWindowEnd) {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Observation observed_at (${record.observedAt}) exceeds window end (${options.timeWindow?.end}).`,
      });
      continue;
    }

    validRecords.push(record);
  }

  // Sample size check
  if (validRecords.length < minRequired) {
    return {
      status: "insufficient_evidence",
      cohortId: options.cohortId,
      metricDefinition: metricDef,
      reason: `Insufficient comparable observations: found ${validRecords.length} valid records, but policy requires minimum ${minRequired}.`,
      validObservationCount: validRecords.length,
      requiredMinimum: minRequired,
      rejectedRecords,
      knownGaps: [
        `Sample size (${validRecords.length}) below statistical threshold (${minRequired}) for cohort '${options.cohortId}'.`,
      ],
    };
  }

  // Sort values ascending for quartile computations
  const sortedValues = validRecords.map((r) => r.value).sort((a, b) => a - b);
  const { median, q1, q3, iqr } = computeQuartiles(sortedValues);

  // Policy: Outlier threshold = median + 1.5 * IQR
  // Special case: When IQR == 0 (e.g. tight cluster or identical values):
  //  - threshold = median
  //  - values strictly greater than median (and above threshold) are outliers.
  //  - If all values are identical, max === median === threshold, so 0 outliers are flagged.
  const zeroIqrHandled = iqr === 0;
  const outlierThreshold = median + 1.5 * iqr;

  // Compute observation window span
  const timestamps = validRecords.map((r) => new Date(r.observedAt).getTime());
  const earliest = new Date(Math.min(...timestamps)).toISOString();
  const latest = new Date(Math.max(...timestamps)).toISOString();

  // Flag high-side outliers: must be STRICTLY GREATER than outlierThreshold
  const flaggedOutliers: FlaggedOutlierRecord[] = [];

  for (const rec of validRecords) {
    if (rec.value > outlierThreshold) {
      flaggedOutliers.push({
        id: rec.id,
        sourceId: rec.sourceId,
        evidenceClass: "observed",
        metricKey: rec.metricKey,
        unit: rec.unit,
        calculationMethod: rec.calculationMethod,
        value: rec.value,
        observedAt: rec.observedAt,
        citability: rec.citability,
        denominator: rec.denominator ?? null,
        deltaAboveMedian: Number((rec.value - median).toFixed(6)),
        deltaAboveThreshold: Number((rec.value - outlierThreshold).toFixed(6)),
        provenance: rec.provenance ?? {},
      });
    }
  }

  // Sort flagged outliers descending by value (highest observations first)
  flaggedOutliers.sort((a, b) => b.value - a.value);

  return {
    status: "success",
    cohortId: options.cohortId,
    metricDefinition: metricDef,
    statistics: {
      sampleSize: validRecords.length,
      median,
      q1,
      q3,
      iqr,
      outlierThreshold,
      policy: OUTLIER_POLICY_VERSION,
      zeroIqrHandled,
    },
    observationWindow: {
      earliest,
      latest,
    },
    flaggedOutliers,
    flaggedCount: flaggedOutliers.length,
    rejectedRecords,
    knownGaps:
      rejectedRecords.length > 0
        ? [`${rejectedRecords.length} records excluded from calculation due to validation failures.`]
        : [],
  };
}
