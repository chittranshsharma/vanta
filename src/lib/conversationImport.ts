import { isSupabaseConfigured, supabase } from "./supabase";
import type { ConversationObservationCandidate } from "../../shared/conversations/csvImport";
import { recordImportBatch } from "./importBatches";

type Result<T> = { data: T; error: null } | { data: null; error: string };
const NOT_CONFIGURED = "Supabase is not configured.";

export interface ImportConversationInput {
  workspaceId: string;
  userId: string;
  sourceId: string;
  candidates: ConversationObservationCandidate[];
  rejections?: Array<{ line: number; reason: string }>;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  fileSha256?: string | null;
  batchId?: string;
}

export interface ConversationImportOutcome {
  batchId: string;
  accepted: number;
  rejected: number;
}

export async function importConversationObservations(
  input: ImportConversationInput
): Promise<Result<ConversationImportOutcome>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  const batchId = input.batchId || crypto.randomUUID();
  const rejections = input.rejections || [];

  // 1. Record the import batch metadata
  const batchRes = await recordImportBatch({
    id: batchId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    sourceId: input.sourceId,
    batchKind: "conversation_observations",
    fileName: input.fileName,
    fileSizeBytes: input.fileSizeBytes,
    fileSha256: input.fileSha256,
    expectedRows: input.candidates.length + rejections.length,
    acceptedRows: input.candidates.length,
    rejectedRows: rejections.length,
    rejectionReasons: rejections,
    provenance: { imported_at: new Date().toISOString() },
  });

  if (batchRes.error) {
    return { data: null, error: `Failed to create import batch record: ${batchRes.error}` };
  }

  // If there are zero accepted candidates, return the batch outcome immediately
  if (input.candidates.length === 0) {
    return {
      data: {
        batchId,
        accepted: 0,
        rejected: rejections.length,
      },
      error: null,
    };
  }

  // 2. Insert candidate observations
  const rows = input.candidates.map((c) => ({
    workspace_id: input.workspaceId,
    source_id: input.sourceId,
    import_batch_id: batchId,
    provider: c.provider,
    external_event_id: c.external_event_id,
    external_post_id: c.external_post_id,
    idempotency_key: c.idempotency_key,
    observed_at: c.observed_at,
    author_ref: c.author_ref,
    raw_text: c.text,
    text_sha256: c.text_sha256,
    character_count: c.character_count,
    evidence_class: c.evidence_class,
    review_state: "unreviewed",
    created_by: input.userId,
  }));

  const { error: insertError } = await supabase
    .from("conversation_observations")
    .insert(rows);

  if (insertError) {
    if (insertError.code === "23505") {
      return {
        data: null,
        error: "Some conversation observations in this file already exist in the workspace.",
      };
    }
    return { data: null, error: insertError.message };
  }

  return {
    data: {
      batchId,
      accepted: input.candidates.length,
      rejected: rejections.length,
    },
    error: null,
  };
}
