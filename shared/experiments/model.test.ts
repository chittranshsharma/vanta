import { describe, expect, it } from "vitest";
import { calibrationReadiness, canTransitionExperiment, evaluateReadiness, validateOutcomeRows, type ExperimentDefinition } from "./model";

const def: ExperimentDefinition = {
  hypothesis: "A proof-point-led hook beats a question-led hook on completion rate.",
  primaryMetricKey: "completion_rate",
  variantTwinIds: ["a", "b"],
  minObservationsPerVariant: 3,
  outcomeSource: "csv_import"
};

describe("evaluateReadiness", () => {
  it("is ready when everything is declared and present", () => {
    expect(evaluateReadiness(def, { metricDefined: true, variantsExist: ["a", "b"], sourceState: "not_applicable" })).toEqual({ state: "ready", blockers: [] });
  });
  it("lists every blocker instead of the first", () => {
    const r = evaluateReadiness({ ...def, hypothesis: "short", variantTwinIds: ["a"], outcomeSource: "none" }, { metricDefined: false, variantsExist: [], sourceState: "unknown" });
    expect(r.state).toBe("blocked");
    expect(r.blockers.length).toBeGreaterThanOrEqual(5);
  });
  it("blocks a connector-sourced experiment while the connector is unknown", () => {
    const r = evaluateReadiness({ ...def, outcomeSource: "connector" }, { metricDefined: true, variantsExist: ["a", "b"], sourceState: "unknown" });
    expect(r.blockers).toEqual([expect.stringMatching(/connector is unknown/)]);
  });
});

describe("validateOutcomeRows", () => {
  const base = { variant_twin_id: "a", metric_key: "completion_rate", value: 0.4, observed_at: "2026-08-01T00:00:00Z", source_id: "s1", source_kind: "csv_import" as const };
  it("accepts only sourced, in-scope, finite rows and labels them observed", () => {
    const v = validateOutcomeRows([
      base,
      { ...base, source_id: null },
      { ...base, variant_twin_id: "zzz" },
      { ...base, metric_key: "other" },
      { ...base, value: Number.NaN },
      { ...base, observed_at: "nope" }
    ], def);
    expect(v.accepted).toHaveLength(1);
    expect(v.accepted[0].evidence_class).toBe("observed");
    expect(v.rejected.map((r) => r.reason)).toEqual([
      expect.stringMatching(/no source/),
      expect.stringMatching(/not part/),
      expect.stringMatching(/primary metric/),
      expect.stringMatching(/finite/),
      expect.stringMatching(/timestamp/)
    ]);
  });
});

describe("calibrationReadiness", () => {
  it("is insufficient until every variant meets the minimum and never names a winner", () => {
    const r = calibrationReadiness(def, [{ variant_twin_id: "a" }, { variant_twin_id: "a" }, { variant_twin_id: "a" }, { variant_twin_id: "b" }]);
    expect(r.state).toBe("insufficient");
    expect(r.perVariant).toEqual([{ variant_twin_id: "a", observations: 3, needed: 3 }, { variant_twin_id: "b", observations: 1, needed: 3 }]);
    const ok = calibrationReadiness(def, Array.from({ length: 6 }, (_, i) => ({ variant_twin_id: i % 2 ? "a" : "b" })));
    expect(ok.state).toBe("ready");
    expect(ok.note).not.toMatch(/win|best|better/);
  });
});

describe("transitions", () => {
  it("follows the declared state machine", () => {
    expect(canTransitionExperiment("draft", "ready")).toBe(true);
    expect(canTransitionExperiment("draft", "concluded")).toBe(false);
    expect(canTransitionExperiment("concluded", "running")).toBe(false);
    expect(canTransitionExperiment("running", "awaiting_outcomes")).toBe(true);
  });
});
