import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ isSupabaseConfigured: false, supabase: {} }));

import { createExperiment, importOutcomes, isMissingTableError, listExperiments } from "./experiments";

describe("experiments client without configuration", () => {
  it("fails closed with a typed error, never an empty list", async () => {
    expect(await listExperiments("w")).toEqual({ data: null, error: "Supabase is not configured." });
    const r = await createExperiment({ workspaceId: "w", userId: "u", title: "t", hypothesis: "h".repeat(20), primaryMetricKey: "m", variantTwinIds: ["a", "b"], minObservationsPerVariant: 3, outcomeSource: "csv_import" });
    expect(r.error).toBe("Supabase is not configured.");
  });
  it("refuses an empty import and fails closed when unconfigured", async () => {
    const base = { workspaceId: "w", userId: "u", experimentId: "e", metricKey: "m", sourceId: "s", sourceCitability: "verified" as const, batchId: "b" };
    expect(await importOutcomes({ ...base, rows: [] })).toEqual({ data: null, error: "Supabase is not configured." });
  });

  it("recognises pending-migration errors", () => {
    expect(isMissingTableError('relation "public.experiments" does not exist')).toBe(true);
    expect(isMissingTableError("Could not find the table in the schema cache")).toBe(true);
    expect(isMissingTableError("permission denied")).toBe(false);
  });
});
