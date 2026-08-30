import React, { useState, useEffect } from "react";
import {
  FlaskConical,
  Plus,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Link as LinkIcon,
  ShieldCheck,
  ShieldAlert,
  Info,
  Trash2,
  StopCircle,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import {
  createPersistentSimulationRun,
  fetchSimulationRunDetails,
  listSimulationRuns,
  reviewSimulationRun,
  transitionSimulationRunStatus,
  linkSimulationObservedOutcome,
  type SimulationRunRow,
  type SimulationRunDetail,
  type SimulationReviewDecision,
} from "../lib/simulations";
import {
  fetchStructuredTwin,
  type StructuredTwinDetails,
} from "../lib/creativeTwin";
import { fetchBrandForWorkspace, fetchBrandClaims, type BrandClaim } from "../lib/brandBrain";
import { listExperiments, listOutcomes, type ExperimentRow, type ExperimentOutcomeRow } from "../lib/experiments";
import type {
  CounterfactualMutation,
  CreativeTwinVersionSnapshot,
  MutationType,
  SceneSnapshot,
  StructuralDelta,
} from "../../shared/simulation/types";
import { Modal } from "./Modal";

export interface SimulationLabProps {
  workspaceId: string;
  userId: string;
  userRole?: string;
}

interface TwinOption {
  id: string;
  title: string;
  assetKind: string;
  state: string;
}

const MUTATION_TYPES: { type: MutationType; label: string; description: string }[] = [
  {
    type: "hook_replacement",
    label: "Hook Replacement",
    description: "Replace the opening hook script/text on a target scene.",
  },
  {
    type: "cta_replacement",
    label: "Call-to-Action Replacement",
    description: "Replace the concluding CTA prompt or offer on a target scene.",
  },
  {
    type: "scene_reorder",
    label: "Scene Permutation / Reorder",
    description: "Reorder existing scenes into a novel sequence without altering script content.",
  },
  {
    type: "scene_duration_adjust",
    label: "Scene Duration Adjust",
    description: "Adjust the pacing/duration of a scene, deterministically shifting WPM reading burden.",
  },
  {
    type: "on_screen_text_change",
    label: "On-Screen Text Change",
    description: "Modify the visual on-screen overlay text without changing spoken audio.",
  },
  {
    type: "claim_substitution",
    label: "Brand Claim Substitution",
    description: "Substitute an ungrounded or weak claim with an approved Brand Codex claim.",
  },
  {
    type: "tone_guideline_adaptation",
    label: "Tone Guideline Adaptation",
    description: "Adapt scene copy to conform to an approved brand voice/tone guideline.",
  },
];

export function SimulationLab({ workspaceId, userId, userRole }: { workspaceId: string; userId: string; userRole?: string }) {
  const isReadOnly = userRole === "viewer";
  const [runs, setRuns] = useState<SimulationRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Selected run for detail drawer/view
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<SimulationRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Create Simulation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [twins, setTwins] = useState<TwinOption[]>([]);
  const [selectedTwinId, setSelectedTwinId] = useState<string>("");
  const [selectedTwinDetails, setSelectedTwinDetails] = useState<StructuredTwinDetails | null>(null);
  const [selectedVersionNum, setSelectedVersionNum] = useState<number>(1);
  const [hypothesis, setHypothesis] = useState("");
  const [mutationsList, setMutationsList] = useState<CounterfactualMutation[]>([]);
  const [approvedBrandClaims, setApprovedBrandClaims] = useState<BrandClaim[]>([]);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Active mutation draft in create flow
  const [currentMutationType, setCurrentMutationType] = useState<MutationType>("hook_replacement");
  const [targetSceneIdx, setTargetSceneIdx] = useState<number>(0);
  const [mutationText, setMutationText] = useState<string>("");
  const [mutationRationale, setMutationRationale] = useState<string>("");
  const [mutationDuration, setMutationDuration] = useState<number>(5.0);
  const [selectedClaimId, setSelectedClaimId] = useState<string>("");
  const [sceneOrderStr, setSceneOrderStr] = useState<string>("");

  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<SimulationReviewDecision>("accepted");
  const [reviewRationale, setReviewRationale] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Cancel Confirmation Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Outcome Link Modal State
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [experiments, setExperiments] = useState<ExperimentRow[]>([]);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string>("");
  const [availableOutcomes, setAvailableOutcomes] = useState<ExperimentOutcomeRow[]>([]);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>("");
  const [linkNote, setLinkNote] = useState("");
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Notification Banner
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // 1. Fetch simulation runs list
  useEffect(() => {
    let mounted = true;
    const fetchRuns = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        setError("Supabase is not configured.");
        return;
      }
      setLoading(true);
      setError(null);
      const res = await listSimulationRuns(workspaceId);
      if (!mounted) return;
      setLoading(false);
      if (res.error) {
        setError(res.error);
        setRuns([]);
      } else {
        setRuns(res.data ?? []);
      }
    };
    fetchRuns();
    return () => {
      mounted = false;
    };
  }, [workspaceId, reloadToken]);

  // 2. Fetch run details when a run is selected
  useEffect(() => {
    let mounted = true;
    const fetchDetails = async () => {
      if (!selectedRunId) {
        setRunDetail(null);
        return;
      }
      setDetailLoading(true);
      setDetailError(null);
      const res = await fetchSimulationRunDetails(workspaceId, selectedRunId);
      if (!mounted) return;
      setDetailLoading(false);
      if (res.error) {
        setDetailError(res.error);
        setRunDetail(null);
      } else {
        setRunDetail(res.data);
      }
    };
    fetchDetails();
    return () => {
      mounted = false;
    };
  }, [workspaceId, selectedRunId, reloadToken]);

  // 3. Load twins & brand claims when create modal opens
  useEffect(() => {
    if (!showCreateModal) return;
    let mounted = true;
    const loadPrerequisites = async () => {
      const { data: twinData, error: twinErr } = await supabase
        .from("creative_twins")
        .select("id, title, asset_kind, state")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (!mounted) return;
      if (!twinErr && twinData) {
        setTwins(twinData.map((t) => ({ id: t.id, title: t.title, assetKind: t.asset_kind, state: t.state })));
        if (twinData.length > 0 && !selectedTwinId) {
          setSelectedTwinId(twinData[0].id);
        }
      }

      const brandRes = await fetchBrandForWorkspace(workspaceId);
      if (brandRes.data && mounted) {
        const claimsRes = await fetchBrandClaims(brandRes.data.id);
        if (mounted && claimsRes.data) {
          const approved = claimsRes.data.filter((c) => c.review_status === "approved");
          setApprovedBrandClaims(approved);
        }
      }
    };
    loadPrerequisites();
    return () => {
      mounted = false;
    };
  }, [showCreateModal, workspaceId, selectedTwinId]);

  // 4. Load structured twin details when selectedTwinId changes in create modal
  useEffect(() => {
    if (!selectedTwinId || !showCreateModal) return;
    let mounted = true;
    const loadStructured = async () => {
      const res = await fetchStructuredTwin(selectedTwinId, workspaceId);
      if (!mounted) return;
      if (res.data) {
        setSelectedTwinDetails(res.data);
        if (res.data.versions && res.data.versions.length > 0) {
          setSelectedVersionNum(res.data.versions[0].version_number);
        }
        if (res.data.scenes && res.data.scenes.length > 0) {
          const defaultOrder = res.data.scenes.map((_, i) => i).join(", ");
          setSceneOrderStr(defaultOrder);
        }
      } else {
        setSelectedTwinDetails(null);
      }
    };
    loadStructured();
    return () => {
      mounted = false;
    };
  }, [selectedTwinId, showCreateModal, workspaceId]);

  // 5. Load experiments for outcome linking
  useEffect(() => {
    if (!showLinkModal) return;
    let mounted = true;
    const loadExp = async () => {
      const res = await listExperiments(workspaceId);
      if (!mounted) return;
      if (res.data) {
        setExperiments(res.data);
        if (res.data.length > 0 && !selectedExperimentId) {
          setSelectedExperimentId(res.data[0].id);
        }
      }
    };
    loadExp();
    return () => {
      mounted = false;
    };
  }, [showLinkModal, workspaceId, selectedExperimentId]);

  // 6. Load outcomes for selected experiment
  useEffect(() => {
    if (!selectedExperimentId || !showLinkModal) return;
    let mounted = true;
    const loadExpOutcomes = async () => {
      const res = await listOutcomes(selectedExperimentId, workspaceId);
      if (!mounted) return;
      if (res.data) {
        setAvailableOutcomes(res.data);
        if (res.data.length > 0) {
          setSelectedOutcomeId(res.data[0].id);
        } else {
          setSelectedOutcomeId("");
        }
      }
    };
    loadExpOutcomes();
    return () => {
      mounted = false;
    };
  }, [selectedExperimentId, showLinkModal, workspaceId]);

  // Handler: Add mutation to draft list
  const handleAddMutation = () => {
    setCreateError(null);
    if (!mutationRationale.trim() || mutationRationale.trim().length < 5) {
      setCreateError("Each mutation must include a clear rationale of at least 5 characters.");
      return;
    }
    if (mutationsList.length >= 5) {
      setCreateError("Maximum 5 bounded mutations allowed per simulation run.");
      return;
    }

    const sceneCount = selectedTwinDetails?.scenes?.length || 1;
    if (targetSceneIdx < 0 || targetSceneIdx >= sceneCount) {
      setCreateError(`Target scene index ${targetSceneIdx} is out of bounds (twin has ${sceneCount} scenes).`);
      return;
    }

    let newMutation: CounterfactualMutation;

    switch (currentMutationType) {
      case "hook_replacement":
        if (!mutationText.trim() || mutationText.trim().length < 3) {
          setCreateError("Hook replacement text must be at least 3 characters.");
          return;
        }
        newMutation = {
          type: "hook_replacement",
          targetSceneIndex: targetSceneIdx,
          newHookText: mutationText.trim(),
          rationale: mutationRationale.trim(),
        };
        break;

      case "cta_replacement":
        if (!mutationText.trim() || mutationText.trim().length < 3) {
          setCreateError("CTA replacement text must be at least 3 characters.");
          return;
        }
        newMutation = {
          type: "cta_replacement",
          targetSceneIndex: targetSceneIdx,
          newCtaText: mutationText.trim(),
          rationale: mutationRationale.trim(),
        };
        break;

      case "scene_reorder": {
        const parsedOrder = sceneOrderStr
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !Number.isNaN(n));
        if (parsedOrder.length !== sceneCount) {
          setCreateError(`Scene reorder must be a full permutation containing exactly ${sceneCount} scene indices.`);
          return;
        }
        const set = new Set(parsedOrder);
        if (set.size !== sceneCount || parsedOrder.some((idx) => idx < 0 || idx >= sceneCount)) {
          setCreateError(`Invalid scene permutation: indices must cover [0..${sceneCount - 1}] uniquely.`);
          return;
        }
        newMutation = {
          type: "scene_reorder",
          newOrder: parsedOrder,
          rationale: mutationRationale.trim(),
        };
        break;
      }

      case "scene_duration_adjust":
        if (mutationDuration < 1.0) {
          setCreateError("Scene duration must be at least 1.0 second.");
          return;
        }
        newMutation = {
          type: "scene_duration_adjust",
          targetSceneIndex: targetSceneIdx,
          newDurationSeconds: mutationDuration,
          rationale: mutationRationale.trim(),
        };
        break;

      case "on_screen_text_change":
        if (!mutationText.trim()) {
          setCreateError("On-screen text cannot be empty.");
          return;
        }
        newMutation = {
          type: "on_screen_text_change",
          targetSceneIndex: targetSceneIdx,
          newOnScreenText: mutationText.trim(),
          rationale: mutationRationale.trim(),
        };
        break;

      case "claim_substitution": {
        const claim = approvedBrandClaims.find((c) => c.id === selectedClaimId);
        if (!claim) {
          setCreateError("Select an approved Brand Codex claim for substitution.");
          return;
        }
        newMutation = {
          type: "claim_substitution",
          targetSceneIndex: targetSceneIdx,
          originalClaimText: mutationText.trim() || "Original claim",
          substituteBrandClaimId: claim.id,
          substituteBrandClaimText: claim.claim_text,
          proofPointId: claim.id,
          rationale: mutationRationale.trim(),
        };
        break;
      }

      case "tone_guideline_adaptation":
        if (!mutationText.trim() || mutationText.trim().length < 3) {
          setCreateError("Adapted script text must be at least 3 characters.");
          return;
        }
        newMutation = {
          type: "tone_guideline_adaptation",
          targetSceneIndex: targetSceneIdx,
          toneGuidelineId: `tone-${workspaceId.slice(0, 8)}`,
          adaptedScriptText: mutationText.trim(),
          rationale: mutationRationale.trim(),
        };
        break;

      default:
        setCreateError("Unsupported mutation type.");
        return;
    }

    setMutationsList((prev) => [...prev, newMutation]);
    setMutationText("");
    setMutationRationale("");
  };

  // Handler: Remove mutation from draft list
  const handleRemoveMutation = (idx: number) => {
    setMutationsList((prev) => prev.filter((_, i) => i !== idx));
  };

  // Handler: Execute Simulation Run
  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!selectedTwinDetails || !selectedTwinId) {
      setCreateError("Please select a Creative Twin.");
      return;
    }
    if (!hypothesis.trim() || hypothesis.trim().length < 5) {
      setCreateError("A clear falsifiable hypothesis of at least 5 characters is required.");
      return;
    }
    if (mutationsList.length === 0) {
      setCreateError("Declare at least one bounded mutation operator before running the simulation.");
      return;
    }

    setCreateSubmitting(true);

    try {
      // Assemble baseline snapshot
      const rawScenes = selectedTwinDetails.scenes || [];
      const scenes: SceneSnapshot[] = rawScenes.map((s) => ({
        sceneIndex: s.scene_index,
        text: s.spoken_transcript || "",
        onScreenText: s.on_screen_text || null,
        durationSeconds: s.end_seconds && s.start_seconds ? Math.max(1, s.end_seconds - s.start_seconds) : 5,
        wpm: s.reading_burden_wpm || null,
        claims: (selectedTwinDetails.claims || [])
          .filter((c) => (c.scene_indices || []).includes(s.scene_index))
          .map((c) => ({ claimText: c.claim_text, brandClaimId: c.brand_claim_id || undefined })),
      }));

      const totalDuration = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
      const totalWords = scenes.reduce((sum, s) => sum + (s.text ? s.text.trim().split(/\s+/).length : 0), 0);
      const averageWpm = totalDuration > 0 ? Math.round((totalWords / totalDuration) * 60) : null;

      const baselineSnapshot: CreativeTwinVersionSnapshot = {
        twinId: selectedTwinId,
        twinVersion: selectedVersionNum,
        workspaceId,
        totalDurationSeconds: totalDuration || 15,
        averageWpm,
        scenes: scenes.length > 0 ? scenes : [
          {
            sceneIndex: 0,
            text: "Baseline script text",
            durationSeconds: 15,
            wpm: 120,
            claims: [],
          },
        ],
      };

      const approvedContext = approvedBrandClaims.map((c) => ({
        id: c.id,
        workspaceId,
        claimText: c.claim_text,
        claimType: c.claim_type,
        reviewStatus: c.review_status,
        proofPointId: c.id,
      }));

      const res = await createPersistentSimulationRun({
        workspaceId,
        actorUserId: userId,
        baselineSnapshot,
        twinVersionId: selectedTwinDetails.versions?.[0]?.id || selectedTwinId,
        hypothesis: hypothesis.trim(),
        mutations: mutationsList,
        approvedClaims: approvedContext,
      });

      if (res.error || !res.data) {
        setCreateError(res.error || "Failed to persist simulation run.");
      } else {
        setNotification({
          type: "success",
          message: `Counterfactual simulation run persisted (${res.data.simulationRunId.slice(0, 8)}…). Evidence class: simulation.`,
        });
        setShowCreateModal(false);
        setHypothesis("");
        setMutationsList([]);
        setSelectedRunId(res.data.simulationRunId);
        setReloadToken((t) => t + 1);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to execute simulation run.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Handler: Review Simulation Run
  const handleReviewRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRunId) return;
    setReviewError(null);

    if (reviewDecision !== "accepted" && (!reviewRationale.trim() || reviewRationale.trim().length < 5)) {
      setReviewError("A rationale of at least 5 characters is required for this review decision.");
      return;
    }

    setReviewSubmitting(true);
    try {
      const res = await reviewSimulationRun({
        workspaceId,
        simulationRunId: selectedRunId,
        decision: reviewDecision,
        rationale: reviewRationale.trim() || undefined,
      });

      if (res.error || !res.data) {
        setReviewError(res.error || "Failed to submit review.");
      } else {
        setNotification({
          type: "success",
          message: `Review recorded: ${res.data.newDecision}. Evidence class strictly preserved as simulation.`,
        });
        setShowReviewModal(false);
        setReviewRationale("");
        setReloadToken((t) => t + 1);
      }
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to submit review.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Handler: Cancel Simulation Run
  const handleCancelRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRunId) return;
    setCancelError(null);

    setCancelSubmitting(true);
    try {
      const res = await transitionSimulationRunStatus({
        workspaceId,
        simulationRunId: selectedRunId,
        targetStatus: "cancelled",
        reason: cancelReason.trim() || "User cancelled simulation run",
      });

      if (res.error) {
        setCancelError(res.error);
      } else {
        setNotification({
          type: "success",
          message: "Simulation run cancelled. Immutability guarantee preserved.",
        });
        setShowCancelModal(false);
        setCancelReason("");
        setReloadToken((t) => t + 1);
      }
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel run.");
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Handler: Link Observed Outcome
  const handleLinkOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRunId || !selectedOutcomeId) {
      setLinkError("Please select an observed experiment outcome to link.");
      return;
    }

    setLinkSubmitting(true);
    setLinkError(null);

    try {
      const res = await linkSimulationObservedOutcome({
        workspaceId,
        simulationRunId: selectedRunId,
        experimentOutcomeId: selectedOutcomeId,
        note: linkNote.trim() || undefined,
      });

      if (res.error) {
        setLinkError(res.error);
      } else {
        setNotification({
          type: "success",
          message: "Traceability link established. Structural simulation parameters preserved without variance/lift calculation.",
        });
        setShowLinkModal(false);
        setLinkNote("");
        setReloadToken((t) => t + 1);
      }
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Failed to link observed outcome.");
    } finally {
      setLinkSubmitting(false);
    }
  };

  const selectedRun = runs.find((r) => r.id === selectedRunId);
  const structuralDelta = (runDetail?.results?.structural_delta as unknown as StructuralDelta) || null;

  return (
    <div className="space-y-6" data-testid="simulation-lab-panel">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <FlaskConical size={18} className="text-indigo-400" /> Counterfactual Simulation Lab
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Deterministic mutation engine and six-role Council coordinator. Computes structural differences over
            immutable Creative Twin snapshots. Evidence class: <code className="font-mono text-indigo-300">simulation</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReloadToken((t) => t + 1)}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Refresh simulation runs"
          >
            <RotateCcw size={14} />
          </button>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus size={14} /> New Simulation
            </button>
          )}
        </div>
      </div>

      {/* Epistemic Guardrail Notice */}
      <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-xs text-zinc-400 flex items-start gap-2.5">
        <Info size={15} className="shrink-0 mt-0.5 text-indigo-400" />
        <div>
          <strong className="text-zinc-200">Constitutional Epistemic Boundary:</strong> Counterfactual simulations produce
          strictly structural, textual, and pacing deltas. They are <em>never</em> empirical observations, audience virality scores,
          reach forecasts, or performance predictions. Human review records governance decisions but never promotes simulated outputs to observed facts.
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

      {/* Loading state */}
      {loading && (
        <div className="brand-brain-loading" role="status">
          Loading counterfactual simulations…
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="vp-empty vp-state-blocked" role="alert">
          <ShieldAlert size={16} />
          <h3>Could not load simulations</h3>
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

      {/* Empty runs state */}
      {!loading && !error && runs.length === 0 && (
        <div className="border border-dashed border-zinc-800 rounded-xl p-8 text-center space-y-3">
          <FlaskConical size={28} className="mx-auto text-zinc-600" />
          <h4 className="text-sm font-medium text-zinc-300">No counterfactual simulations run yet</h4>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Create your first simulation to evaluate bounded mutations (hooks, CTAs, pacing, claim substitutions)
            against an immutable Creative Twin baseline.
          </p>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
            >
              Create first simulation
            </button>
          )}
        </div>
      )}

      {/* Main Runs Layout: List on Left, Detail on Right */}
      {!loading && !error && runs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Runs List */}
          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Simulations ({runs.length})
              </span>
            </div>

            <div className="space-y-2">
              {runs.map((run) => {
                const isSelected = run.id === selectedRunId;
                return (
                  <div
                    key={run.id}
                    onClick={() => setSelectedRunId(run.id)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? "bg-zinc-900 border-indigo-500/50 shadow-md"
                        : "bg-zinc-950/60 border-zinc-800/80 hover:bg-zinc-900/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            run.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : run.status === "running" || run.status === "queued"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : run.status === "blocked" || run.status === "failed"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : run.status === "cancelled"
                              ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                              : "bg-zinc-800 text-zinc-300 border-zinc-700"
                          }`}
                        >
                          {run.status}
                        </span>

                        {/* Explicit Evidence Class */}
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-900/40">
                          {run.evidence_class}
                        </span>

                        {/* Observed Link Status */}
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            run.observed_validation === "linked"
                              ? "bg-purple-950/40 text-purple-300 border border-purple-900/40"
                              : "bg-zinc-900 text-zinc-500"
                          }`}
                        >
                          {run.observed_validation === "linked" ? "linked" : "unlinked"}
                        </span>
                      </div>

                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(run.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-200 font-medium mt-2 line-clamp-2">{run.hypothesis}</p>

                    <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400">
                      <span>Twin v{run.twin_version}</span>
                      <span
                        className={`font-mono text-[10px] ${
                          run.review_decision === "accepted"
                            ? "text-emerald-400"
                            : run.review_decision === "rejected"
                            ? "text-red-400"
                            : run.review_decision === "needs_human"
                            ? "text-amber-400"
                            : "text-zinc-500"
                        }`}
                      >
                        Review: {run.review_decision}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Run Detail View */}
          <div className="lg:col-span-7">
            {!selectedRunId ? (
              <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center text-zinc-500 text-xs">
                Select a simulation run from the list to inspect its mutations, structural deltas, and review status.
              </div>
            ) : detailLoading ? (
              <div className="border border-zinc-800 rounded-xl p-8 bg-zinc-950/60 text-center text-zinc-400 text-xs">
                Loading simulation details…
              </div>
            ) : detailError || !selectedRun ? (
              <div className="border border-red-900/40 rounded-xl p-6 bg-red-950/20 text-xs text-red-300 space-y-2">
                <AlertTriangle size={16} />
                <h4 className="font-semibold">Could not load simulation run</h4>
                <p>{detailError || "Run not found."}</p>
              </div>
            ) : (
              <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950/90 space-y-6">
                {/* Detail Header & Action Buttons */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-zinc-100 font-mono">
                        Run {selectedRun.id.slice(0, 8)}…
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-900/50">
                        evidence_class = {selectedRun.evidence_class}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Twin ID: <code className="font-mono text-zinc-300">{selectedRun.twin_id.slice(0, 8)}…</code> (v{selectedRun.twin_version})
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {!isReadOnly && selectedRun.status !== "cancelled" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowReviewModal(true)}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1"
                        >
                          <ShieldCheck size={13} className="text-indigo-400" /> Review
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowLinkModal(true)}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1"
                        >
                          <LinkIcon size={13} className="text-purple-400" /> Link Outcome
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCancelModal(true)}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-red-950/40 text-red-400 border border-red-900/40 flex items-center gap-1"
                        >
                          <StopCircle size={13} /> Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Hypothesis Box */}
                <div className="p-3.5 rounded-lg bg-zinc-900/70 border border-zinc-800 text-xs space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">Hypothesis</span>
                  <p className="text-zinc-200 font-medium">{selectedRun.hypothesis}</p>
                </div>

                {/* Deterministic Structural Deltas */}
                {structuralDelta && (
                  <div className="space-y-3">
                    <h5 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={14} className="text-indigo-400" /> Deterministic Structural Deltas
                    </h5>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs">
                        <span className="text-zinc-500 block text-[10px] uppercase">Duration</span>
                        <div className="text-sm font-semibold text-zinc-100 font-mono mt-0.5">
                          {structuralDelta.simulatedDurationSeconds}s
                          <span
                            className={`text-[10px] ml-1.5 font-normal ${
                              structuralDelta.durationDeltaSeconds >= 0 ? "text-emerald-400" : "text-amber-400"
                            }`}
                          >
                            ({structuralDelta.durationDeltaSeconds >= 0 ? "+" : ""}
                            {structuralDelta.durationDeltaSeconds}s)
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs">
                        <span className="text-zinc-500 block text-[10px] uppercase">Average WPM</span>
                        <div className="text-sm font-semibold text-zinc-100 font-mono mt-0.5">
                          {structuralDelta.simulatedAverageWpm ?? "N/A"}
                          {structuralDelta.wpmDelta !== null && (
                            <span className="text-[10px] ml-1.5 font-normal text-zinc-400">
                              ({structuralDelta.wpmDelta >= 0 ? "+" : ""}
                              {structuralDelta.wpmDelta})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs">
                        <span className="text-zinc-500 block text-[10px] uppercase">Scenes</span>
                        <div className="text-sm font-semibold text-zinc-100 font-mono mt-0.5">
                          {structuralDelta.simulatedSceneCount}
                          <span className="text-[10px] ml-1.5 font-normal text-zinc-400">
                            ({structuralDelta.sceneCountDelta >= 0 ? "+" : ""}
                            {structuralDelta.sceneCountDelta})
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs">
                        <span className="text-zinc-500 block text-[10px] uppercase">Claims</span>
                        <div className="text-sm font-semibold text-zinc-100 font-mono mt-0.5">
                          {structuralDelta.simulatedClaimCount}
                          <span className="text-[10px] ml-1.5 font-normal text-zinc-400">
                            ({structuralDelta.claimCountDelta >= 0 ? "+" : ""}
                            {structuralDelta.claimCountDelta})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Hook & CTA Change indicators */}
                    <div className="flex items-center gap-3 text-xs text-zinc-400 pt-1">
                      <span>
                        Hook Modified:{" "}
                        <strong className={structuralDelta.hasHookChanged ? "text-indigo-300" : "text-zinc-500"}>
                          {structuralDelta.hasHookChanged ? "Yes" : "No"}
                        </strong>
                      </span>
                      <span>·</span>
                      <span>
                        CTA Modified:{" "}
                        <strong className={structuralDelta.hasCtaChanged ? "text-indigo-300" : "text-zinc-500"}>
                          {structuralDelta.hasCtaChanged ? "Yes" : "No"}
                        </strong>
                      </span>
                    </div>

                    {/* Warnings */}
                    {structuralDelta.warnings && structuralDelta.warnings.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/30 text-xs text-amber-300 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          <AlertTriangle size={13} /> Pacing / Structural Warnings:
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90">
                          {structuralDelta.warnings.map((w, idx) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Applied Mutations List */}
                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                  <h5 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Applied Mutations ({runDetail?.mutations.length || 0})
                  </h5>
                  {(!runDetail?.mutations || runDetail.mutations.length === 0) ? (
                    <p className="text-xs text-zinc-500">No mutations recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {runDetail.mutations.map((m) => (
                        <div key={m.id} className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-indigo-300 font-semibold">{m.mutation_type}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              Scene #{m.target_scene_index} · Seq {m.sequence_order}
                            </span>
                          </div>
                          <p className="text-zinc-300 text-[11px]">{m.rationale}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Review Governance History */}
                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                      Review Governance ({selectedRun.review_decision})
                    </h5>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      Governance Gate: human_reviewer
                    </span>
                  </div>

                  {runDetail?.reviewEvents && runDetail.reviewEvents.length > 0 ? (
                    <div className="space-y-1.5">
                      {runDetail.reviewEvents.map((rev) => (
                        <div key={rev.id} className="p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/80 text-xs flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="font-semibold text-zinc-200">
                              Decision: <span className="font-mono text-indigo-300">{rev.new_decision}</span>
                            </div>
                            {rev.rationale && <p className="text-zinc-400 text-[11px]">{rev.rationale}</p>}
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                            {new Date(rev.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">No review events logged yet. Status is unreviewed.</p>
                  )}
                </div>

                {/* Observed Outcome Links */}
                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                  <h5 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Traceability Links ({runDetail?.observedLinks.length || 0})
                  </h5>
                  {runDetail?.observedLinks && runDetail.observedLinks.length > 0 ? (
                    <div className="space-y-1.5">
                      {runDetail.observedLinks.map((link) => (
                        <div key={link.id} className="p-2.5 rounded-lg bg-purple-950/20 border border-purple-900/30 text-xs space-y-1">
                          <div className="flex items-center justify-between text-purple-300">
                            <span className="font-semibold flex items-center gap-1.5">
                              <LinkIcon size={12} /> Outcome {link.experiment_outcome_id.slice(0, 8)}…
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {new Date(link.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {link.note && <p className="text-zinc-400 text-[11px]">{link.note}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      No empirical outcomes linked. Traceability status is <code className="font-mono">unknown</code>.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE SIMULATION MODAL */}
      {showCreateModal && (
        <Modal open={showCreateModal} title="Create Counterfactual Simulation" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreateRun} className="space-y-5">
            {/* Step 1: Baseline Creative Twin */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Target Creative Twin</label>
              <select
                value={selectedTwinId}
                onChange={(e) => setSelectedTwinId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                {twins.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.assetKind})
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Hypothesis */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Counterfactual Hypothesis</label>
              <textarea
                required
                rows={2}
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                placeholder="e.g. Replacing the hook with a direct value proposition reduces intro duration and improves script density."
                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
              <p className="text-[11px] text-zinc-500">
                State a structural variation test. Do not include reach/ROI predictions.
              </p>
            </div>

            {/* Step 3: Mutation Operator Builder */}
            <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-950/60 space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Layers size={14} className="text-indigo-400" /> Declare Bounded Mutation
                </h5>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {mutationsList.length}/5 mutations declared
                </span>
              </div>

              {/* Mutation Type Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MUTATION_TYPES.map((m) => (
                  <button
                    key={m.type}
                    type="button"
                    onClick={() => setCurrentMutationType(m.type)}
                    className={`p-2 rounded-lg text-left border transition-all ${
                      currentMutationType === m.type
                        ? "bg-indigo-950/40 border-indigo-600/60 text-indigo-200"
                        : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-900"
                    }`}
                  >
                    <div className="font-semibold text-xs text-zinc-100">{m.label}</div>
                    <div className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">{m.description}</div>
                  </button>
                ))}
              </div>

              {/* Mutation Parameter Inputs */}
              <div className="space-y-3 pt-2 border-t border-zinc-800">
                {currentMutationType !== "scene_reorder" && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-zinc-300">Target Scene Index</label>
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, (selectedTwinDetails?.scenes?.length || 1) - 1)}
                      value={targetSceneIdx}
                      onChange={(e) => setTargetSceneIdx(parseInt(e.target.value, 10) || 0)}
                      className="w-24 px-2.5 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                )}

                {/* Conditional fields by operator */}
                {currentMutationType === "scene_reorder" && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-zinc-300">
                      Scene Index Sequence (Comma-separated permutation)
                    </label>
                    <input
                      type="text"
                      value={sceneOrderStr}
                      onChange={(e) => setSceneOrderStr(e.target.value)}
                      placeholder="e.g. 1, 0, 2"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono"
                    />
                  </div>
                )}

                {currentMutationType === "scene_duration_adjust" && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-zinc-300">
                      New Scene Duration (Seconds, min 1.0)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1.0"
                      value={mutationDuration}
                      onChange={(e) => setMutationDuration(parseFloat(e.target.value) || 1.0)}
                      className="w-32 px-2.5 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                )}

                {currentMutationType === "claim_substitution" && (
                  <div className="space-y-2">
                    <label className="block text-[11px] font-medium text-zinc-300">
                      Select Approved Brand Codex Claim
                    </label>
                    {approvedBrandClaims.length === 0 ? (
                      <p className="text-[11px] text-amber-400">
                        No approved Brand Codex claims found in this workspace.
                      </p>
                    ) : (
                      <select
                        value={selectedClaimId}
                        onChange={(e) => setSelectedClaimId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
                      >
                        <option value="">-- Choose Approved Claim --</option>
                        {approvedBrandClaims.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.claim_text.slice(0, 60)}… ({c.claim_type})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {(currentMutationType === "hook_replacement" ||
                  currentMutationType === "cta_replacement" ||
                  currentMutationType === "on_screen_text_change" ||
                  currentMutationType === "tone_guideline_adaptation") && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-zinc-300">New Text Content</label>
                    <textarea
                      rows={2}
                      value={mutationText}
                      onChange={(e) => setMutationText(e.target.value)}
                      placeholder="Enter substituted copy/text..."
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-zinc-300">Operator Rationale</label>
                  <input
                    type="text"
                    value={mutationRationale}
                    onChange={(e) => setMutationRationale(e.target.value)}
                    placeholder="Why this mutation is being tested..."
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddMutation}
                    disabled={mutationsList.length >= 5}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-40"
                  >
                    + Add Mutation to Run
                  </button>
                </div>
              </div>

              {/* Declared Mutations Summary */}
              {mutationsList.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                  <h6 className="text-[10px] uppercase font-semibold text-zinc-400">Declared Mutations Queue:</h6>
                  {mutationsList.map((m, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded bg-zinc-900 border border-zinc-800 text-xs"
                    >
                      <div>
                        <span className="font-mono text-indigo-300 font-semibold">{m.type}</span>
                        <span className="text-zinc-400 text-[11px] ml-2 font-mono">
                          Scene #{("targetSceneIndex" in m ? m.targetSceneIndex : "all")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMutation(idx)}
                        className="text-zinc-500 hover:text-red-400 p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {createError && <p className="text-xs text-red-400">{createError}</p>}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 text-xs rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createSubmitting || mutationsList.length === 0}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 flex items-center gap-1.5"
              >
                <Sparkles size={13} />
                {createSubmitting ? "Executing…" : "Execute Simulation"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* HUMAN REVIEW MODAL */}
      {showReviewModal && (
        <Modal open={showReviewModal} title="Simulation Governance Review" onClose={() => setShowReviewModal(false)}>
          <form onSubmit={handleReviewRun} className="space-y-4">
            <p className="text-xs text-zinc-400">
              Apply a human governance decision to this simulation run. Human approval records administrative
              acceptance but strictly preserves <code className="font-mono text-zinc-300">evidence_class = simulation</code>.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Decision</label>
              <select
                value={reviewDecision}
                onChange={(e) => setReviewDecision(e.target.value as SimulationReviewDecision)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
              >
                <option value="accepted">Accept (Validated for potential test formulation)</option>
                <option value="needs_human">Needs Further Review</option>
                <option value="corrected">Corrected</option>
                <option value="rejected">Reject</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Governance Rationale</label>
              <textarea
                rows={3}
                required={reviewDecision !== "accepted"}
                value={reviewRationale}
                onChange={(e) => setReviewRationale(e.target.value)}
                placeholder="Reason or editorial notes..."
                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
              />
            </div>

            {reviewError && <p className="text-xs text-red-400">{reviewError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-3 py-1.5 text-xs rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reviewSubmitting}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
              >
                {reviewSubmitting ? "Recording…" : "Save Review Decision"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* CANCEL MODAL */}
      {showCancelModal && (
        <Modal open={showCancelModal} title="Cancel Simulation Run" onClose={() => setShowCancelModal(false)}>
          <form onSubmit={handleCancelRun} className="space-y-4">
            <p className="text-xs text-zinc-400">
              Are you sure you want to cancel this simulation run? The status will transition to <code className="font-mono text-zinc-300">cancelled</code>.
              Prior run records and structural deltas remain immutable.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Cancellation Reason (Optional)</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Superseded by new hypothesis"
                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
              />
            </div>

            {cancelError && <p className="text-xs text-red-400">{cancelError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-3 py-1.5 text-xs rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={cancelSubmitting}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 text-white disabled:opacity-40"
              >
                {cancelSubmitting ? "Cancelling…" : "Confirm Cancel"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* LINK OUTCOME MODAL */}
      {showLinkModal && (
        <Modal open={showLinkModal} title="Link Observed Experiment Outcome" onClose={() => setShowLinkModal(false)}>
          <form onSubmit={handleLinkOutcome} className="space-y-4">
            <p className="text-xs text-zinc-400">
              Establish a post-hoc traceability link between an observed experiment outcome and this simulation.
              Invariant: Traceability only—never calculates lift, accuracy, or variance.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Experiment</label>
              <select
                value={selectedExperimentId}
                onChange={(e) => setSelectedExperimentId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
              >
                {experiments.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.title} ({exp.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Observed Outcome</label>
              {availableOutcomes.length === 0 ? (
                <p className="text-[11px] text-amber-400">No observed outcome rows found for this experiment.</p>
              ) : (
                <select
                  value={selectedOutcomeId}
                  onChange={(e) => setSelectedOutcomeId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
                >
                  {availableOutcomes.map((out) => (
                    <option key={out.id} value={out.id}>
                      {out.metric_key}: {out.value} ({new Date(out.observed_at).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Traceability Note (Optional)</label>
              <input
                type="text"
                value={linkNote}
                onChange={(e) => setLinkNote(e.target.value)}
                placeholder="e.g. In-market experiment test completed"
                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
              />
            </div>

            {linkError && <p className="text-xs text-red-400">{linkError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="px-3 py-1.5 text-xs rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={linkSubmitting || !selectedOutcomeId}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40"
              >
                {linkSubmitting ? "Linking…" : "Create Traceability Link"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
