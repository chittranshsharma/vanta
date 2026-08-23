import { describe, expect, it } from "vitest";
import { describeAccess, suggestTestWindows } from "./access";

const now = new Date("2026-08-23T12:00:00Z");
const base = { requiredScopes: ["insights.read"], now, freshnessWindowHours: 24 };

describe("describeAccess", () => {
  it("is unknown without a connector, with pending consent, revoked, or error", () => {
    expect(describeAccess({ ...base, connector: null }).state).toBe("unknown");
    for (const status of ["pending_consent", "revoked", "error"] as const) {
      const r = describeAccess({ ...base, connector: { status, granted_scopes: ["insights.read"], last_sync_at: null, token_expires_at: null } });
      expect(r.state).toBe("unknown");
      if (r.state === "unknown") expect(r.nextInput.length).toBeGreaterThan(0);
    }
  });

  it("is unknown when scopes are missing or token expired", () => {
    const r1 = describeAccess({ ...base, connector: { status: "connected", granted_scopes: [], last_sync_at: "2026-08-23T11:00:00Z", token_expires_at: null } });
    expect(r1.state).toBe("unknown");
    if (r1.state === "unknown") expect(r1.reason).toContain("insights.read");
    const r2 = describeAccess({ ...base, connector: { status: "connected", granted_scopes: ["insights.read"], last_sync_at: "2026-08-23T11:00:00Z", token_expires_at: "2026-08-22T00:00:00Z" } });
    expect(r2.state).toBe("unknown");
  });

  it("is unknown before the first sync, stale after the window, available inside it", () => {
    const c = { status: "connected" as const, granted_scopes: ["insights.read"], token_expires_at: null };
    expect(describeAccess({ ...base, connector: { ...c, last_sync_at: null } }).state).toBe("unknown");
    expect(describeAccess({ ...base, connector: { ...c, last_sync_at: "2026-08-20T12:00:00Z" } }).state).toBe("stale");
    expect(describeAccess({ ...base, connector: { ...c, last_sync_at: "2026-08-23T09:00:00Z" } }).state).toBe("available");
  });
});

describe("suggestTestWindows", () => {
  it("returns unknown with too little history", () => {
    const r = suggestTestWindows([{ hour: 9, weekday: 1, value: 10 }]);
    expect(r.state).toBe("unknown");
    expect(r.windows).toEqual([]);
  });

  it("ranks buckets by mean and never calls them predictions", () => {
    const obs = [];
    for (let i = 0; i < 10; i += 1) obs.push({ hour: 9, weekday: 1, value: 5 });
    for (let i = 0; i < 10; i += 1) obs.push({ hour: 18, weekday: 3, value: 9 });
    for (let i = 0; i < 10; i += 1) obs.push({ hour: 12, weekday: 5, value: 7 });
    const r = suggestTestWindows(obs);
    expect(r.state).toBe("inference");
    expect(r.windows[0]).toEqual({ weekday: 3, hour: 18, observations: 10 });
    expect(r.note).toMatch(/Not a prediction/);
  });
});
