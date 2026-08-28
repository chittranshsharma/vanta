/**
 * Handler: conversation_import_validate
 *
 * Validates a registered import batch and its candidate conversation observations.
 * Ensures the batch exists within the job's workspace, checks row integrity,
 * and updates batch metadata with validation outcome.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobHandler } from "../loop.js";

export function makeConversationImportValidateHandler(supabase: SupabaseClient): JobHandler {
  return async (job) => {
    const payload = job.payload as { batch_id?: string; source_id?: string };
    const batchId = payload.batch_id;

    if (!batchId) {
      return {
        ok: false,
        failure: { kind: "permanent", message: "payload.batch_id is required", code: "bad_payload" },
      };
    }

    // 1. Verify batch exists in this workspace (Tenant Isolation)
    const { data: batch, error: batchError } = await supabase
      .from("import_batches")
      .select("id, workspace_id, source_id, status, expected_rows, accepted_rows, rejected_rows")
      .eq("id", batchId)
      .eq("workspace_id", job.workspace_id)
      .maybeSingle();

    if (batchError) {
      return {
        ok: false,
        failure: { kind: "transient", message: `Database error reading batch: ${batchError.message}`, code: "db_error" },
      };
    }

    if (!batch) {
      return {
        ok: false,
        failure: { kind: "permanent", message: "Import batch not found in workspace", code: "not_found" },
      };
    }

    // 2. Query observations linked to this batch
    const { data: observations, error: obsError } = await supabase
      .from("conversation_observations")
      .select("id, evidence_class, character_count, text_sha256, observed_at, author_ref")
      .eq("import_batch_id", batchId)
      .eq("workspace_id", job.workspace_id);

    if (obsError) {
      return {
        ok: false,
        failure: { kind: "transient", message: `Database error reading observations: ${obsError.message}`, code: "db_error" },
      };
    }

    const obsList = observations ?? [];
    let validCount = 0;
    let rejectedCount = 0;
    const rejectionReasons: Array<{ id: string; reason: string }> = [];

    for (const obs of obsList) {
      if (obs.evidence_class !== "observed") {
        rejectedCount += 1;
        rejectionReasons.push({ id: obs.id, reason: `Invalid evidence class "${obs.evidence_class}". Must be "observed".` });
        continue;
      }
      if (obs.character_count <= 0 || !obs.text_sha256) {
        rejectedCount += 1;
        rejectionReasons.push({ id: obs.id, reason: "Observation text or hash is empty." });
        continue;
      }
      if (!obs.observed_at || Number.isNaN(new Date(obs.observed_at).getTime())) {
        rejectedCount += 1;
        rejectionReasons.push({ id: obs.id, reason: "Invalid observed_at timestamp." });
        continue;
      }
      validCount += 1;
    }

    const newStatus = rejectedCount === 0 ? "completed" : validCount > 0 ? "partial" : "failed";

    // 3. Update batch status
    const { error: updateError } = await supabase
      .from("import_batches")
      .update({
        status: newStatus,
        accepted_rows: validCount,
        rejected_rows: rejectedCount,
      })
      .eq("id", batchId)
      .eq("workspace_id", job.workspace_id);

    if (updateError) {
      return {
        ok: false,
        failure: { kind: "transient", message: `Failed to update batch status: ${updateError.message}`, code: "write_error" },
      };
    }

    return {
      ok: true,
      result: {
        batch_id: batchId,
        status: newStatus,
        valid_count: validCount,
        rejected_count: rejectedCount,
        rejection_reasons: rejectionReasons,
      },
    };
  };
}
