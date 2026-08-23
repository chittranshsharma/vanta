import { isSupabaseConfigured, supabase } from "./supabase";
import { isMissingRelationError } from "./rows";
import type { ApprovedClaimCount } from "./decisionRoom";
import type { Brand } from "./brandBrain";
import type { CreativeAssetRow } from "./creativeIntake";
import type { SourceRegistryRow } from "./sourceRegistry";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface WorkspaceOverview {
  sources: SourceRegistryRow[];
  brand: Brand | null;
  assets: CreativeAssetRow[];
  /** Brand Codex claims approved for use, or the reason there is no number. */
  approvedClaims: ApprovedClaimCount;
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
  approvedClaims: { state: "unreadable", reason: "Supabase is not configured." },
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

  // The approved-claim count needs the brand id, so it cannot join the batch
  // above. It runs only when a brand was actually read.
  const approvedClaims = await countApprovedClaims(workspaceId, brandRes.data ?? null, brandRes.error);
  if (approvedClaims.error) errors.push(`Approved Brand Codex claims: ${approvedClaims.error}`);

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
      approvedClaims: approvedClaims.value,
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

/**
 * Counts the Brand Codex claims this brand has approved for use.
 *
 * A claim counts only when both halves of its approval agree: `claim_type`
 * marks it as a claim the brand permits, and `review_status` marks the review
 * as finished. A claim that is one but not the other is still in progress and
 * is not counted. The filter names the workspace as well as the brand, so a
 * row belonging to another tenant cannot reach this number even if a policy
 * were later relaxed.
 *
 * Returns the state for the UI plus, separately, the message to report when the
 * failure is a real one. An absent table is a pending migration, not a failure.
 */
async function countApprovedClaims(
  workspaceId: string,
  brand: { id: string } | null,
  brandError: { message: string } | null,
): Promise<{ value: ApprovedClaimCount; error: string | null }> {
  // Without a readable brand there is no scope to count in, and reporting the
  // brand failure twice would be noise: the caller already recorded it.
  if (brandError) return { value: { state: "unreadable", reason: brandError.message }, error: null };
  if (!brand) return { value: { state: "no_brand" }, error: null };

  const { count, error } = await supabase
    .from("brand_claims")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("brand_id", brand.id)
    .eq("claim_type", "approved")
    .eq("review_status", "approved");

  if (error) {
    return {
      value: { state: "unreadable", reason: error.message },
      error: isMissingRelationError(error) ? null : error.message,
    };
  }
  return { value: { state: "counted", count: count ?? 0 }, error: null };
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
