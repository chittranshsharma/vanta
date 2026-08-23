import { isSupabaseConfigured, supabase } from "./supabase";

/**
 * Retrieval coverage for the UI (Upgrade E). The browser never embeds and
 * never queries vectors directly; it only reports how much of the codex is
 * indexed so the product can say "retrieval covers 12 of 40 approved rows".
 */

export interface RetrievalCoverageRow {
  source_table: string;
  indexed_rows: number;
  total_rows: number;
}

export async function fetchRetrievalCoverage(
  workspaceId: string
): Promise<{ data: RetrievalCoverageRow[] | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  const { data, error } = await supabase.rpc("retrieval_coverage", { p_workspace_id: workspaceId });
  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}
