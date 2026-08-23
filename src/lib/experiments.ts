import { isSupabaseConfigured, supabase } from "./supabase";
import { isMissingRelationError, narrow } from "./rows";
import type { Tables } from "../types/database.types";
import {
  EXPERIMENT_STATUSES,
  OUTCOME_SOURCE_KINDS,
  type ExperimentStatus,
  type OutcomeSourceKind,
} from "../../shared/experiments/model";
import { SOURCE_CITABILITIES, type CandidateRow, type SourceCitability } from "../../shared/experiments/outcomeImport";

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
const SCHEMA_AHEAD = "The database schema is ahead of this build; reload or update the app.";

/** Outcome rows are observations by definition; migration 016 constrains the column to this one value. */
const EVIDENCE_CLASSES = ["observed"] as const;

/** True when the error means the tables are not applied yet (static schema, pending live apply). */
export function isMissingTableError(message: string): boolean {
  return isMissingRelationError({ message });
}

/**
 * Reads a stored experiment, or returns why it could not be read. `status` and
 * `outcome_source` are CHECK-constrained in the database but arrive as `string`,
 * so they are narrowed against the shared state machine's own value lists.
 */
export function toExperimentRow(row: Tables<"experiments">): ExperimentRow | string {
  const status = narrow(EXPERIMENT_STATUSES, row.status);
  if (!status) return `experiment ${row.id} has status "${row.status}"`;
  const outcome_source = narrow(OUTCOME_SOURCE_KINDS, row.outcome_source);
  if (!outcome_source) return `experiment ${row.id} has outcome_source "${row.outcome_source}"`;
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    created_by: row.created_by,
    title: row.title,
    hypothesis: row.hypothesis,
    primary_metric_key: row.primary_metric_key,
    variant_twin_ids: row.variant_twin_ids,
    min_observations_per_variant: row.min_observations_per_variant,
    outcome_source,
    status,
    started_at: row.started_at,
    concluded_at: row.concluded_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function toOutcomeRow(row: Tables<"experiment_outcomes">): ExperimentOutcomeRow | string {
  const evidence_class = narrow(EVIDENCE_CLASSES, row.evidence_class);
  if (!evidence_class) return `outcome ${row.id} has evidence_class "${row.evidence_class}", but only observed values may be stored as outcomes`;
  const source_citability = narrow(SOURCE_CITABILITIES, row.source_citability);
  if (!source_citability) return `outcome ${row.id} has source_citability "${row.source_citability}"`;
  return {
    id: row.id,
    experiment_id: row.experiment_id,
    variant_twin_id: row.variant_twin_id,
    source_id: row.source_id,
    metric_key: row.metric_key,
    value: row.value,
    observed_at: row.observed_at,
    evidence_class,
    source_citability,
    date_ambiguous: row.date_ambiguous,
    import_note: row.import_note,
    import_batch_id: row.import_batch_id,
  };
}

function readOne(row: Tables<"experiments"> | null): Result<ExperimentRow> {
  if (!row) return { data: null, error: "The database returned no experiment row." };
  const mapped = toExperimentRow(row);
  if (typeof mapped === "string") return { data: null, error: `Cannot read ${mapped}. ${SCHEMA_AHEAD}` };
  return { data: mapped, error: null };
}

export async function listExperiments(workspaceId: string): Promise<Result<ExperimentRow[]>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await supabase.from("experiments").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (error) return { data: null, error: error.message };
  const rows: ExperimentRow[] = [];
  for (const row of data ?? []) {
    const mapped = toExperimentRow(row);
    if (typeof mapped === "string") return { data: null, error: `Cannot read ${mapped}. ${SCHEMA_AHEAD}` };
    rows.push(mapped);
  }
  return { data: rows, error: null };
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
  const { data, error } = await supabase
    .from("experiments")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      title: input.title,
      hypothesis: input.hypothesis,
      primary_metric_key: input.primaryMetricKey,
      variant_twin_ids: input.variantTwinIds,
      min_observations_per_variant: input.minObservationsPerVariant,
      outcome_source: input.outcomeSource,
    })
    .select("*")
    .single();
  if (error) return { data: null, error: error.message };
  return readOne(data);
}

export async function setExperimentStatus(id: string, workspaceId: string, status: ExperimentStatus): Promise<Result<ExperimentRow>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await supabase.from("experiments").update({ status }).eq("id", id).eq("workspace_id", workspaceId).select("*").single();
  if (error) return { data: null, error: error.message };
  return readOne(data);
}

export async function listOutcomes(experimentId: string, workspaceId: string): Promise<Result<ExperimentOutcomeRow[]>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await supabase.from("experiment_outcomes").select("*").eq("experiment_id", experimentId).eq("workspace_id", workspaceId);
  if (error) return { data: null, error: error.message };
  const rows: ExperimentOutcomeRow[] = [];
  for (const row of data ?? []) {
    const mapped = toOutcomeRow(row);
    if (typeof mapped === "string") return { data: null, error: `Cannot read ${mapped}. ${SCHEMA_AHEAD}` };
    rows.push(mapped);
  }
  return { data: rows, error: null };
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
    import_batch_id: input.batchId,
  }));
  const { data, error } = await supabase.from("experiment_outcomes").insert(payload).select("id");
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []).length, error: null };
}
