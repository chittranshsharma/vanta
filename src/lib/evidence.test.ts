import { describe, expect, it } from "vitest";
import { canDisplayNumericClaim, deriveEvidenceState } from "./evidence";

describe("evidence guards", () => {
  it("blocks numeric claims without complete provenance", () => {
    expect(
      canDisplayNumericClaim({
        metricKey: "completion_rate",
        value: 0.62,
        unit: "%",
        definition: "completed views divided by starts"
      })
    ).toBe(false);
  });

  it("allows only fully sourced and complete numeric claims", () => {
    expect(
      canDisplayNumericClaim({
        metricKey: "completion_rate",
        value: 0.62,
        unit: "%",
        definition: "completed views divided by starts",
        sourceEvidenceId: "evidence_01",
        timeWindow: "2026-08-01 to 2026-08-07",
        completeness: "complete"
      })
    ).toBe(true);
  });

  it("returns an insufficient state for missing or conflicting evidence", () => {
    expect(deriveEvidenceState({ sourceCount: 0, hasConflict: false, isFresh: true })).toBe("insufficient");
    expect(deriveEvidenceState({ sourceCount: 2, hasConflict: true, isFresh: true })).toBe("insufficient");
  });
});
