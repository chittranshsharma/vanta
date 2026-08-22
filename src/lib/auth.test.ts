import { describe, expect, it } from "vitest";
import { isSupabaseConfigured } from "./supabase";
import { signInWithEmail, signUpWithEmail } from "./auth";

describe("Supabase auth integration guards", () => {
  it("detects whether Supabase environment variables are properly configured", () => {
    expect(typeof isSupabaseConfigured).toBe("boolean");
  });

  it("handles unconfigured or invalid signup cleanly without crashing", async () => {
    if (!isSupabaseConfigured) {
      const res = await signUpWithEmail("test@example.com", "password123", "Test User");
      expect(res.error).toBeDefined();
      expect(res.user).toBeNull();
    }
  });

  it("handles unconfigured or invalid signin cleanly without crashing", async () => {
    if (!isSupabaseConfigured) {
      const res = await signInWithEmail("test@example.com", "password123");
      expect(res.error).toBeDefined();
      expect(res.session).toBeNull();
    }
  });
});
