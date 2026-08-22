/**
 * Brand Brain typed queries
 * All functions are workspace-scoped and read their own brand only.
 * No fake data is ever seeded or returned; callers receive null if no brand exists.
 */

import { supabase, isSupabaseConfigured } from "./supabase";
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

/** Fetch the Brand Brain root for a workspace. Returns null if none exists yet. */
export async function fetchBrandForWorkspace(workspaceId: string): Promise<Brand | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) {
    console.error("fetchBrandForWorkspace error:", error.message);
    return null;
  }
  return data;
}

/** Fetch all claims for a brand, optionally filtered by type. */
export async function fetchBrandClaims(
  brandId: string,
  claimType?: ClaimType
): Promise<BrandClaim[]> {
  if (!isSupabaseConfigured) return [];
  let query = supabase.from("brand_claims").select("*").eq("brand_id", brandId).order("created_at");
  if (claimType) query = query.eq("claim_type", claimType);
  const { data, error } = await query;
  if (error) { console.error("fetchBrandClaims error:", error.message); return []; }
  return data || [];
}

/** Fetch all audiences for a brand. */
export async function fetchBrandAudiences(brandId: string): Promise<BrandAudience[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("brand_audiences").select("*").eq("brand_id", brandId).order("created_at");
  if (error) { console.error("fetchBrandAudiences error:", error.message); return []; }
  return data || [];
}

/** Fetch all competitors for a brand. */
export async function fetchBrandCompetitors(brandId: string): Promise<BrandCompetitor[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("brand_competitors").select("*").eq("brand_id", brandId).order("watch_level");
  if (error) { console.error("fetchBrandCompetitors error:", error.message); return []; }
  return data || [];
}

/** Fetch all tone guidelines for a brand. */
export async function fetchBrandTone(brandId: string): Promise<BrandToneGuideline[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("brand_tone_guidelines").select("*").eq("brand_id", brandId).order("dimension");
  if (error) { console.error("fetchBrandTone error:", error.message); return []; }
  return data || [];
}

/** Fetch all compliance boundaries for a brand. */
export async function fetchBrandCompliance(brandId: string): Promise<BrandComplianceBoundary[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("brand_compliance_boundaries").select("*").eq("brand_id", brandId).order("enforcement_level");
  if (error) { console.error("fetchBrandCompliance error:", error.message); return []; }
  return data || [];
}

/** Fetch codex version history for a brand. */
export async function fetchBrandCodexVersions(brandId: string): Promise<BrandCodexVersion[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("brand_codex_versions").select("*").eq("brand_id", brandId).order("version_number", { ascending: false });
  if (error) { console.error("fetchBrandCodexVersions error:", error.message); return []; }
  return data || [];
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
