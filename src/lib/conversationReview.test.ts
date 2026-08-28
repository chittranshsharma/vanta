import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  configured: false,
  rpcResult: null as { data: unknown; error: { message: string } | null } | null,
  selectResult: { data: [] as unknown[], error: null as { message: string } | null },
}));

vi.mock("./supabase", () => ({
  get isSupabaseConfigured() {
    return mockState.configured;
  },
  supabase: {
    rpc: () => Promise.resolve(mockState.rpcResult ?? { data: { success: true }, error: null }),
    from: (_table: string) => ({
      select: () => {
        const chain = {
          eq: () => chain,
          order: () => chain,
          limit: () => Promise.resolve(mockState.selectResult),
        };
        return chain;
      },
    }),
  },
}));

import {
  listConversationObservations,
  listConversationReviewEvents,
  reviewConversationInterpretation,
  reviewConversationObservation,
} from "./conversationReview";

beforeEach(() => {
  mockState.configured = false;
  mockState.rpcResult = null;
  mockState.selectResult = { data: [], error: null };
});

describe("reviewConversationObservation", () => {
  it("fails when unconfigured", async () => {
    mockState.configured = false;
    const res = await reviewConversationObservation({
      workspaceId: "w1",
      userId: "u1",
      observationId: "obs-1",
      reviewState: "accepted",
    });
    expect(res.error).toBe("Supabase is not configured.");
  });

  it("calls review RPC and returns new review state", async () => {
    mockState.configured = true;
    mockState.rpcResult = {
      data: { success: true, observation_id: "obs-1", new_state: "accepted" },
      error: null,
    };
    const res = await reviewConversationObservation({
      workspaceId: "w1",
      userId: "u1",
      observationId: "obs-1",
      reviewState: "accepted",
      rationale: "Approved claim match",
    });
    expect(res.error).toBeNull();
    expect(res.data?.reviewState).toBe("accepted");
  });

  it("propagates RPC errors cleanly", async () => {
    mockState.configured = true;
    mockState.rpcResult = {
      data: null,
      error: { message: "Access denied: not a workspace member" },
    };
    const res = await reviewConversationObservation({
      workspaceId: "w1",
      userId: "u1",
      observationId: "obs-1",
      reviewState: "rejected",
    });
    expect(res.data).toBeNull();
    expect(res.error).toMatch(/Access denied/);
  });
});

describe("reviewConversationInterpretation", () => {
  beforeEach(() => {
    mockState.configured = true;
  });

  it("updates interpretation review state", async () => {
    mockState.rpcResult = {
      data: { success: true, interpretation_id: "int-1", new_state: "accepted" },
      error: null,
    };
    const res = await reviewConversationInterpretation({
      workspaceId: "w1",
      userId: "u1",
      interpretationId: "int-1",
      reviewState: "accepted",
    });
    expect(res.error).toBeNull();
    expect(res.data?.reviewState).toBe("accepted");
  });
});

describe("listConversationObservations", () => {
  beforeEach(() => {
    mockState.configured = true;
  });

  it("returns observations list", async () => {
    mockState.selectResult = {
      data: [{ id: "obs-1", workspace_id: "w1", raw_text: "Hello", review_state: "unreviewed" }],
      error: null,
    };
    const res = await listConversationObservations("w1", { reviewState: "unreviewed" });
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(1);
  });
});

describe("listConversationReviewEvents", () => {
  beforeEach(() => {
    mockState.configured = true;
  });

  it("returns review events list", async () => {
    mockState.selectResult = {
      data: [{ id: "rev-1", workspace_id: "w1", event_kind: "accepted", new_state: "accepted" }],
      error: null,
    };
    const res = await listConversationReviewEvents("w1", "obs-1");
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(1);
  });
});
