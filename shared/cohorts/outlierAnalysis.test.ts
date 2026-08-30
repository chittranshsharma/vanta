/**
 * Comprehensive Unit Tests for Cohort Outlier Analysis (Pure Domain Module)
 *
 * Tests cover:
 *  1. Odd sample count (15 observations)
 *  2. Even sample count (16 observations)
 *  3. Exact threshold boundary (value === threshold is not an outlier; value > threshold is)
 *  4. Zero IQR handling (identical values yield 0 outliers; clustered median with higher value flags outlier)
 *  5. No outliers present in uniform distribution
 *  6. Single and multiple high outliers correctly identified
 *  7. Fewer than 15 comparable observations returns 'insufficient_evidence'
 *  8. Rejection on mixed metric keys
 *  9. Rejection on mixed units
 *  10. Rejection on mixed calculation methods
 *  11. Rejection on missing/invalid denominator when required
 *  12. Rejection on blocked or disconnected source citability
 *  13. Rejection on expired retention timestamp
 *  14. Rejection on non-finite values (NaN, Infinity, -Infinity)
 *  15. Rejection on invalid/out-of-range observation windows
 *  16. Deduplication and idempotent handling of duplicate IDs
 *  17. Provenance preservation on all flagged records
 *  18. Rejection reasons recorded and visible in output
 *  19. Rejection of simulation, inference, sourced, and unknown evidence classes
 *  20. Quartiles calculation helper unit tests
 */

import { describe, it, expect } from "vitest";
import {
  analyzeCohortOutliers,
  computeQuartiles,
  type ObservedCohortRecord,
  type OutlierAnalysisOptions,
  OUTLIER_POLICY_VERSION,
} from "./outlierAnalysis";

// Helper to generate N baseline records
function createValidRecords(
  count: number,
  baseValue = 100,
  step = 5,
  overrides: Partial<ObservedCohortRecord> = {}
): ObservedCohortRecord[] {
  const records: ObservedCohortRecord[] = [];
  const baseDate = new Date("2026-08-01T12:00:00Z").getTime();

  for (let i = 0; i < count; i++) {
    const d = new Date(baseDate + i * 3600 * 1000).toISOString();
    records.push({
      id: `obs-${String(i + 1).padStart(3, "0")}`,
      sourceId: "src-001",
      evidenceClass: "observed",
      metricKey: "view_count",
      unit: "views",
      calculationMethod: "sum_30d",
      value: baseValue + i * step,
      observedAt: d,
      citability: "verified",
      retentionUntil: "2027-01-01T00:00:00Z",
      provenance: { raw_row_index: i + 1 },
      ...overrides,
    });
  }

  return records;
}

const defaultOptions: OutlierAnalysisOptions = {
  cohortId: "cohort-tech-creators",
  expectedMetricKey: "view_count",
  expectedUnit: "views",
  expectedCalculationMethod: "sum_30d",
  minComparableObservations: 15,
  referenceTime: "2026-08-15T00:00:00Z",
};

describe("computeQuartiles helper", () => {
  it("computes exact quartiles for odd length array", () => {
    // 7 elements: [1, 2, 3, 4, 5, 6, 7]
    // median = 4
    // lower half = [1, 2, 3] -> q1 = 2
    // upper half = [5, 6, 7] -> q3 = 6
    // iqr = 4
    const res = computeQuartiles([1, 2, 3, 4, 5, 6, 7]);
    expect(res.median).toBe(4);
    expect(res.q1).toBe(2);
    expect(res.q3).toBe(6);
    expect(res.iqr).toBe(4);
  });

  it("computes exact quartiles for even length array", () => {
    // 8 elements: [1, 2, 3, 4, 5, 6, 7, 8]
    // median = (4 + 5) / 2 = 4.5
    // lower half = [1, 2, 3, 4] -> q1 = (2 + 3) / 2 = 2.5
    // upper half = [5, 6, 7, 8] -> q3 = (6 + 7) / 2 = 6.5
    // iqr = 4
    const res = computeQuartiles([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(res.median).toBe(4.5);
    expect(res.q1).toBe(2.5);
    expect(res.q3).toBe(6.5);
    expect(res.iqr).toBe(4);
  });

  it("handles empty and single-element arrays", () => {
    expect(computeQuartiles([])).toEqual({ median: 0, q1: 0, q3: 0, iqr: 0 });
    expect(computeQuartiles([42])).toEqual({ median: 42, q1: 42, q3: 42, iqr: 0 });
  });
});

describe("analyzeCohortOutliers — Happy Paths & Statistical Calculations", () => {
  it("1. Analyzes 15 observations (odd sample count) with no outliers", () => {
    // values: 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170
    // median = 135
    // lower: [100..130] -> q1 = 115
    // upper: [140..170] -> q3 = 155
    // iqr = 40; threshold = 135 + 1.5*40 = 195. Max is 170 -> 0 outliers.
    const records = createValidRecords(15, 100, 5);
    const result = analyzeCohortOutliers(records, defaultOptions);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.statistics.sampleSize).toBe(15);
      expect(result.statistics.median).toBe(135);
      expect(result.statistics.q1).toBe(115);
      expect(result.statistics.q3).toBe(155);
      expect(result.statistics.iqr).toBe(40);
      expect(result.statistics.outlierThreshold).toBe(195);
      expect(result.statistics.policy).toBe(OUTLIER_POLICY_VERSION);
      expect(result.flaggedCount).toBe(0);
      expect(result.flaggedOutliers).toHaveLength(0);
      expect(result.rejectedRecords).toHaveLength(0);
    }
  });

  it("2. Analyzes 16 observations (even sample count) with 1 high outlier", () => {
    const records = createValidRecords(15, 100, 5);
    // Add 16th record with high value 500
    records.push({
      id: "obs-016",
      sourceId: "src-002",
      evidenceClass: "observed",
      metricKey: "view_count",
      unit: "views",
      calculationMethod: "sum_30d",
      value: 500,
      observedAt: "2026-08-01T20:00:00Z",
      citability: "verified",
      provenance: { note: "high_engagement_test" },
    });

    const result = analyzeCohortOutliers(records, defaultOptions);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.statistics.sampleSize).toBe(16);
      expect(result.flaggedCount).toBe(1);
      const outlier = result.flaggedOutliers[0];
      expect(outlier.id).toBe("obs-016");
      expect(outlier.sourceId).toBe("src-002");
      expect(outlier.value).toBe(500);
      expect(outlier.deltaAboveThreshold).toBeGreaterThan(0);
      expect(outlier.deltaAboveMedian).toBeGreaterThan(0);
      expect(outlier.provenance).toEqual({ note: "high_engagement_test" });
    }
  });

  it("3. Exact threshold boundary: value === threshold is NOT an outlier; value > threshold is", () => {
    // Construct 15 values where median = 100, IQR = 20 -> threshold = 100 + 1.5*20 = 130
    // Record A has value 130 (boundary) -> NOT flagged
    // Record B has value 130.01 -> FLAGGED
    const records: ObservedCohortRecord[] = [
      // Lower half (7 items): median = 90
      ...[80, 85, 88, 90, 92, 95, 98].map((v, i) => ({
        id: `lower-${i}`,
        sourceId: "src-1",
        evidenceClass: "observed" as const,
        metricKey: "view_count",
        unit: "views",
        calculationMethod: "sum_30d",
        value: v,
        observedAt: "2026-08-01T10:00:00Z",
        citability: "verified" as const,
      })),
      // Median item
      {
        id: "mid",
        sourceId: "src-1",
        evidenceClass: "observed" as const,
        metricKey: "view_count",
        unit: "views",
        calculationMethod: "sum_30d",
        value: 100,
        observedAt: "2026-08-01T11:00:00Z",
        citability: "verified" as const,
      },
      // Upper half (7 items): median = 110 (q3=110, q1=90, iqr=20, threshold=130)
      ...[102, 105, 108, 110, 115, 130, 130.01].map((v, i) => ({
        id: `upper-${i}`,
        sourceId: "src-1",
        evidenceClass: "observed" as const,
        metricKey: "view_count",
        unit: "views",
        calculationMethod: "sum_30d",
        value: v,
        observedAt: "2026-08-01T12:00:00Z",
        citability: "verified" as const,
      })),
    ];

    const result = analyzeCohortOutliers(records, defaultOptions);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.statistics.median).toBe(100);
      expect(result.statistics.q1).toBe(90);
      expect(result.statistics.q3).toBe(110);
      expect(result.statistics.iqr).toBe(20);
      expect(result.statistics.outlierThreshold).toBe(130);

      // Only 130.01 should be flagged (upper-6); 130 (upper-5) is on the boundary
      expect(result.flaggedCount).toBe(1);
      expect(result.flaggedOutliers[0].id).toBe("upper-6");
      expect(result.flaggedOutliers[0].value).toBe(130.01);
    }
  });

  it("4. Zero IQR handling: identical values yield 0 outliers", () => {
    // 15 records with identical value 100
    const records = createValidRecords(15, 100, 0);
    const result = analyzeCohortOutliers(records, defaultOptions);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.statistics.median).toBe(100);
      expect(result.statistics.q1).toBe(100);
      expect(result.statistics.q3).toBe(100);
      expect(result.statistics.iqr).toBe(0);
      expect(result.statistics.zeroIqrHandled).toBe(true);
      expect(result.statistics.outlierThreshold).toBe(100);
      // All values are 100, none is strictly greater than 100
      expect(result.flaggedCount).toBe(0);
    }
  });

  it("5. Zero IQR handling: tight cluster at median with one higher value flags outlier", () => {
    // 14 records at 100, 1 record at 250
    // Sorted: [100, 100, ..., 100, 250] (15 elements)
    // median = 100; lower=[100..100]->q1=100; upper=[100..250]->q3=100; iqr=0
    const records = createValidRecords(14, 100, 0);
    records.push({
      id: "obs-high",
      sourceId: "src-001",
      evidenceClass: "observed",
      metricKey: "view_count",
      unit: "views",
      calculationMethod: "sum_30d",
      value: 250,
      observedAt: "2026-08-01T15:00:00Z",
      citability: "verified",
    });

    const result = analyzeCohortOutliers(records, defaultOptions);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.statistics.iqr).toBe(0);
      expect(result.statistics.zeroIqrHandled).toBe(true);
      expect(result.flaggedCount).toBe(1);
      expect(result.flaggedOutliers[0].id).toBe("obs-high");
      expect(result.flaggedOutliers[0].value).toBe(250);
    }
  });

  it("6. Observation window span is correctly reported", () => {
    const records = createValidRecords(15, 100, 5);
    const result = analyzeCohortOutliers(records, defaultOptions);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.observationWindow.earliest).toBe("2026-08-01T12:00:00.000Z");
      expect(result.observationWindow.latest).toBe("2026-08-02T02:00:00.000Z");
    }
  });
});

describe("analyzeCohortOutliers — Fail-Closed Validation & Rejection Pipeline", () => {
  it("7. Fails closed with 'insufficient_evidence' when fewer than 15 valid records provided", () => {
    const records = createValidRecords(14, 100, 5); // 14 records < 15 minimum
    const result = analyzeCohortOutliers(records, defaultOptions);

    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.validObservationCount).toBe(14);
      expect(result.requiredMinimum).toBe(15);
      expect(result.reason).toMatch(/insufficient comparable observations/i);
    }
  });

  it("8. Rejects non-observed evidence classes (simulation, inference, sourced, unknown)", () => {
    const records = createValidRecords(14, 100, 5);
    // Add 4 non-observed records (total 18 raw, but only 14 valid observed)
    records.push({
      id: "sim-01",
      sourceId: "src-1",
      evidenceClass: "simulation",
      metricKey: "view_count",
      unit: "views",
      calculationMethod: "sum_30d",
      value: 1000,
      observedAt: "2026-08-01T12:00:00Z",
      citability: "verified",
    });
    records.push({
      id: "inf-01",
      sourceId: "src-1",
      evidenceClass: "inference",
      metricKey: "view_count",
      unit: "views",
      calculationMethod: "sum_30d",
      value: 900,
      observedAt: "2026-08-01T12:00:00Z",
      citability: "verified",
    });
    records.push({
      id: "src-claim-01",
      sourceId: "src-1",
      evidenceClass: "sourced",
      metricKey: "view_count",
      unit: "views",
      calculationMethod: "sum_30d",
      value: 800,
      observedAt: "2026-08-01T12:00:00Z",
      citability: "verified",
    });
    records.push({
      id: "unk-01",
      sourceId: "src-1",
      evidenceClass: "unknown",
      metricKey: "view_count",
      unit: "views",
      calculationMethod: "sum_30d",
      value: 700,
      observedAt: "2026-08-01T12:00:00Z",
      citability: "verified",
    });

    const result = analyzeCohortOutliers(records, defaultOptions);

    // Since only 14 valid observed records exist, it must fail closed
    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.validObservationCount).toBe(14);
      expect(result.rejectedRecords).toHaveLength(4);
      expect(result.rejectedRecords.map((r) => r.id)).toEqual([
        "sim-01",
        "inf-01",
        "src-claim-01",
        "unk-01",
      ]);
      expect(result.rejectedRecords[0].reason).toMatch(/evidence_class must be 'observed'/i);
    }
  });

  it("9. Rejects mixed metric keys", () => {
    const records = createValidRecords(15, 100, 5);
    records[0].metricKey = "engagement_rate"; // Mismatch

    const result = analyzeCohortOutliers(records, defaultOptions);

    // 14 valid, 1 rejected
    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.validObservationCount).toBe(14);
      expect(result.rejectedRecords[0].id).toBe(records[0].id);
      expect(result.rejectedRecords[0].reason).toMatch(/metric key mismatch/i);
    }
  });

  it("10. Rejects mixed units", () => {
    const records = createValidRecords(15, 100, 5);
    records[0].unit = "seconds"; // Expected "views"

    const result = analyzeCohortOutliers(records, defaultOptions);

    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.rejectedRecords[0].reason).toMatch(/unit mismatch/i);
    }
  });

  it("11. Rejects mixed calculation methods", () => {
    const records = createValidRecords(15, 100, 5);
    records[0].calculationMethod = "average_7d"; // Expected "sum_30d"

    const result = analyzeCohortOutliers(records, defaultOptions);

    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.rejectedRecords[0].reason).toMatch(/calculation method mismatch/i);
    }
  });

  it("12. Rejects missing denominator on rate metrics requiring it", () => {
    const records = createValidRecords(15, 10, 1, {
      metricKey: "click_through_rate",
      unit: "ratio",
      calculationMethod: "clicks_over_impressions",
      requiresDenominator: true,
      denominator: null, // Missing denominator
    });

    const result = analyzeCohortOutliers(records, {
      ...defaultOptions,
      expectedMetricKey: "click_through_rate",
      expectedUnit: "ratio",
      expectedCalculationMethod: "clicks_over_impressions",
    });

    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.validObservationCount).toBe(0);
      expect(result.rejectedRecords).toHaveLength(15);
      expect(result.rejectedRecords[0].reason).toMatch(/denominator is missing/i);
    }
  });

  it("13. Rejects blocked and disconnected source citability", () => {
    const records = createValidRecords(15, 100, 5);
    records[0].citability = "blocked";
    records[1].citability = "disconnected";

    const result = analyzeCohortOutliers(records, defaultOptions);

    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.validObservationCount).toBe(13);
      expect(result.rejectedRecords).toHaveLength(2);
      expect(result.rejectedRecords[0].reason).toMatch(/citability status 'blocked' prohibits/i);
      expect(result.rejectedRecords[1].reason).toMatch(/citability status 'disconnected' prohibits/i);
    }
  });

  it("14. Rejects expired retention timestamps against referenceTime", () => {
    const records = createValidRecords(15, 100, 5);
    records[0].retentionUntil = "2026-08-01T00:00:00Z"; // Expired before referenceTime (2026-08-15)

    const result = analyzeCohortOutliers(records, defaultOptions);

    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.rejectedRecords[0].reason).toMatch(/retention period expired/i);
    }
  });

  it("15. Rejects non-finite values (NaN, Infinity, -Infinity)", () => {
    const records = createValidRecords(16, 100, 5);
    records[0].value = NaN;
    records[1].value = Infinity;
    records[2].value = -Infinity;

    const result = analyzeCohortOutliers(records, defaultOptions);

    // 16 - 3 = 13 valid < 15 min
    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.validObservationCount).toBe(13);
      expect(result.rejectedRecords).toHaveLength(3);
      expect(result.rejectedRecords[0].reason).toMatch(/non-finite/i);
    }
  });

  it("16. Rejects observations outside configured timeWindow", () => {
    const records = createValidRecords(16, 100, 5);
    // records span from 2026-08-01T12:00 to 2026-08-02T03:00

    const result = analyzeCohortOutliers(records, {
      ...defaultOptions,
      timeWindow: {
        start: "2026-08-01T14:00:00Z", // excludes first two records (12:00, 13:00)
        end: "2026-08-02T00:00:00Z", // excludes last few records
      },
    });

    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.rejectedRecords.length).toBeGreaterThan(0);
      expect(result.rejectedRecords[0].reason).toMatch(/precedes window start|exceeds window end/i);
    }
  });

  it("17. Rejects invalid time window bounds", () => {
    const records = createValidRecords(16, 100, 5);
    const result = analyzeCohortOutliers(records, {
      ...defaultOptions,
      timeWindow: {
        start: "2026-08-02T00:00:00Z",
        end: "2026-08-01T00:00:00Z", // start > end
      },
    });

    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.reason).toMatch(/time window is invalid/i);
    }
  });

  it("18. Deduplicates duplicate IDs idempotently", () => {
    const records = createValidRecords(15, 100, 5);
    // Push duplicate of record 0
    records.push({ ...records[0] });

    const result = analyzeCohortOutliers(records, defaultOptions);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.statistics.sampleSize).toBe(15);
      expect(result.rejectedRecords).toHaveLength(1);
      expect(result.rejectedRecords[0].reason).toMatch(/duplicate observation identifier/i);
    }
  });

  it("19. Preserves exact provenance and source IDs on flagged outliers", () => {
    const records = createValidRecords(15, 100, 5);
    records.push({
      id: "obs-outlier-99",
      sourceId: "src-verified-channel",
      evidenceClass: "observed",
      metricKey: "view_count",
      unit: "views",
      calculationMethod: "sum_30d",
      value: 12000,
      observedAt: "2026-08-01T18:00:00Z",
      citability: "verified",
      provenance: {
        batch_id: "batch-abc",
        source_url: "https://example.com/rss",
      },
    });

    const result = analyzeCohortOutliers(records, defaultOptions);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.flaggedCount).toBe(1);
      const outlier = result.flaggedOutliers[0];
      expect(outlier.id).toBe("obs-outlier-99");
      expect(outlier.sourceId).toBe("src-verified-channel");
      expect(outlier.metricKey).toBe("view_count");
      expect(outlier.unit).toBe("views");
      expect(outlier.calculationMethod).toBe("sum_30d");
      expect(outlier.provenance).toEqual({
        batch_id: "batch-abc",
        source_url: "https://example.com/rss",
      });
    }
  });
});
