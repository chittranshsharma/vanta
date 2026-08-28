/**
 * Handler: conversation_attribution
 *
 * Explicitly links an audience observation to a Creative Twin, variant, brand claim, CTA, or experiment.
 *
 * Invariants:
 *  - Links ONLY on explicit IDs provided in payload; never infers links from text or timestamp similarity.
 *  - Verifies all referenced entities belong to job.workspace_id (Tenant Isolation).
 *  - Fails permanently if cross-tenant or missing foreign IDs are supplied.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobHandler } from "../loop.js";

export function makeConversationAttributionHandler(supabase: SupabaseClient): JobHandler {
  return async (job) => {
    const payload = (job.payload ?? {}) as {
      observation_id?: string;
      twin_id?: string;
      variant_twin_id?: string;
      twin_version_id?: string;
      brand_claim_id?: string;
      experiment_id?: string;
      cta_identifier?: string;
      destination_url?: string;
    };

    const observationId = payload.observation_id;
    if (!observationId) {
      return {
        ok: false,
        failure: { kind: "permanent", message: "payload.observation_id is required", code: "bad_payload" },
      };
    }

    // 1. Verify observation belongs to workspace
    const { data: obs, error: obsError } = await supabase
      .from("conversation_observations")
      .select("id, workspace_id")
      .eq("id", observationId)
      .eq("workspace_id", job.workspace_id)
      .maybeSingle();

    if (obsError) {
      return {
        ok: false,
        failure: { kind: "transient", message: `Database error: ${obsError.message}`, code: "db_error" },
      };
    }

    if (!obs) {
      return {
        ok: false,
        failure: { kind: "permanent", message: "Observation not found in workspace", code: "not_found" },
      };
    }

    // 2. Validate referenced twin if provided
    if (payload.twin_id) {
      const { data: twin } = await supabase
        .from("creative_twins")
        .select("id")
        .eq("id", payload.twin_id)
        .eq("workspace_id", job.workspace_id)
        .maybeSingle();

      if (!twin) {
        return {
          ok: false,
          failure: { kind: "permanent", message: `Creative Twin ${payload.twin_id} not found in workspace`, code: "invalid_reference" },
        };
      }
    }

    // 3. Validate referenced brand claim if provided
    if (payload.brand_claim_id) {
      const { data: claim } = await supabase
        .from("brand_claims")
        .select("id")
        .eq("id", payload.brand_claim_id)
        .eq("workspace_id", job.workspace_id)
        .maybeSingle();

      if (!claim) {
        return {
          ok: false,
          failure: { kind: "permanent", message: `Brand claim ${payload.brand_claim_id} not found in workspace`, code: "invalid_reference" },
        };
      }
    }

    // 4. Validate referenced experiment if provided
    if (payload.experiment_id) {
      const { data: exp } = await supabase
        .from("experiments")
        .select("id")
        .eq("id", payload.experiment_id)
        .eq("workspace_id", job.workspace_id)
        .maybeSingle();

      if (!exp) {
        return {
          ok: false,
          failure: { kind: "permanent", message: `Experiment ${payload.experiment_id} not found in workspace`, code: "invalid_reference" },
        };
      }
    }

    // 5. Insert attribution
    const { data: inserted, error: insertError } = await supabase
      .from("conversation_attributions")
      .insert({
        workspace_id: job.workspace_id,
        observation_id: observationId,
        twin_id: payload.twin_id ?? null,
        variant_twin_id: payload.variant_twin_id ?? null,
        twin_version_id: payload.twin_version_id ?? null,
        brand_claim_id: payload.brand_claim_id ?? null,
        experiment_id: payload.experiment_id ?? null,
        cta_identifier: payload.cta_identifier ?? null,
        destination_url: payload.destination_url ?? null,
        provenance: { attributed_via_job: job.id, attributed_at: new Date().toISOString() },
      })
      .select("id")
      .single();

    if (insertError) {
      return {
        ok: false,
        failure: { kind: "transient", message: `Failed to record attribution: ${insertError.message}`, code: "write_error" },
      };
    }

    return {
      ok: true,
      result: {
        attribution_id: inserted.id,
        observation_id: observationId,
      },
    };
  };
}
