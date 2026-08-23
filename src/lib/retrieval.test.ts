import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  configured: false,
  result: {
    data: null as Array<{ source_table: string; indexed_rows: number; total_rows: number }> | null,
    error: null as { message: string; code?: string } | null
  },
  calls: [] as Array<[string, unknown]>
}));

vi.mock("./supabase", () => ({
  get isSupabaseConfigured() {
    return mockState.configured;
  },
  supabase: {
    rpc: (fn: string, args: unknown) => {
      mockState.calls.push([fn, args]);
      return Promise.resolve(mockState.result);
    }
  }
}));

import { MISSING_RETRIEVAL_PIECES, fetchRetrievalCoverage, retrievalSummary } from "./retrieval";

beforeEach(() => {
  mockState.configured = true;
  mockState.result = { data: [], error: null };
  mockState.calls = [];
});

describe("fetchRetrievalCoverage", () => {
  it("reports unconfigured rather than zero coverage", async () => {
    mockState.configured = false;
    const coverage = await fetchRetrievalCoverage("w1");
    expect(coverage).toEqual({ state: "unconfigured" });
    expect(retrievalSummary(coverage)).toContain("unknown");
  });

  it("passes the workspace to the SECURITY INVOKER function", async () => {
    await fetchRetrievalCoverage("w1");
    expect(mockState.calls).toEqual([["retrieval_coverage", { p_workspace_id: "w1" }]]);
  });

  it("reports a missing function as a pending migration, not a read failure", async () => {
    // PostgREST reports an absent function as a schema-cache miss, the same way
    // it reports an absent table.
    mockState.result = { data: null, error: { message: "Could not find the function public.retrieval_coverage in the schema cache" } };
    const coverage = await fetchRetrievalCoverage("w1");
    expect(coverage).toEqual({ state: "not_applied" });
    expect(retrievalSummary(coverage)).toContain("not reachable in the environment");
  });

  it("separates a permission refusal from a pending migration", async () => {
    mockState.result = { data: null, error: { message: "permission denied for table codex_embeddings", code: "42501" } };
    expect(await fetchRetrievalCoverage("w1")).toEqual({ state: "denied" });
  });

  it("keeps an unexpected message visible", async () => {
    mockState.result = { data: null, error: { message: "TypeError: Failed to fetch" } };
    expect(await fetchRetrievalCoverage("w1")).toEqual({ state: "unreadable", reason: "TypeError: Failed to fetch" });
  });

  it("reports nothing indexed as its own state, distinct from nothing indexable", async () => {
    mockState.result = { data: [{ source_table: "codex_claims", indexed_rows: 0, total_rows: 40 }], error: null };
    const some = await fetchRetrievalCoverage("w1");
    expect(some).toMatchObject({ state: "nothing_indexed", total: 40 });
    expect(retrievalSummary(some)).toContain("nothing in this build would index them");

    mockState.result = { data: [], error: null };
    const none = await fetchRetrievalCoverage("w1");
    expect(none).toMatchObject({ state: "nothing_indexed", total: 0 });
    expect(retrievalSummary(none)).toContain("no approved codex rows");
  });

  it("sums coverage across source tables once anything is indexed", async () => {
    mockState.result = {
      data: [
        { source_table: "codex_claims", indexed_rows: 12, total_rows: 40 },
        { source_table: "source_observations", indexed_rows: 3, total_rows: 10 }
      ],
      error: null
    };
    const coverage = await fetchRetrievalCoverage("w1");
    expect(coverage).toMatchObject({ state: "covered", indexed: 15, total: 50 });
    expect(retrievalSummary(coverage)).toBe("Retrieval covers 15 of 50 indexable row(s).");
  });
});

describe("MISSING_RETRIEVAL_PIECES", () => {
  it("names every independent absence, so clearing one is not read as progress", () => {
    expect(MISSING_RETRIEVAL_PIECES.length).toBeGreaterThan(1);
    const text = MISSING_RETRIEVAL_PIECES.join(" ");
    expect(text).toContain("embedding provider");
    expect(text).toContain("worker");
    expect(text).toContain("vector search");
  });

  it("does not claim the embedding store is missing, because migration 013 is applied", () => {
    // The gap is that nothing fills or reads the store, not that it is absent.
    // Sending an operator to apply an applied migration wastes the one action
    // they were told to take.
    expect(MISSING_RETRIEVAL_PIECES.join(" ")).not.toMatch(/not applied|pending/i);
  });
});
