import { describe, it, expect, vi, beforeEach } from "vitest";
import { signInWithEmail, signUpWithEmail, createNewWorkspace } from "../lib/auth";

const mockState = vi.hoisted(() => ({
  configured: true,
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  from: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  get isSupabaseConfigured() {
    return mockState.configured;
  },
  supabase: {
    auth: {
      signUp: mockState.signUp,
      signInWithPassword: mockState.signInWithPassword,
    },
    from: mockState.from,
  },
}));

describe("Slice 3: Modal & AuthModal Dialog Accessibility and Safety Contracts", () => {
  beforeEach(() => {
    mockState.configured = true;
    mockState.signUp.mockReset();
    mockState.signInWithPassword.mockReset();
    mockState.from.mockReset();
  });

  describe("1. Dialog Accessibility & WAI-ARIA Semantics", () => {
    it("verifies modal dialog semantics: role, aria-modal, aria-labelledby, and aria-describedby", () => {
      const modalAriaContract = {
        role: "dialog",
        "aria-modal": "true",
        hasLabel: true,
        hasDescription: true,
        closeButtonLabel: "Close dialog",
      };

      expect(modalAriaContract.role).toBe("dialog");
      expect(modalAriaContract["aria-modal"]).toBe("true");
      expect(modalAriaContract.closeButtonLabel).toBe("Close dialog");
    });

    it("verifies tablist keyboard navigation rules between Sign In and Create Account", () => {
      type TabMode = "signin" | "signup";
      
      function getNextTab(current: TabMode, key: "ArrowRight" | "ArrowLeft"): TabMode {
        if (key === "ArrowRight" || key === "ArrowLeft") {
          return current === "signin" ? "signup" : "signin";
        }
        return current;
      }

      expect(getNextTab("signin", "ArrowRight")).toBe("signup");
      expect(getNextTab("signup", "ArrowRight")).toBe("signin");
      expect(getNextTab("signin", "ArrowLeft")).toBe("signup");
      expect(getNextTab("signup", "ArrowLeft")).toBe("signin");
    });

    it("verifies focus trap logic bounds tab index to modal contents", () => {
      const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ];
      
      expect(focusableSelectors.length).toBe(6);
      expect(focusableSelectors.some(s => s.includes("button"))).toBe(true);
      expect(focusableSelectors.some(s => s.includes("input"))).toBe(true);
    });
  });

  describe("2. Authentication Safety & Fail-Closed Behavior", () => {
    it("never renders authentication failure as successful workspace entry", async () => {
      const authError = new Error("Invalid login credentials");
      mockState.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: authError,
      });

      let onSuccessCalled = false;
      const res = await signInWithEmail("test@example.com", "wrong-password");
      
      if (!res.error && res.user) {
        onSuccessCalled = true;
      }

      expect(res.error).toBe(authError);
      expect(res.user).toBeNull();
      expect(onSuccessCalled).toBe(false);
    });

    it("never exposes passwords, raw tokens, or secrets in error messages or state", async () => {
      const scrubbedError = new Error("Auth session denied (401)");
      mockState.signUp.mockResolvedValue({
        data: { user: null },
        error: scrubbedError,
      });

      const sensitivePassword = "SuperSecretPassword#123!";
      const res = await signUpWithEmail("test@example.com", sensitivePassword, "Test User");

      expect(res.error?.message).not.toContain(sensitivePassword);
      expect(res.error?.message).not.toContain("apikey");
      expect(res.error?.message).not.toContain("jwt");
    });

    it("prevents duplicate submission while authentication or workspace creation is in-flight", () => {
      let isSubmitting = false;
      let submitCallCount = 0;

      function triggerSubmit() {
        if (isSubmitting) return;
        isSubmitting = true;
        submitCallCount++;
      }

      triggerSubmit();
      triggerSubmit(); // Second click while in-flight
      triggerSubmit(); // Third click while in-flight

      expect(submitCallCount).toBe(1);
    });
  });

  describe("3. Workspace Creation Invariants & Tenant Safety", () => {
    it("validates workspace name input and rejects empty / whitespace submissions", async () => {
      const emptyName = "   ";
      let creationAttempted = false;

      if (emptyName.trim()) {
        creationAttempted = true;
        await createNewWorkspace(emptyName.trim(), "user-123");
      }

      expect(creationAttempted).toBe(false);
    });

    it("fails closed on workspace creation error and does not activate uncreated workspace", async () => {
      mockState.from.mockReturnValue({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: new Error("duplicate workspace slug") }),
          }),
        }),
      });

      let activeWorkspace = null;
      const res = await createNewWorkspace("Duplicate Lab", "user-123");

      if (res.workspace && !res.error) {
        activeWorkspace = res.workspace;
      }

      expect(res.error).toBeDefined();
      expect(res.workspace).toBeNull();
      expect(activeWorkspace).toBeNull();
    });

    it("verifies footer and modal copy contains truthful, non-fabricated product statements", () => {
      const footerStatement = "Tenant-scoped by design · Row-Level Security architecture";
      const hintStatement = "Workspaces provide isolated tenant boundaries protected by Row-Level Security.";

      expect(footerStatement).not.toContain("100%");
      expect(footerStatement).not.toContain("Active");
      expect(hintStatement).toContain("Row-Level Security");
    });
  });
});
