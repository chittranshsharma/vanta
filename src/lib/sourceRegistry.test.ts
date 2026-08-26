import { beforeEach, describe, expect, it, vi } from "vitest";
import { canDisplayNumericClaim, type CitabilityResult, type NumericClaim } from "./evidence";
import {
  evaluateSourceCitability,
  fetchEvidenceItems,
  fetchMetricDefinitions,
  fetchSourcesForWorkspace,
  resolveEvidenceCitability,
  type SourceRegistryRow
} from "./sourceRegistry";

const mockState = vi.hoisted(() => ({
  configured: true,
  result: { data: null as unknown, error: null as { message: string; code?: string } | null },
  tables: [] as string[]
}));

vi.mock("./supabase", () => {
  /** One chainable stub: every builder method returns it, and awaiting it resolves the result. */
  const chain: Record<string, unknown> = {
    select: () => chain,
    order: () => chain,
    eq: () => chain,
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

function createMockSource(overrides: Partial<SourceRegistryRow> = {}): SourceRegistryRow {
  return {
    id: "src-001",
    workspace_id: "ws-001",
    created_by: "user-001",
    name: "Test Source",
    source_type: "url",
    url: "https://example.com/data",
    description: "Mock source for testing",
    health_status: "unverified",
    last_verified_at: null,
    freshness_window_days: 30,
    source_coverage: "unknown",
    review_status: "draft",
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
}

const validClaim: NumericClaim = {
  metricKey: "click_through_rate",
  value: 0.042,
  unit: "%",
  definition: "Clicks divided by impressions",
  sourceEvidenceId: "ev-001",
  timeWindow: "2026-08-01 to 2026-08-15",
  completeness: "complete"
};

describe("evaluateSourceCitability pure logic", () => {
  it("returns blocked when source is null", () => {
    const result = evaluateSourceCitability(null);
    expect(result.status).toBe("blocked");
  });

  it("returns blocked when source is disconnected", () => {
    const source = createMockSource({ health_status: "disconnected" });
    const result = evaluateSourceCitability(source);
    expect(result.status).toBe("blocked");
  });

  it("returns citable_unverified for unverified manual sources", () => {
    const source = createMockSource({ health_status: "unverified" });
    const result = evaluateSourceCitability(source);
    expect(result.status).toBe("citable_unverified");
    if (result.status === "citable_unverified") {
      expect(result.sourceId).toBe("src-001");
      expect(result.warning).toBeDefined();
    }
  });

  it("returns citable_stale when health_status is explicitly stale", () => {
    const source = createMockSource({ health_status: "stale" });
    const result = evaluateSourceCitability(source);
    expect(result.status).toBe("citable_stale");
  });

  it("returns citable_stale for connected source without last_verified_at timestamp", () => {
    const source = createMockSource({ health_status: "connected", last_verified_at: null });
    const result = evaluateSourceCitability(source);
    expect(result.status).toBe("citable_stale");
  });

  it("returns citable_stale when connected source exceeds freshness window", () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const source = createMockSource({
      health_status: "connected",
      last_verified_at: fortyDaysAgo,
      freshness_window_days: 30
    });
    const result = evaluateSourceCitability(source);
    expect(result.status).toBe("citable_stale");
  });

  it("returns verified for connected source within freshness window", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const source = createMockSource({
      health_status: "connected",
      last_verified_at: twoDaysAgo,
      freshness_window_days: 30
    });
    const result = evaluateSourceCitability(source);
    expect(result.status).toBe("verified");
    if (result.status === "verified") {
      expect(result.sourceId).toBe("src-001");
    }
  });
});

describe("canDisplayNumericClaim with citability guards", () => {
  it("allows claim when citability is verified", () => {
    const citability: CitabilityResult = { status: "verified", sourceId: "src-001" };
    expect(canDisplayNumericClaim(validClaim, citability)).toBe(true);
  });

  it("blocks numeric claim when citability is citable_unverified (manual sources cannot support verified numeric claims)", () => {
    const citability: CitabilityResult = {
      status: "citable_unverified",
      sourceId: "src-001",
      warning: "Unverified"
    };
    expect(canDisplayNumericClaim(validClaim, citability)).toBe(false);
  });

  it("blocks numeric claim when citability is citable_stale", () => {
    const citability: CitabilityResult = {
      status: "citable_stale",
      sourceId: "src-001",
      warning: "Stale"
    };
    expect(canDisplayNumericClaim(validClaim, citability)).toBe(false);
  });

  it("blocks numeric claim when citability is blocked", () => {
    const citability: CitabilityResult = {
      status: "blocked",
      reason: "Disconnected"
    };
    expect(canDisplayNumericClaim(validClaim, citability)).toBe(false);
  });

  it("blocks numeric claim if incomplete, even with verified citability", () => {
    const citability: CitabilityResult = { status: "verified", sourceId: "src-001" };
    const incompleteClaim: NumericClaim = { ...validClaim, completeness: "partial" };
    expect(canDisplayNumericClaim(incompleteClaim, citability)).toBe(false);
  });
});

describe("registry reads report a failure class instead of an empty registry", () => {
  beforeEach(() => {
    mockState.configured = true;
    mockState.result = { data: null, error: null };
    mockState.tables = [];
  });

  it("returns the rows a successful read produced", async () => {
    mockState.result = { data: [createMockSource()], error: null };
    const res = await fetchSourcesForWorkspace("ws-001");
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(1);
    expect(mockState.tables).toEqual(["source_registry"]);
  });

  it("distinguishes a genuinely empty registry from a registry that was not read", async () => {
    mockState.result = { data: [], error: null };
    const empty = await fetchSourcesForWorkspace("ws-001");
    expect(empty.error).toBeNull();
    expect(empty.data).toEqual([]);

    mockState.result = { data: null, error: { message: "permission denied for table source_registry", code: "42501" } };
    const denied = await fetchSourcesForWorkspace("ws-001");
    // Same screen, opposite meaning: one workspace has registered nothing, the
    // other may have registered everything and refused this reader.
    expect(denied.data).toBeNull();
    expect(denied.error?.failure).toBe("denied");
  });

  it("never reports a failed evidence read as no evidence", async () => {
    mockState.result = { data: null, error: { message: "Failed to fetch" } };
    const res = await fetchEvidenceItems("ws-001");
    expect(res.data).toBeNull();
    expect(res.error?.failure).toBe("offline");
  });

  it("keeps filters working on the evidence read", async () => {
    mockState.result = { data: [], error: null };
    const res = await fetchEvidenceItems("ws-001", { sourceId: "src-001", evidenceClass: "observed" });
    expect(res.error).toBeNull();
    expect(mockState.tables).toEqual(["evidence_items"]);
  });

  it("never reports a failed metric read as no metric definitions", async () => {
    mockState.result = { data: null, error: { message: 'relation "public.metric_definitions" does not exist', code: "42P01" } };
    const res = await fetchMetricDefinitions("ws-001");
    expect(res.data).toBeNull();
    expect(res.error?.failure).toBe("absent");
  });

  it("reports an unconfigured build without pretending to have read anything", async () => {
    mockState.configured = false;
    for (const read of [fetchSourcesForWorkspace("ws-001"), fetchEvidenceItems("ws-001"), fetchMetricDefinitions("ws-001")]) {
      const res = await read;
      expect(res.data).toBeNull();
      expect(res.error?.failure).toBe("unconfigured");
    }
    expect(mockState.tables).toEqual([]);
  });
});

describe("resolveEvidenceCitability separates a refused read from a missing source", () => {
  beforeEach(() => {
    mockState.configured = true;
    mockState.result = { data: null, error: null };
    mockState.tables = [];
  });

  it("does not tell the user to register a source it was not allowed to read", async () => {
    mockState.result = { data: null, error: { message: "permission denied for table source_registry", code: "42501" } };
    const res = await resolveEvidenceCitability("src-001", "ws-001");
    expect(res.status).toBe("blocked");
    // "Not found" would send them to add a row that already exists and that they
    // still would not be able to see.
    expect(res.status === "blocked" && res.reason).toContain("Ask an admin");
    expect(res.status === "blocked" && res.reason).not.toContain("not found");
  });

  it("still reports a genuinely missing source as missing", async () => {
    mockState.result = { data: null, error: null };
    const res = await resolveEvidenceCitability("src-404", "ws-001");
    expect(res.status).toBe("blocked");
    expect(res.status === "blocked" && res.reason).toContain("not found");
  });

  it("evaluates citability when the row was read", async () => {
    mockState.result = { data: createMockSource({ health_status: "disconnected" }), error: null };
    const res = await resolveEvidenceCitability("src-001", "ws-001");
    expect(res.status).toBe("blocked");
    expect(res.status === "blocked" && res.reason).toContain("disconnected");
  });
});
