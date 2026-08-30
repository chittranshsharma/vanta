/**
 * Publishing Schedule Optimizer — Observed-History Summarizer (Pure Domain Module)
 *
 * Invariants:
 *  - Pure, deterministic, and synchronous: zero database calls, zero network requests, zero AI models.
 *  - Answers ONLY: "Within this declared workspace/cohort/platform/metric/time-window and the available
 *    observed history, which configured time buckets had the strongest observed metric values?"
 *  - Strict non-goals: NEVER asserts a "best time to post", an algorithmic preference, a predicted reach,
 *    a guaranteed engagement time, a causal claim, or a viral/ROI forecast.
 *  - Fails closed with typed 'insufficient_evidence' whenever total sample size, per-bucket sample size,
 *    timezone validity, metric comparability, citability, retention, or provenance requirements are unmet.
 *  - Preserves exact source/evidence provenance and explicit rejection reasons for every input row.
 */

import { computeQuartiles } from "../cohorts/outlierAnalysis.js";
import { isValidTimeZone, WEEKDAY_NAMES } from "./history.js";

export const SCHEDULE_OPTIMIZER_POLICY = "v1_observed_history_bucket_summary";
export const DEFAULT_MIN_TOTAL_OBSERVATIONS = 20;
export const DEFAULT_MIN_OBSERVATIONS_PER_BUCKET = 3;

export type BucketResolution = "hour_of_day" | "weekday_and_hour" | "day_of_week";

export type CitabilityStatus =
  | "verified"
  | "citable_unverified"
  | "citable_stale"
  | "blocked"
  | "disconnected";

export interface ObservedPublicationRecord {
  id: string;
  sourceId: string;
  evidenceClass: "observed" | "sourced" | "inference" | "simulation" | "unknown";
  metricKey: string;
  unit: string;
  calculationMethod: string;
  value: number;
  publishedAt: string; // ISO-8601 string
  citability: CitabilityStatus;
  platform?: string | null;
  cohortId?: string | null;
  twinId?: string | null;
  variantTwinId?: string | null;
  retentionUntil?: string | null;
  denominator?: number | null;
  requiresDenominator?: boolean;
  provenance?: Record<string, unknown>;
}

export interface ScheduleOptimizerOptions {
  workspaceId: string;
  timeZone: string; // IANA timezone e.g. "America/New_York", "UTC"
  expectedMetricKey: string;
  expectedUnit: string;
  expectedCalculationMethod: string;
  bucketResolution?: BucketResolution; // default: "hour_of_day"
  targetPlatform?: string;
  targetCohortId?: string;
  targetSourceId?: string;
  minTotalObservations?: number; // default: 20
  minObservationsPerBucket?: number; // default: 3
  referenceTime?: string; // ISO-8601 string for retention checks; defaults to now
  timeWindow?: {
    start: string; // ISO-8601 string
    end: string; // ISO-8601 string
  };
}

export interface RejectedPublicationSummary {
  id: string;
  sourceId?: string;
  reason: string;
}

export interface TimeBucketDescriptiveSummary {
  bucketKey: string;
  displayLabel: string;
  hour?: number;
  weekday?: number;
  observationCount: number;
  medianValue: number;
  q1: number;
  q3: number;
  iqr: number;
  minValue: number;
  maxValue: number;
  observationWindow: {
    earliest: string;
    latest: string;
  };
  sampleMeetsThreshold: boolean;
  recordIds: string[];
}

export interface ScheduleOptimizerSuccess {
  status: "success";
  workspaceId: string;
  cohortId?: string;
  platform?: string;
  timeZone: string;
  bucketResolution: BucketResolution;
  metricDefinition: {
    metricKey: string;
    unit: string;
    calculationMethod: string;
  };
  statistics: {
    totalAcceptedObservations: number;
    totalBucketsWithObservations: number;
    eligibleBucketsCount: number;
    policy: string;
  };
  observationWindow: {
    earliest: string;
    latest: string;
  };
  buckets: TimeBucketDescriptiveSummary[];
  comparisonStatus: "comparable" | "single_eligible_bucket" | "tied";
  highestObservedBuckets: TimeBucketDescriptiveSummary[];
  comparisonNote: string;
  rejectedRecords: RejectedPublicationSummary[];
  knownGaps: string[];
}

export interface ScheduleOptimizerInsufficientEvidence {
  status: "insufficient_evidence";
  workspaceId: string;
  cohortId?: string;
  timeZone: string;
  metricDefinition: {
    metricKey: string;
    unit: string;
    calculationMethod: string;
  };
  reason: string;
  validObservationCount: number;
  requiredMinimum: number;
  rejectedRecords: RejectedPublicationSummary[];
  knownGaps: string[];
}

export type ScheduleOptimizerResult =
  | ScheduleOptimizerSuccess
  | ScheduleOptimizerInsufficientEvidence;

/**
 * Extracts wall-clock hour (0..23) and weekday (0..6, Sunday=0) for an instant in the specified timezone.
 * Uses Intl.DateTimeFormat parts so local DST and offset rules are honored faithfully.
 */
function extractWallClockParts(
  d: Date,
  timeZone: string
): { hour: number; weekday: number } | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    });

    const parts = new Map(formatter.formatToParts(d).map((p) => [p.type, p.value]));
    const year = Number(parts.get("year"));
    const month = Number(parts.get("month"));
    const day = Number(parts.get("day"));
    const rawHour = Number(parts.get("hour"));

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      !Number.isFinite(rawHour)
    ) {
      return null;
    }

    const hour = rawHour === 24 ? 0 : rawHour;
    // Weekday in local timezone from the year, month, day components
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

    return { hour, weekday };
  } catch {
    return null;
  }
}

/**
 * Pure analyzer for optimizing/summarizing publication schedules from historical observed data.
 */
export function optimizePublishingSchedule(
  records: ObservedPublicationRecord[],
  options: ScheduleOptimizerOptions
): ScheduleOptimizerResult {
  const minTotal = options.minTotalObservations ?? DEFAULT_MIN_TOTAL_OBSERVATIONS;
  const minPerBucket =
    options.minObservationsPerBucket ?? DEFAULT_MIN_OBSERVATIONS_PER_BUCKET;
  const resolution: BucketResolution = options.bucketResolution ?? "hour_of_day";

  const metricDef = {
    metricKey: options.expectedMetricKey,
    unit: options.expectedUnit,
    calculationMethod: options.expectedCalculationMethod,
  };

  // 1. Timezone validity check
  if (!isValidTimeZone(options.timeZone)) {
    return {
      status: "insufficient_evidence",
      workspaceId: options.workspaceId,
      cohortId: options.targetCohortId,
      timeZone: options.timeZone,
      metricDefinition: metricDef,
      reason: `Configured workspace timezone '${options.timeZone}' is invalid or unrecognized by the runtime.`,
      validObservationCount: 0,
      requiredMinimum: minTotal,
      rejectedRecords: [],
      knownGaps: [`Invalid IANA timezone string: '${options.timeZone}'.`],
    };
  }

  // 2. Time window validity check
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
      workspaceId: options.workspaceId,
      cohortId: options.targetCohortId,
      timeZone: options.timeZone,
      metricDefinition: metricDef,
      reason: "Configured observation time window is invalid (start > end or unparseable dates).",
      validObservationCount: 0,
      requiredMinimum: minTotal,
      rejectedRecords: [],
      knownGaps: ["Invalid time window bounds specified in options."],
    };
  }

  const refTime = options.referenceTime
    ? new Date(options.referenceTime).getTime()
    : Date.now();

  const rejectedRecords: RejectedPublicationSummary[] = [];
  const validRecords: Array<
    ObservedPublicationRecord & { localHour: number; localWeekday: number }
  > = [];
  const seenIds = new Set<string>();

  // 3. Validation & Admissibility Pipeline
  for (const record of records) {
    // Unique ID check
    if (!record.id || record.id.trim() === "") {
      rejectedRecords.push({
        id: "unknown_id",
        sourceId: record.sourceId,
        reason: "Publication record missing unique identifier.",
      });
      continue;
    }

    if (seenIds.has(record.id)) {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: "Duplicate publication record identifier in input batch.",
      });
      continue;
    }
    seenIds.add(record.id);

    // Evidence class gate
    if (record.evidenceClass !== "observed") {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Admissibility rejection: evidence_class must be 'observed', found '${record.evidenceClass}'. Simulation, inference, and synthetic data are excluded.`,
      });
      continue;
    }

    // Metric definition comparability
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

    // Source identity & citability
    if (!record.sourceId || record.sourceId.trim() === "") {
      rejectedRecords.push({
        id: record.id,
        reason: "Missing source identity: publication record lacks traceable source_id.",
      });
      continue;
    }

    if (record.citability === "blocked" || record.citability === "disconnected") {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Source citability status '${record.citability}' prohibits inclusion in schedule analysis.`,
      });
      continue;
    }

    // Cohort filter match (if specified)
    if (options.targetCohortId && record.cohortId !== options.targetCohortId) {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Cohort mismatch: record cohortId '${record.cohortId ?? "none"}' does not match target '${options.targetCohortId}'.`,
      });
      continue;
    }

    // Platform filter match (if specified)
    if (options.targetPlatform && record.platform !== options.targetPlatform) {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Platform mismatch: record platform '${record.platform ?? "none"}' does not match target '${options.targetPlatform}'.`,
      });
      continue;
    }

    // Source ID filter match (if specified)
    if (options.targetSourceId && record.sourceId !== options.targetSourceId) {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Source mismatch: record sourceId '${record.sourceId}' does not match target '${options.targetSourceId}'.`,
      });
      continue;
    }

    // Retention check
    if (record.retentionUntil) {
      const retentionMs = new Date(record.retentionUntil).getTime();
      if (!Number.isNaN(retentionMs) && retentionMs < refTime) {
        rejectedRecords.push({
          id: record.id,
          sourceId: record.sourceId,
          reason: `Publication observation retention period expired on ${record.retentionUntil}.`,
        });
        continue;
      }
    }

    // Value validity
    if (typeof record.value !== "number" || !Number.isFinite(record.value)) {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Non-finite metric value: ${String(record.value)}.`,
      });
      continue;
    }

    // Denominator metadata (if required)
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
          reason: "Required rate metric denominator is missing, non-finite, or non-positive.",
        });
        continue;
      }
    }

    // Publication timestamp and window check
    const pubTime = new Date(record.publishedAt).getTime();
    if (Number.isNaN(pubTime)) {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Corrupted published_at timestamp: '${record.publishedAt}'.`,
      });
      continue;
    }

    if (timeWindowStart !== null && pubTime < timeWindowStart) {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Publication time (${record.publishedAt}) precedes window start (${options.timeWindow?.start}).`,
      });
      continue;
    }

    if (timeWindowEnd !== null && pubTime > timeWindowEnd) {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Publication time (${record.publishedAt}) exceeds window end (${options.timeWindow?.end}).`,
      });
      continue;
    }

    // Local timezone conversion
    const wallClock = extractWallClockParts(new Date(pubTime), options.timeZone);
    if (!wallClock) {
      rejectedRecords.push({
        id: record.id,
        sourceId: record.sourceId,
        reason: `Failed to convert timestamp '${record.publishedAt}' into target timezone '${options.timeZone}'.`,
      });
      continue;
    }

    validRecords.push({
      ...record,
      localHour: wallClock.hour,
      localWeekday: wallClock.weekday,
    });
  }

  // 4. Sample Size Check
  if (validRecords.length < minTotal) {
    return {
      status: "insufficient_evidence",
      workspaceId: options.workspaceId,
      cohortId: options.targetCohortId,
      timeZone: options.timeZone,
      metricDefinition: metricDef,
      reason: `Insufficient comparable publication observations: found ${validRecords.length} valid records, but policy requires minimum ${minTotal}.`,
      validObservationCount: validRecords.length,
      requiredMinimum: minTotal,
      rejectedRecords,
      knownGaps: [
        `Total sample size (${validRecords.length}) below minimum required (${minTotal}) for workspace '${options.workspaceId}'.`,
      ],
    };
  }

  // 5. Group records into configured time buckets
  const bucketMap = new Map<
    string,
    {
      bucketKey: string;
      displayLabel: string;
      hour?: number;
      weekday?: number;
      records: typeof validRecords;
    }
  >();

  for (const rec of validRecords) {
    let bKey: string;
    let bLabel: string;
    let bHour: number | undefined;
    let bWeekday: number | undefined;

    if (resolution === "hour_of_day") {
      bHour = rec.localHour;
      bKey = String(bHour).padStart(2, "0");
      bLabel = `${bKey}:00 ${options.timeZone}`;
    } else if (resolution === "weekday_and_hour") {
      bHour = rec.localHour;
      bWeekday = rec.localWeekday;
      const dayName = WEEKDAY_NAMES[bWeekday] ?? "Unknown";
      const hourStr = String(bHour).padStart(2, "0");
      bKey = `${dayName}-${hourStr}`;
      bLabel = `${dayName} ${hourStr}:00 ${options.timeZone}`;
    } else {
      // "day_of_week"
      bWeekday = rec.localWeekday;
      const dayName = WEEKDAY_NAMES[bWeekday] ?? "Unknown";
      bKey = dayName;
      bLabel = `${dayName} ${options.timeZone}`;
    }

    const existing = bucketMap.get(bKey);
    if (existing) {
      existing.records.push(rec);
    } else {
      bucketMap.set(bKey, {
        bucketKey: bKey,
        displayLabel: bLabel,
        hour: bHour,
        weekday: bWeekday,
        records: [rec],
      });
    }
  }

  // 6. Compute statistics per bucket
  const bucketSummaries: TimeBucketDescriptiveSummary[] = [];

  for (const [, group] of bucketMap.entries()) {
    const sortedValues = group.records
      .map((r) => r.value)
      .sort((a, b) => a - b);
    const { median, q1, q3, iqr } = computeQuartiles(sortedValues);

    const timestamps = group.records.map((r) => new Date(r.publishedAt).getTime());
    const earliest = new Date(Math.min(...timestamps)).toISOString();
    const latest = new Date(Math.max(...timestamps)).toISOString();

    bucketSummaries.push({
      bucketKey: group.bucketKey,
      displayLabel: group.displayLabel,
      hour: group.hour,
      weekday: group.weekday,
      observationCount: group.records.length,
      medianValue: median,
      q1,
      q3,
      iqr,
      minValue: sortedValues[0],
      maxValue: sortedValues[sortedValues.length - 1],
      observationWindow: { earliest, latest },
      sampleMeetsThreshold: group.records.length >= minPerBucket,
      recordIds: group.records.map((r) => r.id),
    });
  }

  // Sort bucket summaries chronologically (by weekday then hour if present, else by bucketKey)
  bucketSummaries.sort((a, b) => {
    if (a.weekday !== undefined && b.weekday !== undefined) {
      if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    }
    if (a.hour !== undefined && b.hour !== undefined) {
      return a.hour - b.hour;
    }
    return a.bucketKey.localeCompare(b.bucketKey);
  });

  // Filter to eligible buckets meeting per-bucket sample size threshold
  const eligibleBuckets = bucketSummaries.filter((b) => b.sampleMeetsThreshold);

  // 7. Comparative Evaluation
  let comparisonStatus: "comparable" | "single_eligible_bucket" | "tied";
  let highestObservedBuckets: TimeBucketDescriptiveSummary[];
  let comparisonNote: string;

  if (eligibleBuckets.length === 0) {
    // Insufficient per-bucket observations to support any reliable comparison
    return {
      status: "insufficient_evidence",
      workspaceId: options.workspaceId,
      cohortId: options.targetCohortId,
      timeZone: options.timeZone,
      metricDefinition: metricDef,
      reason: `No time bucket met the per-bucket sample size threshold (minimum ${minPerBucket} observations required per bucket).`,
      validObservationCount: validRecords.length,
      requiredMinimum: minTotal,
      rejectedRecords,
      knownGaps: [
        `Observations are too sparsely distributed across time buckets. Minimum ${minPerBucket} observations per bucket required for comparative evaluation.`,
      ],
    };
  }

  if (eligibleBuckets.length === 1) {
    comparisonStatus = "single_eligible_bucket";
    highestObservedBuckets = [eligibleBuckets[0]];
    comparisonNote =
      "Only one time bucket met the minimum sample size threshold. Cross-bucket comparison across multiple time windows is unavailable.";
  } else {
    // Sort eligible buckets descending by median value
    const sortedEligible = [...eligibleBuckets].sort(
      (a, b) => b.medianValue - a.medianValue
    );
    const maxMedian = sortedEligible[0].medianValue;

    // Check for ties within numeric precision
    const tiedBuckets = sortedEligible.filter(
      (b) => Math.abs(b.medianValue - maxMedian) < 1e-9
    );

    if (tiedBuckets.length > 1) {
      comparisonStatus = "tied";
      highestObservedBuckets = tiedBuckets;
      comparisonNote = `Multiple time buckets (${tiedBuckets.length}) tied for highest historical observed median metric value (${maxMedian} ${options.expectedUnit}).`;
    } else {
      comparisonStatus = "comparable";
      highestObservedBuckets = [sortedEligible[0]];
      comparisonNote = `Identified time bucket '${sortedEligible[0].displayLabel}' with highest historical observed median metric value (${sortedEligible[0].medianValue} ${options.expectedUnit}).`;
    }
  }

  // Compute total observation span
  const allTimestamps = validRecords.map((r) => new Date(r.publishedAt).getTime());
  const earliest = new Date(Math.min(...allTimestamps)).toISOString();
  const latest = new Date(Math.max(...allTimestamps)).toISOString();

  return {
    status: "success",
    workspaceId: options.workspaceId,
    cohortId: options.targetCohortId,
    platform: options.targetPlatform,
    timeZone: options.timeZone,
    bucketResolution: resolution,
    metricDefinition: metricDef,
    statistics: {
      totalAcceptedObservations: validRecords.length,
      totalBucketsWithObservations: bucketSummaries.length,
      eligibleBucketsCount: eligibleBuckets.length,
      policy: SCHEDULE_OPTIMIZER_POLICY,
    },
    observationWindow: { earliest, latest },
    buckets: bucketSummaries,
    comparisonStatus,
    highestObservedBuckets,
    comparisonNote,
    rejectedRecords,
    knownGaps:
      rejectedRecords.length > 0
        ? [`${rejectedRecords.length} publication records excluded due to comparability or citability rejections.`]
        : [],
  };
}
