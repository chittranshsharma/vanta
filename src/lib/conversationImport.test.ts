import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  configured: false,
  batchResult: { data: { id: "b1" }, error: null as string | null },
  insertResult: { data: null as unknown, error: null as { message: string; code?: string } | null },
  insertedObservations: [] as unknown[],
}));

vi.mock("./supabase", () => ({
  get isSupabaseConfigured() {
    return mockState.configured;
  },
  supabase: {
    from: (_table: string) => ({
      insert: (rows: unknown[]) => {
        mockState.insertedObservations.push(rows);
        return Promise.resolve(mockState.insertResult);
      },
    }),
  },
}));

vi.mock("./importBatches", () => ({
  recordImportBatch: () => Promise.resolve(mockState.batchResult),
}));

import { importConversationObservations, type ImportConversationInput } from "./conversationImport";

beforeEach(() => {
  mockState.configured = false;
  mockState.batchResult = { data: { id: "b1" }, error: null };
  mockState.insertResult = { data: null, error: null };
  mockState.insertedObservations = [];
});

describe("importConversationObservations", () => {
  it("fails when Supabase is not configured", async () => {
    mockState.configured = false;
    const input: ImportConversationInput = {
      workspaceId: "w1",
      userId: "u1",
      sourceId: "s1",
      candidates: [],
    };
    const res = await importConversationObservations(input);
    expect(res.error).toBe("Supabase is not configured.");
  });

  it("handles empty or all-rejected files by registering batch without inserting observations", async () => {
    mockState.configured = true;
    const input: ImportConversationInput = {
      workspaceId: "w1",
      userId: "u1",
      sourceId: "s1",
      candidates: [],
      rejections: [{ line: 2, reason: "invalid text" }],
    };
    const res = await importConversationObservations(input);
    expect(res.error).toBeNull();
    expect(res.data?.accepted).toBe(0);
    expect(res.data?.rejected).toBe(1);
    expect(mockState.insertedObservations).toHaveLength(0);
  });

  it("persists accepted candidates and returns batch summary", async () => {
    mockState.configured = true;
    const input: ImportConversationInput = {
      workspaceId: "w1",
      userId: "u1",
      sourceId: "s1",
      candidates: [
        {
          line: 2,
          text: "Loved it!",
          text_sha256: "hash1",
          character_count: 9,
          observed_at: "2026-08-28T00:00:00Z",
          author_ref: "anon_abc",
          external_event_id: "e1",
          external_post_id: "p1",
          provider: "manual_csv",
          idempotency_key: "idem1",
          evidence_class: "observed",
        },
      ],
    };
    const res = await importConversationObservations(input);
    expect(res.error).toBeNull();
    expect(res.data?.accepted).toBe(1);
    expect(mockState.insertedObservations).toHaveLength(1);
  });

  it("handles duplicate key error (23505) with clear explanation", async () => {
    mockState.configured = true;
    mockState.insertResult = {
      data: null,
      error: { message: "duplicate key", code: "23505" },
    };
    const input: ImportConversationInput = {
      workspaceId: "w1",
      userId: "u1",
      sourceId: "s1",
      candidates: [
        {
          line: 2,
          text: "Loved it!",
          text_sha256: "hash1",
          character_count: 9,
          observed_at: "2026-08-28T00:00:00Z",
          author_ref: "anon_abc",
          external_event_id: "e1",
          external_post_id: "p1",
          provider: "manual_csv",
          idempotency_key: "idem1",
          evidence_class: "observed",
        },
      ],
    };
    const res = await importConversationObservations(input);
    expect(res.data).toBeNull();
    expect(res.error).toMatch(/already exist in the workspace/);
  });
});
