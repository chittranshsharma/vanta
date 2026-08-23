import { isSupabaseConfigured, supabase } from "./supabase";
import { jsonObject, narrow } from "./rows";
import type { Tables } from "../types/database.types";
import { CONNECTOR_STATUSES, describeAccess, type AccessState, type ConnectorStatus } from "../../shared/connectors/access";

/**
 * Connector client (Upgrade F). Reads the public view (no token columns
 * exist there), requests and revokes via RPCs. Tokens never reach the
 * browser in any form.
 */

export interface ConnectorAccountPublic {
  id: string;
  workspace_id: string;
  provider: string;
  external_account_id: string | null;
  display_name: string | null;
  requested_scopes: string[];
  granted_scopes: string[];
  status: ConnectorStatus;
  consent_granted_at: string | null;
  token_expires_at: string | null;
  last_sync_at: string | null;
  last_error: Record<string, unknown> | null;
  created_at: string;
}

type Result<T> = { data: T; error: null } | { data: null; error: string };
const NOT_CONFIGURED = "Supabase is not configured.";

/**
 * Reads one view row, or returns why it could not be read.
 *
 * Postgres reports every column of a view as nullable, so the generated type
 * cannot promise an id, a provider or a status. A row missing any of those is
 * not a connector this client can describe or revoke, and saying so beats
 * substituting a default that would render as a working connection.
 *
 * Scope arrays default to empty on null, which fails closed: `describeAccess`
 * then reports the required scopes as missing instead of assuming consent.
 */
export function toConnectorAccount(row: Tables<"connector_accounts_public">): ConnectorAccountPublic | string {
  if (!row.id) return "a connector row has no id, so it cannot be revoked or referenced";
  if (!row.workspace_id) return `connector ${row.id} has no workspace`;
  if (!row.provider) return `connector ${row.id} has no provider`;
  if (!row.created_at) return `connector ${row.id} has no creation time`;
  const status = narrow(CONNECTOR_STATUSES, row.status);
  if (!status) return `connector ${row.id} has status "${row.status ?? "null"}", which this build does not recognize`;
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    provider: row.provider,
    external_account_id: row.external_account_id,
    display_name: row.display_name,
    requested_scopes: row.requested_scopes ?? [],
    granted_scopes: row.granted_scopes ?? [],
    status,
    consent_granted_at: row.consent_granted_at,
    token_expires_at: row.token_expires_at,
    last_sync_at: row.last_sync_at,
    last_error: jsonObject(row.last_error),
    created_at: row.created_at,
  };
}

export async function listConnectors(workspaceId: string): Promise<Result<ConnectorAccountPublic[]>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await supabase
    .from("connector_accounts_public")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) return { data: null, error: error.message };
  const rows: ConnectorAccountPublic[] = [];
  for (const row of data ?? []) {
    const mapped = toConnectorAccount(row);
    if (typeof mapped === "string") return { data: null, error: `Cannot read connectors: ${mapped}.` };
    rows.push(mapped);
  }
  return { data: rows, error: null };
}

export async function requestConnector(workspaceId: string, provider: string, scopes: string[]): Promise<Result<string>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await supabase.rpc("request_connector", { p_workspace_id: workspaceId, p_provider: provider, p_scopes: scopes });
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: "request_connector returned no connector id." };
  return { data, error: null };
}

export async function revokeConnector(connectorId: string, workspaceId: string): Promise<Result<boolean>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await supabase.rpc("revoke_connector", { p_connector_id: connectorId, p_workspace_id: workspaceId });
  if (error) return { data: null, error: error.message };
  return { data: Boolean(data), error: null };
}

/** Access state for a platform, computed from the public view rows. */
export function accessStateFor(connectors: ConnectorAccountPublic[], provider: string, requiredScopes: string[], now = new Date()): AccessState {
  const c = connectors.find((x) => x.provider === provider && x.status !== "revoked") ?? connectors.find((x) => x.provider === provider) ?? null;
  return describeAccess({
    connector: c ? { status: c.status, granted_scopes: c.granted_scopes, last_sync_at: c.last_sync_at, token_expires_at: c.token_expires_at } : null,
    requiredScopes,
    now,
    freshnessWindowHours: 24,
  });
}
