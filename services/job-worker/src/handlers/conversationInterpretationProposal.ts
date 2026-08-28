/**
 * Handler: conversation_interpretation_proposal
 *
 * Generates inference-layer candidate interpretation proposals for unreviewed conversation observations.
 *
 * Invariants:
 *  - Consumes workspace quota before execution and fails closed if quota is exhausted.
 *  - Output is strictly classified as evidence_class = 'inference' with review_state = 'unreviewed'.
 *  - Every interpretation requires a mandatory uncertainty_note and supporting observation IDs.
 *  - Supporting IDs are verified to belong to job.workspace_id.
 *  - Never logs raw customer text or prompt text.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobHandler } from "../loop.js";

export function makeConversationInterpretationProposalHandler(supabase: SupabaseClient): JobHandler {
  return async (job) => {
    const payload = (job.payload ?? {}) as { observation_ids?: string[]; limit?: number };
    const observationIds = payload.observation_ids ?? [];

    // 1. Enforce quota consumption (Fail closed if quota is exhausted)
    const { data: quotaConsumed, error: quotaError } = await supabase.rpc("consume_quota", {
      p_workspace_id: job.workspace_id,
      p_feature: "model_call",
      p_units: 1,
    });

    if (quotaError) {
      return {
        ok: false,
        failure: { kind: "transient", message: `Quota verification failed: ${quotaError.message}`, code: "quota_error" },
      };
    }

    if (quotaConsumed !== true) {
      return {
        ok: false,
        failure: { kind: "permanent", message: "Daily workspace quota exceeded for model/worker calls.", code: "quota_exceeded" },
      };
    }

    // 2. Fetch observations
    let q = supabase
      .from("conversation_observations")
      .select("id, workspace_id, raw_text, review_state")
      .eq("workspace_id", job.workspace_id);

    if (observationIds.length > 0) {
      q = q.in("id", observationIds);
    } else {
      q = q.eq("review_state", "unreviewed").limit(Math.min(payload.limit ?? 50, 100));
    }

    const { data: observations, error: obsError } = await q;

    if (obsError) {
      return {
        ok: false,
        failure: { kind: "transient", message: `Failed to load observations: ${obsError.message}`, code: "db_error" },
      };
    }

    const obsList = observations ?? [];
    if (obsList.length === 0) {
      return {
        ok: true,
        result: { proposed_count: 0, interpretation_ids: [] },
      };
    }

    // 3. Generate structured candidate proposals (Inference Layer)
    const interpretationRows = obsList.map((obs) => {
      const isQuestion = obs.raw_text.includes("?") || /^(how|what|why|when|where|is|can)\b/i.test(obs.raw_text);
      const isFriction = /\b(issue|bug|problem|broken|slow|expensive|fail|error|wrong)\b/i.test(obs.raw_text);

      const interpretationType = isQuestion
        ? "question_detected"
        : isFriction
        ? "friction_point"
        : "topic_cluster";

      return {
        workspace_id: job.workspace_id,
        observation_id: obs.id,
        interpretation_type: interpretationType,
        value: {
          detected_pattern: interpretationType,
          character_length: obs.raw_text.length,
          contains_question_mark: isQuestion,
        },
        evidence_class: "inference" as const,
        supporting_evidence_ids: [obs.id],
        uncertainty_note: "Algorithmic candidate proposal; requires explicit operator review before citation.",
        review_state: "unreviewed" as const,
      };
    });

    const { data: inserted, error: insertError } = await supabase
      .from("conversation_interpretations")
      .insert(interpretationRows)
      .select("id");

    if (insertError) {
      return {
        ok: false,
        failure: { kind: "transient", message: `Failed to insert interpretation proposals: ${insertError.message}`, code: "insert_error" },
      };
    }

    const insertedIds = (inserted ?? []).map((row: { id: string }) => row.id);

    return {
      ok: true,
      result: {
        proposed_count: insertedIds.length,
        interpretation_ids: insertedIds,
      },
    };
  };
}
