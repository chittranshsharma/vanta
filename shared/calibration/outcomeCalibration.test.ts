import { describe, expect, it } from "vitest";
import {
  CALIBRATION_POLICY,
  validateCalibrationCandidate,
  evaluateDescriptiveCalibration,
  type CalibrationLinkCandidate,
  type CalibrationValidationContext,
} from "./outcomeCalibration.js";
import type { SimulationRun } from "../simulation/types.js";

const mockSimulationRun: SimulationRun = {
  simulationRunId: "sim-run-100",
  workspaceId: "ws-alpha",
  actorUserId: "usr-1",
  sourceTwinId: "twin-original-1",
  sourceTwinVersion: 1,
  hypothesis: "Replacing hook improves brand claim clarity.",
  mutations: [
    {
      type: "hook_replacement",
      targetSceneIndex: 0,
      newHookText: "Discover verified creative intelligence.",
      rationale: "Align with brand codex",
    },
  ],
  controls: [],
  status: "completed",
  evidenceClass: "simulation",
  observedValidation: "unknown",
  reviewDecision: "accepted",
  uncertaintyNote: "Simulation structural analysis only.",
  simulatedVariant: {
    sourceTwinId: "twin-original-1",
    sourceTwinVersion: 1,
    mutationsAppliedCount: 1,
    simulatedScenes: [],
    structuralDelta: {
      baselineDurationSeconds: 15,
      simulatedDurationSeconds: 15,
      durationDeltaSeconds: 0,
      baselineAverageWpm: 120,
      simulatedAverageWpm: 120,
      wpmDelta: 0,
      baselineSceneCount: 3,
      simulatedSceneCount: 3,
      sceneCountDelta: 0,
      baselineClaimCount: 1,
      simulatedClaimCount: 1,
      claimCountDelta: 0,
      hasCtaChanged: false,
      hasHookChanged: true,
      warnings: [],
    },
    assumptions: [],
    limitations: [],
  },
  councilExecution: {
    analysisRolesRun: ["creative_analyst", "claim_auditor"],
    analysisRolesSkipped: [],
    governanceRole: "human_reviewer",
    executedAt: "2026-08-30T10:00:00Z",
  },
  createdAt: "2026-08-30T10:00:00Z",
  completedAt: "2026-08-30T10:01:00Z",
};

const baseContext: CalibrationValidationContext = {
  workspaceId: "ws-alpha",
  simulationRun: mockSimulationRun,
  validVariantTwinIds: ["twin-original-1", "twin-variant-2"],
  expectedMetricKey: "impressions",
  expectedMetricUnit: "count",
  minSamplesRequired: 3,
  evaluationTimestamp: "2026-08-30T12:00:00Z",
  windowStart: "2026-08-30T09:00:00Z",
  windowEnd: "2026-08-30T15:00:00Z",
  existingLinkedOutcomeIds: ["outcome-already-linked-99"],
};

const makeValidCandidate = (overrides?: Partial<CalibrationLinkCandidate>): CalibrationLinkCandidate => ({
  workspaceId: "ws-alpha",
  simulationRunId: "sim-run-100",
  variantTwinId: "twin-original-1",
  experimentOutcomeId: `outcome-${Date.now()}-${Math.random()}`,
  metricKey: "impressions",
  metricUnit: "count",
  value: 1500,
  observedAt: "2026-08-30T11:00:00Z",
  evidenceClass: "observed",
  sourceId: "src-campaign-1",
  sourceCitability: "verified",
  retentionUntil: "2026-11-30T00:00:00Z",
  ...overrides,
});

describe("Outcome Calibration Validator & Summarizer", () => {
  describe("validateCalibrationCandidate", () => {
    it("accepts a perfectly valid empirical outcome candidate", () => {
      const candidate = makeValidCandidate();
      const res = validateCalibrationCandidate(candidate, baseContext);
      expect(res.valid).toBe(true);
      expect(res.rejectedReasons).toHaveLength(0);
    });

    it("rejects cross-workspace linking fail-closed", () => {
      const candidate = makeValidCandidate({ workspaceId: "ws-beta-adversary" });
      const res = validateCalibrationCandidate(candidate, baseContext);
      expect(res.valid).toBe(false);
      expect(res.rejectedReasons.some((r) => r.code === "workspace_mismatch")).toBe(true);
    });

    it("rejects synthetic, inferred, or simulated votes (non-observed)", () => {
      const synthetic = makeValidCandidate({ evidenceClass: "simulation" });
      const inferred = makeValidCandidate({ evidenceClass: "inference" });
      const unknownCls = makeValidCandidate({ evidenceClass: "unknown" });

      expect(validateCalibrationCandidate(synthetic, baseContext).valid).toBe(false);
      expect(validateCalibrationCandidate(inferred, baseContext).valid).toBe(false);
      expect(validateCalibrationCandidate(unknownCls, baseContext).valid).toBe(false);

      const res = validateCalibrationCandidate(synthetic, baseContext);
      expect(res.rejectedReasons.some((r) => r.code === "synthetic_vote_rejected")).toBe(true);
    });

    it("rejects wrong variant IDs", () => {
      const candidate = makeValidCandidate({ variantTwinId: "twin-unrelated-999" });
      const res = validateCalibrationCandidate(candidate, baseContext);
      expect(res.valid).toBe(false);
      expect(res.rejectedReasons.some((r) => r.code === "variant_mismatch")).toBe(true);
    });

    it("rejects metric key mismatch", () => {
      const candidate = makeValidCandidate({ metricKey: "clicks" });
      const res = validateCalibrationCandidate(candidate, baseContext);
      expect(res.valid).toBe(false);
      expect(res.rejectedReasons.some((r) => r.code === "metric_mismatch")).toBe(true);
    });

    it("rejects unit mismatch", () => {
      const candidate = makeValidCandidate({ metricUnit: "percentage" });
      const res = validateCalibrationCandidate(candidate, baseContext);
      expect(res.valid).toBe(false);
      expect(res.rejectedReasons.some((r) => r.code === "unit_mismatch")).toBe(true);
    });

    it("rejects missing or non-positive denominator for rate/ratio metrics", () => {
      const candidateZero = makeValidCandidate({ denominator: 0 });
      const candidateNeg = makeValidCandidate({ denominator: -5 });
      const candidateNaN = makeValidCandidate({ denominator: NaN });

      expect(validateCalibrationCandidate(candidateZero, baseContext).valid).toBe(false);
      expect(validateCalibrationCandidate(candidateNeg, baseContext).valid).toBe(false);
      expect(validateCalibrationCandidate(candidateNaN, baseContext).valid).toBe(false);

      const res = validateCalibrationCandidate(candidateZero, baseContext);
      expect(res.rejectedReasons.some((r) => r.code === "missing_denominator")).toBe(true);
    });

    it("accepts valid positive denominator for rate metrics", () => {
      const candidate = makeValidCandidate({ denominator: 1000 });
      const res = validateCalibrationCandidate(candidate, baseContext);
      expect(res.valid).toBe(true);
    });

    it("rejects non-finite values (Infinity, NaN)", () => {
      const candidateInf = makeValidCandidate({ value: Infinity });
      const candidateNaN = makeValidCandidate({ value: NaN });

      expect(validateCalibrationCandidate(candidateInf, baseContext).valid).toBe(false);
      expect(validateCalibrationCandidate(candidateNaN, baseContext).valid).toBe(false);
    });

    it("rejects invalid timestamps", () => {
      const candidate = makeValidCandidate({ observedAt: "invalid-iso-date" });
      const res = validateCalibrationCandidate(candidate, baseContext);
      expect(res.valid).toBe(false);
      expect(res.rejectedReasons.some((r) => r.code === "invalid_timestamp")).toBe(true);
    });

    it("rejects observations outside the declared time window", () => {
      const tooEarly = makeValidCandidate({ observedAt: "2026-08-30T08:00:00Z" });
      const tooLate = makeValidCandidate({ observedAt: "2026-08-30T16:00:00Z" });

      expect(validateCalibrationCandidate(tooEarly, baseContext).valid).toBe(false);
      expect(validateCalibrationCandidate(tooLate, baseContext).valid).toBe(false);
    });

    it("rejects blocked or unknown sources", () => {
      const candidateBlocked = makeValidCandidate({ sourceCitability: "blocked" });
      const candidateUnknown = makeValidCandidate({ sourceCitability: "unknown" });

      expect(validateCalibrationCandidate(candidateBlocked, baseContext).valid).toBe(false);
      expect(validateCalibrationCandidate(candidateUnknown, baseContext).valid).toBe(false);
    });

    it("rejects expired retention records", () => {
      const candidate = makeValidCandidate({ retentionUntil: "2026-08-20T00:00:00Z" }); // Expired before evaluation date
      const res = validateCalibrationCandidate(candidate, baseContext);
      expect(res.valid).toBe(false);
      expect(res.rejectedReasons.some((r) => r.code === "expired_retention")).toBe(true);
    });

    it("rejects duplicate outcome links", () => {
      const candidate = makeValidCandidate({ experimentOutcomeId: "outcome-already-linked-99" });
      const res = validateCalibrationCandidate(candidate, baseContext);
      expect(res.valid).toBe(false);
      expect(res.rejectedReasons.some((r) => r.code === "duplicate_link")).toBe(true);
    });
  });

  describe("evaluateDescriptiveCalibration", () => {
    it("returns no_evidence when zero candidates provided", () => {
      const summary = evaluateDescriptiveCalibration([], baseContext);
      expect(summary.policy).toBe(CALIBRATION_POLICY);
      expect(summary.readinessStatus).toBe("no_evidence");
      expect(summary.acceptedSamplesCount).toBe(0);
      expect(summary.distribution).toBeNull();
      expect(summary.simulationEvidenceClass).toBe("simulation");
    });

    it("returns insufficient_evidence when accepted samples are below sample gate", () => {
      const candidates = [
        makeValidCandidate({ experimentOutcomeId: "o1", value: 100 }),
        makeValidCandidate({ experimentOutcomeId: "o2", value: 200 }),
      ]; // Context requires 3 min samples

      const summary = evaluateDescriptiveCalibration(candidates, baseContext);
      expect(summary.readinessStatus).toBe("insufficient_evidence");
      expect(summary.acceptedSamplesCount).toBe(2);
      expect(summary.distribution?.count).toBe(2);
      expect(summary.distribution?.min).toBe(100);
      expect(summary.distribution?.max).toBe(200);
    });

    it("computes accurate descriptive statistics and sufficient_evidence when sample gate is met", () => {
      const candidates = [
        makeValidCandidate({ experimentOutcomeId: "o1", value: 10, observedAt: "2026-08-30T10:00:00Z" }),
        makeValidCandidate({ experimentOutcomeId: "o2", value: 20, observedAt: "2026-08-30T11:00:00Z" }),
        makeValidCandidate({ experimentOutcomeId: "o3", value: 30, observedAt: "2026-08-30T12:00:00Z" }),
        makeValidCandidate({ experimentOutcomeId: "o4", value: 40, observedAt: "2026-08-30T13:00:00Z" }),
        makeValidCandidate({ experimentOutcomeId: "o5", value: 50, observedAt: "2026-08-30T14:00:00Z" }),
      ];

      const summary = evaluateDescriptiveCalibration(candidates, baseContext);
      expect(summary.readinessStatus).toBe("sufficient_evidence");
      expect(summary.acceptedSamplesCount).toBe(5);
      expect(summary.distribution).toEqual({
        count: 5,
        min: 10,
        max: 50,
        median: 30,
        q1: 15,
        q3: 45,
        iqr: 30,
      });
      expect(summary.timeRange).toEqual({
        earliestObservedAt: "2026-08-30T10:00:00Z",
        latestObservedAt: "2026-08-30T14:00:00Z",
      });
    });

    it("strictly preserves simulation evidence class and treats human approval as governance only", () => {
      const candidates = [
        makeValidCandidate({ experimentOutcomeId: "o1", value: 500 }),
        makeValidCandidate({ experimentOutcomeId: "o2", value: 600 }),
        makeValidCandidate({ experimentOutcomeId: "o3", value: 700 }),
      ];

      const summary = evaluateDescriptiveCalibration(candidates, baseContext);
      expect(summary.simulationEvidenceClass).toBe("simulation");
      expect(summary.governanceState.isHumanApproved).toBe(true);
      expect(summary.governanceState.simulationReviewDecision).toBe("accepted");
      expect(summary.governanceState.note).toContain("administrative governance");

      // Invariant: zero predictive accuracy, lift, ROI, virality, or algorithm score
      const rawSummary = summary as unknown as Record<string, unknown>;
      expect(rawSummary.accuracy).toBeUndefined();
      expect(rawSummary.lift).toBeUndefined();
      expect(rawSummary.roi).toBeUndefined();
      expect(rawSummary.reachProbability).toBeUndefined();
      expect(rawSummary.conversionProbability).toBeUndefined();
      expect(rawSummary.viralityScore).toBeUndefined();
      expect(rawSummary.algorithmScore).toBeUndefined();
      expect(rawSummary.confidenceInterval).toBeUndefined();
    });

    it("tracks and reports all rejected candidates with clear reasons", () => {
      const candidates = [
        makeValidCandidate({ experimentOutcomeId: "valid-1", value: 100 }),
        makeValidCandidate({ experimentOutcomeId: "cross-ws", workspaceId: "ws-foreign" }),
        makeValidCandidate({ experimentOutcomeId: "synthetic", evidenceClass: "simulation" }),
      ];

      const summary = evaluateDescriptiveCalibration(candidates, baseContext);
      expect(summary.totalCandidatesEvaluated).toBe(3);
      expect(summary.acceptedSamplesCount).toBe(1);
      expect(summary.rejectedSamplesCount).toBe(2);
      expect(summary.rejectionDetails).toHaveLength(2);
      expect(summary.rejectionDetails[0].code).toBe("workspace_mismatch");
      expect(summary.rejectionDetails[1].code).toBe("synthetic_vote_rejected");
    });
  });
});
