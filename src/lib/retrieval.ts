import { isSupabaseConfigured, supabase } from "./supabase";
import { classifyReadError } from "./rows";

/**
 * Retrieval coverage (Upgrade E), read-only.
 *
 * The browser never embeds and never queries vectors; it can only report how
 * much of the codex is indexed. Migration 013 is applied, so the store exists —
 * and nothing fills it. That is not one missing credential: the reasons are
 * listed in `MISSING_RETRIEVAL_PIECES`. A coverage number of "0 of 40" on its
 * own reads as an import in progress, so the absence is stated instead.
 */

export const MISSING_RETRIEVAL_PIECES: readonly string[] = [
  "No embedding provider is chosen (E-3), so there is nothing to turn an approved claim into a vector.",
  "No job type enqueues an embedding pass and no worker is deployed to run one, so no row would be indexed even with a provider.",
  "Nothing in the product reads retrieval: no brief, answer, or twin field is grounded by a vector search, so a populated store would not change anything a user sees.",
] as const;

export interface RetrievalCoverageRow {
  source_table: string;
  indexed_rows: number;
  total_rows: number;
}

export type RetrievalCoverage =
  | { state: "covered"; rows: RetrievalCoverageRow[]; indexed: number; total: number }
  /** The function answered, and nothing is indexed. Expected while the pieces above are absent. */
  | { state: "nothing_indexed"; rows: RetrievalCoverageRow[]; total: number }
  | { state: "unconfigured" }
  | { state: "not_applied" }
  | { state: "denied" }
  | { state: "unreadable"; reason: string };

export async function fetchRetrievalCoverage(workspaceId: string): Promise<RetrievalCoverage> {
  if (!isSupabaseConfigured) return { state: "unconfigured" };
  const { data, error } = await supabase.rpc("retrieval_coverage", { p_workspace_id: workspaceId });
  if (error) {
    const failure = classifyReadError(error);
    // A missing SECURITY INVOKER function and a missing table both mean the
    // migration has not been applied; PostgREST reports either as a schema-cache
    // miss, so both land here rather than as a read failure.
    if (failure === "absent") return { state: "not_applied" };
    if (failure === "denied") return { state: "denied" };
    return { state: "unreadable", reason: error.message };
  }
  const rows = data ?? [];
  const indexed = rows.reduce((sum, r) => sum + r.indexed_rows, 0);
  const total = rows.reduce((sum, r) => sum + r.total_rows, 0);
  if (indexed === 0) return { state: "nothing_indexed", rows, total };
  return { state: "covered", rows, indexed, total };
}

/** One sentence, and never a coverage figure without the reason it is what it is. */
export function retrievalSummary(coverage: RetrievalCoverage): string {
  switch (coverage.state) {
    case "covered":
      return `Retrieval covers ${coverage.indexed} of ${coverage.total} indexable row(s).`;
    case "nothing_indexed":
      return coverage.total === 0
        ? "Nothing is indexable yet: this workspace has no approved codex rows to index."
        : `None of ${coverage.total} indexable row(s) are indexed, and nothing in this build would index them.`;
    case "unconfigured":
      return "Coverage is unknown: Supabase is not configured.";
    case "not_applied":
      return "Coverage is unknown: the embedding store or its coverage function (migration 013) is not reachable in the environment this build is talking to.";
    case "denied":
      return "Coverage is unknown: you are not allowed to read this workspace's retrieval coverage.";
    case "unreadable":
      return `Coverage is unknown: ${coverage.reason}`;
  }
}
