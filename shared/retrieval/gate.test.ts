import { describe, expect, it } from "vitest";
import { DEFAULT_GATE_POLICY, chunkText, gateCandidates, type GatePolicy, type RetrievalCandidate } from "./gate";

const policy: GatePolicy = { ...DEFAULT_GATE_POLICY, workspaceId: "w1", expectedModel: "m1" };

type Row = NonNullable<RetrievalCandidate["row"]>;
function cand(over: Omit<Partial<RetrievalCandidate>, "row"> & { row?: Partial<Row> | null } = {}): RetrievalCandidate {
  const { row, ...rest } = over;
  return {
    source_table: "brand_proof_points",
    source_id: "p1",
    chunk_index: 0,
    similarity: 0.9,
    embedding_model: "m1",
    row:
      row === null
        ? null
        : { workspace_id: "w1", review_status: "approved", evidence_class: "observed", citability: "verified", text: "proof", ...row },
    ...rest,
  };
}

describe("gateCandidates", () => {
  it("accepts an approved, fresh, observed candidate above threshold and tags it as a candidate", () => {
    const r = gateCandidates([cand()], policy);
    expect(r.accepted).toHaveLength(1);
    expect(r.accepted[0].kind).toBe("retrieval_candidate");
    expect(r.rejected).toEqual([]);
  });

  it("rejects rows the caller cannot see", () => {
    expect(gateCandidates([cand({ row: null })], policy).rejected[0].reason).toBe("row_not_visible");
  });

  it("rejects a workspace mismatch even if the vector search returned it", () => {
    expect(gateCandidates([cand({ row: { workspace_id: "w2" } })], policy).rejected[0].reason).toBe("workspace_mismatch");
  });

  it("rejects a different embedding model", () => {
    expect(gateCandidates([cand({ embedding_model: "m2" })], policy).rejected[0].reason).toBe("model_mismatch");
  });

  it("rejects below the similarity floor", () => {
    expect(gateCandidates([cand({ similarity: 0.5 })], policy).rejected[0].reason).toBe("below_similarity");
  });

  it("rejects drafts, disallowed evidence classes, and stale or blocked sources", () => {
    expect(gateCandidates([cand({ row: { review_status: "draft" } })], policy).rejected[0].reason).toBe("not_approved");
    expect(gateCandidates([cand({ row: { evidence_class: "simulation" } })], policy).rejected[0].reason).toBe("evidence_class");
    expect(gateCandidates([cand({ row: { citability: "citable_stale" } })], policy).rejected[0].reason).toBe("citability");
    expect(gateCandidates([cand({ row: { citability: "blocked" } })], policy).rejected[0].reason).toBe("citability");
  });

  it("brand_claims need approval but carry no evidence class", () => {
    const r = gateCandidates([cand({ source_table: "brand_claims", row: { evidence_class: null, citability: null } })], policy);
    expect(r.accepted).toHaveLength(1);
  });

  it("caps chunks per source and total, keeping the most similar", () => {
    const cs = [
      cand({ chunk_index: 0, similarity: 0.95 }),
      cand({ chunk_index: 1, similarity: 0.93 }),
      ...Array.from({ length: 10 }, (_, i) => cand({ source_id: `p${i + 2}`, similarity: 0.9 - i * 0.005 })),
    ];
    const r = gateCandidates(cs, policy);
    expect(r.accepted).toHaveLength(8);
    expect(r.accepted[0].similarity).toBe(0.95);
    expect(r.rejected.map((x) => x.reason)).toContain("per_source_cap");
    expect(r.rejected.map((x) => x.reason)).toContain("total_cap");
  });
});

describe("chunkText", () => {
  it("returns one chunk for short text and none for empty", () => {
    expect(chunkText("hello world")).toEqual(["hello world"]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("splits on whitespace with overlap and covers the whole text", () => {
    const words = Array.from({ length: 400 }, (_, i) => `w${i}`).join(" ");
    const chunks = chunkText(words, 200, 40);
    expect(chunks.length).toBeGreaterThan(5);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(200);
    expect(chunks[0].startsWith("w0 ")).toBe(true);
    expect(chunks[chunks.length - 1].endsWith("w399")).toBe(true);
  });
});
