import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Auth helper contract tests.
 *
 * The Supabase client module is mocked so these assertions run identically
 * whether or not a .env file is present. The previous version of this file
 * only asserted inside `if (!isSupabaseConfigured)` and therefore executed
 * zero assertions on any configured machine.
 */

const mockState = vi.hoisted(() => ({
  configured: false,
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
}));

vi.mock("./supabase", () => ({
  get isSupabaseConfigured() {
    return mockState.configured;
  },
  supabase: {
    auth: {
      signUp: mockState.signUp,
      signInWithPassword: mockState.signInWithPassword,
      signOut: mockState.signOut,
    },
    from: mockState.from,
  },
}));

import {
  createNewWorkspace,
  fetchUserProfile,
  fetchUserWorkspaces,
  signInWithEmail,
  signOutUser,
  signUpWithEmail,
} from "./auth";

beforeEach(() => {
  mockState.configured = false;
  mockState.signUp.mockReset();
  mockState.signInWithPassword.mockReset();
  mockState.signOut.mockReset();
  mockState.from.mockReset();
});

describe("unconfigured environment fails closed without network calls", () => {
  it("signUpWithEmail returns a typed error and null user", async () => {
    const res = await signUpWithEmail("a@example.com", "password123", "A");
    expect(res.user).toBeNull();
    expect(res.error?.message).toMatch(/not configured/i);
    expect(mockState.signUp).not.toHaveBeenCalled();
  });

  it("signInWithEmail returns a typed error and null session", async () => {
    const res = await signInWithEmail("a@example.com", "password123");
    expect(res.session).toBeNull();
    expect(res.error?.message).toMatch(/not configured/i);
    expect(mockState.signInWithPassword).not.toHaveBeenCalled();
  });

  it("signOutUser is a no-op", async () => {
    const res = await signOutUser();
    expect(res.error).toBeNull();
    expect(mockState.signOut).not.toHaveBeenCalled();
  });

  it("fetchUserProfile and fetchUserWorkspaces return empty results", async () => {
    expect(await fetchUserProfile("u1")).toBeNull();
    expect(await fetchUserWorkspaces("u1")).toEqual([]);
    expect(mockState.from).not.toHaveBeenCalled();
  });

  it("createNewWorkspace returns an error", async () => {
    const res = await createNewWorkspace("Test", "u1");
    expect(res.workspace).toBeNull();
    expect(res.error?.message).toMatch(/not configured/i);
  });
});

describe("configured environment propagates provider results", () => {
  beforeEach(() => {
    mockState.configured = true;
  });

  it("signUpWithEmail forwards full_name as user metadata and returns the provider error", async () => {
    const providerError = new Error("Email already registered");
    mockState.signUp.mockResolvedValue({ data: { user: null }, error: providerError });

    const res = await signUpWithEmail("a@example.com", "password123", "Ada");

    expect(mockState.signUp).toHaveBeenCalledWith({
      email: "a@example.com",
      password: "password123",
      options: { data: { full_name: "Ada" } },
    });
    expect(res.error).toBe(providerError);
    expect(res.user).toBeNull();
  });

  it("signInWithEmail returns the provider session on success", async () => {
    const session = { access_token: "redacted" };
    mockState.signInWithPassword.mockResolvedValue({
      data: { user: { id: "u1" }, session },
      error: null,
    });

    const res = await signInWithEmail("a@example.com", "password123");
    expect(res.error).toBeNull();
    expect(res.session).toBe(session);
    expect(res.user).toEqual({ id: "u1" });
  });

  it("fetchUserWorkspaces drops membership rows whose workspace join is null", async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [
        { role: "owner", workspaces: { id: "w1", name: "One" } },
        { role: "member", workspaces: null },
      ],
      error: null,
    });
    mockState.from.mockReturnValue({ select: () => ({ eq }) });

    const res = await fetchUserWorkspaces("u1");
    expect(res).toEqual([{ id: "w1", name: "One", role: "owner" }]);
  });
});
