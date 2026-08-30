import type { Database } from "../types/database.types";
import { isSupabaseConfigured, supabase } from "./supabase";

export type ConversationReviewState =
  | "unreviewed"
  | "needs_human"
  | "accepted"
  | "rejected"
  | "corrected";

export type InterpretationReviewState =
  | "unreviewed"
  | "accepted"
  | "rejected"
  | "corrected";

export type InterpretationType =
  | "topic_cluster"
  | "question_detected"
  | "friction_point"
  | "objection_claim_link"
  | "sentiment_signal"
  | "cta_intent_signal"
  | "other";

export type ConversationObservationRow = Database["public"]["Tables"]["conversation_observations"]["Row"];
export type ConversationInterpretationRow = Database["public"]["Tables"]["conversation_interpretations"]["Row"];
export type ConversationReviewEventRow = Database["public"]["Tables"]["conversation_review_events"]["Row"];
export type ConversationAttributionRow = Database["public"]["Tables"]["conversation_attributions"]["Row"];

type Result<T> = { data: T; error: null } | { data: null; error: string };
const NOT_CONFIGURED = "Supabase is not configured.";

export async function reviewConversationObservation(input: {
  workspaceId: string;
  userId: string;
  observationId: string;
  reviewState: ConversationReviewState;
  rationale?: string;
  metadata?: Record<string, unknown>;
}): Promise<Result<{ observationId: string; reviewState: ConversationReviewState }>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase.rpc("review_conversation_observation_atomic", {
    p_workspace_id: input.workspaceId,
    p_observation_id: input.observationId,
    p_review_state: input.reviewState,
    p_rationale: input.rationale ?? undefined,
    p_metadata: (input.metadata ?? {}) as Database["public"]["Functions"]["review_conversation_observation_atomic"]["Args"]["p_metadata"],
  });

  if (error) return { data: null, error: error.message };

  const res = data as { success?: boolean; observation_id?: string; new_state?: string };
  return {
    data: {
      observationId: res.observation_id || input.observationId,
      reviewState: (res.new_state as ConversationReviewState) || input.reviewState,
    },
    error: null,
  };
}

export async function reviewConversationInterpretation(input: {
  workspaceId: string;
  userId: string;
  interpretationId: string;
  reviewState: InterpretationReviewState;
  rationale?: string;
  metadata?: Record<string, unknown>;
}): Promise<Result<{ interpretationId: string; reviewState: InterpretationReviewState }>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase.rpc("review_conversation_interpretation_atomic", {
    p_workspace_id: input.workspaceId,
    p_interpretation_id: input.interpretationId,
    p_review_state: input.reviewState,
    p_rationale: input.rationale ?? undefined,
    p_metadata: (input.metadata ?? {}) as Database["public"]["Functions"]["review_conversation_interpretation_atomic"]["Args"]["p_metadata"],
  });

  if (error) return { data: null, error: error.message };

  const res = data as { success?: boolean; interpretation_id?: string; new_state?: string };
  return {
    data: {
      interpretationId: res.interpretation_id || input.interpretationId,
      reviewState: (res.new_state as InterpretationReviewState) || input.reviewState,
    },
    error: null,
  };
}

export async function listConversationObservations(
  workspaceId: string,
  filter?: { reviewState?: ConversationReviewState; sourceId?: string; limit?: number }
): Promise<Result<ConversationObservationRow[]>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  let q = supabase
    .from("conversation_observations")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (filter?.reviewState) q = q.eq("review_state", filter.reviewState);
  if (filter?.sourceId) q = q.eq("source_id", filter.sourceId);

  const { data, error } = await q.order("observed_at", { ascending: false }).limit(filter?.limit ?? 500);
  if (error) return { data: null, error: error.message };

  return {
    data: (data ?? []) as ConversationObservationRow[],
    error: null,
  };
}

export async function listConversationReviewEvents(
  workspaceId: string,
  observationId?: string
): Promise<Result<ConversationReviewEventRow[]>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  let q = supabase
    .from("conversation_review_events")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (observationId) q = q.eq("observation_id", observationId);

  const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
  if (error) return { data: null, error: error.message };

  return {
    data: (data ?? []) as ConversationReviewEventRow[],
    error: null,
  };
}

export async function listConversationInterpretations(
  workspaceId: string,
  observationId?: string
): Promise<Result<ConversationInterpretationRow[]>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  let q = supabase
    .from("conversation_interpretations")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (observationId) q = q.eq("observation_id", observationId);

  const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
  if (error) return { data: null, error: error.message };

  return {
    data: (data ?? []) as ConversationInterpretationRow[],
    error: null,
  };
}

export async function listConversationAttributions(
  workspaceId: string,
  observationId?: string
): Promise<Result<ConversationAttributionRow[]>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  let q = supabase
    .from("conversation_attributions")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (observationId) q = q.eq("observation_id", observationId);

  const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
  if (error) return { data: null, error: error.message };

  return {
    data: (data ?? []) as ConversationAttributionRow[],
    error: null,
  };
}


