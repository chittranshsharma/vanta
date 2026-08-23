/**
 * Connector outcome-sync capability (review item F-1). Pure.
 *
 * An experiment may declare that its outcomes will come from an authorized
 * connector. Nothing in this build can deliver that yet, and the gap is not one
 * missing credential: it is four separate absences, listed in
 * `MISSING_SYNC_PIECES` below. This module states them so a screen can say what
 * is absent and who, if anyone, could act on it — instead of offering a sync
 * button that silently does nothing, or reporting a connector as an available
 * outcome source because a row exists.
 *
 * Connector access itself is resolved by `describeAccess`, which this module
 * reuses rather than re-deriving. An unimplemented sync never hides a revoked
 * token: `access` is computed either way.
 */

import { describeAccess, type AccessState, type ConnectorStatus } from "./access";
import { analyticsProviders, providerSpec, type ProviderId } from "./providers";

/**
 * Providers whose outcome sync this build actually contains.
 *
 * Empty. No job type enqueues an outcome sync and no worker handler writes
 * `experiment_outcomes`, so every provider resolves to `not_implemented`. A
 * future implementation adds its provider id here, and the states below start
 * reflecting the connector instead of the build.
 */
export const OUTCOME_SYNC_PROVIDERS_IN_BUILD: readonly ProviderId[] = [];

/**
 * What must exist before any provider's outcomes could be synced.
 *
 * Each line is a fact about this repository, not a guess about a provider. They
 * are independent: registering an OAuth app would clear the first and leave the
 * other three, so an operator who completes consent would still get no rows.
 */
export const MISSING_SYNC_PIECES: readonly string[] = [
  "No OAuth application is registered for any provider, so consent cannot be granted (every provider's consent flow is still oauth_pending_registration).",
  "No job type enqueues an outcome sync and no worker handler writes experiment_outcomes, so nothing would run even with a valid token.",
  "An outcome row requires a variant_twin_id, and nothing records which external post carried which variant, so a fetched metric could not be attributed to a variant without inventing the link.",
  "An outcome row requires a source_id to cite, and connecting an account does not create a registered source row for it.",
] as const;

export type OutcomeSyncState =
  /** The provider carries no performance metrics, so it is not an outcome source. */
  | "not_applicable"
  /** This build contains no sync path, so no action by any person produces rows. */
  | "not_implemented"
  /** A sync path exists and the connection has not been established yet. */
  | "setup_required"
  /** A sync path exists and the connection cannot be used as it stands. */
  | "blocked"
  /** Rows could be synced, but the last sync is older than the freshness window. */
  | "stale"
  /** Rows could be synced now. */
  | "ready";

export interface OutcomeSyncCapability {
  provider: ProviderId;
  label: string;
  state: OutcomeSyncState;
  detail: string;
  /** What a person could do next, or null when nothing they do would help. */
  nextInput: string | null;
  /** Absences in this build. Empty only when the provider's sync is implemented. */
  missingPieces: readonly string[];
  /** Connector access, computed even when the sync is unimplemented. Null when no connector is possible. */
  access: AccessState | null;
  requiredScopes: string[];
}

export interface ConnectorFacts {
  provider: string;
  status: ConnectorStatus;
  granted_scopes: string[];
  last_sync_at: string | null;
  token_expires_at: string | null;
}

export interface OutcomeSyncInput {
  provider: ProviderId;
  /** Connector rows for the workspace, from the public view. Rows for other providers are ignored. */
  connectors: ConnectorFacts[];
  now: Date;
  freshnessWindowHours?: number;
  /**
   * Which providers have a sync path. Defaults to what this build contains, which
   * is nothing. Passed in rather than read from the constant so the connector
   * branches are reachable and tested before any producer is written.
   */
  implementedProviders?: readonly ProviderId[];
}

/** The connector this provider would sync through: the live one, else the most recent of any state. */
function connectorFor(connectors: ConnectorFacts[], provider: ProviderId): ConnectorFacts | null {
  return (
    connectors.find((c) => c.provider === provider && c.status !== "revoked") ??
    connectors.find((c) => c.provider === provider) ??
    null
  );
}

/**
 * Whether one provider's outcomes could be synced, and what stands in the way.
 *
 * `not_implemented` outranks every connector state on purpose. Telling an
 * operator to complete a consent flow that cannot produce a row would be asking
 * for work with no result, so the build's own gap is reported first and
 * `nextInput` is null. The connector's access state is still returned alongside,
 * so a revoked or expired connection stays visible.
 */
export function describeOutcomeSync(input: OutcomeSyncInput): OutcomeSyncCapability {
  const spec = providerSpec(input.provider);
  const label = spec?.label ?? input.provider;
  const requiredScopes = spec?.analyticsScopes ?? [];

  if (requiredScopes.length === 0) {
    return {
      provider: input.provider,
      label,
      state: "not_applicable",
      detail: `${label} carries no performance metrics, so it cannot be an outcome source. Connecting it adds sourced claims, not observed outcomes.`,
      nextInput: null,
      missingPieces: [],
      access: null,
      requiredScopes,
    };
  }

  const connector = connectorFor(input.connectors, input.provider);
  const access = describeAccess({
    connector: connector
      ? {
          status: connector.status,
          granted_scopes: connector.granted_scopes,
          last_sync_at: connector.last_sync_at,
          token_expires_at: connector.token_expires_at,
        }
      : null,
    requiredScopes,
    now: input.now,
    freshnessWindowHours: input.freshnessWindowHours ?? 24,
  });

  const implemented = input.implementedProviders ?? OUTCOME_SYNC_PROVIDERS_IN_BUILD;
  if (!implemented.includes(input.provider)) {
    return {
      provider: input.provider,
      label,
      state: "not_implemented",
      detail: `No outcome sync for ${label} exists in this build. ${MISSING_SYNC_PIECES.length} things are absent, and clearing any one of them alone would still produce no rows. Import outcomes from a CSV against a registered source instead.`,
      nextInput: null,
      missingPieces: MISSING_SYNC_PIECES,
      access,
      requiredScopes,
    };
  }

  if (access.state === "available") {
    return { provider: input.provider, label, state: "ready", detail: `Last sync ${access.lastSyncAt}.`, nextInput: null, missingPieces: [], access, requiredScopes };
  }
  if (access.state === "stale") {
    return { provider: input.provider, label, state: "stale", detail: access.reason, nextInput: "Run a sync, or read the existing rows as older than the freshness window.", missingPieces: [], access, requiredScopes };
  }
  // A connection nobody has established yet is setup; one that exists and cannot
  // be used — revoked, errored, expired, or short of scopes — is blocked.
  const isSetup = connector === null || connector.status === "pending_consent";
  return {
    provider: input.provider,
    label,
    state: isSetup ? "setup_required" : "blocked",
    detail: access.reason,
    nextInput: access.nextInput,
    missingPieces: [],
    access,
    requiredScopes,
  };
}

/** Every provider that could carry outcomes, in catalog order. */
export function describeAllOutcomeSync(
  connectors: ConnectorFacts[],
  now: Date,
  freshnessWindowHours?: number,
  implementedProviders?: readonly ProviderId[]
): OutcomeSyncCapability[] {
  return analyticsProviders().map((p) => describeOutcomeSync({ provider: p.id, connectors, now, freshnessWindowHours, implementedProviders }));
}

/**
 * The source state an experiment declaring `outcome_source: "connector"` should
 * be read against.
 *
 * An experiment row names no provider, so the only truthful reading is across
 * all of them: outcomes could arrive if any provider's sync is ready. This is
 * deliberately keyed on sync readiness rather than connector access — a
 * connected account whose data nothing in this build can fetch is not an
 * available outcome source.
 */
export function connectorOutcomeSourceState(capabilities: OutcomeSyncCapability[]): "available" | "stale" | "unknown" {
  if (capabilities.some((c) => c.state === "ready")) return "available";
  if (capabilities.some((c) => c.state === "stale")) return "stale";
  return "unknown";
}
