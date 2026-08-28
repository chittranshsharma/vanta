import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  configured: false,
  deleteResult: { data: null as Array<{ id: string }> | null, error: null as { message: string } | null },
  auditError: null as { message: string } | null,
  rpcResult: null as { data: unknown; error: { message: string } | null } | null,
  /** Every `.eq()` the delete chain applied, so tests can assert the scope. */
  deleteFilters: [] as Array<[string, string]>,
  auditRows: [] as Array<Record<string, unknown>>
}));

vi.mock("./supabase", () => ({
  get isSupabaseConfigured() {
    return mockState.configured;
  },
  supabase: {
    rpc: () => Promise.resolve(mockState.rpcResult ?? { data: null, error: { message: "Could not find the function delete_post_observation_batch" } }),
    from: (table: string) => ({
      delete: () => {
        const chain = {
          eq: (column: string, value: string) => {
            mockState.deleteFilters.push([column, value]);
            return chain;
          },
          select: () => Promise.resolve(mockState.deleteResult)
        };
        return chain;
      },
      insert: (row: Record<string, unknown>) => {
        if (table === "audit_events") mockState.auditRows.push(row);
        const result = { data: [], error: mockState.auditError };
        return Object.assign(Promise.resolve(result), { select: () => Promise.resolve(result) });
      }
    })
  }
}));

import { deleteImportBatch, importPostObservations, listPostObservations } from "./postHistory";

beforeEach(() => {
  mockState.configured = false;
  mockState.deleteResult = { data: [{ id: "o1" }, { id: "o2" }], error: null };
  mockState.rpcResult = null;
  mockState.auditError = null;
  mockState.deleteFilters = [];
  mockState.auditRows = [];
});

describe("post history client without configuration", () => {
  it("returns typed errors rather than empty history", async () => {
    expect(await listPostObservations("w")).toEqual({ data: null, error: "Supabase is not configured." });
    const r = await importPostObservations({ workspaceId: "w", userId: "u", sourceId: "s", sourceCitability: "verified", metricKey: "views", rows: [], batchId: "b" });
    expect(r.error).toBe("Supabase is not configured.");
  });

  it("refuses to delete a batch it cannot reach", async () => {
    expect(await deleteImportBatch({ workspaceId: "w", userId: "u", batchId: "b" })).toEqual({
      data: null,
      error: "Supabase is not configured."
    });
  });
});

describe("deleteImportBatch", () => {
  beforeEach(() => {
    mockState.configured = true;
  });

  it("scopes the delete to the workspace as well as the batch", async () => {
    const res = await deleteImportBatch({ workspaceId: "ws-1", userId: "u", batchId: "batch-a" });
    expect(res).toEqual({ data: { deleted: 2, auditWriteFailed: null }, error: null });
    expect(mockState.deleteFilters).toEqual([
      ["workspace_id", "ws-1"],
      ["import_batch_id", "batch-a"]
    ]);
  });

  it("reports the count the database confirmed, not a predicted one", async () => {
    mockState.deleteResult = { data: [{ id: "o1" }], error: null };
    const res = await deleteImportBatch({ workspaceId: "ws-1", userId: "u", batchId: "batch-a" });
    expect(res.data?.deleted).toBe(1);
  });

  it("treats zero removed rows as a possible permission denial, never as success", async () => {
    mockState.deleteResult = { data: [], error: null };
    const res = await deleteImportBatch({ workspaceId: "ws-1", userId: "u", batchId: "batch-a" });
    expect(res.data).toBeNull();
    expect(res.error).toMatch(/No rows were removed/);
    expect(res.error).toMatch(/owners and admins/);
    expect(mockState.auditRows).toEqual([]);
  });

  it("surfaces a database error instead of claiming a deletion", async () => {
    mockState.deleteResult = { data: null, error: { message: "permission denied for table post_observations" } };
    const res = await deleteImportBatch({ workspaceId: "ws-1", userId: "u", batchId: "batch-a" });
    expect(res).toEqual({ data: null, error: "permission denied for table post_observations" });
    expect(mockState.auditRows).toEqual([]);
  });

  it("refuses an unnamed batch before issuing any delete", async () => {
    const res = await deleteImportBatch({ workspaceId: "ws-1", userId: "u", batchId: "" });
    expect(res.error).toMatch(/No import batch was named/);
    expect(mockState.deleteFilters).toEqual([]);
  });

  it("records the removal in the append-only audit log with the observed count", async () => {
    await deleteImportBatch({ workspaceId: "ws-1", userId: "user-9", batchId: "batch-a" });
    expect(mockState.auditRows).toEqual([
      {
        workspace_id: "ws-1",
        user_id: "user-9",
        action: "post_observation_batch.deleted",
        resource_type: "post_observation_batch",
        resource_id: "batch-a",
        metadata: { observations_deleted: 2 }
      }
    ]);
  });

  it("executes atomic RPC when available", async () => {
    mockState.rpcResult = { data: { success: true, deleted: 5, batch_id: "batch-a" }, error: null };
    const res = await deleteImportBatch({ workspaceId: "ws-1", userId: "u", batchId: "batch-a" });
    expect(res).toEqual({ data: { deleted: 5, auditWriteFailed: null }, error: null });
  });

  it("handles RPC error from permission denial", async () => {
    mockState.rpcResult = { data: null, error: { message: "Access denied: only workspace owners and admins may delete post observation batches" } };
    const res = await deleteImportBatch({ workspaceId: "ws-1", userId: "u", batchId: "batch-a" });
    expect(res).toEqual({ data: null, error: "Access denied: only workspace owners and admins may delete post observation batches" });
  });
});
