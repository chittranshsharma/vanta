/**
 * Brand Brain typed queries
 * All functions are workspace-scoped and read their own brand only.
 * No fake data is ever seeded or returned.
 *
 * A read that fails returns its failure class instead of an empty result. These
 * queries used to log the error and return `null` or `[]`, which made a refused
 * read and an unwritten codex look identical: the screen offered to create a
 * brand that already existed, and a grounding claim list could be empty because
 * the network dropped. An absent codex is a real and common state, so it has to
 * be told apart from not being allowed to see one.
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import { classifyReadError, type ReadFailure } from "./rows";
import type { Database } from "../types/database.types";

export type Brand = Database["public"]["Tables"]["brands"]["Row"];
export type BrandInsert = Database["public"]["Tables"]["brands"]["Insert"];
export type BrandUpdate = Database["public"]["Tables"]["brands"]["Update"];

export type BrandClaim = Database["public"]["Tables"]["brand_claims"]["Row"];
export type BrandClaimInsert = Database["public"]["Tables"]["brand_claims"]["Insert"];
export type ClaimType = "approved" | "prohibited" | "conditional" | "unknown";

export type BrandAudience = Database["public"]["Tables"]["brand_audiences"]["Row"];
export type BrandAudienceInsert = Database["public"]["Tables"]["brand_audiences"]["Insert"];

export type BrandProofPoint = Database["public"]["Tables"]["brand_proof_points"]["Row"];
export type BrandCompetitor = Database["public"]["Tables"]["brand_competitors"]["Row"];
export type BrandToneGuideline = Database["public"]["Tables"]["brand_tone_guidelines"]["Row"];
export type BrandComplianceBoundary = Database["public"]["Tables"]["brand_compliance_boundaries"]["Row"];
export type BrandCodexVersion = Database["public"]["Tables"]["brand_codex_versions"]["Row"];

export type BrandFull = {
  brand: Brand;
  claims: BrandClaim[];
  audiences: BrandAudience[];
  competitors: BrandCompetitor[];
  toneGuidelines: BrandToneGuideline[];
  complianceBoundaries: BrandComplianceBoundary[];
  codexVersions: BrandCodexVersion[];
};

// ============================================================
// READ
// ============================================================

/** Why a Brand Brain read produced nothing. `unconfigured` is not a failure of the query. */
export type BrandReadFailure = ReadFailure | "unconfigured";

export type BrandRead<T> =
  | { data: T; error: null }
  | { data: null; error: { failure: BrandReadFailure; message: string } };

const UNCONFIGURED = {
  data: null,
  error: { failure: "unconfigured" as const, message: "Supabase is not configured." }
};

/** Turns one PostgREST response into a `BrandRead`, keeping the failure class. */
function read<T>(
  response: { data: T | null; error: { message: string; code?: string } | null },
  whenNoRows: T
): BrandRead<T> {
  if (response.error) {
    return { data: null, error: { failure: classifyReadError(response.error), message: response.error.message } };
  }
  return { data: response.data ?? whenNoRows, error: null };
}

/** Fetch the Brand Brain root for a workspace. `data: null` means no brand exists yet. */
export async function fetchBrandForWorkspace(workspaceId: string): Promise<BrandRead<Brand | null>> {
  if (!isSupabaseConfigured) return UNCONFIGURED;
  const response = await supabase.from("brands").select("*").eq("workspace_id", workspaceId).maybeSingle();
  // `maybeSingle` already returns null for no rows, and here null is the answer
  // rather than a stand-in for one, so the no-rows fallback is null.
  return read<Brand | null>(response, null);
}

/** Fetch all claims for a brand, optionally filtered by type. */
export async function fetchBrandClaims(brandId: string, claimType?: ClaimType): Promise<BrandRead<BrandClaim[]>> {
  if (!isSupabaseConfigured) return UNCONFIGURED;
  let query = supabase.from("brand_claims").select("*").eq("brand_id", brandId).order("created_at");
  if (claimType) query = query.eq("claim_type", claimType);
  return read(await query, []);
}

/** Fetch all audiences for a brand. */
export async function fetchBrandAudiences(brandId: string): Promise<BrandRead<BrandAudience[]>> {
  if (!isSupabaseConfigured) return UNCONFIGURED;
  return read(await supabase.from("brand_audiences").select("*").eq("brand_id", brandId).order("created_at"), []);
}

/** Fetch all competitors for a brand. */
export async function fetchBrandCompetitors(brandId: string): Promise<BrandRead<BrandCompetitor[]>> {
  if (!isSupabaseConfigured) return UNCONFIGURED;
  return read(await supabase.from("brand_competitors").select("*").eq("brand_id", brandId).order("watch_level"), []);
}

/** Fetch all tone guidelines for a brand. */
export async function fetchBrandTone(brandId: string): Promise<BrandRead<BrandToneGuideline[]>> {
  if (!isSupabaseConfigured) return UNCONFIGURED;
  return read(await supabase.from("brand_tone_guidelines").select("*").eq("brand_id", brandId).order("dimension"), []);
}

/** Fetch all compliance boundaries for a brand. */
export async function fetchBrandCompliance(brandId: string): Promise<BrandRead<BrandComplianceBoundary[]>> {
  if (!isSupabaseConfigured) return UNCONFIGURED;
  return read(
    await supabase.from("brand_compliance_boundaries").select("*").eq("brand_id", brandId).order("enforcement_level"),
    []
  );
}

/** Fetch codex version history for a brand. */
export async function fetchBrandCodexVersions(brandId: string): Promise<BrandRead<BrandCodexVersion[]>> {
  if (!isSupabaseConfigured) return UNCONFIGURED;
  return read(
    await supabase
      .from("brand_codex_versions")
      .select("*")
      .eq("brand_id", brandId)
      .order("version_number", { ascending: false }),
    []
  );
}

/** One sentence for a failed Brand Brain read, naming the recovery that applies. */
export function brandReadSummary(error: { failure: BrandReadFailure; message: string }): string {
  switch (error.failure) {
    case "unconfigured":
      return "Supabase is not configured, so the codex cannot be read in this build.";
    case "denied":
      return "You are not allowed to read this workspace's codex. Ask an admin for access rather than retrying.";
    case "absent":
      return `A table this build expects is not reachable: ${error.message}`;
    case "offline":
      return "The codex could not be reached. The request did not arrive, so nothing was changed — check the connection and try again.";
    case "failed":
      return `The codex could not be read: ${error.message}`;
  }
}

// ============================================================
// WRITE
// ============================================================

/** Create or update the Brand Brain root. Emits an audit event on success. */
export async function upsertBrand(
  payload: BrandInsert,
  userId: string
): Promise<{ brand: Brand | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { brand: null, error: new Error("Supabase not configured.") };
  }

  const { data, error } = await supabase
    .from("brands")
    .upsert({ ...payload, created_by: userId, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error || !data) {
    return { brand: null, error: error ?? new Error("Unknown error.") };
  }

  // Audit trail
  await supabase.from("audit_events").insert({
    workspace_id: data.workspace_id,
    user_id: userId,
    action: "brand.upserted",
    resource_type: "brand",
    resource_id: data.id,
    metadata: { name: data.name, review_status: data.review_status }
  });

  return { brand: data, error: null };
}

/** Add a claim to the brand. */
export async function insertBrandClaim(
  payload: BrandClaimInsert,
  userId: string
): Promise<{ claim: BrandClaim | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { claim: null, error: new Error("Supabase not configured.") };
  }

  const { data, error } = await supabase
    .from("brand_claims")
    .insert({ ...payload, created_by: userId })
    .select()
    .single();

  if (error || !data) {
    return { claim: null, error: error ?? new Error("Unknown error.") };
  }

  await supabase.from("audit_events").insert({
    workspace_id: data.workspace_id,
    user_id: userId,
    action: "brand_claim.created",
    resource_type: "brand_claim",
    resource_id: data.id,
    metadata: { claim_type: data.claim_type, claim_text: data.claim_text.substring(0, 80) }
  });

  return { claim: data, error: null };
}

/** Add an audience segment to the brand. */
export async function insertBrandAudience(
  payload: BrandAudienceInsert,
  userId: string
): Promise<{ audience: BrandAudience | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { audience: null, error: new Error("Supabase not configured.") };
  }

  const { data, error } = await supabase
    .from("brand_audiences")
    .insert({ ...payload, created_by: userId })
    .select()
    .single();

  if (error || !data) {
    return { audience: null, error: error ?? new Error("Unknown error.") };
  }

  await supabase.from("audit_events").insert({
    workspace_id: data.workspace_id,
    user_id: userId,
    action: "brand_audience.created",
    resource_type: "brand_audience",
    resource_id: data.id,
    metadata: { segment_name: data.segment_name }
  });

  return { audience: data, error: null };
}

/** Snapshot the current brand state as a new codex version. */
export async function snapshotBrandCodex(
  brand: Brand,
  claims: BrandClaim[],
  audiences: BrandAudience[],
  userId: string,
  changeSummary: string
): Promise<{ version: BrandCodexVersion | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { version: null, error: new Error("Supabase not configured.") };
  }

  // Get current max version
  const { data: existing } = await supabase
    .from("brand_codex_versions")
    .select("version_number")
    .eq("brand_id", brand.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (existing?.version_number ?? 0) + 1;

  const snapshot = {
    brand,
    claims,
    audiences,
    snapshotted_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("brand_codex_versions")
    .insert({
      brand_id: brand.id,
      workspace_id: brand.workspace_id,
      created_by: userId,
      version_number: nextVersion,
      snapshot,
      change_summary: changeSummary
    })
    .select()
    .single();

  if (error || !data) {
    return { version: null, error: error ?? new Error("Unknown error.") };
  }

  await supabase.from("audit_events").insert({
    workspace_id: brand.workspace_id,
    user_id: userId,
    action: "brand_codex.version_created",
    resource_type: "brand_codex_version",
    resource_id: data.id,
    metadata: { version_number: nextVersion, change_summary: changeSummary }
  });

  return { version: data, error: null };
}
