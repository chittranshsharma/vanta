import { describe, it, expect } from "vitest";
import {
  analyzeCohortOutliers,
  OUTLIER_POLICY_VERSION,
  DEFAULT_MIN_COMPARABLE_OBSERVATIONS,
  type ObservedCohortRecord,
} from "../../shared/cohorts/outlierAnalysis";
import {
  optimizePublishingSchedule,
  SCHEDULE_OPTIMIZER_POLICY,
  DEFAULT_MIN_TOTAL_OBSERVATIONS,
  DEFAULT_MIN_OBSERVATIONS_PER_BUCKET,
  type ObservedPublicationRecord,
} from "../../shared/publishing/scheduleOptimizer";

describe("Slice A: Source Cohorts & Descriptive Outlier Analyzer Integration", () => {
  const mockCohortId = "c1111111-2222-3333-4444-555555555555";

  it("verifies exact outlier policy version and minimum sample gate from backend contract", () => {
    expect(OUTLIER_POLICY_VERSION).toBe("v1_tukey_median_iqr");
    expect(DEFAULT_MIN_COMPARABLE_OBSERVATIONS).toBe(15);
  });

  it("fails closed with insufficient_evidence when fewer than 15 comparable observations are provided", () => {
    const sparseRecords: ObservedCohortRecord[] = Array.from({ length: 4 }).map((_, i) => ({
      id: `obs-${i}`,
      sourceId: `src-${i}`,
      evidenceClass: "observed",
      metricKey: "impressions",
      unit: "count",
      calculationMethod: "sum",
      value: 100 * (i + 1),
      observedAt: new Date(Date.now() - i * 86400000).toISOString(),
      citability: "verified",
    }));

    const result = analyzeCohortOutliers(sparseRecords, {
      cohortId: mockCohortId,
      expectedMetricKey: "impressions",
      expectedUnit: "count",
      expectedCalculationMethod: "sum",
      minComparableObservations: DEFAULT_MIN_COMPARABLE_OBSERVATIONS,
    });

    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.validObservationCount).toBe(4);
      expect(result.requiredMinimum).toBe(15);
      expect(result.reason).toContain("found 4 valid records, but policy requires minimum 15");
    }
  });

  it("computes exact Tukey IQR outlier thresholds over sufficient history without synthetic predictions", () => {
    // 20 observations with an extreme high outlier at 50,000
    const records: ObservedCohortRecord[] = Array.from({ length: 19 }).map((_, i) => ({
      id: `obs-${i}`,
      sourceId: `src-${i}`,
      evidenceClass: "observed",
      metricKey: "impressions",
      unit: "count",
      calculationMethod: "sum",
      value: 1000 + (i % 5) * 50,
      observedAt: new Date(Date.now() - i * 86400000).toISOString(),
      citability: "verified",
    }));

    records.push({
      id: "obs-outlier",
      sourceId: "src-outlier",
      evidenceClass: "observed",
      metricKey: "impressions",
      unit: "count",
      calculationMethod: "sum",
      value: 50000,
      observedAt: new Date().toISOString(),
      citability: "verified",
    });

    const result = analyzeCohortOutliers(records, {
      cohortId: mockCohortId,
      expectedMetricKey: "impressions",
      expectedUnit: "count",
      expectedCalculationMethod: "sum",
      minComparableObservations: 15,
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.statistics.policy).toBe("v1_tukey_median_iqr");
      expect(result.statistics.sampleSize).toBe(20);
      expect(result.flaggedOutliers.length).toBeGreaterThan(0);
      expect(result.flaggedOutliers[0].id).toBe("obs-outlier");
      expect(result.flaggedOutliers[0].deltaAboveThreshold).toBeGreaterThan(0);
      expect(result.flaggedOutliers[0].evidenceClass).toBe("observed");
    }
  });
});

describe("Slice A: Publishing Schedule Optimizer Integration", () => {
  const mockWorkspaceId = "w1111111-2222-3333-4444-555555555555";

  it("verifies exact schedule optimizer policy and sample thresholds from backend contract", () => {
    expect(SCHEDULE_OPTIMIZER_POLICY).toBe("v1_observed_history_bucket_summary");
    expect(DEFAULT_MIN_TOTAL_OBSERVATIONS).toBe(20);
    expect(DEFAULT_MIN_OBSERVATIONS_PER_BUCKET).toBe(3);
  });

  it("returns typed insufficient_evidence status on sparse posting history", () => {
    const sparsePubs: ObservedPublicationRecord[] = Array.from({ length: 5 }).map((_, i) => ({
      id: `pub-${i}`,
      sourceId: "src-1",
      evidenceClass: "observed",
      metricKey: "impressions",
      unit: "count",
      calculationMethod: "sum",
      value: 500,
      publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
      citability: "verified",
    }));

    const result = optimizePublishingSchedule(sparsePubs, {
      workspaceId: mockWorkspaceId,
      timeZone: "UTC",
      expectedMetricKey: "impressions",
      expectedUnit: "count",
      expectedCalculationMethod: "sum",
      bucketResolution: "hour_of_day",
    });

    expect(result.status).toBe("insufficient_evidence");
    if (result.status === "insufficient_evidence") {
      expect(result.validObservationCount).toBe(5);
      expect(result.requiredMinimum).toBe(20);
    }
  });

  it("computes descriptive historical bucket rankings when history satisfies sample gates", () => {
    // Generate 24 observations across two distinct hours (12 in 09:00 and 12 in 15:00)
    const baseDate = new Date("2026-06-01T00:00:00Z");
    const pubs: ObservedPublicationRecord[] = [];

    for (let i = 0; i < 12; i++) {
      const d1 = new Date(baseDate);
      d1.setUTCDate(d1.getUTCDate() + i);
      d1.setUTCHours(9, 0, 0, 0);
      pubs.push({
        id: `pub-09-${i}`,
        sourceId: "src-1",
        evidenceClass: "observed",
        metricKey: "impressions",
        unit: "count",
        calculationMethod: "sum",
        value: 2000,
        publishedAt: d1.toISOString(),
        citability: "verified",
      });

      const d2 = new Date(baseDate);
      d2.setUTCDate(d2.getUTCDate() + i);
      d2.setUTCHours(15, 0, 0, 0);
      pubs.push({
        id: `pub-15-${i}`,
        sourceId: "src-1",
        evidenceClass: "observed",
        metricKey: "impressions",
        unit: "count",
        calculationMethod: "sum",
        value: 800,
        publishedAt: d2.toISOString(),
        citability: "verified",
      });
    }

    const result = optimizePublishingSchedule(pubs, {
      workspaceId: mockWorkspaceId,
      timeZone: "UTC",
      expectedMetricKey: "impressions",
      expectedUnit: "count",
      expectedCalculationMethod: "sum",
      bucketResolution: "hour_of_day",
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.statistics.policy).toBe("v1_observed_history_bucket_summary");
      expect(result.statistics.totalAcceptedObservations).toBe(24);
      expect(result.highestObservedBuckets.length).toBeGreaterThan(0);
      expect(result.highestObservedBuckets[0].bucketKey).toBe("09");
      expect(result.highestObservedBuckets[0].medianValue).toBe(2000);
    }
  });
});
