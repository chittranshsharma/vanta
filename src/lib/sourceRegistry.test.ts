import { describe, expect, it } from "vitest";
import { canDisplayNumericClaim, type CitabilityResult, type NumericClaim } from "./evidence";
import { evaluateSourceCitability, type SourceRegistryRow } from "./sourceRegistry";

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
