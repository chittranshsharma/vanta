import { isSupabaseConfigured, supabase } from "./supabase";
import { classifyReadError, type ReadFailure } from "./rows";

/**
 * Model task runs, read-only.
 *
 * Every gateway task writes a row here with its correlation id, so this table is
 * the only evidence that a model has ever run for a workspace. The agent panel
 * used to state "no run has ever happened in this workspace" without reading
 * anything, which is an assertion about stored data dressed as an observation.
 * A head count is enough to make the claim observed, or to say it is unknown.
 *
 * The rows themselves are not read: nothing in this build renders a past run,
 * and pulling model output into the browser to count it would be work with no
 * consumer.
 */

export type ModelRunCount =
  | { state: "counted"; count: number }
  | { state: "unconfigured" }
  | { state: "not_applied" }
  | { state: "denied" }
  | { state: "unreadable"; reason: string };

export async function countModelRuns(workspaceId: string): Promise<ModelRunCount> {
  if (!isSupabaseConfigured) return { state: "unconfigured" };
  const { count, error } = await supabase
    .from("model_task_runs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  if (error) {
    const failure: ReadFailure = classifyReadError(error);
    if (failure === "absent") return { state: "not_applied" };
    if (failure === "denied") return { state: "denied" };
    return { state: "unreadable", reason: error.message };
  }
  // A head count with no error and no number is not zero; it is a count the
  // server declined to return, and reporting it as zero would invent evidence.
  if (typeof count !== "number") return { state: "unreadable", reason: "The database returned no count." };
  return { state: "counted", count };
}

/** One sentence about run history, never asserting an absence that was not read. */
export function modelRunSummary(result: ModelRunCount): string {
  switch (result.state) {
    case "counted":
      return result.count === 0
        ? "No model task run has been recorded for this workspace."
        : `${result.count} model task run(s) recorded. Every run kept its correlation id, prompt version, and validation errors.`;
    case "unconfigured":
      return "Run history is unknown: Supabase is not configured.";
    case "not_applied":
      return "Run history is unknown: the model_task_runs table (migration 010) is not reachable in this environment.";
    case "denied":
      return "Run history is unknown: you are not allowed to read this workspace's run records.";
    case "unreadable":
      return `Run history is unknown: ${result.reason}`;
  }
}
