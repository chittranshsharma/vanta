import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ isSupabaseConfigured: false, supabase: {} }));

import { importPostObservations, listPostObservations } from "./postHistory";

describe("post history client without configuration", () => {
  it("returns typed errors rather than empty history", async () => {
    expect(await listPostObservations("w")).toEqual({ data: null, error: "Supabase is not configured." });
    const r = await importPostObservations({ workspaceId: "w", userId: "u", sourceId: "s", sourceCitability: "verified", metricKey: "views", rows: [], batchId: "b" });
    expect(r.error).toBe("Supabase is not configured.");
  });
});
