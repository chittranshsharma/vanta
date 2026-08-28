import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  configured: false,
  selectResult: { data: [] as unknown[], error: null as { message: string; code?: string } | null },
  insertResult: { data: null as unknown, error: null as { message: string; code?: string } | null },
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
  linkPostToVariant,
  listPostAttributions,
  toPostVariantAttributionRow,
  type CreatePostAttributionInput,
} from "./postAttribution";

beforeEach(() => {
  mockState.configured = false;
  mockState.selectResult = { data: [], error: null };
  mockState.insertResult = { data: null, error: null };
  mockState.insertedPayloads = [];
});

describe("postVariantAttribution mapping", () => {
  it("maps fields correctly", () => {
    const raw = {
      id: "a1",
      workspace_id: "w1",
      provider: "meta_instagram",
      external_post_id: "post-123",
      asset_id: "asset-1",
      twin_id: "twin-1",
      variant_twin_id: "twin-2",
      created_at: "2026-08-28T00:00:00Z",
    };
    const mapped = toPostVariantAttributionRow(raw);
    expect(mapped.external_post_id).toBe("post-123");
    expect(mapped.variant_twin_id).toBe("twin-2");
    expect(mapped.provider).toBe("meta_instagram");
  });
});

describe("linkPostToVariant", () => {
  beforeEach(() => {
    mockState.configured = true;
  });

  it("handles duplicate key error (23505) with clear explanation", async () => {
    mockState.insertResult = {
      data: null,
      error: { message: "duplicate key value violates unique constraint", code: "23505" },
    };

    const input: CreatePostAttributionInput = {
      workspaceId: "w1",
      userId: "u1",
      provider: "meta_instagram",
      externalPostId: "post-123",
      assetId: "a1",
      twinId: "t1",
    };

    const res = await linkPostToVariant(input);
    expect(res.data).toBeNull();
    expect(res.error).toMatch(/is already attributed to a variant/);
  });

  it("inserts valid attribution", async () => {
    mockState.insertResult = {
      data: {
        id: "attr-1",
        workspace_id: "w1",
        provider: "meta_instagram",
        external_post_id: "post-123",
        asset_id: "a1",
        twin_id: "t1",
      },
      error: null,
    };

    const res = await linkPostToVariant({
      workspaceId: "w1",
      userId: "u1",
      provider: "meta_instagram",
      externalPostId: "post-123",
      assetId: "a1",
      twinId: "t1",
    });

    expect(res.error).toBeNull();
    expect(res.data?.id).toBe("attr-1");
  });
});

describe("listPostAttributions", () => {
  beforeEach(() => {
    mockState.configured = true;
  });

  it("returns list of attributions", async () => {
    mockState.selectResult = {
      data: [
        {
          id: "a1",
          workspace_id: "w1",
          provider: "meta_instagram",
          external_post_id: "post-123",
          asset_id: "asset-1",
          twin_id: "twin-1",
        },
      ],
      error: null,
    };

    const res = await listPostAttributions("w1");
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0].external_post_id).toBe("post-123");
  });
});
