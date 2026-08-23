import { isSupabaseConfigured, supabase } from "./supabase";
import { jsonObject, narrow } from "./rows";
import type { Tables } from "../types/database.types";
import { ARTIFACT_COVERAGES, ARTIFACT_KINDS, ARTIFACT_PRODUCERS, type StoredArtifact } from "../../shared/media/artifacts";

/**
 * Derived-artifact client (migration 012).
 *
 * Read-only. Migration 012 lets a workspace member insert only rows whose
 * `producer` is `deterministic`, forbids UPDATE outright, and restricts DELETE
 * to owners and admins; every artifact this build cares about is written by the
 * worker under the service role. So there is nothing for the browser to write
 * here, and this module does not pretend otherwise.
 */

type Result<T> = { data: T; error: null } | { data: null; error: string };
const NOT_CONFIGURED = "Supabase is not configured.";
const SCHEMA_AHEAD = "The database schema is ahead of this build; reload or update the app.";

/**
 * Reads one artifact row, or returns why it could not be read.
 *
 * `artifact_kind`, `producer` and `coverage` are CHECK-constrained text columns
 * that the generated types give as `string`. A value this build does not know is
 * reported rather than narrowed away, because guessing the kind of an artifact
 * decides which contract is applied to its bytes.
 */
export function toStoredArtifact(row: Tables<"derived_artifacts">): StoredArtifact | string {
  const artifact_kind = narrow(ARTIFACT_KINDS, row.artifact_kind);
  if (!artifact_kind) return `artifact ${row.id} has artifact_kind "${row.artifact_kind}"`;
  const producer = narrow(ARTIFACT_PRODUCERS, row.producer);
  if (!producer) return `artifact ${row.id} has producer "${row.producer}"`;
  const coverage = narrow(ARTIFACT_COVERAGES, row.coverage);
  if (!coverage) return `artifact ${row.id} has coverage "${row.coverage}"`;
  const features = jsonObject(row.features);
  if (!features) return `artifact ${row.id} has a features value that is not a JSON object`;
  return {
    id: row.id,
    artifact_kind,
    producer,
    producer_version: row.producer_version,
    storage_bucket: row.storage_bucket,
    storage_path: row.storage_path,
    mime_type: row.mime_type,
    byte_size: row.byte_size,
    features,
    coverage,
    created_at: row.created_at,
  };
}

/**
 * Every artifact stored for one asset, newest first.
 *
 * Scoped by workspace as well as asset: the composite foreign key makes the pair
 * the real identity of an asset, and filtering on both means a mistyped asset id
 * cannot reach another tenant's row even before RLS refuses it.
 */
export async function listAssetArtifacts(workspaceId: string, assetId: string): Promise<Result<StoredArtifact[]>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await supabase
    .from("derived_artifacts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false });
  if (error) return { data: null, error: error.message };
  const rows: StoredArtifact[] = [];
  for (const row of data ?? []) {
    const mapped = toStoredArtifact(row);
    if (typeof mapped === "string") return { data: null, error: `Cannot read ${mapped}. ${SCHEMA_AHEAD}` };
    rows.push(mapped);
  }
  return { data: rows, error: null };
}
