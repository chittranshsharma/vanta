import { describe, expect, it } from "vitest";
import {
  RATIONALE_MAX_CHARS,
  claimGroundingJsonSchema,
  validateClaimGroundingOutput,
  type GroundingContext,
} from "./claimGroundingAudit.ts";

const ctx: GroundingContext = {
  creativeClaimIds: ["cc-1", "cc-2"],
  brandClaims: new Map([
    ["bc-approved", "approved"],
    ["bc-cond", "conditional"],
    ["bc-prohib", "prohibited"],
  ]),
  proofPoints: new Map([
    ["pp-1", "bc-approved"],
    ["pp-other", "bc-cond"],
  ]),
};

function verdict(overrides: Record<string, unknown> = {}) {
  return {
    creative_claim_id: "cc-1",
    verdict: "backed_by_proof",
    matched_brand_claim_id: "bc-approved",
    cited_proof_point_ids: ["pp-1"],
    rationale: "Matches the approved durability claim; proof point pp-1 documents the test.",
    confidence: "medium",
    ...overrides,
  };
}

const unmatched2 = {
  creative_claim_id: "cc-2",
  verdict: "unmatched",
  matched_brand_claim_id: null,
  cited_proof_point_ids: [],
  rationale: "No brand claim corresponds to this statement.",
  confidence: "low",
};

function run(verdicts: unknown[]) {
  return validateClaimGroundingOutput({ verdicts }, ctx);
}

describe("validateClaimGroundingOutput: accepts", () => {
  it("a complete, well-formed response and assigns evidence classes", () => {
    const res = run([verdict(), unmatched2]);
    expect(res.isValid).toBe(true);
    if (res.isValid) {
      expect(res.data.map((v) => v.evidence_class)).toEqual(["inference", "unknown"]);
    }
  });

  it("approved_no_proof with an approved claim and no citations", () => {
    const res = run([verdict({ verdict: "approved_no_proof", cited_proof_point_ids: [] }), unmatched2]);
    expect(res.isValid).toBe(true);
  });

  it("conditional and prohibited when the brand claim type matches", () => {
    expect(run([verdict({ verdict: "conditional", matched_brand_claim_id: "bc-cond", cited_proof_point_ids: [] }), unmatched2]).isValid).toBe(true);
    expect(run([verdict({ verdict: "prohibited", matched_brand_claim_id: "bc-prohib", cited_proof_point_ids: [] }), unmatched2]).isValid).toBe(true);
  });
});

describe("validateClaimGroundingOutput: rejects", () => {
  function expectError(verdicts: unknown[], pattern: RegExp) {
    const res = run(verdicts);
    expect(res.isValid).toBe(false);
    if (!res.isValid) expect(res.errors.join("\n")).toMatch(pattern);
  }

  it("non-object and wrong top-level shape", () => {
    expect(validateClaimGroundingOutput(null, ctx).isValid).toBe(false);
    expect(validateClaimGroundingOutput([], ctx).isValid).toBe(false);
    expect(validateClaimGroundingOutput({ verdicts: "x" }, ctx).isValid).toBe(false);
  });

  it("unknown top-level and item keys", () => {
    const res = validateClaimGroundingOutput({ verdicts: [verdict(), unmatched2], summary: "great ad" }, ctx);
    expect(res.isValid).toBe(false);
    expectError([verdict({ virality_score: 0.9 }), unmatched2], /disallowed key "virality_score"/);
  });

  it("a missing input claim", () => {
    expectError([verdict()], /Missing verdict for creative claim "cc-2"/);
  });

  it("a duplicate input claim", () => {
    expectError([verdict(), verdict()], /duplicate creative_claim_id/);
  });

  it("a creative claim id outside the input set", () => {
    expectError([verdict({ creative_claim_id: "cc-999" }), unmatched2], /not in the input claim set/);
  });

  it("a brand claim id outside the allowed set (hallucinated citation)", () => {
    expectError([verdict({ matched_brand_claim_id: "bc-fake" }), unmatched2], /not an allowed brand claim/);
  });

  it("a proof point outside the allowed set", () => {
    expectError([verdict({ cited_proof_point_ids: ["pp-fake"] }), unmatched2], /not in the allowed set/);
  });

  it("a proof point that belongs to a different brand claim", () => {
    expectError([verdict({ cited_proof_point_ids: ["pp-other"] }), unmatched2], /does not belong to the matched brand claim/);
  });

  it("backed_by_proof without any citation", () => {
    expectError([verdict({ cited_proof_point_ids: [] }), unmatched2], /requires at least one cited proof point/);
  });

  it("approved_no_proof that cites proof anyway", () => {
    expectError([verdict({ verdict: "approved_no_proof" }), unmatched2], /must not cite proof points/);
  });

  it("verdict type that disagrees with the brand claim type", () => {
    expectError([verdict({ verdict: "prohibited" }), unmatched2], /prohibited requires a prohibited brand claim/);
    expectError([verdict({ verdict: "conditional" }), unmatched2], /conditional requires a conditional brand claim/);
  });

  it("unmatched that still names a brand claim", () => {
    expectError([verdict(), { ...unmatched2, matched_brand_claim_id: "bc-approved" }], /unmatched requires matched_brand_claim_id = null/);
  });

  it("empty or over-long rationale and bad confidence", () => {
    expectError([verdict({ rationale: "" }), unmatched2], /rationale must be a non-empty string/);
    expectError([verdict({ rationale: "x".repeat(RATIONALE_MAX_CHARS + 1) }), unmatched2], /exceeds/);
    expectError([verdict({ confidence: "certain" }), unmatched2], /confidence must be/);
  });

  it("never partially accepts: one bad item rejects the whole response", () => {
    const res = run([verdict(), { ...unmatched2, confidence: "absolute" }]);
    expect(res.isValid).toBe(false);
    expect("data" in res).toBe(false);
  });
});

describe("claimGroundingJsonSchema", () => {
  it("forbids additional properties at both levels and enumerates verdicts", () => {
    const schema = claimGroundingJsonSchema() as {
      additionalProperties: boolean;
      properties: { verdicts: { items: { additionalProperties: boolean; properties: { verdict: { enum: string[] } } } } };
    };
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.verdicts.items.additionalProperties).toBe(false);
    expect(schema.properties.verdicts.items.properties.verdict.enum).toContain("unmatched");
  });

  it("is allowlisted but not enabled by default", async () => {
    const { ALLOWLISTED_TASKS, DEFAULT_ENABLED_TASKS } = await import("../schemas.ts");
    expect(ALLOWLISTED_TASKS).toContain("claim_grounding_audit");
    expect(DEFAULT_ENABLED_TASKS).toEqual(["gateway_health_check"]);
  });
});
