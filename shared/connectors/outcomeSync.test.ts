import { describe, expect, it } from "vitest";
import {
  connectorOutcomeSourceState,
  describeAllOutcomeSync,
  describeOutcomeSync,
  MISSING_SYNC_PIECES,
  OUTCOME_SYNC_PROVIDERS_IN_BUILD,
  type ConnectorFacts,
  type OutcomeSyncCapability,
} from "./outcomeSync";
import { analyticsProviders } from "./providers";

const now = new Date("2026-08-23T12:00:00Z");

function connector(over: Partial<ConnectorFacts> = {}): ConnectorFacts {
  return {
    provider: "meta",
    status: "connected",
    granted_scopes: ["owned_post_insights", "owned_ad_insights"],
    last_sync_at: "2026-08-23T09:00:00Z",
    token_expires_at: null,
    ...over,
  };
}

/** Pretend Meta's sync exists, so the connector branches are reachable. */
const asIfImplemented = ["meta"] as const;

describe("describeOutcomeSync in this build", () => {
  it("reports no sync path for every analytics provider, whatever the connector says", () => {
    for (const p of analyticsProviders()) {
      const r = describeOutcomeSync({ provider: p.id, connectors: [connector({ provider: p.id, granted_scopes: p.analyticsScopes })], now });
      expect(r.state).toBe("not_implemented");
      expect(r.missingPieces).toEqual(MISSING_SYNC_PIECES);
    }
    expect(OUTCOME_SYNC_PROVIDERS_IN_BUILD).toEqual([]);
  });

  it("offers no next input when nothing an operator does would produce rows", () => {
    const r = describeOutcomeSync({ provider: "meta", connectors: [], now });
    expect(r.state).toBe("not_implemented");
    expect(r.nextInput).toBeNull();
  });

  it("still resolves connector access, so a revoked connection stays visible", () => {
    const r = describeOutcomeSync({ provider: "meta", connectors: [connector({ status: "revoked" })], now });
    expect(r.state).toBe("not_implemented");
    expect(r.access?.state).toBe("unknown");
  });

  it("names four independent absences, so clearing consent alone is not read as progress to rows", () => {
    expect(MISSING_SYNC_PIECES).toHaveLength(4);
    expect(MISSING_SYNC_PIECES.join(" ")).toContain("variant_twin_id");
    expect(MISSING_SYNC_PIECES.join(" ")).toContain("source_id");
  });

  it("treats a feed with no metrics as not an outcome source at all", () => {
    const r = describeOutcomeSync({ provider: "rss", connectors: [], now });
    expect(r.state).toBe("not_applicable");
    expect(r.missingPieces).toEqual([]);
    expect(r.access).toBeNull();
    expect(r.detail).toMatch(/no performance metrics/);
  });
});

describe("describeOutcomeSync once a provider has a sync path", () => {
  const args = { provider: "meta" as const, now, implementedProviders: asIfImplemented };

  it("is setup_required when no connection was ever requested", () => {
    const r = describeOutcomeSync({ ...args, connectors: [] });
    expect(r.state).toBe("setup_required");
    expect(r.nextInput).not.toBeNull();
  });

  it("is setup_required while consent is pending, and blocked once a connection cannot be used", () => {
    expect(describeOutcomeSync({ ...args, connectors: [connector({ status: "pending_consent" })] }).state).toBe("setup_required");
    for (const status of ["revoked", "error"] as const) {
      expect(describeOutcomeSync({ ...args, connectors: [connector({ status })] }).state).toBe("blocked");
    }
  });

  it("is blocked when granted scopes fall short of what the metrics need", () => {
    const r = describeOutcomeSync({ ...args, connectors: [connector({ granted_scopes: ["owned_post_insights"] })] });
    expect(r.state).toBe("blocked");
    expect(r.detail).toContain("owned_ad_insights");
  });

  it("is blocked on an expired token and stale past the freshness window", () => {
    expect(describeOutcomeSync({ ...args, connectors: [connector({ token_expires_at: "2026-08-22T00:00:00Z" })] }).state).toBe("blocked");
    expect(describeOutcomeSync({ ...args, connectors: [connector({ last_sync_at: "2026-08-20T12:00:00Z" })] }).state).toBe("stale");
  });

  it("is ready only inside the window, and reports the sync it read", () => {
    const r = describeOutcomeSync({ ...args, connectors: [connector()] });
    expect(r.state).toBe("ready");
    expect(r.detail).toContain("2026-08-23T09:00:00Z");
  });

  it("prefers a live connector over a revoked one for the same provider", () => {
    const r = describeOutcomeSync({ ...args, connectors: [connector({ status: "revoked" }), connector()] });
    expect(r.state).toBe("ready");
  });

  it("ignores connectors belonging to other providers", () => {
    const r = describeOutcomeSync({ ...args, connectors: [connector({ provider: "tiktok" })] });
    expect(r.state).toBe("setup_required");
  });
});

describe("describeAllOutcomeSync", () => {
  it("covers every analytics provider and excludes the ones that carry no metrics", () => {
    const all = describeAllOutcomeSync([], now);
    expect(all.map((c) => c.provider)).toEqual(analyticsProviders().map((p) => p.id));
    expect(all.some((c) => c.provider === "rss")).toBe(false);
  });
});

describe("connectorOutcomeSourceState", () => {
  const cap = (state: OutcomeSyncCapability["state"]): OutcomeSyncCapability => ({
    provider: "meta",
    label: "Meta",
    state,
    detail: "",
    nextInput: null,
    missingPieces: [],
    access: null,
    requiredScopes: [],
  });

  it("is unknown while nothing can sync, which is every provider in this build", () => {
    expect(connectorOutcomeSourceState(describeAllOutcomeSync([connector()], now))).toBe("unknown");
    expect(connectorOutcomeSourceState([])).toBe("unknown");
    expect(connectorOutcomeSourceState([cap("setup_required"), cap("blocked"), cap("not_implemented")])).toBe("unknown");
  });

  it("reports stale rather than available when the only sync is past its window", () => {
    expect(connectorOutcomeSourceState([cap("blocked"), cap("stale")])).toBe("stale");
  });

  it("is available only when some provider could sync now", () => {
    expect(connectorOutcomeSourceState([cap("stale"), cap("ready")])).toBe("available");
  });
});
