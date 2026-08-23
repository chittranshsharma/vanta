import { isSupabaseConfigured, supabase } from "./supabase";
import { isMissingRelationError } from "./rows";
import type { Brand } from "./brandBrain";
import type { CreativeAssetRow } from "./creativeIntake";
import type { SourceRegistryRow } from "./sourceRegistry";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface WorkspaceOverview {
  sources: SourceRegistryRow[];
  brand: Brand | null;
  assets: CreativeAssetRow[];
  /** Counts for the Decision Room ladder. `null` means the table is unavailable in this environment (migration pending), which is different from zero. */
  counts: {
    twins: number;
    metricDefinitions: number;
    experiments: number | null;
    observedOutcomes: number | null;
    postObservations: number | null;
  };
}

export interface WorkspaceOverviewResult {
  data: WorkspaceOverview;
  /** Human-readable failures, one per query that failed. Empty means every query succeeded. */
  errors: string[];
}

export const EMPTY_OVERVIEW: WorkspaceOverview = {
  sources: [],
  brand: null,
  assets: [],
  counts: { twins: 0, metricDefinitions: 0, experiments: null, observedOutcomes: null, postObservations: null }
};

/**
 * Loads the Decision Room summary for a workspace.
 *
 * Unlike the per-entity fetch helpers, this reports query failures instead of
 * collapsing them into empty arrays. A failed read must render as "could not
 * load", never as "no sources yet": an empty state is a claim about the data
 * and Vanta does not make claims it cannot back.
 */
export async function fetchWorkspaceOverview(workspaceId: string): Promise<WorkspaceOverviewResult> {
  if (!isSupabaseConfigured) {
    return { data: EMPTY_OVERVIEW, errors: ["Supabase is not configured."] };
  }

  const [sourcesRes, brandRes, assetsRes, twinCount, metricCount, experimentCount, outcomeCount, historyCount] = await Promise.all([
    supabase.from("source_registry").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("brands").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    supabase.from("creative_assets").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    countRows("creative_twins", workspaceId),
    countRows("metric_definitions", workspaceId),
    countRows("experiments", workspaceId),
    countRows("experiment_outcomes", workspaceId),
    countRows("post_observations", workspaceId),
  ]);

  const errors: string[] = [];
  if (sourcesRes.error) errors.push(`Sources: ${sourcesRes.error.message}`);
  if (brandRes.error) errors.push(`Brand Brain: ${brandRes.error.message}`);
  if (assetsRes.error) errors.push(`Creative assets: ${assetsRes.error.message}`);

  // A table that does not exist yet is a known repository state, not a read
  // failure: it becomes a null count, and the UI says the migration is pending.
  for (const [label, res] of [
    ["Creative twins", twinCount],
    ["Metric definitions", metricCount],
  ] as const) {
    if (res.error && !res.missing) errors.push(`${label}: ${res.error}`);
  }

  return {
    data: {
      sources: sourcesRes.data ?? [],
      brand: brandRes.data ?? null,
      assets: assetsRes.data ?? [],
      counts: {
        twins: twinCount.count ?? 0,
        metricDefinitions: metricCount.count ?? 0,
        experiments: experimentCount.count,
        observedOutcomes: outcomeCount.count,
        postObservations: historyCount.count,
      },
    },
    errors,
  };
}

interface CountResult {
  count: number | null;
  error: string | null;
  /** True when the table is absent in this environment (migration pending live apply). */
  missing: boolean;
}

/** Tables the Decision Room ladder counts. Literal names, so the generated schema checks every one of them. */
type CountableTable = "creative_twins" | "metric_definitions" | "experiments" | "experiment_outcomes" | "post_observations";

/** Row count for one workspace. Returns `missing` rather than an error when the table does not exist yet. */
async function countRows(table: CountableTable, workspaceId: string): Promise<CountResult> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
  if (error) {
    return { count: null, error: error.message, missing: isMissingRelationError(error) };
  }
  return { count: count ?? 0, error: null, missing: false };
}
