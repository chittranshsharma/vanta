/**
 * Source Cohorts — Ticket 7.1
 *
 * Workspace-scoped named cohorts that organize source_registry rows into
 * labeled watchlists. Cohorts are organizational metadata only. They do not
 * create evidence, alter source citability, produce rankings, or ingest feeds.
 *
 * All mutations go through SECURITY DEFINER RPCs — never direct table writes.
 * Reads fail closed: a refused or failed read is returned as ReadResult.error,
 * not as an empty list.
 *
 * Evidence class vocabulary: observed | sourced | inference | simulation | unknown
 * (No evidence class exists on cohort tables.)
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import {
  classifyReadError,
  readFailureSummary,
  readRows,
  UNCONFIGURED_READ,
  type ReadResult,
} from "./rows";
import type { Database } from "../types/database.types";

export type SourceCohortRow =
  Database["public"]["Tables"]["source_cohorts"]["Row"];
export type SourceCohortMemberRow =
  Database["public"]["Tables"]["source_cohort_members"]["Row"];

export type CohortStatus = "active" | "archived";

// ============================================================
// READS — all fail closed
// ============================================================

/**
 * Returns all cohorts in the workspace, ordered newest first.
 * Fails closed: a refused or transient read is returned as error,
 * not as an empty array.
 */
export async function listSourceCohorts(
  workspaceId: string
): Promise<ReadResult<SourceCohortRow[]>> {
  if (!isSupabaseConfigured) return UNCONFIGURED_READ;

  const response = await supabase
    .from("source_cohorts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  return readRows(response, []);
}

/**
 * Returns a single cohort by id, scoped to the workspace.
 * Returns error if the cohort is not found or the read is refused.
 */
export async function getSourceCohort(
  cohortId: string,
  workspaceId: string
): Promise<ReadResult<SourceCohortRow>> {
  if (!isSupabaseConfigured) return UNCONFIGURED_READ;

  const { data, error } = await supabase
    .from("source_cohorts")
    .select("*")
    .eq("id", cohortId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    return {
      data: null,
      error: {
        failure: classifyReadError(error),
        message: readFailureSummary(
          { failure: classifyReadError(error), message: error.message },
          "the source cohort"
        ),
      },
    };
  }

  if (!data) {
    return {
      data: null,
      error: { failure: "failed", message: "Source cohort not found in workspace." },
    };
  }

  return { data, error: null };
}

/**
 * Returns all member rows for a cohort, scoped to the workspace.
 * Fails closed.
 */
export async function listCohortMembers(
  cohortId: string,
  workspaceId: string
): Promise<ReadResult<SourceCohortMemberRow[]>> {
  if (!isSupabaseConfigured) return UNCONFIGURED_READ;

  const response = await supabase
    .from("source_cohort_members")
    .select("*")
    .eq("cohort_id", cohortId)
    .eq("workspace_id", workspaceId)
    .order("added_at", { ascending: false });

  return readRows(response, []);
}

// ============================================================
// WRITES — all via SECURITY DEFINER RPCs
// ============================================================

/**
 * Creates a new active source cohort in the workspace.
 * Any workspace member may create a cohort.
 */
export async function createSourceCohort(
  payload: {
    workspaceId: string;
    name: string;
    description?: string;
    tags?: string[];
  }
): Promise<{ cohortId: string | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { cohortId: null, error: new Error("Supabase not configured.") };
  }

  const { data, error } = await supabase.rpc("create_source_cohort", {
    p_workspace_id: payload.workspaceId,
    p_name: payload.name,
    p_description: payload.description ?? null,
    p_tags: payload.tags ?? [],
  });

  if (error) {
    return { cohortId: null, error: new Error(error.message) };
  }

  const result = data as unknown as { cohort_id: string; success: boolean } | null;
  if (!result?.success || !result.cohort_id) {
    return { cohortId: null, error: new Error("create_source_cohort RPC returned no cohort_id.") };
  }

  return { cohortId: result.cohort_id, error: null };
}

/**
 * Archives a cohort. Requires admin or owner role.
 * Archived cohorts cannot be reactivated (irreversible in v1).
 * Idempotent: archiving an already-archived cohort is a no-op.
 */
export async function archiveSourceCohort(
  cohortId: string,
  workspaceId: string
): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { error: new Error("Supabase not configured.") };
  }

  const { data, error } = await supabase.rpc("archive_source_cohort", {
    p_workspace_id: workspaceId,
    p_cohort_id: cohortId,
  });

  if (error) {
    return { error: new Error(error.message) };
  }

  const result = data as unknown as { success: boolean } | null;
  if (!result?.success) {
    return { error: new Error("archive_source_cohort RPC did not confirm success.") };
  }

  return { error: null };
}

/**
 * Adds a source_registry row to a cohort.
 * Idempotent: duplicate membership silently no-ops.
 * Validates both cohort and source belong to the same workspace.
 * Fails if the cohort is archived.
 */
export async function addSourceToCohort(
  cohortId: string,
  sourceId: string,
  workspaceId: string
): Promise<{ wasDuplicate: boolean; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { wasDuplicate: false, error: new Error("Supabase not configured.") };
  }

  const { data, error } = await supabase.rpc("add_source_to_cohort", {
    p_workspace_id: workspaceId,
    p_cohort_id: cohortId,
    p_source_id: sourceId,
  });

  if (error) {
    return { wasDuplicate: false, error: new Error(error.message) };
  }

  const result = data as unknown as { success: boolean; was_duplicate: boolean } | null;
  if (!result?.success) {
    return { wasDuplicate: false, error: new Error("add_source_to_cohort RPC did not confirm success.") };
  }

  return { wasDuplicate: result.was_duplicate ?? false, error: null };
}

/**
 * Removes a source_registry row from a cohort.
 * Idempotent: removing a non-existent membership is a no-op.
 * Does not touch source_registry or any evidence rows.
 */
export async function removeSourceFromCohort(
  cohortId: string,
  sourceId: string,
  workspaceId: string
): Promise<{ wasNoop: boolean; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { wasNoop: false, error: new Error("Supabase not configured.") };
  }

  const { data, error } = await supabase.rpc("remove_source_from_cohort", {
    p_workspace_id: workspaceId,
    p_cohort_id: cohortId,
    p_source_id: sourceId,
  });

  if (error) {
    return { wasNoop: false, error: new Error(error.message) };
  }

  const result = data as unknown as { success: boolean; was_noop: boolean } | null;
  if (!result?.success) {
    return { wasNoop: false, error: new Error("remove_source_from_cohort RPC did not confirm success.") };
  }

  return { wasNoop: result.was_noop ?? false, error: null };
}
