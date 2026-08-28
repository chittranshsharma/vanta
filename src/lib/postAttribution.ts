import { isSupabaseConfigured, supabase } from "./supabase";

export interface PostVariantAttributionRow {
  id: string;
  workspace_id: string;
  connector_account_id: string | null;
  provider: string;
  external_account_id: string | null;
  external_post_id: string;
  asset_id: string;
  twin_id: string;
  variant_twin_id: string | null;
  twin_version_id: string | null;
  experiment_id: string | null;
  source_id: string | null;
  published_at: string | null;
  idempotency_key: string | null;
  provenance: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

type Result<T> = { data: T; error: null } | { data: null; error: string };
const NOT_CONFIGURED = "Supabase is not configured.";

export interface CreatePostAttributionInput {
  workspaceId: string;
  userId: string;
  provider: string;
  externalPostId: string;
  assetId: string;
  twinId: string;
  connectorAccountId?: string | null;
  externalAccountId?: string | null;
  variantTwinId?: string | null;
  twinVersionId?: string | null;
  experimentId?: string | null;
  sourceId?: string | null;
  publishedAt?: string | null;
  idempotencyKey?: string | null;
  provenance?: Record<string, unknown>;
}

export function toPostVariantAttributionRow(raw: Record<string, unknown>): PostVariantAttributionRow {
  return {
    id: String(raw.id),
    workspace_id: String(raw.workspace_id),
    connector_account_id: raw.connector_account_id ? String(raw.connector_account_id) : null,
    provider: String(raw.provider),
    external_account_id: raw.external_account_id ? String(raw.external_account_id) : null,
    external_post_id: String(raw.external_post_id),
    asset_id: String(raw.asset_id),
    twin_id: String(raw.twin_id),
    variant_twin_id: raw.variant_twin_id ? String(raw.variant_twin_id) : null,
    twin_version_id: raw.twin_version_id ? String(raw.twin_version_id) : null,
    experiment_id: raw.experiment_id ? String(raw.experiment_id) : null,
    source_id: raw.source_id ? String(raw.source_id) : null,
    published_at: raw.published_at ? String(raw.published_at) : null,
    idempotency_key: raw.idempotency_key ? String(raw.idempotency_key) : null,
    provenance: raw.provenance && typeof raw.provenance === "object" && !Array.isArray(raw.provenance)
      ? (raw.provenance as Record<string, unknown>)
      : {},
    created_by: raw.created_by ? String(raw.created_by) : null,
    created_at: String(raw.created_at || new Date().toISOString()),
  };
}

export async function linkPostToVariant(input: CreatePostAttributionInput): Promise<Result<PostVariantAttributionRow>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  const payload: Record<string, unknown> = {
    workspace_id: input.workspaceId,
    created_by: input.userId,
    provider: input.provider,
    external_post_id: input.externalPostId,
    asset_id: input.assetId,
    twin_id: input.twinId,
    connector_account_id: input.connectorAccountId ?? null,
    external_account_id: input.externalAccountId ?? null,
    variant_twin_id: input.variantTwinId ?? null,
    twin_version_id: input.twinVersionId ?? null,
    experiment_id: input.experimentId ?? null,
    source_id: input.sourceId ?? null,
    published_at: input.publishedAt ?? null,
    idempotency_key: input.idempotencyKey ?? null,
    provenance: input.provenance ?? {},
  };

  const { data, error } = await supabase
    .from("post_variant_attributions" as never)
    .insert(payload as never)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        data: null,
        error: `Post "${input.externalPostId}" for provider "${input.provider}" is already attributed to a variant in this workspace.`,
      };
    }
    return { data: null, error: error.message };
  }

  return { data: toPostVariantAttributionRow(data as Record<string, unknown>), error: null };
}

export async function listPostAttributions(workspaceId: string, twinId?: string): Promise<Result<PostVariantAttributionRow[]>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  let q = supabase
    .from("post_variant_attributions" as never)
    .select("*")
    .eq("workspace_id", workspaceId);

  if (twinId) q = q.eq("twin_id", twinId);

  const { data, error } = await q.order("created_at", { ascending: false }).limit(500);
  if (error) return { data: null, error: error.message };

  return {
    data: (data ?? []).map((r) => toPostVariantAttributionRow(r as Record<string, unknown>)),
    error: null,
  };
}
