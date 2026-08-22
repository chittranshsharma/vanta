/**
 * Source access state (Upgrade F). Turns connector and source facts into
 * the explicit `unknown` / `insufficient evidence` states the product must
 * show whenever authorized data is absent. Pure.
 */

export type ConnectorStatus = "pending_consent" | "connected" | "revoked" | "error";

export interface AccessInput {
  /** Connector for the platform in question, or null when none was ever requested. */
  connector: { status: ConnectorStatus; granted_scopes: string[]; last_sync_at: string | null; token_expires_at: string | null } | null;
  requiredScopes: string[];
  now: Date;
  /** Maximum age of the last sync before data is considered stale. */
  freshnessWindowHours: number;
}

export type AccessState =
  | { state: "available"; lastSyncAt: string }
  | { state: "stale"; lastSyncAt: string; reason: string }
  | { state: "unknown"; reason: string; nextInput: string };

export function describeAccess(input: AccessInput): AccessState {
  const c = input.connector;
  if (!c) return { state: "unknown", reason: "No authorized connection exists for this platform.", nextInput: "Ask a workspace admin to connect the account." };
  if (c.status === "pending_consent") return { state: "unknown", reason: "Connection requested; consent not granted yet.", nextInput: "Complete the authorization flow." };
  if (c.status === "revoked") return { state: "unknown", reason: "Connection was revoked.", nextInput: "Reconnect the account." };
  if (c.status === "error") return { state: "unknown", reason: "Connection is in an error state.", nextInput: "Reconnect or check the provider." };

  const missing = input.requiredScopes.filter((s) => !c.granted_scopes.includes(s));
  if (missing.length > 0) {
    return { state: "unknown", reason: `Granted scopes do not include: ${missing.join(", ")}.`, nextInput: "Re-authorize with the missing scopes." };
  }
  if (c.token_expires_at && Date.parse(c.token_expires_at) < input.now.getTime()) {
    return { state: "unknown", reason: "Access token expired and has not been refreshed.", nextInput: "Wait for the backend refresh or reconnect." };
  }
  if (!c.last_sync_at) {
    return { state: "unknown", reason: "Connected, but no sync has completed yet.", nextInput: "Run the first sync." };
  }
  const ageHours = (input.now.getTime() - Date.parse(c.last_sync_at)) / 3_600_000;
  if (ageHours > input.freshnessWindowHours) {
    return { state: "stale", lastSyncAt: c.last_sync_at, reason: `Last sync ${Math.floor(ageHours)} h ago exceeds the ${input.freshnessWindowHours} h window.` };
  }
  return { state: "available", lastSyncAt: c.last_sync_at };
}

/**
 * Test windows derived from owned history only. Returns null (unknown) when
 * there is not enough observed data. Never a "best time to post" claim.
 */
export function suggestTestWindows(
  observations: Array<{ hour_utc: number; weekday: number; value: number }>,
  minObservations = 30
): { windows: Array<{ weekday: number; hour_utc: number; observations: number }>; state: "inference" | "unknown"; note: string } {
  if (observations.length < minObservations) {
    return { windows: [], state: "unknown", note: `Insufficient observed history (${observations.length} of ${minObservations} needed).` };
  }
  const buckets = new Map<string, { weekday: number; hour_utc: number; n: number; sum: number }>();
  for (const o of observations) {
    const k = `${o.weekday}:${o.hour_utc}`;
    const b = buckets.get(k) ?? { weekday: o.weekday, hour_utc: o.hour_utc, n: 0, sum: 0 };
    b.n += 1;
    b.sum += o.value;
    buckets.set(k, b);
  }
  const ranked = [...buckets.values()]
    .filter((b) => b.n >= 3)
    .sort((a, b) => b.sum / b.n - a.sum / a.n)
    .slice(0, 3)
    .map((b) => ({ weekday: b.weekday, hour_utc: b.hour_utc, observations: b.n }));
  if (ranked.length === 0) {
    return { windows: [], state: "unknown", note: "No hour bucket has at least 3 observations." };
  }
  return { windows: ranked, state: "inference", note: "Candidate test windows from your own observed history. Not a prediction; run them as experiments." };
}
