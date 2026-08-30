import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  BarChart2,
  Send,
  Info,
} from "lucide-react";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  listConversationObservations,
  listConversationInterpretations,
  listConversationAttributions,
  reviewConversationObservation,
  reviewConversationInterpretation,
  type ConversationObservationRow,
  type ConversationInterpretationRow,
  type ConversationAttributionRow,
  type ConversationReviewState,
  type InterpretationReviewState,
} from "../lib/conversationReview";
import { fetchSourcesForWorkspace, evaluateSourceCitability, type SourceRegistryRow } from "../lib/sourceRegistry";
import { fetchBrandForWorkspace, fetchBrandClaims, type BrandClaim } from "../lib/brandBrain";
import { aggregateConversationObservations, type SpikeAggregationResult } from "../../shared/conversations/spikeAggregation";
import { buildSourceGroundedReplyDraft, type ReplyDraftOutcome } from "../../shared/conversations/replyDrafts";
import { Modal } from "./Modal";

export interface ConversationIntelligenceProps {
  workspaceId: string;
  userId: string;
  userRole?: string;
  timeZone?: string;
}

export function ConversationIntelligence({
  workspaceId,
  userId,
  userRole,
  timeZone = "UTC",
}: ConversationIntelligenceProps) {
  const isReadOnly = userRole === "viewer";
  const [activeTab, setActiveTab] = useState<"observations" | "interpretations" | "spikes" | "attribution">("observations");

  // Reference timestamp in state to ensure pure render
  const [referenceTimeMs] = useState(() => Date.now());

  // Observations State
  const [observations, setObservations] = useState<ConversationObservationRow[]>([]);
  const [sources, setSources] = useState<SourceRegistryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Privacy: Reveal Comment Map (in-memory only, strictly never logged or persisted)
  const [revealedCommentIds, setRevealedCommentIds] = useState<Set<string>>(new Set());

  // Selected Observation for Detail/Attribution
  const [selectedObsId, setSelectedObsId] = useState<string | null>(null);

  // Interpretations State
  const [interpretations, setInterpretations] = useState<ConversationInterpretationRow[]>([]);
  const [attributions, setAttributions] = useState<ConversationAttributionRow[]>([]);

  // Brand Claims for Grounded Reply Drafts
  const [brandClaims, setBrandClaims] = useState<BrandClaim[]>([]);

  // Review Observation Modal
  const [reviewObsModalOpen, setReviewObsModalOpen] = useState(false);
  const [reviewObsTarget, setReviewObsTarget] = useState<ConversationObservationRow | null>(null);
  const [obsReviewState, setObsReviewState] = useState<ConversationReviewState>("accepted");
  const [obsReviewRationale, setObsReviewRationale] = useState("");
  const [obsReviewSubmitting, setObsReviewSubmitting] = useState(false);
  const [obsReviewError, setObsReviewError] = useState<string | null>(null);

  // Review Interpretation Modal
  const [reviewInterpModalOpen, setReviewInterpModalOpen] = useState(false);
  const [reviewInterpTarget, setReviewInterpTarget] = useState<ConversationInterpretationRow | null>(null);
  const [interpReviewState, setInterpReviewState] = useState<InterpretationReviewState>("accepted");
  const [interpReviewRationale, setInterpReviewRationale] = useState("");
  const [interpReviewSubmitting, setInterpReviewSubmitting] = useState(false);
  const [interpReviewError, setInterpReviewError] = useState<string | null>(null);

  // Reply Draft Sandbox State
  const [replyDraftOutcome, setReplyDraftOutcome] = useState<ReplyDraftOutcome | null>(null);
  const [replyDraftTargetObs, setReplyDraftTargetObs] = useState<ConversationObservationRow | null>(null);

  // Notification Banner
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // 1. Fetch observations, interpretations, attributions, sources, and brand claims
  useEffect(() => {
    let mounted = true;
    const loadAll = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        setError("Supabase is not configured.");
        return;
      }
      setLoading(true);
      setError(null);

      const [obsRes, sourcesRes, interpRes, attrRes, brandRes] = await Promise.all([
        listConversationObservations(workspaceId),
        fetchSourcesForWorkspace(workspaceId),
        listConversationInterpretations(workspaceId),
        listConversationAttributions(workspaceId),
        fetchBrandForWorkspace(workspaceId),
      ]);

      if (!mounted) return;
      setLoading(false);

      if (obsRes.error) {
        setError(obsRes.error);
        setObservations([]);
      } else {
        const obsList = obsRes.data ?? [];
        setObservations(obsList);
        setSelectedObsId((current) => current || (obsList.length > 0 ? obsList[0].id : null));
      }

      if (sourcesRes.data) {
        setSources(sourcesRes.data);
      }
      if (interpRes.data) {
        setInterpretations(interpRes.data);
      }
      if (attrRes.data) {
        setAttributions(attrRes.data);
      }

      if (brandRes.data) {
        const claimsRes = await fetchBrandClaims(brandRes.data.id);
        if (mounted && claimsRes.data) {
          setBrandClaims(claimsRes.data.filter((c) => c.review_status === "approved"));
        }
      }
    };

    loadAll();
    return () => {
      mounted = false;
    };
  }, [workspaceId, reloadToken]);

  // Privacy evaluation for a given observation
  const evaluatePrivacyGate = (obs: ConversationObservationRow) => {
    const source = sources.find((s) => s.id === obs.source_id);
    const sourceCitability = source ? evaluateSourceCitability(source) : { status: "unverified" };

    // Check retention expiration
    const isRetentionExpired = obs.retention_until
      ? new Date(obs.retention_until).getTime() < referenceTimeMs
      : false;

    // Check if source is blocked or disconnected
    const isSourceBlocked = sourceCitability.status === "blocked" || sourceCitability.status === "disconnected";

    // Is user authorized to view? (Viewers / unauthenticated cannot)
    const isAuthorized = !isReadOnly;

    const canReveal = isAuthorized && !isRetentionExpired && !isSourceBlocked;

    return {
      canReveal,
      isRetentionExpired,
      isSourceBlocked,
      sourceStatus: sourceCitability.status,
      redactionReason: isRetentionExpired
        ? "[Retention window expired - Raw content purged]"
        : isSourceBlocked
        ? "[Source disconnected/blocked - Raw content restricted]"
        : !isAuthorized
        ? "[Restricted - Insufficient permissions to view raw comments]"
        : null,
    };
  };

  // Toggle reveal for authorized user
  const handleToggleReveal = (id: string) => {
    setRevealedCommentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Handler: Review Observation
  const handleSubmitObsReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewObsTarget) return;
    setObsReviewError(null);

    if (obsReviewState !== "accepted" && (!obsReviewRationale.trim() || obsReviewRationale.trim().length < 5)) {
      setObsReviewError("Rationale of at least 5 characters is required for this review decision.");
      return;
    }

    setObsReviewSubmitting(true);
    try {
      const res = await reviewConversationObservation({
        workspaceId,
        userId,
        observationId: reviewObsTarget.id,
        reviewState: obsReviewState,
        rationale: obsReviewRationale.trim() || undefined,
      });

      if (res.error || !res.data) {
        setObsReviewError(res.error || "Failed to submit review.");
      } else {
        setNotification({
          type: "success",
          message: `Observation review recorded: ${res.data.reviewState}. Evidence class strictly preserved as observed.`,
        });
        setReviewObsModalOpen(false);
        setReviewObsTarget(null);
        setObsReviewRationale("");
        setReloadToken((t) => t + 1);
      }
    } catch (err) {
      setObsReviewError(err instanceof Error ? err.message : "Failed to record review.");
    } finally {
      setObsReviewSubmitting(false);
    }
  };

  // Handler: Review Interpretation
  const handleSubmitInterpReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewInterpTarget) return;
    setInterpReviewError(null);

    if (interpReviewState !== "accepted" && (!interpReviewRationale.trim() || interpReviewRationale.trim().length < 5)) {
      setInterpReviewError("Rationale of at least 5 characters is required for this review decision.");
      return;
    }

    setInterpReviewSubmitting(true);
    try {
      const res = await reviewConversationInterpretation({
        workspaceId,
        userId,
        interpretationId: reviewInterpTarget.id,
        reviewState: interpReviewState,
        rationale: interpReviewRationale.trim() || undefined,
      });

      if (res.error || !res.data) {
        setInterpReviewError(res.error || "Failed to submit review.");
      } else {
        setNotification({
          type: "success",
          message: `Interpretation review recorded: ${res.data.reviewState}. Evidence class strictly preserved as inference.`,
        });
        setReviewInterpModalOpen(false);
        setReviewInterpTarget(null);
        setInterpReviewRationale("");
        setReloadToken((t) => t + 1);
      }
    } catch (err) {
      setInterpReviewError(err instanceof Error ? err.message : "Failed to record review.");
    } finally {
      setInterpReviewSubmitting(false);
    }
  };

  // Handler: Generate Source-Grounded Reply Draft
  const handleGenerateReplyDraft = (obs: ConversationObservationRow) => {
    setReplyDraftTargetObs(obs);
    const approvedClaimsContext = brandClaims.map((c) => ({
      id: c.id,
      claim_text: c.claim_text,
      review_status: "approved" as const,
      expires_at: c.expires_at,
    }));

    const outcome = buildSourceGroundedReplyDraft({
      observation_id: obs.id,
      observation_text: obs.raw_text,
      approved_claims: approvedClaimsContext,
      approved_proof_points: [],
    });

    setReplyDraftOutcome(outcome);
  };

  // Spike Aggregation calculation
  const spikeResult: SpikeAggregationResult = aggregateConversationObservations({
    observations: observations.map((o) => ({ observed_at: o.observed_at })),
    timeZone,
  });

  return (
    <div className="space-y-6" data-testid="conversation-intelligence-panel">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <MessageSquare size={18} className="text-indigo-400" /> Conversation Intelligence & Review
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Privacy-safe audience observation review, inference draft governance, and descriptive volume distributions.
            Evidence classes: <code className="font-mono text-zinc-300">observed</code> (comments) /{" "}
            <code className="font-mono text-indigo-300">inference</code> (interpretations/drafts).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReloadToken((t) => t + 1)}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Refresh observations"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Epistemic Privacy & Governance Directive */}
      <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-xs text-zinc-400 flex items-start gap-2.5">
        <ShieldCheck size={15} className="shrink-0 mt-0.5 text-emerald-400" />
        <div>
          <strong className="text-zinc-200">Audience Privacy & Epistemic Boundary:</strong> Raw comment text is sensitive
          and masked by default. It is revealed only to authorized workspace operators when the source is connected and retention
          is active. Inferences (sentiment, topics, intents, reply drafts) are <em>never</em> empirical observations; human approval
          records editorial review but never converts inference into observed fact.
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-2 ${
            notification.type === "success"
              ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-300"
              : "bg-red-950/30 border-red-800/50 text-red-300"
          }`}
          role="status"
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-zinc-500 hover:text-zinc-300 text-xs font-mono"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("observations")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === "observations"
              ? "bg-zinc-800 text-zinc-100 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
          }`}
        >
          <MessageSquare size={13} /> Observations ({observations.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("interpretations")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === "interpretations"
              ? "bg-zinc-800 text-zinc-100 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
          }`}
        >
          <Sparkles size={13} className="text-indigo-400" /> Interpretations ({interpretations.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("spikes")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === "spikes"
              ? "bg-zinc-800 text-zinc-100 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
          }`}
        >
          <BarChart2 size={13} className="text-emerald-400" /> Volume & Spikes
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("attribution")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === "attribution"
              ? "bg-zinc-800 text-zinc-100 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
          }`}
        >
          <Layers size={13} className="text-purple-400" /> Evidence Attribution ({attributions.length})
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="brand-brain-loading" role="status">
          Loading conversation intelligence records…
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="vp-empty vp-state-blocked" role="alert">
          <ShieldAlert size={16} />
          <h3>Could not load conversation records</h3>
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setReloadToken((t) => t + 1)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 mt-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* TAB 1: OBSERVATIONS & PRIVACY-SAFE BROWSER */}
      {!loading && !error && activeTab === "observations" && (
        <div className="space-y-4">
          {observations.length === 0 ? (
            <div className="border border-dashed border-zinc-800 rounded-xl p-8 text-center space-y-2">
              <MessageSquare size={24} className="mx-auto text-zinc-600" />
              <h4 className="text-sm font-medium text-zinc-300">No conversation observations recorded</h4>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Audience comments imported via verified CSV or authorized source connectors will appear here for governance review.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {observations.map((obs) => {
                const gate = evaluatePrivacyGate(obs);
                const isRevealed = revealedCommentIds.has(obs.id);

                return (
                  <div
                    key={obs.id}
                    className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-xs space-y-3"
                  >
                    {/* Metadata Header */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Author Ref (Pseudonymized) */}
                        <span className="font-mono text-zinc-200 font-semibold bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                          {obs.author_ref}
                        </span>

                        {/* Evidence Class */}
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                          evidence_class: {obs.evidence_class}
                        </span>

                        {/* Review State */}
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            obs.review_state === "accepted"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : obs.review_state === "rejected"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : obs.review_state === "needs_human"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700"
                          }`}
                        >
                          Review: {obs.review_state}
                        </span>

                        {/* Provider */}
                        <span className="text-[10px] text-zinc-500 font-mono">
                          Provider: {obs.provider}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {new Date(obs.observed_at).toLocaleString()}
                        </span>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewObsTarget(obs);
                              setObsReviewState(obs.review_state as ConversationReviewState);
                              setReviewObsModalOpen(true);
                            }}
                            className="px-2 py-1 text-[11px] font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1"
                          >
                            <ShieldCheck size={12} /> Review
                          </button>
                        )}
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => handleGenerateReplyDraft(obs)}
                            className="px-2 py-1 text-[11px] font-medium rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-900/50 flex items-center gap-1"
                          >
                            <Send size={11} /> Grounded Draft
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Raw Text Box with Strict Privacy Gate */}
                    <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-xs">
                      {gate.redactionReason ? (
                        <div className="flex items-center gap-2 text-zinc-500 italic font-mono text-[11px]">
                          <Lock size={13} className="text-zinc-600" />
                          <span>{gate.redactionReason}</span>
                        </div>
                      ) : !isRevealed ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-zinc-500 italic">
                            [Masked audience comment text · {obs.character_count} characters]
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleReveal(obs.id)}
                            className="px-2 py-1 text-[10px] font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1 font-mono transition-colors"
                          >
                            <Eye size={12} /> Reveal (Authorized)
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-zinc-200 font-sans leading-relaxed">{obs.raw_text}</p>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleToggleReveal(obs.id)}
                              className="px-2 py-0.5 text-[10px] font-medium rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 flex items-center gap-1 font-mono"
                            >
                              <EyeOff size={11} /> Mask
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer Provenance & Hash */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono pt-1">
                      <span>SHA-256: {obs.text_sha256.slice(0, 16)}…</span>
                      <span>Source ID: {obs.source_id.slice(0, 8)}…</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INTERPRETATIONS & REPLY DRAFTS */}
      {!loading && !error && activeTab === "interpretations" && (
        <div className="space-y-6">
          {/* Grounded Reply Draft Sandbox (if active) */}
          {replyDraftOutcome && replyDraftTargetObs && (
            <div className="p-5 rounded-xl bg-indigo-950/20 border border-indigo-900/40 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-indigo-200 flex items-center gap-1.5 uppercase tracking-wider">
                  <Send size={13} /> Source-Grounded Reply Draft Sandbox
                </h4>
                <button
                  type="button"
                  onClick={() => setReplyDraftOutcome(null)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs font-mono"
                >
                  ✕ Close
                </button>
              </div>

              <div className="text-xs text-zinc-400 space-y-1">
                <div>
                  Target Comment: <code className="font-mono text-zinc-300">{replyDraftTargetObs.author_ref}</code>
                </div>
                <div className="text-[11px] text-zinc-500">
                  Grounding: Workspace approved Brand Codex claims only. System does not send automated replies.
                </div>
              </div>

              {replyDraftOutcome.status === "ready" ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs space-y-2">
                    <span className="text-[10px] font-mono uppercase font-semibold text-emerald-400">
                      Grounded Draft ({replyDraftOutcome.evidence_class})
                    </span>
                    <p className="text-zinc-100 leading-relaxed">{replyDraftOutcome.draft_text}</p>
                    <div className="text-[11px] text-zinc-500 italic">
                      Uncertainty Disclosure: {replyDraftOutcome.uncertainty_note}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
                    <span>Cited Brand Claims: {replyDraftOutcome.cited_claim_ids.length}</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <div>
                    <strong>Draft Generation Blocked:</strong> {replyDraftOutcome.reason}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Interpretations List */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
              AI Interpretations ({interpretations.length})
            </h4>

            {interpretations.length === 0 ? (
              <div className="border border-dashed border-zinc-800 rounded-xl p-8 text-center space-y-2">
                <Sparkles size={24} className="mx-auto text-zinc-600" />
                <h4 className="text-sm font-medium text-zinc-300">No interpretations generated yet</h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Model-analyzed topic clusters, question detections, and friction signals will appear here tagged as{" "}
                  <code className="font-mono">evidence_class: inference</code>.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {interpretations.map((interp) => (
                  <div
                    key={interp.id}
                    className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-xs space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-indigo-300 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/40">
                          {interp.interpretation_type}
                        </span>

                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                          evidence_class: {interp.evidence_class}
                        </span>

                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            interp.review_state === "accepted"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : interp.review_state === "rejected"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700"
                          }`}
                        >
                          Review: {interp.review_state}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {new Date(interp.created_at).toLocaleDateString()}
                        </span>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewInterpTarget(interp);
                              setInterpReviewState(interp.review_state as InterpretationReviewState);
                              setReviewInterpModalOpen(true);
                            }}
                            className="px-2 py-1 text-[11px] font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1"
                          >
                            <ShieldCheck size={12} /> Review
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Interpretation Value */}
                    <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 font-mono text-[11px] text-zinc-300 overflow-x-auto">
                      <pre>{JSON.stringify(interp.value, null, 2)}</pre>
                    </div>

                    {/* Uncertainty Note */}
                    <div className="text-[11px] text-zinc-400 italic flex items-start gap-1.5">
                      <Info size={13} className="shrink-0 mt-0.5 text-zinc-500" />
                      <span>Uncertainty Note: {interp.uncertainty_note}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: VOLUME & SPIKE AGGREGATION */}
      {!loading && !error && activeTab === "spikes" && (
        <div className="space-y-4">
          <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-950/80 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h4 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <BarChart2 size={16} className="text-emerald-400" /> Observed Volume & Spike Aggregation
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Deterministic count distribution by hour in configured timezone ({timeZone}). Purely descriptive.
                </p>
              </div>

              <div className="text-xs font-mono text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800">
                Total Observations: {spikeResult.total_observations}
              </div>
            </div>

            {spikeResult.buckets.length === 0 ? (
              <p className="text-xs text-zinc-500">No observations available to aggregate.</p>
            ) : (
              <div className="space-y-2 pt-2">
                {spikeResult.buckets.map((bucket, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                      bucket.is_observed_spike
                        ? "bg-amber-950/20 border-amber-800/40 text-amber-200"
                        : "bg-zinc-900/60 border-zinc-800 text-zinc-300"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-zinc-100">{bucket.local_label}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{bucket.explanation}</div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-sm font-bold text-zinc-100">{bucket.observation_count} posts</div>
                      <div className="text-[10px] text-zinc-500">
                        Baseline: {bucket.baseline_status === "recorded" ? bucket.baseline_count : "unknown"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: EVIDENCE ATTRIBUTION */}
      {!loading && !error && activeTab === "attribution" && (
        <div className="space-y-4">
          <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-950/80 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Layers size={16} className="text-purple-400" /> Evidence Attribution & Lineage
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Explicit traceable links connecting conversation observations to Creative Twins, Brand Claims, and Experiments.
                Attribution is never inferred from timestamps or text similarity.
              </p>
            </div>

            {attributions.length === 0 ? (
              <p className="text-xs text-zinc-500">No conversation attribution records established yet.</p>
            ) : (
              <div className="space-y-2">
                {attributions.map((attr) => (
                  <div
                    key={attr.id}
                    onClick={() => setSelectedObsId(attr.observation_id)}
                    className={`p-3.5 rounded-lg border text-xs space-y-2 cursor-pointer transition-colors ${
                      selectedObsId === attr.observation_id
                        ? "bg-purple-950/30 border-purple-800/60"
                        : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between text-purple-300 font-mono text-[11px]">
                      <span>Observation ID: {attr.observation_id.slice(0, 8)}…</span>
                      <span>{new Date(attr.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-zinc-300 text-[11px]">
                      {attr.twin_id && (
                        <div>
                          <span className="text-zinc-500 block">Creative Twin</span>
                          <code className="font-mono">{attr.twin_id.slice(0, 8)}…</code>
                        </div>
                      )}
                      {attr.brand_claim_id && (
                        <div>
                          <span className="text-zinc-500 block">Brand Claim</span>
                          <code className="font-mono">{attr.brand_claim_id.slice(0, 8)}…</code>
                        </div>
                      )}
                      {attr.experiment_id && (
                        <div>
                          <span className="text-zinc-500 block">Experiment</span>
                          <code className="font-mono">{attr.experiment_id.slice(0, 8)}…</code>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REVIEW OBSERVATION MODAL */}
      {reviewObsModalOpen && reviewObsTarget && (
        <Modal
          open={reviewObsModalOpen}
          title="Review Conversation Observation"
          onClose={() => setReviewObsModalOpen(false)}
        >
          <form onSubmit={handleSubmitObsReview} className="space-y-4">
            <p className="text-xs text-zinc-400">
              Apply a human governance review decision to this observed conversation record.
              The record strictly remains <code className="font-mono text-zinc-300">evidence_class = observed</code>.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Decision</label>
              <select
                value={obsReviewState}
                onChange={(e) => setObsReviewState(e.target.value as ConversationReviewState)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
              >
                <option value="accepted">Accept (Legitimate observed audience signal)</option>
                <option value="needs_human">Needs Further Review</option>
                <option value="corrected">Corrected</option>
                <option value="rejected">Reject (Invalid / Spam)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Rationale</label>
              <textarea
                rows={3}
                required={obsReviewState !== "accepted"}
                value={obsReviewRationale}
                onChange={(e) => setObsReviewRationale(e.target.value)}
                placeholder="Reason or context for this governance decision..."
                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
              />
            </div>

            {obsReviewError && <p className="text-xs text-red-400">{obsReviewError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewObsModalOpen(false)}
                className="px-3 py-1.5 text-xs rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={obsReviewSubmitting}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
              >
                {obsReviewSubmitting ? "Saving…" : "Save Observation Review"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* REVIEW INTERPRETATION MODAL */}
      {reviewInterpModalOpen && reviewInterpTarget && (
        <Modal
          open={reviewInterpModalOpen}
          title="Review AI Interpretation"
          onClose={() => setReviewInterpModalOpen(false)}
        >
          <form onSubmit={handleSubmitInterpReview} className="space-y-4">
            <p className="text-xs text-zinc-400">
              Apply a human governance review decision to this model interpretation.
              Approval does not convert AI inference into empirical fact; the record strictly remains{" "}
              <code className="font-mono text-zinc-300">evidence_class = inference</code>.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Decision</label>
              <select
                value={interpReviewState}
                onChange={(e) => setInterpReviewState(e.target.value as InterpretationReviewState)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
              >
                <option value="accepted">Accept (Grounded inference candidate)</option>
                <option value="corrected">Corrected</option>
                <option value="rejected">Reject</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Rationale</label>
              <textarea
                rows={3}
                required={interpReviewState !== "accepted"}
                value={interpReviewRationale}
                onChange={(e) => setInterpReviewRationale(e.target.value)}
                placeholder="Reason or notes..."
                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
              />
            </div>

            {interpReviewError && <p className="text-xs text-red-400">{interpReviewError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewInterpModalOpen(false)}
                className="px-3 py-1.5 text-xs rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={interpReviewSubmitting}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
              >
                {interpReviewSubmitting ? "Saving…" : "Save Interpretation Review"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
