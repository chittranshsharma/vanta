import { describe, expect, it } from "vitest";
import { PROVIDERS, analyticsProviders, providerSpec } from "./providers";

describe("provider catalog", () => {
  it("matches the migration 014 CHECK list exactly", () => {
    expect(PROVIDERS.map((p) => p.id).sort()).toEqual(["google", "linkedin", "meta", "rss", "tiktok", "x", "youtube"]);
  });
  it("never promises performance or algorithm access", () => {
    for (const p of PROVIDERS) {
      for (const u of p.unlocks) {
        expect(u.toLowerCase()).not.toMatch(/predict|virality|best time|algorithm access/);
        if (p.id !== "rss") expect(u.toLowerCase()).toMatch(/observed/);
      }
    }
  });
  it("rss needs no consent flow and yields no analytics", () => {
    expect(providerSpec("rss")?.consentFlow).toBe("none_required");
    expect(analyticsProviders().some((p) => p.id === "rss")).toBe(false);
    expect(providerSpec("nope")).toBeNull();
  });
});
