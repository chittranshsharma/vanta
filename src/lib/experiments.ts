import { isSupabaseConfigured, supabase } from "./supabase";
import type { ExperimentStatus, OutcomeSourceKind } from "../../shared/experiments/model";
import type { CandidateRow, SourceCitability } from "../../shared/experiments/outcomeImport";

/**
 * Experiment client. Tables exist only after migration 016 is applied;
 * until then every call returns a typed error, never an empty success.
 */

export interface ExperimentRow {
  id: string;
  workspace_id: string;
  created_by: string | null;
  title: string;
  hypothesis: string;
  primary_metric_key: string;
  variant_twin_ids: string[];
  min_observations_per_variant: number;
  outcome_source: OutcomeSourceKind;
  status: ExperimentStatus;
  started_at: string | null;
  concluded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExperimentOutcomeRow {
  id: string;
  experiment_id: string;
  variant_twin_id: string;
  source_id: string;
  metric_key: string;
  value: number;
  observed_at: string;
  evidence_class: "observed";
  source_citability: SourceCitability;
  date_ambiguous: boolean;
  import_note: string | null;
  import_batch_id: string | null;
}

type Result<T> = { data: T; error: null } | { data: null; error: string };
const NOT_CONFIGURED = "Supabase is not configured.";

// Generated types predate migration 016; loose client until types are regenerated (D-16).
function table<T extends "experiments" | "experiment_outcomes">(name: T) {
  return supabase.from(name);
}

/** True when the error means the tables are not applied yet (static schema, pending live apply). */
export function isMissingTableError(message: string): boolean {
  return /does not exist|42P01|schema cache/i.test(message);
}

export async function listExperiments(workspaceId: string): Promise<Result<ExperimentRow[]>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await table("experiments").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as ExperimentRow[], error: null };
}

export async function createExperiment(input: {
  workspaceId: string;
  userId: string;
  title: string;
  hypothesis: string;
  primaryMetricKey: string;
  variantTwinIds: string[];
  minObservationsPerVariant: number;
  outcomeSource: OutcomeSourceKind;
}): Promise<Result<ExperimentRow>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await table("experiments")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      title: input.title,
      hypothesis: input.hypothesis,
      primary_metric_key: input.primaryMetricKey,
      variant_twin_ids: input.variantTwinIds,
      min_observations_per_variant: input.minObservationsPerVariant,
      outcome_source: input.outcomeSource
    } as never)
    .select("*")
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as ExperimentRow, error: null };
}

export async function setExperimentStatus(id: string, workspaceId: string, status: ExperimentStatus): Promise<Result<ExperimentRow>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await table("experiments").update({ status } as never).eq("id", id).eq("workspace_id", workspaceId).select("*").single();
  if (error) return { data: null, error: error.message };
  return { data: data as unknown as ExperimentRow, error: null };
}

export async function listOutcomes(experimentId: string, workspaceId: string): Promise<Result<ExperimentOutcomeRow[]>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await table("experiment_outcomes").select("*").eq("experiment_id", experimentId).eq("workspace_id", workspaceId);
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as ExperimentOutcomeRow[], error: null };
}

/**
 * Writes a reviewed import plan. Every row carries its experiment, variant,
 * source, the citability of that source at import time, and the ambiguity
 * flag. Rows are inserted in one statement so a partial import cannot leave
 * an experiment half-populated without the caller knowing.
 */
export async function importOutcomes(input: {
  workspaceId: string;
  userId: string;
  experimentId: string;
  metricKey: string;
  sourceId: string;
  sourceCitability: SourceCitability;
  rows: CandidateRow[];
  batchId: string;
}): Promise<Result<number>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  if (input.rows.length === 0) return { data: null, error: "No accepted rows to import." };
  const payload = input.rows.map((r) => ({
    workspace_id: input.workspaceId,
    experiment_id: input.experimentId,
    variant_twin_id: r.variant_twin_id,
    source_id: input.sourceId,
    created_by: input.userId,
    metric_key: input.metricKey,
    value: r.value,
    observed_at: r.observed_at,
    source_citability: input.sourceCitability,
    date_ambiguous: r.date_ambiguous,
    import_note: r.notes.length > 0 ? r.notes.join("; ") : null,
    import_batch_id: input.batchId
  }));
  const { data, error } = await table("experiment_outcomes").insert(payload as never).select("id");
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []).length, error: null };
}
