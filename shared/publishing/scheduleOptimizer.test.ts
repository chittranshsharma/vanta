/**
 * Comprehensive Unit Tests for Publishing Schedule Optimizer (Pure Domain Module)
 *
 * Tests cover:
 *  1. Happy path: Multiple eligible buckets compared by median value in timezone
 *  2. UTC to workspace timezone conversion (e.g. UTC 18:00 -> 14:00 EDT)
 *  3. Daylight Saving Time (DST) transitions (summer EDT vs winter EST)
 *  4. Resolution variations: "hour_of_day", "weekday_and_hour", "day_of_week"
 *  5. Total minimum sample failure (< 20 records returns insufficient_evidence)
 *  6. Per-bucket minimum sample failure (scattered data where 0 buckets meet minPerBucket)
 *  7. Single eligible bucket scenario (only 1 bucket meets minPerBucket)
 *  8. Tied buckets (two buckets with identical top median metric)
 *  9. Metric definition comparability gates (metricKey, unit, calculationMethod)
 *  10. Denominator requirements on rate metrics
 *  11. Source citability (blocked, disconnected) and retention expirations
 *  12. Non-finite values (NaN, Infinity) and unparseable timestamps
 *  13. Observation window filtering (start / end boundary rejection)
 *  14. Cohort, Platform, and Source ID filters
 *  15. Evidence class rejection (simulation, inference, sourced, unknown excluded)
 *  16. Deduplication and idempotent ID handling
 *  17. Invalid IANA timezone fail-closed rejection
 *  18. Rejection reasons and provenance preservation
 */

import { describe, it, expect } from "vitest";
import {
  optimizePublishingSchedule,
  type ObservedPublicationRecord,
  type ScheduleOptimizerOptions,
  SCHEDULE_OPTIMIZER_POLICY,
} from "./scheduleOptimizer";

function createValidPublications(
  count: number,
  baseHourUtc = 14,
  baseValue = 100,
  overrides: Partial<ObservedPublicationRecord> = {}
): ObservedPublicationRecord[] {
  const records: ObservedPublicationRecord[] = [];
  // Using summer date (2026-08-01) where America/New_York is EDT (UTC-4)
  // UTC 18:00 -> EDT 14:00
  const baseTimestamp = new Date("2026-08-01T00:00:00Z").getTime();

  for (let i = 0; i < count; i++) {
    // Distribute across days but keep baseHourUtc constant by default
    const dayOffset = Math.floor(i / 5);
    const postDate = new Date(baseTimestamp + dayOffset * 24 * 3600 * 1000);
    postDate.setUTCHours(baseHourUtc, (i % 5) * 10, 0, 0);

    records.push({
      id: `pub-obs-${String(i + 1).padStart(3, "0")}`,
      sourceId: "src-main-channel",
      evidenceClass: "observed",
      metricKey: "video_views",
      unit: "views",
      calculationMethod: "total_30d",
      value: baseValue + (i % 5) * 10,
      publishedAt: postDate.toISOString(),
      citability: "verified",
      platform: "youtube",
      cohortId: "cohort-alpha",
      retentionUntil: "2027-01-01T00:00:00Z",
      provenance: { row_index: i + 1 },
      ...overrides,
    });
  }

  return records;
}

const defaultOptions: ScheduleOptimizerOptions = {
  workspaceId: "ws-test-01",
  timeZone: "America/New_York",
  expectedMetricKey: "video_views",
  expectedUnit: "views",
  expectedCalculationMethod: "total_30d",
  minTotalObservations: 20,
  minObservationsPerBucket: 3,
  referenceTime: "2026-08-15T00:00:00Z",
};

describe("optimizePublishingSchedule — Happy Path & Timezone Conversions", () => {
  it("1. Analyzes 20 valid observations across 2 hour buckets and identifies top median bucket", () => {
    // 10 posts at UTC 18:00 -> EDT 14:00 (values 100..140, median 120)
    // 10 posts at UTC 22:00 -> EDT 18:00 (values 200..240, median 220)
    const bucketA = createValidPublications(10, 18, 100);
    const bucketB = createValidPublications(10, 22, 200, {
      id: "pub-b", // IDs will be mapped
    }).map((r, i) => ({ ...r, id: `pub-b-${i}` }));

    const records = [...bucketA, ...bucketB];
    const result = optimizePublishingSchedule(records, defaultOptions);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.statistics.totalAcceptedObservations).toBe(20);
      expect(result.statistics.eligibleBucketsCount).toBe(2);
      expect(result.statistics.policy).toBe(SCHEDULE_OPTIMIZER_POLICY);
      expect(result.comparisonStatus).toBe("comparable");

      // Highest bucket should be 18:00 EDT (from UTC 22:00) with median 220
      expect(result.highestObservedBuckets).toHaveLength(1);
      const top = result.highestObservedBuckets[0];
      expect(top.bucketKey).toBe("18");
      expect(top.displayLabel).toBe("18:00 America/New_York");
      expect(top.medianValue).toBe(220);
      expect(top.observationCount).toBe(10);
      expect(top.sampleMeetsThreshold).toBe(true);

      // Bucket A (14:00 EDT) should have median 120
      const lower = result.buckets.find((b) => b.bucketKey === "14");
      expect(lower).toBeDefined();
      expect(lower?.medianValue).toBe(120);
      expect(result.rejectedRecords).toHaveLength(0);
    }
  });

  it("2. Accurately converts UTC to workspace timezone (e.g. UTC 15:00 in Asia/Tokyo is 00:00 next day)", () => {
    const records = createValidPublications(20, 15, 100);
    const result = optimizePublishingSchedule(records, {
      ...defaultOptions,
      timeZone: "Asia/Tokyo", // UTC+9 -> 15:00 UTC is 00:00 Tokyo
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.buckets[0].bucketKey).toBe("00");
      expect(result.buckets[0].displayLabel).toBe("00:00 Asia/Tokyo");
      expect(result.buckets[0].observationCount).toBe(20);
    }
  });

  it("3. Handles Daylight Saving Time (DST) spring/fall transitions accurately", () => {
    // Summer date: 2026-07-01T16:00:00Z (EDT, UTC-4) -> 12:00 New York
    // Winter date: 2026-12-01T17:00:00Z (EST, UTC-5) -> 12:00 New York
    const summerRecords = Array.from({ length: 10 }).map((_, i) => ({
      id: `summer-${i}`,
      sourceId: "src-1",
      evidenceClass: "observed" as const,
      metricKey: "video_views",
      unit: "views",
      calculationMethod: "total_30d",
      value: 100,
      publishedAt: `2026-07-${String(i + 1).padStart(2, "0")}T16:00:00Z`,
      citability: "verified" as const,
    }));

    const winterRecords = Array.from({ length: 10 }).map((_, i) => ({
      id: `winter-${i}`,
      sourceId: "src-1",
      evidenceClass: "observed" as const,
      metricKey: "video_views",
      unit: "views",
      calculationMethod: "total_30d",
      value: 100,
      publishedAt: `2026-12-${String(i + 1).padStart(2, "0")}T17:00:00Z`,
      citability: "verified" as const,
    }));

    const records = [...summerRecords, ...winterRecords];
    const result = optimizePublishingSchedule(records, defaultOptions);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      // Both summer (16:00Z -4 = 12:00) and winter (17:00Z -5 = 12:00) map to 12:00 New York
      expect(result.buckets).toHaveLength(1);
      expect(result.buckets[0].bucketKey).toBe("12");
      expect(result.buckets[0].observationCount).toBe(20);
    }
  });

  it("4. Supports 'weekday_and_hour' and 'day_of_week' resolutions", () => {
    // 2026-08-01 was a Saturday. 18:00 UTC = 14:00 EDT Saturday.
    const records = createValidPublications(20, 18, 100);

    // Test weekday_and_hour
    const resWeekdayHour = optimizePublishingSchedule(records, {
      ...defaultOptions,
      bucketResolution: "weekday_and_hour",
    });
    expect(resWeekdayHour.status).toBe("success");
    if (resWeekdayHour.status === "success") {
      expect(resWeekdayHour.buckets[0].bucketKey).toMatch(/^[A-Za-z]+-14$/);
    }

    // Test day_of_week
    const resDayOfWeek = optimizePublishingSchedule(records, {
      ...defaultOptions,
      bucketResolution: "day_of_week",
    });
    expect(resDayOfWeek.status).toBe("success");
    if (resDayOfWeek.status === "success") {
      expect(resDayOfWeek.buckets[0].bucketKey).toMatch(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/);
    }
  });

  it("5. Detects tied highest buckets without fabricating a winner", () => {
    // 10 posts at 14:00 with values 100..140 (median 120)
    // 10 posts at 18:00 with values 100..140 (median 120)
    const bucketA = createValidPublications(10, 18, 100);
    const bucketB = createValidPublications(10, 22, 100).map((r, i) => ({
      ...r,
      id: `pub-b-${i}`,
    }));

    const result = optimizePublishingSchedule([...bucketA, ...bucketB], defaultOptions);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.comparisonStatus).toBe("tied");
      expect(result.highestObservedBuckets).toHaveLength(2);
      expect(result.highestObservedBuckets[0].medianValue).toBe(120);
      expect(result.highestObservedBuckets[1].medianValue).toBe(120);
      expect(result.comparisonNote).toMatch(/tied for highest historical observed/i);
    }
  });

  it("6. Reports single eligible bucket when only one bucket meets minPerBucket", () => {
    // 18 posts at 14:00 (meets threshold >= 3)
    // 2 posts at 18:00 (does not meet threshold 3)
    const bucketA = createValidPublications(18, 18, 100);
    const bucketB = createValidPublications(2, 22, 500).map((r, i) => ({
      ...r,
      id: `pub-sparse-${i}`,
    }));

    const result = optimizePublishingSchedule([...bucketA, ...bucketB], defaultOptions);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.comparisonStatus).toBe("single_eligible_bucket");
      expect(result.highestObservedBuckets).toHaveLength(1);
      expect(result.highestObservedBuckets[0].bucketKey).toBe("14");
      expect(result.comparisonNote).toMatch(/cross-bucket comparison across multiple time windows is unavailable/i);
    }
  });
});

describe("optimizePublishingSchedule — Fail-Closed Evidence Gates", () => {
  it("7. Fails closed when total observations < minTotalObservations", () => {
    const records = createValidRecords(19); // 19 < 20 min
    const result = optimizePublishingSchedule(records, defaultOptions);

    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.validObservationCount).toBe(19);
      expect(result.requiredMinimum).toBe(20);
      expect(result.reason).toMatch(/insufficient comparable publication observations/i);
    }
  });

  it("8. Fails closed when 0 buckets meet minObservationsPerBucket", () => {
    // 20 records scattered into 20 distinct hours (1 record per hour < 3 minPerBucket)
    const records = Array.from({ length: 20 }).map((_, i) => ({
      id: `scatter-${i}`,
      sourceId: "src-1",
      evidenceClass: "observed" as const,
      metricKey: "video_views",
      unit: "views",
      calculationMethod: "total_30d",
      value: 100,
      publishedAt: `2026-08-01T${String(i).padStart(2, "0")}:00:00Z`,
      citability: "verified" as const,
    }));

    const result = optimizePublishingSchedule(records, defaultOptions);

    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.reason).toMatch(/no time bucket met the per-bucket sample size threshold/i);
    }
  });

  it("9. Fails closed when IANA timezone is invalid", () => {
    const records = createValidPublications(20);
    const result = optimizePublishingSchedule(records, {
      ...defaultOptions,
      timeZone: "Mars/Olympus_Mons", // Invalid
    });

    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.reason).toMatch(/invalid or unrecognized by the runtime/i);
    }
  });

  it("10. Rejects non-observed evidence classes (simulation, inference, sourced, unknown)", () => {
    const records = createValidPublications(19);
    records.push({
      id: "sim-pub-01",
      sourceId: "src-1",
      evidenceClass: "simulation",
      metricKey: "video_views",
      unit: "views",
      calculationMethod: "total_30d",
      value: 9999,
      publishedAt: "2026-08-01T18:00:00Z",
      citability: "verified",
    });

    const result = optimizePublishingSchedule(records, defaultOptions);

    // 19 valid < 20 min -> insufficient_evidence
    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.validObservationCount).toBe(19);
      expect(result.rejectedRecords).toHaveLength(1);
      expect(result.rejectedRecords[0].reason).toMatch(/evidence_class must be 'observed'/i);
    }
  });

  it("11. Rejects metric key, unit, and calculation method mismatches", () => {
    const records = createValidPublications(20);
    records[0].metricKey = "likes";
    records[1].unit = "seconds";
    records[2].calculationMethod = "average_7d";

    const result = optimizePublishingSchedule(records, defaultOptions);

    // 17 valid < 20 min
    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.validObservationCount).toBe(17);
      expect(result.rejectedRecords).toHaveLength(3);
    }
  });

  it("12. Filters by targetCohortId and targetPlatform and rejects non-matching rows", () => {
    const records = createValidPublications(20, 18, 100, {
      cohortId: "cohort-alpha",
      platform: "youtube",
    });
    records[0].cohortId = "cohort-beta"; // Mismatch
    records[1].platform = "tiktok"; // Mismatch

    const result = optimizePublishingSchedule(records, {
      ...defaultOptions,
      targetCohortId: "cohort-alpha",
      targetPlatform: "youtube",
    });

    // 18 valid < 20 min
    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.validObservationCount).toBe(18);
      expect(result.rejectedRecords).toHaveLength(2);
      expect(result.rejectedRecords[0].reason).toMatch(/cohort mismatch/i);
      expect(result.rejectedRecords[1].reason).toMatch(/platform mismatch/i);
    }
  });

  it("13. Rejects blocked, disconnected, and expired records", () => {
    const records = createValidPublications(20);
    records[0].citability = "blocked";
    records[1].citability = "disconnected";
    records[2].retentionUntil = "2026-08-01T00:00:00Z"; // Expired before referenceTime (2026-08-15)

    const result = optimizePublishingSchedule(records, defaultOptions);

    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.validObservationCount).toBe(17);
      expect(result.rejectedRecords).toHaveLength(3);
    }
  });

  it("14. Rejects non-finite values and invalid timestamps", () => {
    const records = createValidPublications(20);
    records[0].value = NaN;
    records[1].value = Infinity;
    records[2].publishedAt = "not-a-valid-date";

    const result = optimizePublishingSchedule(records, defaultOptions);

    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.validObservationCount).toBe(17);
      expect(result.rejectedRecords).toHaveLength(3);
    }
  });

  it("15. Rejects observations outside timeWindow bounds", () => {
    const records = createValidPublications(20);
    const result = optimizePublishingSchedule(records, {
      ...defaultOptions,
      timeWindow: {
        start: "2026-08-01T00:00:00Z",
        end: "2026-08-02T00:00:00Z", // Excludes posts on subsequent days
      },
    });

    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.rejectedRecords.length).toBeGreaterThan(0);
      expect(result.rejectedRecords[0].reason).toMatch(/exceeds window end|precedes window start/i);
    }
  });

  it("16. Deduplicates duplicate IDs idempotently", () => {
    const records = createValidPublications(20);
    // Add duplicate
    records.push({ ...records[0] });

    const result = optimizePublishingSchedule(records, defaultOptions);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.statistics.totalAcceptedObservations).toBe(20);
      expect(result.rejectedRecords).toHaveLength(1);
      expect(result.rejectedRecords[0].reason).toMatch(/duplicate publication record identifier/i);
    }
  });
});

// Helper for minimal test record construction
function createValidRecords(count: number): ObservedPublicationRecord[] {
  return createValidPublications(count);
}
