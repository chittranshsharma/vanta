import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  configured: false,
  selectResult: { data: [] as unknown[], error: null as { message: string } | null },
  insertResult: { data: null as unknown, error: null as { message: string } | null },
  insertedPayloads: [] as unknown[],
}));

vi.mock("./supabase", () => ({
  get isSupabaseConfigured() {
    return mockState.configured;
  },
  supabase: {
    from: (_table: string) => ({
      select: () => {
        const chain = {
          eq: () => chain,
          order: () => chain,
          limit: () => Promise.resolve(mockState.selectResult),
          single: () => Promise.resolve(mockState.insertResult),
        };
        return chain;
      },
      insert: (payload: unknown) => {
        mockState.insertedPayloads.push(payload);
        return {
          select: () => ({
            single: () => Promise.resolve(mockState.insertResult),
          }),
        };
      },
    }),
  },
}));

import {
  listImportBatches,
  recordImportBatch,
  toImportBatchRow,
  type CreateImportBatchInput,
} from "./importBatches";

beforeEach(() => {
  mockState.configured = false;
  mockState.selectResult = { data: [], error: null };
  mockState.insertResult = { data: null, error: null };
  mockState.insertedPayloads = [];
});

describe("importBatches mapping and validation", () => {
  it("maps a valid row faithfully", () => {
    const raw = {
      id: "b1",
      workspace_id: "w1",
      source_id: "s1",
      created_by: "u1",
      batch_kind: "post_observations",
      file_name: "history.csv",
      file_size_bytes: 1024,
      file_sha256: "abc",
      expected_rows: 10,
      accepted_rows: 8,
      rejected_rows: 2,
      rejection_reasons: [{ line: 3, reason: "invalid date" }],
      status: "partial",
      provenance: { tool: "manual_csv" },
      created_at: "2026-08-28T00:00:00Z",
      completed_at: "2026-08-28T00:00:01Z",
    };
    const res = toImportBatchRow(raw);
    expect(typeof res).toBe("object");
    if (typeof res === "object") {
      expect(res.batch_kind).toBe("post_observations");
      expect(res.accepted_rows).toBe(8);
      expect(res.rejected_rows).toBe(2);
      expect(res.status).toBe("partial");
    }
  });

  it("rejects unknown batch kind or status", () => {
    expect(toImportBatchRow({ id: "1", batch_kind: "unknown_kind", status: "completed" })).toMatch(
      /invalid batch_kind/
    );
    expect(toImportBatchRow({ id: "1", batch_kind: "post_observations", status: "not_a_status" })).toMatch(
      /invalid status/
    );
  });
});

describe("recordImportBatch", () => {
  beforeEach(() => {
    mockState.configured = true;
  });

  it("returns unconfigured error when Supabase is disabled", async () => {
    mockState.configured = false;
    const input: CreateImportBatchInput = {
      workspaceId: "w1",
      userId: "u1",
      batchKind: "post_observations",
      acceptedRows: 5,
      rejectedRows: 0,
    };
    expect(await recordImportBatch(input)).toEqual({ data: null, error: "Supabase is not configured." });
  });

  it("computes status = completed when all rows accepted", async () => {
    mockState.insertResult = {
      data: {
        id: "b1",
        workspace_id: "w1",
        batch_kind: "post_observations",
        accepted_rows: 5,
        rejected_rows: 0,
        status: "completed",
        created_at: "2026-08-28T00:00:00Z",
        completed_at: "2026-08-28T00:00:01Z",
      },
      error: null,
    };
    const res = await recordImportBatch({
      workspaceId: "w1",
      userId: "u1",
      batchKind: "post_observations",
      acceptedRows: 5,
      rejectedRows: 0,
    });
    expect(res.error).toBeNull();
    expect(res.data?.status).toBe("completed");
    expect(mockState.insertedPayloads[0]).toMatchObject({
      status: "completed",
      accepted_rows: 5,
      rejected_rows: 0,
    });
  });

  it("computes status = failed when 0 accepted and some rejected", async () => {
    mockState.insertResult = {
      data: {
        id: "b2",
        workspace_id: "w1",
        batch_kind: "experiment_outcomes",
        accepted_rows: 0,
        rejected_rows: 4,
        status: "failed",
      },
      error: null,
    };
    const res = await recordImportBatch({
      workspaceId: "w1",
      userId: "u1",
      batchKind: "experiment_outcomes",
      acceptedRows: 0,
      rejectedRows: 4,
    });
    expect(res.error).toBeNull();
    expect(mockState.insertedPayloads[0]).toMatchObject({
      status: "failed",
      accepted_rows: 0,
      rejected_rows: 4,
    });
  });
});

describe("listImportBatches", () => {
  beforeEach(() => {
    mockState.configured = true;
  });

  it("returns batches ordered and mapped", async () => {
    mockState.selectResult = {
      data: [
        {
          id: "b1",
          workspace_id: "w1",
          batch_kind: "post_observations",
          accepted_rows: 10,
          rejected_rows: 0,
          status: "completed",
        },
      ],
      error: null,
    };
    const res = await listImportBatches("w1", "post_observations");
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0].id).toBe("b1");
  });
});
