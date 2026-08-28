import { describe, expect, it } from "vitest";
import {
  anonymizeAuthor,
  buildConversationImportPlan,
  computeConversationIdempotencyKey,
  MAX_COMMENT_LENGTH,
  type ConversationCsvColumnMap,
} from "./csvImport";

const map: ConversationCsvColumnMap = {
  text: "comment_text",
  observedAt: "posted_at",
  author: "user_handle",
  externalEventId: "comment_id",
  externalPostId: "post_id",
};

describe("anonymizeAuthor", () => {
  it("generates deterministic privacy-safe pseudonymized reference", () => {
    const a1 = anonymizeAuthor("johndoe@example.com", "ws-1");
    const a2 = anonymizeAuthor("johndoe@example.com", "ws-1");
    expect(a1).toBe(a2);
    expect(a1.startsWith("anon_")).toBe(true);
    expect(a1).not.toContain("johndoe");
  });

  it("produces different hashes for different workspaces (tenant isolation)", () => {
    const a1 = anonymizeAuthor("user_123", "ws-1");
    const a2 = anonymizeAuthor("user_123", "ws-2");
    expect(a1).not.toBe(a2);
  });

  it("handles blank author cleanly", () => {
    expect(anonymizeAuthor("", "ws-1")).toBe("anon_unknown");
  });
});

describe("computeConversationIdempotencyKey", () => {
  it("produces deterministic keys using externalEventId when present", () => {
    const k1 = computeConversationIdempotencyKey({
      workspaceId: "w1",
      provider: "meta_instagram",
      externalEventId: "ev-100",
      authorRef: "anon_a",
      observedAt: "2026-08-28T00:00:00Z",
      textSha256: "hash1",
    });
    const k2 = computeConversationIdempotencyKey({
      workspaceId: "w1",
      provider: "meta_instagram",
      externalEventId: "ev-100",
      authorRef: "anon_b",
      observedAt: "2026-08-28T12:00:00Z",
      textSha256: "hash2",
    });
    expect(k1).toBe(k2);
  });

  it("differentiates identical externalEventIds across different providers or workspaces", () => {
    const k1 = computeConversationIdempotencyKey({
      workspaceId: "w1",
      provider: "meta_instagram",
      externalEventId: "ev-100",
      authorRef: "anon_a",
      observedAt: "2026-08-28T00:00:00Z",
      textSha256: "hash1",
    });
    const k2 = computeConversationIdempotencyKey({
      workspaceId: "w1",
      provider: "youtube_comments",
      externalEventId: "ev-100",
      authorRef: "anon_a",
      observedAt: "2026-08-28T00:00:00Z",
      textSha256: "hash1",
    });
    expect(k1).not.toBe(k2);
  });
});

describe("buildConversationImportPlan", () => {
  it("accepts valid rows and sets evidence_class = observed", () => {
    const csv = [
      "comment_id,post_id,user_handle,comment_text,posted_at",
      "c1,p1,@creativefan,Loved the demo of the new battery feature!,2026-08-28T14:30:00Z",
      "c2,p1,@skeptic,How does this compare to the competitor?,2026-08-28T15:00:00Z",
    ].join("\n");

    const plan = buildConversationImportPlan(csv, map, "ws-1");
    expect(plan.accepted).toHaveLength(2);
    expect(plan.rejected).toHaveLength(0);
    expect(plan.accepted[0].evidence_class).toBe("observed");
    expect(plan.accepted[0].text).toBe("Loved the demo of the new battery feature!");
    expect(plan.accepted[0].author_ref.startsWith("anon_")).toBe(true);
  });

  it("rejects rows with invalid date or timestamp", () => {
    const csv = [
      "comment_id,post_id,user_handle,comment_text,posted_at",
      "c1,p1,@fan,Good product,invalid-date",
    ].join("\n");

    const plan = buildConversationImportPlan(csv, map, "ws-1");
    expect(plan.accepted).toHaveLength(0);
    expect(plan.rejected).toHaveLength(1);
    expect(plan.rejected[0].reason).toMatch(/valid UTC date/);
  });

  it("rejects empty text", () => {
    const csv = [
      "comment_id,post_id,user_handle,comment_text,posted_at",
      "c1,p1,@fan,   ,2026-08-28T14:30:00Z",
    ].join("\n");

    const plan = buildConversationImportPlan(csv, map, "ws-1");
    expect(plan.accepted).toHaveLength(0);
    expect(plan.rejected[0].reason).toMatch(/text is empty/);
  });

  it("rejects text exceeding maximum character length", () => {
    const longText = "x".repeat(MAX_COMMENT_LENGTH + 50);
    const csv = [
      "comment_id,post_id,user_handle,comment_text,posted_at",
      `c1,p1,@fan,${longText},2026-08-28T14:30:00Z`,
    ].join("\n");

    const plan = buildConversationImportPlan(csv, map, "ws-1");
    expect(plan.accepted).toHaveLength(0);
    expect(plan.rejected[0].reason).toMatch(/exceeds maximum length/);
  });

  it("detects and rejects duplicate rows in file", () => {
    const csv = [
      "comment_id,post_id,user_handle,comment_text,posted_at",
      "c1,p1,@fan,Great ad,2026-08-28T14:30:00Z",
      "c1,p1,@fan,Great ad,2026-08-28T14:30:00Z",
    ].join("\n");

    const plan = buildConversationImportPlan(csv, map, "ws-1");
    expect(plan.accepted).toHaveLength(1);
    expect(plan.duplicatesInFile).toBe(1);
    expect(plan.rejected[0].reason).toMatch(/Duplicate observation record/);
  });

  it("rejects all rows when required headers are missing", () => {
    const csv = ["col_a,col_b", "val1,val2"].join("\n");
    const plan = buildConversationImportPlan(csv, map, "ws-1");
    expect(plan.accepted).toHaveLength(0);
    expect(plan.rejected[0].reason).toMatch(/Mapping refers to headers not present/);
  });

  it("handles partial acceptance cleanly with line numbers preserved", () => {
    const csv = [
      "comment_id,post_id,user_handle,comment_text,posted_at",
      "c1,p1,@fan,Valid first row,2026-08-28T10:00:00Z",
      "c2,p1,@fan,,2026-08-28T11:00:00Z",
      "c3,p1,@fan,Valid third row,2026-08-28T12:00:00Z",
    ].join("\n");

    const plan = buildConversationImportPlan(csv, map, "ws-1");
    expect(plan.accepted).toHaveLength(2);
    expect(plan.accepted[0].line).toBe(2);
    expect(plan.accepted[1].line).toBe(4);
    expect(plan.rejected).toHaveLength(1);
    expect(plan.rejected[0].line).toBe(3);
  });
});
