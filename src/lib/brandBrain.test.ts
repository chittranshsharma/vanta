import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  configured: false,
  result: { data: null as unknown, error: null as { message: string; code?: string } | null },
  /** Every table read and `.eq()` applied, so a test can assert scoping. */
  tables: [] as string[],
  filters: [] as Array<[string, string]>
}));

vi.mock("./supabase", () => {
  /** One chainable stub: every builder method returns it, and awaiting it resolves the result. */
  const chain: Record<string, unknown> = {
    select: () => chain,
    order: () => chain,
    eq: (column: string, value: string) => {
      mockState.filters.push([column, value]);
      return chain;
    },
    maybeSingle: () => Promise.resolve(mockState.result),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(mockState.result).then(resolve)
  };
  return {
    get isSupabaseConfigured() {
      return mockState.configured;
    },
    supabase: {
      from: (table: string) => {
        mockState.tables.push(table);
        return chain;
      }
    }
  };
});

import {
  brandReadSummary,
  fetchBrandAudiences,
  fetchBrandClaims,
  fetchBrandCodexVersions,
  fetchBrandForWorkspace,
  type BrandReadFailure
} from "./brandBrain";

const DENIED = { message: "permission denied for table brand_claims", code: "42501" };
const OFFLINE = { message: "TypeError: Failed to fetch" };

beforeEach(() => {
  mockState.configured = true;
  mockState.result = { data: null, error: null };
  mockState.tables = [];
  mockState.filters = [];
});

describe("fetchBrandForWorkspace", () => {
  it("reports unconfigured rather than an absent brand", async () => {
    mockState.configured = false;
    const read = await fetchBrandForWorkspace("w1");
    expect(read.error).toEqual({ failure: "unconfigured", message: "Supabase is not configured." });
  });

  it("scopes the read to the workspace", async () => {
    await fetchBrandForWorkspace("w1");
    expect(mockState.tables).toEqual(["brands"]);
    expect(mockState.filters).toEqual([["workspace_id", "w1"]]);
  });

  it("reports no rows as no brand, which is a real state", async () => {
    mockState.result = { data: null, error: null };
    expect(await fetchBrandForWorkspace("w1")).toEqual({ data: null, error: null });
  });

  it("does not report a refused read as an absent brand", async () => {
    // This is the whole point of the change: the screen used to offer to create
    // a brand that may already exist, and the create would then fail.
    mockState.result = { data: null, error: DENIED };
    const read = await fetchBrandForWorkspace("w1");
    expect(read.data).toBeNull();
    expect(read.error).toEqual({ failure: "denied", message: DENIED.message });
  });

  it("returns the brand when the read succeeds", async () => {
    mockState.result = { data: { id: "b1", name: "Acme" }, error: null };
    const read = await fetchBrandForWorkspace("w1");
    expect(read.error).toBeNull();
    expect(read.data).toMatchObject({ id: "b1" });
  });
});

describe("fetchBrandClaims", () => {
  it("does not report an unread claim list as an empty one", async () => {
    // An empty grounding set means "this brand claims nothing", which changes
    // what a variant is allowed to say. It must not stand in for a failed read.
    mockState.result = { data: null, error: OFFLINE };
    const read = await fetchBrandClaims("b1");
    expect(read.data).toBeNull();
    expect(read.error).toEqual({ failure: "offline", message: OFFLINE.message });
  });

  it("reports a genuinely empty claim set as data, not as a failure", async () => {
    mockState.result = { data: [], error: null };
    expect(await fetchBrandClaims("b1")).toEqual({ data: [], error: null });
  });

  it("scopes by brand and applies the claim type filter", async () => {
    mockState.result = { data: [], error: null };
    await fetchBrandClaims("b1", "approved");
    expect(mockState.filters).toEqual([
      ["brand_id", "b1"],
      ["claim_type", "approved"]
    ]);
  });
});

describe("the other codex reads", () => {
  it("all keep the failure class instead of returning an empty list", async () => {
    mockState.result = { data: null, error: DENIED };
    for (const read of [await fetchBrandAudiences("b1"), await fetchBrandCodexVersions("b1")]) {
      expect(read.data).toBeNull();
      expect(read.error?.failure).toBe("denied");
    }
  });
});

describe("brandReadSummary", () => {
  it("invites a retry only for a request that never arrived", async () => {
    expect(brandReadSummary({ failure: "offline", message: OFFLINE.message })).toMatch(/try again/i);
    expect(brandReadSummary({ failure: "denied", message: DENIED.message })).toMatch(/rather than retrying/i);
  });

  it("never describes a failed read as an empty codex", () => {
    const classes: BrandReadFailure[] = ["unconfigured", "denied", "absent", "offline", "failed"];
    for (const failure of classes) {
      const line = brandReadSummary({ failure, message: "boom" });
      expect(line).not.toMatch(/no claims|no brand|empty/i);
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it("keeps the platform message for the classes where it is the only detail", () => {
    expect(brandReadSummary({ failure: "failed", message: "statement timeout" })).toContain("statement timeout");
    expect(brandReadSummary({ failure: "absent", message: "relation does not exist" })).toContain("relation does not exist");
  });
});
