import { describe, expect, it } from "vitest";
import { deriveGuidance, type WorkspaceFacts } from "./decisionRoom";

const empty: WorkspaceFacts = {
  hasBrandName: false,
  approvedClaimCount: 0,
  assetCount: 0,
  twinCount: 0,
  sourceCount: 0,
  citableSourceCount: 0,
  metricDefinitionCount: 0,
  experimentCount: 0,
  observedOutcomeCount: 0,
  postObservationCount: 0
};

describe("deriveGuidance", () => {
  it("points at the brand step first in an empty workspace", () => {
    const g = deriveGuidance(empty);
    expect(g.next?.id).toBe("brand");
    expect(g.steps.filter((s) => s.state === "waiting")).toHaveLength(7);
    expect(g.summary).toMatch(/^0 of 8 steps done/);
  });

  it("marks exactly one step as next and never skips a gap", () => {
    const g = deriveGuidance({ ...empty, hasBrandName: true, assetCount: 2, twinCount: 1 });
    expect(g.steps.filter((s) => s.state === "next")).toHaveLength(1);
    expect(g.next?.id).toBe("sources");
  });

  it("treats a registered but non-citable source as not done", () => {
    const g = deriveGuidance({ ...empty, hasBrandName: true, assetCount: 1, twinCount: 1, sourceCount: 3, citableSourceCount: 0 });
    expect(g.next?.id).toBe("sources");
    expect(g.next?.detail).toMatch(/none are citable/);
  });

  it("blocks steps whose tables are unavailable and says why", () => {
    const g = deriveGuidance({ ...empty, hasBrandName: true, assetCount: 1, twinCount: 1, citableSourceCount: 1, sourceCount: 1, metricDefinitionCount: 1, observedOutcomeCount: null, postObservationCount: null });
    const blocked = g.steps.filter((s) => s.state === "blocked").map((s) => s.id);
    expect(blocked).toEqual(["experiment", "outcomes", "history"]);
    expect(g.next).toBeNull();
    expect(g.summary).toMatch(/blocked by pending migrations, not by your input/);
  });

  it("reports completion without claiming any result", () => {
    const g = deriveGuidance({
      hasBrandName: true, approvedClaimCount: 3, assetCount: 1, twinCount: 2, sourceCount: 1,
      citableSourceCount: 1, metricDefinitionCount: 1, experimentCount: 1, observedOutcomeCount: 40, postObservationCount: 55
    });
    expect(g.next).toBeNull();
    expect(g.summary).toMatch(/Any remaining gap is evidence, not configuration/);
    expect(g.summary).not.toMatch(/win|success|improve/);
  });
});
