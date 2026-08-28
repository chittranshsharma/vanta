import { isSupabaseConfigured, supabase } from "./supabase";
import { narrow } from "./rows";

export const BATCH_KINDS = [
  "post_observations",
  "experiment_outcomes",
  "conversation_observations",
] as const;
export type BatchKind = (typeof BATCH_KINDS)[number];

export const BATCH_STATUSES = [
  "pending",
  "completed",
  "partial",
  "failed",
] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export interface ImportBatchRow {
  id: string;
  workspace_id: string;
  source_id: string | null;
  created_by: string | null;
  batch_kind: BatchKind;
  file_name: string | null;
  file_size_bytes: number | null;
  file_sha256: string | null;
  expected_rows: number | null;
  accepted_rows: number;
  rejected_rows: number;
  rejection_reasons: Array<{ line?: number; reason: string }>;
  status: BatchStatus;
  provenance: Record<string, unknown>;
  created_at: string;
  completed_at: string;
}

type Result<T> = { data: T; error: null } | { data: null; error: string };
const NOT_CONFIGURED = "Supabase is not configured.";
const SCHEMA_AHEAD = "The database schema is ahead of this build; reload or update the app.";

export interface CreateImportBatchInput {
  id?: string;
  workspaceId: string;
  sourceId?: string | null;
  userId: string;
  batchKind: BatchKind;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  fileSha256?: string | null;
  expectedRows?: number | null;
  acceptedRows: number;
  rejectedRows: number;
  rejectionReasons?: Array<{ line?: number; reason: string }>;
  status?: BatchStatus;
  provenance?: Record<string, unknown>;
}

export function toImportBatchRow(raw: Record<string, unknown>): ImportBatchRow | string {
  const batch_kind = narrow(BATCH_KINDS, String(raw.batch_kind));
  if (!batch_kind) return `batch ${raw.id} has invalid batch_kind "${raw.batch_kind}"`;

  const status = narrow(BATCH_STATUSES, String(raw.status));
  if (!status) return `batch ${raw.id} has invalid status "${raw.status}"`;

  return {
    id: String(raw.id),
    workspace_id: String(raw.workspace_id),
    source_id: raw.source_id ? String(raw.source_id) : null,
    created_by: raw.created_by ? String(raw.created_by) : null,
    batch_kind,
    file_name: raw.file_name ? String(raw.file_name) : null,
    file_size_bytes: typeof raw.file_size_bytes === "number" ? raw.file_size_bytes : null,
    file_sha256: raw.file_sha256 ? String(raw.file_sha256) : null,
    expected_rows: typeof raw.expected_rows === "number" ? raw.expected_rows : null,
    accepted_rows: typeof raw.accepted_rows === "number" ? raw.accepted_rows : 0,
    rejected_rows: typeof raw.rejected_rows === "number" ? raw.rejected_rows : 0,
    rejection_reasons: Array.isArray(raw.rejection_reasons) ? (raw.rejection_reasons as Array<{ line?: number; reason: string }>) : [],
    status,
    provenance: (raw.provenance && typeof raw.provenance === "object" && !Array.isArray(raw.provenance)) ? (raw.provenance as Record<string, unknown>) : {},
    created_at: String(raw.created_at || new Date().toISOString()),
    completed_at: String(raw.completed_at || new Date().toISOString()),
  };
}

export async function recordImportBatch(input: CreateImportBatchInput): Promise<Result<ImportBatchRow>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  const payload: Record<string, unknown> = {
    workspace_id: input.workspaceId,
    source_id: input.sourceId ?? null,
    created_by: input.userId,
    batch_kind: input.batchKind,
    file_name: input.fileName ?? null,
    file_size_bytes: input.fileSizeBytes ?? null,
    file_sha256: input.fileSha256 ?? null,
    expected_rows: input.expectedRows ?? null,
    accepted_rows: input.acceptedRows,
    rejected_rows: input.rejectedRows,
    rejection_reasons: input.rejectionReasons ?? [],
    status: input.status ?? (input.acceptedRows > 0 ? (input.rejectedRows > 0 ? "partial" : "completed") : "failed"),
    provenance: input.provenance ?? {},
  };
  if (input.id) payload.id = input.id;

  const { data, error } = await supabase
    .from("import_batches" as never)
    .insert(payload as never)
    .select("*")
    .single();

  if (error) return { data: null, error: error.message };
  const mapped = toImportBatchRow(data as Record<string, unknown>);
  if (typeof mapped === "string") return { data: null, error: `Cannot read ${mapped}. ${SCHEMA_AHEAD}` };
  return { data: mapped, error: null };
}

export async function listImportBatches(workspaceId: string, batchKind?: BatchKind): Promise<Result<ImportBatchRow[]>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  let q = supabase
    .from("import_batches" as never)
    .select("*")
    .eq("workspace_id", workspaceId);

  if (batchKind) q = q.eq("batch_kind", batchKind);

  const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
  if (error) return { data: null, error: error.message };

  const rows: ImportBatchRow[] = [];
  for (const raw of data ?? []) {
    const mapped = toImportBatchRow(raw as Record<string, unknown>);
    if (typeof mapped === "string") return { data: null, error: `Cannot read ${mapped}. ${SCHEMA_AHEAD}` };
    rows.push(mapped);
  }
  return { data: rows, error: null };
}
