import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkerJob } from "../loop.js";
import { makeConversationImportValidateHandler } from "./conversationImportValidate.js";
import { makeConversationDeduplicateHandler } from "./conversationDeduplicate.js";
import { makeConversationInterpretationProposalHandler } from "./conversationInterpretationProposal.js";
import { makeConversationAttributionHandler } from "./conversationAttribution.js";
import { makeConversationAggregateHandler } from "./conversationAggregate.js";

function makeJob(type: WorkerJob["job_type"], payload: Record<string, unknown> = {}, workspaceId = "ws-1"): WorkerJob {
  return {
    id: "job-100",
    workspace_id: workspaceId,
    job_type: type,
    status: "running",
    payload,
    attempts: 1,
    max_attempts: 3,
    correlation_id: "corr-100",
  };
}

describe("conversation_import_validate handler", () => {
  it("fails permanently when batch_id is missing from payload", async () => {
    const fakeClient = {} as SupabaseClient;
    const handler = makeConversationImportValidateHandler(fakeClient);
    const res = await handler(makeJob("conversation_import_validate", {}), { deadlineMs: Date.now() + 5000 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.failure.kind).toBe("permanent");
      expect(res.failure.code).toBe("bad_payload");
    }
  });

  it("fails permanently when batch is not found in workspace (Tenant Isolation)", async () => {
    const fakeClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const handler = makeConversationImportValidateHandler(fakeClient);
    const res = await handler(
      makeJob("conversation_import_validate", { batch_id: "b-missing" }),
      { deadlineMs: Date.now() + 5000 }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.failure.kind).toBe("permanent");
      expect(res.failure.code).toBe("not_found");
    }
  });

  it("validates observation rows and marks batch completed", async () => {
    let updatedBatch: Record<string, unknown> | null = null;
    const fakeClient = {
      from: (table: string) => {
        if (table === "import_batches") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { id: "b1", workspace_id: "ws-1" }, error: null }),
                }),
              }),
            }),
            update: (vals: Record<string, unknown>) => ({
              eq: () => ({
                eq: () => {
                  updatedBatch = vals;
                  return Promise.resolve({ error: null });
                },
              }),
            }),
          };
        }
        if (table === "conversation_observations") {
          return {
            select: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: "obs-1",
                        evidence_class: "observed",
                        character_count: 20,
                        text_sha256: "hash1",
                        observed_at: "2026-08-28T12:00:00Z",
                        author_ref: "anon_1",
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          };
        }
        return {};
      },
    } as unknown as SupabaseClient;

    const handler = makeConversationImportValidateHandler(fakeClient);
    const res = await handler(
      makeJob("conversation_import_validate", { batch_id: "b1" }),
      { deadlineMs: Date.now() + 5000 }
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.valid_count).toBe(1);
      expect(res.result.rejected_count).toBe(0);
      expect(res.result.status).toBe("completed");
    }
    expect(updatedBatch).toEqual({
      status: "completed",
      accepted_rows: 1,
      rejected_rows: 0,
    });
  });
});

describe("conversation_deduplicate handler", () => {
  it("scans workspace observations and reports exact duplicate counts without deleting", async () => {
    const fakeClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () =>
                Promise.resolve({
                  data: [
                    { id: "o1", idempotency_key: "k1", observed_at: "2026-08-28T10:00:00Z" },
                    { id: "o2", idempotency_key: "k1", observed_at: "2026-08-28T10:05:00Z" },
                    { id: "o3", idempotency_key: "k2", observed_at: "2026-08-28T11:00:00Z" },
                  ],
                  error: null,
                }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const handler = makeConversationDeduplicateHandler(fakeClient);
    const res = await handler(makeJob("conversation_deduplicate", {}), { deadlineMs: Date.now() + 5000 });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.scanned_count).toBe(3);
      expect(res.result.unique_count).toBe(2);
      expect(res.result.duplicate_count).toBe(1);
      expect(res.result.duplicate_observation_ids).toEqual(["o2"]);
    }
  });
});

describe("conversation_interpretation_proposal handler", () => {
  it("fails permanently when quota is exceeded", async () => {
    const fakeClient = {
      rpc: (proc: string) => {
        if (proc === "consume_quota") {
          return Promise.resolve({ data: false, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
    } as unknown as SupabaseClient;

    const handler = makeConversationInterpretationProposalHandler(fakeClient);
    const res = await handler(makeJob("conversation_interpretation_proposal", {}), { deadlineMs: Date.now() + 5000 });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.failure.kind).toBe("permanent");
      expect(res.failure.code).toBe("quota_exceeded");
    }
  });

  it("consumes quota and creates inference proposals with review_state = unreviewed", async () => {
    let insertedRows: unknown[] = [];
    const fakeClient = {
      rpc: (proc: string) => {
        if (proc === "consume_quota") {
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      from: (table: string) => {
        if (table === "conversation_observations") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: [
                        { id: "obs-1", workspace_id: "ws-1", raw_text: "Does it support fast charging?", review_state: "unreviewed" },
                      ],
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        if (table === "conversation_interpretations") {
          return {
            insert: (rows: unknown[]) => {
              insertedRows = rows;
              return {
                select: () => Promise.resolve({ data: [{ id: "int-1" }], error: null }),
              };
            },
          };
        }
        return {};
      },
    } as unknown as SupabaseClient;

    const handler = makeConversationInterpretationProposalHandler(fakeClient);
    const res = await handler(makeJob("conversation_interpretation_proposal", {}), { deadlineMs: Date.now() + 5000 });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.proposed_count).toBe(1);
      expect(res.result.interpretation_ids).toEqual(["int-1"]);
    }
    expect(insertedRows).toHaveLength(1);
    const inserted = insertedRows[0] as Record<string, unknown>;
    expect(inserted.evidence_class).toBe("inference");
    expect(inserted.review_state).toBe("unreviewed");
    expect(inserted.interpretation_type).toBe("question_detected");
    expect(typeof inserted.uncertainty_note).toBe("string");
  });
});

describe("conversation_attribution handler", () => {
  it("fails permanently when cross-tenant twin is referenced", async () => {
    const fakeClient = {
      from: (table: string) => {
        if (table === "conversation_observations") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { id: "obs-1", workspace_id: "ws-1" }, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "creative_twins") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    } as unknown as SupabaseClient;

    const handler = makeConversationAttributionHandler(fakeClient);
    const res = await handler(
      makeJob("conversation_attribution", { observation_id: "obs-1", twin_id: "cross-twin" }),
      { deadlineMs: Date.now() + 5000 }
    );

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.failure.kind).toBe("permanent");
      expect(res.failure.code).toBe("invalid_reference");
    }
  });

  it("inserts attribution row for valid explicit workspace IDs", async () => {
    let insertedAttribution: unknown = null;
    const fakeClient = {
      from: (table: string) => {
        if (table === "conversation_observations") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { id: "obs-1", workspace_id: "ws-1" }, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "creative_twins") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { id: "twin-1" }, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "conversation_attributions") {
          return {
            insert: (row: unknown) => {
              insertedAttribution = row;
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: { id: "attr-1" }, error: null }),
                }),
              };
            },
          };
        }
        return {};
      },
    } as unknown as SupabaseClient;

    const handler = makeConversationAttributionHandler(fakeClient);
    const res = await handler(
      makeJob("conversation_attribution", {
        observation_id: "obs-1",
        twin_id: "twin-1",
        cta_identifier: "cta-buy",
      }),
      { deadlineMs: Date.now() + 5000 }
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.attribution_id).toBe("attr-1");
      expect(res.result.observation_id).toBe("obs-1");
    }
    expect(insertedAttribution).toMatchObject({
      workspace_id: "ws-1",
      observation_id: "obs-1",
      twin_id: "twin-1",
      cta_identifier: "cta-buy",
    });
  });
});

describe("conversation_aggregate handler", () => {
  it("aggregates observations and uses workspace timezone", async () => {
    const fakeClient = {
      from: (table: string) => {
        if (table === "workspaces") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { id: "ws-1", timezone: "America/New_York" }, error: null }),
              }),
            }),
          };
        }
        if (table === "conversation_observations") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: [
                        { observed_at: "2026-08-28T14:00:00Z" },
                        { observed_at: "2026-08-28T14:30:00Z" },
                      ],
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    } as unknown as SupabaseClient;

    const handler = makeConversationAggregateHandler(fakeClient);
    const res = await handler(makeJob("conversation_aggregate", {}), { deadlineMs: Date.now() + 5000 });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.time_zone).toBe("America/New_York");
      expect(res.result.total_observations).toBe(2);
      expect(res.result.buckets_count).toBe(1);
    }
  });
});
