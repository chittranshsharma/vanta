import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  configured: false,
  result: { count: null as number | null, error: null as { message: string; code?: string } | null },
  /** The select options the client passed, so a test can assert it never pulled model output. */
  selectArgs: [] as Array<[string, unknown]>,
  filters: [] as Array<[string, string]>
}));

vi.mock("./supabase", () => ({
  get isSupabaseConfigured() {
    return mockState.configured;
  },
  supabase: {
    from: () => ({
      select: (columns: string, options?: unknown) => {
        mockState.selectArgs.push([columns, options]);
        return {
          eq: (column: string, value: string) => {
            mockState.filters.push([column, value]);
            return Promise.resolve(mockState.result);
          }
        };
      }
    })
  }
}));

import { countModelRuns, modelRunSummary } from "./modelRuns";

beforeEach(() => {
  mockState.configured = true;
  mockState.result = { count: 0, error: null };
  mockState.selectArgs = [];
  mockState.filters = [];
});

describe("countModelRuns", () => {
  it("reports unknown rather than zero when Supabase is not configured", async () => {
    mockState.configured = false;
    const result = await countModelRuns("w1");
    expect(result).toEqual({ state: "unconfigured" });
    expect(modelRunSummary(result)).toContain("unknown");
  });

  it("counts with a head request, so no model output reaches the browser", async () => {
    await countModelRuns("w1");
    expect(mockState.selectArgs).toEqual([["id", { count: "exact", head: true }]]);
    expect(mockState.filters).toEqual([["workspace_id", "w1"]]);
  });

  it("reports an observed zero as an observation", async () => {
    mockState.result = { count: 0, error: null };
    const result = await countModelRuns("w1");
    expect(result).toEqual({ state: "counted", count: 0 });
    expect(modelRunSummary(result)).toBe("No model task run has been recorded for this workspace.");
  });

  it("reports a real count", async () => {
    mockState.result = { count: 3, error: null };
    const result = await countModelRuns("w1");
    expect(result).toEqual({ state: "counted", count: 3 });
    expect(modelRunSummary(result)).toContain("3 model task run(s)");
  });

  it("does not report a withheld count as zero", async () => {
    // No error and no number is a count the server declined to return. Calling
    // that zero would invent the very evidence the panel is there to report.
    mockState.result = { count: null, error: null };
    const result = await countModelRuns("w1");
    expect(result).toEqual({ state: "unreadable", reason: "The database returned no count." });
    expect(modelRunSummary(result)).toContain("unknown");
  });

  it("separates a pending migration from a permission refusal", async () => {
    mockState.result = { count: null, error: { message: 'relation "public.model_task_runs" does not exist', code: "42P01" } };
    expect(await countModelRuns("w1")).toEqual({ state: "not_applied" });

    mockState.result = { count: null, error: { message: "permission denied for table model_task_runs", code: "42501" } };
    expect(await countModelRuns("w1")).toEqual({ state: "denied" });
  });

  it("keeps an unexpected message visible", async () => {
    mockState.result = { count: null, error: { message: "TypeError: Failed to fetch" } };
    expect(await countModelRuns("w1")).toEqual({ state: "unreadable", reason: "TypeError: Failed to fetch" });
  });
});

describe("modelRunSummary", () => {
  it("only asserts an absence for a state that read one", () => {
    for (const state of [
      { state: "unconfigured" } as const,
      { state: "not_applied" } as const,
      { state: "denied" } as const,
      { state: "unreadable", reason: "boom" } as const
    ]) {
      expect(modelRunSummary(state)).toMatch(/^Run history is unknown/);
    }
  });
});
