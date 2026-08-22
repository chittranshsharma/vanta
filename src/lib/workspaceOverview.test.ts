import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  configured: true,
  responses: {} as Record<string, { data: unknown; count?: number | null; error: { message: string; code?: string } | null }>,
}));

vi.mock("./supabase", () => ({
  get isSupabaseConfigured() {
    return mockState.configured;
  },
  supabase: {
    from: (table: string) => {
      const result = mockState.responses[table] ?? { data: null, error: { message: "unmocked" } };
      const chain = {
        select: () => chain,
        // Count queries resolve directly on .eq(); list queries resolve on .order().
        eq: () => Object.assign(Promise.resolve(result), chain),
        order: () => Promise.resolve(result),
        maybeSingle: () => Promise.resolve(result),
      };
      return chain;
    },
  },
}));

import { EMPTY_OVERVIEW, fetchWorkspaceOverview } from "./workspaceOverview";

beforeEach(() => {
  mockState.configured = true;
  mockState.responses = {
    source_registry: { data: [{ id: "s1" }], error: null },
    brands: { data: { id: "b1", name: "Acme" }, error: null },
    creative_assets: { data: [], error: null },
    creative_twins: { data: null, count: 2, error: null },
    metric_definitions: { data: null, count: 1, error: null },
    experiments: { data: null, count: null, error: { message: 'relation "public.experiments" does not exist' } },
    experiment_outcomes: { data: null, count: null, error: { message: 'relation "public.experiment_outcomes" does not exist' } },
    post_observations: { data: null, count: null, error: { message: 'relation "public.post_observations" does not exist' } },
  };
});

describe("fetchWorkspaceOverview", () => {
  it("returns data with no errors when all three queries succeed", async () => {
    const res = await fetchWorkspaceOverview("ws");
    expect(res.errors).toEqual([]);
    expect(res.data.sources).toHaveLength(1);
    expect(res.data.brand).toEqual({ id: "b1", name: "Acme" });
    expect(res.data.assets).toEqual([]);
    expect(res.data.counts.twins).toBe(2);
    expect(res.data.counts.metricDefinitions).toBe(1);
  });

  it("treats an absent table as an unknown count, not as a read failure", async () => {
    const res = await fetchWorkspaceOverview("ws");
    expect(res.errors).toEqual([]);
    expect(res.data.counts.experiments).toBeNull();
    expect(res.data.counts.observedOutcomes).toBeNull();
    expect(res.data.counts.postObservations).toBeNull();
  });

  it("reports a genuine count failure as an error", async () => {
    mockState.responses.creative_twins = { data: null, count: null, error: { message: "permission denied" } };
    const res = await fetchWorkspaceOverview("ws");
    expect(res.errors).toEqual(["Creative twins: permission denied"]);
    expect(res.data.counts.twins).toBe(0);
  });

  it("reports a failed query instead of presenting it as an empty state", async () => {
    mockState.responses.source_registry = { data: null, error: { message: "permission denied" } };
    const res = await fetchWorkspaceOverview("ws");
    expect(res.errors).toEqual(["Sources: permission denied"]);
    expect(res.data.sources).toEqual([]);
    expect(res.data.brand).not.toBeNull();
  });

  it("reports every failed query independently", async () => {
    mockState.responses.brands = { data: null, error: { message: "relation missing" } };
    mockState.responses.creative_assets = { data: null, error: { message: "timeout" } };
    const res = await fetchWorkspaceOverview("ws");
    expect(res.errors).toHaveLength(2);
    expect(res.errors[0]).toMatch(/Brand Brain/);
    expect(res.errors[1]).toMatch(/Creative assets/);
  });

  it("fails closed when Supabase is not configured", async () => {
    mockState.configured = false;
    const res = await fetchWorkspaceOverview("ws");
    expect(res.data).toEqual(EMPTY_OVERVIEW);
    expect(res.errors).toEqual(["Supabase is not configured."]);
  });
});
