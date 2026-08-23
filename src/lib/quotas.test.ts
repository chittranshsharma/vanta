import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  configured: false,
  result: { data: null as Array<Record<string, unknown>> | null, error: null as { message: string; code?: string } | null },
  /** Every `.eq()` the select chain applied, so a test can assert workspace scoping. */
  filters: [] as Array<[string, string]>
}));

vi.mock("./supabase", () => ({
  get isSupabaseConfigured() {
    return mockState.configured;
  },
  supabase: {
    from: () => ({
      select: () => ({
        eq: (column: string, value: string) => {
          mockState.filters.push([column, value]);
          return Promise.resolve(mockState.result);
        }
      })
    })
  }
}));

import { describeQuota, fetchQuotas, quotaSummary, type QuotaRead } from "./quotas";

const NOW = new Date("2026-08-23T09:00:00.000Z");

beforeEach(() => {
  mockState.configured = true;
  mockState.result = { data: [], error: null };
  mockState.filters = [];
});

describe("fetchQuotas", () => {
  it("reports unconfigured rather than an empty budget", async () => {
    mockState.configured = false;
    expect(await fetchQuotas("w1")).toEqual({ state: "unconfigured" });
  });

  it("scopes the read to the workspace", async () => {
    await fetchQuotas("w1");
    expect(mockState.filters).toEqual([["workspace_id", "w1"]]);
  });

  it("keeps the failure kind so the caller can tell absent from denied", async () => {
    mockState.result = { data: null, error: { message: "Could not find the table in the schema cache" } };
    expect(await fetchQuotas("w1")).toEqual({
      state: "unreadable",
      failure: "absent",
      reason: "Could not find the table in the schema cache"
    });

    mockState.result = { data: null, error: { message: "permission denied for table workspace_quotas", code: "42501" } };
    const denied = await fetchQuotas("w1");
    expect(denied).toMatchObject({ state: "unreadable", failure: "denied" });
  });

  it("drops a kind this build does not know instead of relabelling it", async () => {
    mockState.result = {
      data: [
        { kind: "job_enqueue", daily_limit: 200, used_today: 3, window_date: "2026-08-23" },
        { kind: "vector_search", daily_limit: 10, used_today: 1, window_date: "2026-08-23" }
      ],
      error: null
    };
    const read = await fetchQuotas("w1");
    expect(read).toEqual({
      state: "read",
      rows: [{ kind: "job_enqueue", daily_limit: 200, used_today: 3, window_date: "2026-08-23" }]
    });
  });
});

describe("describeQuota", () => {
  const read = (rows: Array<{ kind: "job_enqueue"; daily_limit: number; used_today: number; window_date: string }>): QuotaRead => ({
    state: "read",
    rows
  });

  it("reports a pending migration as not_applied, not as an absent budget", () => {
    const state = describeQuota("job_enqueue", { state: "unreadable", failure: "absent", reason: "no table" }, NOW);
    expect(state).toEqual({ state: "not_applied" });
    expect(quotaSummary(state)).toContain("migration 015");
    // An unreachable quota table does not mean an unlimited one: enqueueJob
    // consumes the quota first and fails closed.
    expect(quotaSummary(state)).toContain("fails closed");
  });

  it("reports an authorization refusal separately from a read failure", () => {
    expect(describeQuota("job_enqueue", { state: "unreadable", failure: "denied", reason: "denied" }, NOW)).toEqual({ state: "denied" });
    expect(describeQuota("job_enqueue", { state: "unreadable", failure: "failed", reason: "Failed to fetch" }, NOW)).toEqual({
      state: "unreadable",
      reason: "Failed to fetch"
    });
  });

  it("reports a missing configuration as unreadable, never as unlimited", () => {
    expect(describeQuota("job_enqueue", { state: "unconfigured" }, NOW)).toEqual({
      state: "unreadable",
      reason: "Supabase is not configured."
    });
  });

  it("reports a missing row as never_consumed without inventing the default limit", () => {
    const state = describeQuota("job_enqueue", read([]), NOW);
    expect(state).toEqual({ state: "never_consumed" });
    // The number lives in migration 015; copying it here would drift.
    expect(quotaSummary(state)).not.toMatch(/\d/);
  });

  it("does not read another kind's row as this kind's budget", () => {
    const other = read([{ kind: "job_enqueue", daily_limit: 200, used_today: 200, window_date: "2026-08-23" }]);
    expect(describeQuota("model_call", other, NOW)).toEqual({ state: "never_consumed" });
  });

  it("reports a stale row as reset_pending rather than as today's usage", () => {
    const state = describeQuota("job_enqueue", read([{ kind: "job_enqueue", daily_limit: 200, used_today: 200, window_date: "2026-08-22" }]), NOW);
    expect(state).toEqual({ state: "reset_pending", limit: 200, storedDate: "2026-08-22" });
    // An exhausted yesterday must not read as an exhausted today.
    expect(quotaSummary(state)).not.toContain("Nothing further");
  });

  it("compares against the UTC date, matching Postgres CURRENT_DATE", () => {
    // 2026-08-23T23:30Z is already 2026-08-24 in Asia/Kolkata, but the counter
    // has not rolled over on the server, so today's usage is still today's.
    const late = new Date("2026-08-23T23:30:00.000Z");
    expect(describeQuota("job_enqueue", read([{ kind: "job_enqueue", daily_limit: 200, used_today: 5, window_date: "2026-08-23" }]), late)).toEqual({
      state: "available",
      used: 5,
      limit: 200,
      remaining: 195
    });
  });

  it("reports remaining budget", () => {
    expect(describeQuota("job_enqueue", read([{ kind: "job_enqueue", daily_limit: 200, used_today: 8, window_date: "2026-08-23" }]), NOW)).toEqual({
      state: "available",
      used: 8,
      limit: 200,
      remaining: 192
    });
  });

  it("reports exhaustion at and beyond the limit", () => {
    expect(describeQuota("job_enqueue", read([{ kind: "job_enqueue", daily_limit: 200, used_today: 200, window_date: "2026-08-23" }]), NOW)).toEqual({
      state: "exhausted",
      used: 200,
      limit: 200
    });
    expect(describeQuota("job_enqueue", read([{ kind: "job_enqueue", daily_limit: 200, used_today: 201, window_date: "2026-08-23" }]), NOW)).toMatchObject({
      state: "exhausted"
    });
  });
});

describe("quotaSummary", () => {
  it("never reports a budget the read did not prove", () => {
    for (const state of [
      { state: "not_applied" } as const,
      { state: "denied" } as const,
      { state: "unreadable", reason: "boom" } as const,
      { state: "never_consumed" } as const
    ]) {
      expect(quotaSummary(state)).not.toMatch(/used today/);
    }
  });
});
