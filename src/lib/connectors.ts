import { isSupabaseConfigured, supabase } from "./supabase";
import { describeAccess, type AccessState, type ConnectorStatus } from "../../shared/connectors/access";

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

function loose() {
  return supabase as unknown as {
    from: (t: string) => ReturnType<typeof supabase.from>;
    rpc: (n: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
}

export async function listConnectors(workspaceId: string): Promise<Result<ConnectorAccountPublic[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  const { data, error } = await loose().from("connector_accounts_public").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as ConnectorAccountPublic[], error: null };
}

export async function requestConnector(workspaceId: string, provider: string, scopes: string[]): Promise<Result<string>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  const { data, error } = await loose().rpc("request_connector", { p_workspace_id: workspaceId, p_provider: provider, p_scopes: scopes });
  if (error) return { data: null, error: error.message };
  return { data: data as string, error: null };
}

export async function revokeConnector(connectorId: string, workspaceId: string): Promise<Result<boolean>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  const { data, error } = await loose().rpc("revoke_connector", { p_connector_id: connectorId, p_workspace_id: workspaceId });
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
