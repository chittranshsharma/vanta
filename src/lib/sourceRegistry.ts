/**
 * Source Registry & Evidence Layer typed queries and services
 *
 * Workspace-scoped reads and audited writes.
 * Pure and deterministic evidence-validation helpers.
 *
 * Notice: Ordinary users cannot set health_status = 'connected'.
 * The updateSourceStatus API explicitly excludes 'connected' from its allowed status union,
 * and the database trigger trg_block_connected_status enforces this for any authenticated JWT.
 *
 * A failed read returns its failure class rather than an empty list. These readers
 * used to log the error and return `[]`, which rendered a refused or unreachable
 * registry as a workspace with no sources and no evidence — a positive claim about
 * what may be cited, made from data that was never read.
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import { classifyReadError, readFailureSummary, readRows, UNCONFIGURED_READ, type ReadResult } from "./rows";
import type { Database } from "../types/database.types";
import type { CitabilityResult, EvidenceClass } from "./evidence";

export type SourceRegistryRow = Database["public"]["Tables"]["source_registry"]["Row"];
export type SourceRegistryInsert = Database["public"]["Tables"]["source_registry"]["Insert"];
export type SourceRegistryUpdate = Database["public"]["Tables"]["source_registry"]["Update"];

export type EvidenceItemRow = Database["public"]["Tables"]["evidence_items"]["Row"];
export type EvidenceItemInsert = Database["public"]["Tables"]["evidence_items"]["Insert"];

export type MetricDefinitionRow = Database["public"]["Tables"]["metric_definitions"]["Row"];
export type MetricDefinitionInsert = Database["public"]["Tables"]["metric_definitions"]["Insert"];

export type AllowedUserSourceStatus = "unverified" | "stale" | "disconnected";

// ============================================================
// EVALUATION / CITABILITY LOGIC (Synchronous & Pure)
// ============================================================

/**
 * Pure evaluation of a source's citability based on its health_status,
 * last_verified_at timestamp, and freshness_window_days.
 *
 * Returns a rich CitabilityResult rather than a flattened boolean.
 */
export function evaluateSourceCitability(source: SourceRegistryRow | null): CitabilityResult {
  if (!source) {
    return { status: "blocked", reason: "Source not found." };
  }

  if (source.health_status === "disconnected") {
    return { status: "blocked", reason: "Source is disconnected and cannot be cited." };
  }

  if (source.health_status === "stale") {
    return {
      status: "citable_stale",
      sourceId: source.id,
      warning: "Source is marked stale. It may be cited for context but cannot support verified numeric claims."
    };
  }

  if (source.health_status === "unverified") {
    return {
      status: "citable_unverified",
      sourceId: source.id,
      warning: "Source is unverified. Claims derived from it remain in partial evidence state."
    };
  }

  if (source.health_status === "connected") {
    // Check freshness based on last_verified_at and freshness_window_days
    if (!source.last_verified_at) {
      return {
        status: "citable_stale",
        sourceId: source.id,
        warning: "Connected source lacks a verification timestamp and is treated as stale."
      };
    }

    const lastVerified = new Date(source.last_verified_at).getTime();
    const now = Date.now();
    const windowMs = (source.freshness_window_days || 30) * 24 * 60 * 60 * 1000;

    if (now - lastVerified > windowMs) {
      return {
        status: "citable_stale",
        sourceId: source.id,
        warning: "Source verification has exceeded its configured freshness window."
      };
    }

    return { status: "verified", sourceId: source.id };
  }

  return { status: "blocked", reason: `Unknown source health status: ${source.health_status}` };
}

// ============================================================
// ASYNC EVIDENCE VALIDATION SERVICE
// ============================================================

/**
 * Resolves citability for a specific source ID within a workspace.
 */
export async function resolveEvidenceCitability(
  sourceId: string,
  workspaceId: string
): Promise<CitabilityResult> {
  if (!isSupabaseConfigured) {
    return { status: "blocked", reason: "Supabase not configured." };
  }

  const { data: source, error } = await supabase
    .from("source_registry")
    .select("*")
    .eq("id", sourceId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    // Blocked either way, but the reason has to name the right recovery. A refused
    // read is not an unregistered source, and telling the user to register one
    // sends them to add a row that already exists and that they still cannot see.
    return {
      status: "blocked",
      reason: readFailureSummary({ failure: classifyReadError(error), message: error.message }, "the source registry")
    };
  }

  if (!source) {
    return { status: "blocked", reason: "Source record not found in workspace." };
  }

  return evaluateSourceCitability(source);
}

// ============================================================
// SOURCE REGISTRY READ & WRITE
// ============================================================

export async function fetchSourcesForWorkspace(workspaceId: string): Promise<ReadResult<SourceRegistryRow[]>> {
  if (!isSupabaseConfigured) return UNCONFIGURED_READ;
  const response = await supabase
    .from("source_registry")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  return readRows(response, []);
}

export async function insertSource(
  payload: Omit<SourceRegistryInsert, "health_status"> & { health_status?: "unverified" | "stale" | "disconnected" },
  userId: string
): Promise<{ source: SourceRegistryRow | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { source: null, error: new Error("Supabase not configured.") };
  }

  // Force default health_status to 'unverified' if not specified
  const insertPayload: SourceRegistryInsert = {
    ...payload,
    health_status: payload.health_status || "unverified",
    created_by: userId,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("source_registry")
    .insert(insertPayload)
    .select()
    .single();

  if (error || !data) {
    return { source: null, error: error ?? new Error("Failed to insert source.") };
  }

  await supabase.from("audit_events").insert({
    workspace_id: data.workspace_id,
    user_id: userId,
    action: "source_registry.created",
    resource_type: "source_registry",
    resource_id: data.id,
    metadata: { name: data.name, source_type: data.source_type, health_status: data.health_status }
  });

  return { source: data, error: null };
}

export async function updateSourceStatus(
  id: string,
  workspaceId: string,
  status: AllowedUserSourceStatus,
  userId: string
): Promise<{ source: SourceRegistryRow | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { source: null, error: new Error("Supabase not configured.") };
  }

  const { data, error } = await supabase
    .from("source_registry")
    .update({
      health_status: status,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error || !data) {
    return { source: null, error: error ?? new Error("Failed to update source status.") };
  }

  await supabase.from("audit_events").insert({
    workspace_id: workspaceId,
    user_id: userId,
    action: "source_registry.status_updated",
    resource_type: "source_registry",
    resource_id: data.id,
    metadata: { new_status: status }
  });

  return { source: data, error: null };
}

// ============================================================
// EVIDENCE ITEMS READ & WRITE
// ============================================================

export async function fetchEvidenceItems(
  workspaceId: string,
  filter?: { sourceId?: string; evidenceClass?: EvidenceClass }
): Promise<ReadResult<EvidenceItemRow[]>> {
  if (!isSupabaseConfigured) return UNCONFIGURED_READ;
  let query = supabase
    .from("evidence_items")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (filter?.sourceId) {
    query = query.eq("source_id", filter.sourceId);
  }
  if (filter?.evidenceClass) {
    query = query.eq("evidence_class", filter.evidenceClass);
  }

  return readRows(await query, []);
}

export async function insertEvidenceItem(
  payload: EvidenceItemInsert,
  userId: string
): Promise<{ item: EvidenceItemRow | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { item: null, error: new Error("Supabase not configured.") };
  }

  const { data, error } = await supabase
    .from("evidence_items")
    .insert({
      ...payload,
      created_by: userId,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error || !data) {
    return { item: null, error: error ?? new Error("Failed to insert evidence item.") };
  }

  await supabase.from("audit_events").insert({
    workspace_id: data.workspace_id,
    user_id: userId,
    action: "evidence_item.created",
    resource_type: "evidence_item",
    resource_id: data.id,
    metadata: {
      claim_text: data.claim_text.substring(0, 80),
      evidence_class: data.evidence_class,
      source_id: data.source_id
    }
  });

  return { item: data, error: null };
}

// ============================================================
// METRIC DEFINITIONS READ & WRITE
// ============================================================

export async function fetchMetricDefinitions(workspaceId: string): Promise<ReadResult<MetricDefinitionRow[]>> {
  if (!isSupabaseConfigured) return UNCONFIGURED_READ;
  const response = await supabase
    .from("metric_definitions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("metric_key");

  return readRows(response, []);
}

export async function insertMetricDefinition(
  payload: MetricDefinitionInsert,
  userId: string
): Promise<{ definition: MetricDefinitionRow | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { definition: null, error: new Error("Supabase not configured.") };
  }

  const { data, error } = await supabase
    .from("metric_definitions")
    .insert({
      ...payload,
      created_by: userId,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error || !data) {
    return { definition: null, error: error ?? new Error("Failed to insert metric definition.") };
  }

  await supabase.from("audit_events").insert({
    workspace_id: data.workspace_id,
    user_id: userId,
    action: "metric_definition.created",
    resource_type: "metric_definition",
    resource_id: data.id,
    metadata: { metric_key: data.metric_key, display_name: data.display_name }
  });

  return { definition: data, error: null };
}
