import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import {
  fetchStructuredTwin,
  correctSceneAtomic,
  correctClaimAtomic,
  categorizeWpmDensity,
  calculateReadingBurden,
  type StructuredTwinDetails,
  type CreativeSceneRow,
  type CreativeClaimRow,
  type CreativeTwinVersionRow,
  type ShotPurpose,
  type ClaimClassification,
  type BrandAlignmentStatus,
} from '../lib/creativeTwin';
import { fetchBrandForWorkspace, fetchBrandClaims, brandReadSummary, type BrandClaim } from '../lib/brandBrain';
import { TimelineDoctor } from './TimelineDoctor';
import { ClaimGroundingPanel } from './ClaimGroundingPanel';
import { isFlagOn } from '../lib/flags';

interface CreativeTwinEditorProps {
  twinId: string;
  workspaceId: string;
  userId: string;
  userRole?: string;
  onBack: () => void;
}

export const CreativeTwinEditor: React.FC<CreativeTwinEditorProps> = ({
  twinId,
  workspaceId,
  userId,
  userRole,
  onBack,
}) => {
  const [details, setDetails] = useState<StructuredTwinDetails | null>(null);
  const [brandClaims, setBrandClaims] = useState<BrandClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'claims' | 'versions' | 'gaps' | 'doctor'>('timeline');

  // Scene edit modal state
  const [editingScene, setEditingScene] = useState<CreativeSceneRow | null>(null);
  const [scenePurpose, setScenePurpose] = useState<ShotPurpose>('other');
  const [sceneTranscript, setSceneTranscript] = useState('');
  const [sceneOnScreenText, setSceneOnScreenText] = useState('');
  const [sceneVisualNotes, setSceneVisualNotes] = useState('');
  const [sceneStartSeconds, setSceneStartSeconds] = useState<string>('');
  const [sceneEndSeconds, setSceneEndSeconds] = useState<string>('');
  const [sceneChangeSummary, setSceneChangeSummary] = useState('');
  const [savingScene, setSavingScene] = useState(false);

  // Claim edit modal state
  const [editingClaim, setEditingClaim] = useState<CreativeClaimRow | null>(null);
  const [claimText, setClaimText] = useState('');
  const [claimClassification, setClaimClassification] = useState<ClaimClassification>('unverified_statement');
  const [brandAlignment, setBrandAlignment] = useState<BrandAlignmentStatus>('unassessed');
  const [selectedBrandClaimId, setSelectedBrandClaimId] = useState<string>('');
  const [proofReference, setProofReference] = useState('');
  const [claimChangeSummary, setClaimChangeSummary] = useState('');
  const [savingClaim, setSavingClaim] = useState(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [reloadToken, setReloadToken] = useState(0);

  // Initial load runs with loading=true from state init; reload() is for user-triggered refreshes.
  const reload = () => {
    setLoading(true);
    setError(null);
    setReloadToken((t) => t + 1);
  };

  useEffect(() => {
    const loadData = async () => {
      const [twinRes, brandRes] = await Promise.all([
        fetchStructuredTwin(twinId, workspaceId),
        fetchBrandForWorkspace(workspaceId),
      ]);

      if (twinRes.error) {
        setError(twinRes.error);
      } else {
        setDetails(twinRes.data);
      }

      if (brandRes.error) {
        // Grounding claims decide what this twin may say. An unread claim list
        // is not an empty one, so the editor reports the read failure instead of
        // rendering as though the brand had no claims.
        setError(brandReadSummary(brandRes.error));
      } else if (brandRes.data) {
        const claims = await fetchBrandClaims(brandRes.data.id);
        if (claims.error) setError(brandReadSummary(claims.error));
        else setBrandClaims(claims.data);
      }

      setLoading(false);
    };
    void loadData();
  }, [twinId, workspaceId, reloadToken]);

  // Handle Scene Edit
  const openSceneModal = (scene: CreativeSceneRow) => {
    setEditingScene(scene);
    setScenePurpose((scene.shot_purpose as ShotPurpose) || 'other');
    setSceneTranscript(scene.spoken_transcript || '');
    setSceneOnScreenText(scene.on_screen_text || '');
    setSceneVisualNotes(scene.provided_visual_notes || '');
    setSceneStartSeconds(scene.start_seconds !== null ? String(scene.start_seconds) : '');
    setSceneEndSeconds(scene.end_seconds !== null ? String(scene.end_seconds) : '');
    setSceneChangeSummary('');
  };

  const handleSaveScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScene || !sceneChangeSummary.trim()) {
      setNotification({ type: 'error', message: 'A concise change summary is required for version snapshotting.' });
      return;
    }

    setSavingScene(true);
    const startSec = sceneStartSeconds.trim() ? parseFloat(sceneStartSeconds) : null;
    const endSec = sceneEndSeconds.trim() ? parseFloat(sceneEndSeconds) : null;

    if (startSec !== null && endSec !== null && endSec <= startSec) {
      setSavingScene(false);
      setNotification({ type: 'error', message: 'End timecode must be strictly greater than start timecode.' });
      return;
    }

    const wordCount = sceneTranscript.trim() ? sceneTranscript.trim().split(/\s+/).filter(Boolean).length : 0;
    const wpm = calculateReadingBurden(wordCount, startSec, endSec);

    const res = await correctSceneAtomic(
      editingScene.id,
      workspaceId,
      userId,
      {
        shotPurpose: scenePurpose,
        spokenTranscript: sceneTranscript,
        onScreenText: sceneOnScreenText || null,
        providedVisualNotes: sceneVisualNotes || null,
        startSeconds: startSec,
        endSeconds: endSec,
        readingBurdenWpm: wpm,
      },
      sceneChangeSummary.trim()
    );

    setSavingScene(false);

    if (res.error) {
      setNotification({ type: 'error', message: `Failed to save scene: ${res.error}` });
    } else {
      setNotification({
        type: 'success',
        message: `Scene updated and Version ${res.newVersionNumber} snapshot created.`,
      });
      setEditingScene(null);
      reload();
    }
  };

  // Handle Claim Edit
  const openClaimModal = (claim: CreativeClaimRow) => {
    setEditingClaim(claim);
    setClaimText(claim.claim_text);
    setClaimClassification((claim.claim_classification as ClaimClassification) || 'unverified_statement');
    setBrandAlignment((claim.brand_alignment_status as BrandAlignmentStatus) || 'unassessed');
    setSelectedBrandClaimId(claim.brand_claim_id || '');
    setProofReference(claim.proof_reference || '');
    setClaimChangeSummary('');
  };

  const handleSaveClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClaim || !claimChangeSummary.trim()) {
      setNotification({ type: 'error', message: 'A concise change summary is required for version snapshotting.' });
      return;
    }

    setSavingClaim(true);

    const res = await correctClaimAtomic(
      editingClaim.id,
      workspaceId,
      userId,
      {
        brandClaimId: selectedBrandClaimId || null,
        claimText: claimText.trim(),
        claimClassification,
        brandAlignmentStatus: brandAlignment,
        proofReference: proofReference.trim() || null,
      },
      claimChangeSummary.trim()
    );

    setSavingClaim(false);

    if (res.error) {
      setNotification({ type: 'error', message: `Failed to save claim: ${res.error}` });
    } else {
      setNotification({
        type: 'success',
        message: `Claim updated and Version ${res.newVersionNumber} snapshot created.`,
      });
      setEditingClaim(null);
      reload();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-400">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        Loading Structured Creative Twin...
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="p-6 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300">
        <h3 className="font-semibold text-lg mb-2">Error Loading Twin</h3>
        <p className="text-sm">{error || 'Twin details not found.'}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-lg font-medium transition"
        >
          ← Return to Creative Intake
        </button>
      </div>
    );
  }

  const { twin, scenes, claims, versions } = details;
  const knownGaps = (twin.known_gaps as string[]) || [];

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={onBack}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              ← Creative Intake
            </button>
            <span className="text-zinc-600">/</span>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
              v{versions[0]?.version_number || 1} Snapshot
            </span>
          </div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-3">
            {twin.title}
            <span className="text-xs font-normal font-mono uppercase bg-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded">
              {twin.asset_kind}
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Structured Twin: deterministic text representation. No AI hallucinations or predicted scores.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              activeTab === 'timeline'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800'
            }`}
          >
            Scene Timeline ({scenes.length})
          </button>
          <button
            onClick={() => setActiveTab('claims')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              activeTab === 'claims'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800'
            }`}
          >
            Claims & Codex ({claims.length})
          </button>
          <button
            onClick={() => setActiveTab('versions')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              activeTab === 'versions'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800'
            }`}
          >
            Changelog ({versions.length})
          </button>
          <button
            onClick={() => setActiveTab('gaps')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              activeTab === 'gaps'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800'
            }`}
          >
            Known Gaps ({knownGaps.length})
          </button>
          <button
            onClick={() => setActiveTab('doctor')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              activeTab === 'doctor'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800'
            }`}
          >
            Timeline Doctor 🩺
          </button>
        </div>
      </div>

      {/* Notification toast */}
      {notification && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
            notification.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              : 'bg-red-950/60 border-red-800 text-red-200'
          }`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-zinc-400 hover:text-zinc-200 text-xs ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: SCENE TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>
              {scenes.length} sequential scenes decomposed from raw text delimiters.
            </span>
            <span className="font-mono text-zinc-500">
              Click &quot;Edit & Correct&quot; on any scene to capture a versioned snapshot.
            </span>
          </div>

          {scenes.length === 0 ? (
            <div className="p-8 text-center bg-zinc-900/50 border border-zinc-800 rounded-xl text-zinc-400 text-xs">
              No scenes extracted. Add delimiter markers like &quot;Scene 1:&quot; or &quot;Hook:&quot; to structure your script.
            </div>
          ) : (
            <div className="space-y-3">
              {scenes.map((scene: CreativeSceneRow) => {
                const density = categorizeWpmDensity(scene.reading_burden_wpm);
                const hasTime = scene.start_seconds !== null && scene.end_seconds !== null;

                return (
                  <div
                    key={scene.id}
                    className="p-4 bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 rounded-xl transition space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
                          Scene {scene.scene_index + 1}
                        </span>
                        <span
                          className={`text-xs font-medium uppercase px-2 py-0.5 rounded ${
                            scene.shot_purpose === 'hook'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                              : scene.shot_purpose === 'problem_setup'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                              : scene.shot_purpose === 'product_demonstration'
                              ? 'bg-blue-950 text-blue-400 border border-blue-800/50'
                              : scene.shot_purpose === 'cta'
                              ? 'bg-purple-950 text-purple-400 border border-purple-800/50'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {scene.shot_purpose.replace('_', ' ')}
                        </span>
                        {scene.is_user_corrected && (
                          <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/40 px-1.5 py-0.5 rounded">
                            Edited by user
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-zinc-400">
                          {hasTime
                            ? `${scene.start_seconds}s – ${scene.end_seconds}s`
                            : 'Timing unsupplied'}
                        </span>
                        <span
                          className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                            density.level === 'moderate' || density.level === 'low'
                              ? 'text-emerald-400 bg-emerald-950/40'
                              : density.level === 'dense'
                              ? 'text-amber-400 bg-amber-950/40'
                              : density.level === 'overload'
                              ? 'text-red-400 bg-red-950/40'
                              : 'text-zinc-500 bg-zinc-800/40'
                          }`}
                        >
                          {density.label}
                        </span>
                        <button
                          onClick={() => openSceneModal(scene)}
                          className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded font-medium transition"
                        >
                          Edit & Correct
                        </button>
                      </div>
                    </div>

                    {/* Spoken Transcript */}
                    <div className="text-sm text-zinc-200 leading-relaxed font-sans bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/60">
                      {scene.spoken_transcript || <span className="text-zinc-600 italic">No spoken transcript supplied.</span>}
                    </div>

                    {/* Provided Visual Notes & On-screen Text (User-Supplied Only) */}
                    {(scene.provided_visual_notes || scene.on_screen_text) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-1">
                        {scene.provided_visual_notes && (
                          <div className="p-2 bg-zinc-800/40 border border-zinc-800 rounded text-zinc-300">
                            <span className="text-zinc-500 font-mono block text-[10px] uppercase">
                              Provided Visual Notes:
                            </span>
                            {scene.provided_visual_notes}
                          </div>
                        )}
                        {scene.on_screen_text && (
                          <div className="p-2 bg-zinc-800/40 border border-zinc-800 rounded text-zinc-300">
                            <span className="text-zinc-500 font-mono block text-[10px] uppercase">
                              On-Screen Text:
                            </span>
                            {scene.on_screen_text}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CLAIMS & CODEX ALIGNMENT */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-xs text-zinc-400">
            <span className="text-emerald-400 font-medium">Deterministic Lexical Matching: </span>
            Extracted assertion candidates with exact character offsets. Matches are cross-referenced with active claims in your Brand Codex. Not formal legal advice.
          </div>

          {claims.length === 0 ? (
            <div className="p-8 text-center bg-zinc-900/50 border border-zinc-800 rounded-xl text-zinc-400 text-xs">
              No deterministic claim candidates identified in this asset.
            </div>
          ) : (
            <div className="space-y-3">
              {claims.map((claim: CreativeClaimRow) => (
                <div
                  key={claim.id}
                  className="p-4 bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 rounded-xl transition space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono uppercase bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                        {claim.claim_classification.replace('_', ' ')}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-mono ${
                          claim.brand_alignment_status === 'exact_brand_claim_match'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                            : claim.brand_alignment_status === 'possible_term_overlap'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {claim.brand_alignment_status.replace(/_/g, ' ')}
                      </span>
                      {claim.is_user_corrected && (
                        <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/40 px-1.5 py-0.5 rounded">
                          Edited by user
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-zinc-500">
                        offset: {claim.source_char_offset_start ?? 0}–{claim.source_char_offset_end ?? 0}
                      </span>
                      <button
                        onClick={() => openClaimModal(claim)}
                        className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded font-medium transition"
                      >
                        Edit Claim
                      </button>
                    </div>
                  </div>

                  <div className="text-sm text-zinc-100 font-medium">
                    &quot;{claim.claim_text}&quot;
                  </div>

                  {claim.source_excerpt && (
                    <div className="text-xs text-zinc-400 italic bg-zinc-950/60 p-2 rounded border border-zinc-800/50">
                      Context Excerpt: &quot;{claim.source_excerpt}&quot;
                    </div>
                  )}

                  {claim.proof_reference && (
                    <div className="text-xs text-zinc-400">
                      <span className="text-zinc-500 font-mono">Proof citation: </span>
                      {claim.proof_reference}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isFlagOn('claim_grounding_panel') && (
            <ClaimGroundingPanel workspaceId={workspaceId} twinId={twinId} claims={claims} brandClaims={brandClaims} userRole={userRole} />
          )}
        </div>
      )}

      {/* TAB 3: IMMUTABLE VERSION SNAPSHOTS */}
      {activeTab === 'versions' && (
        <div className="space-y-4">
          <div className="text-xs text-zinc-400">
            Immutable snapshot log enforced by database trigger. Each user correction records an atomic version.
          </div>

          <div className="space-y-3">
            {versions.map((ver: CreativeTwinVersionRow) => (
              <div
                key={ver.id}
                className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/50">
                      Version {ver.version_number}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {new Date(ver.created_at).toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">
                    ID: {ver.id.slice(0, 8)}...
                  </span>
                </div>
                <p className="text-xs text-zinc-200 font-mono">
                  {ver.change_summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: KNOWN GAPS & UNANALYZED DIMENSIONS */}
      {activeTab === 'gaps' && (
        <div className="space-y-4">
          <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-lg text-xs text-amber-300">
            The following creative dimensions are unobserved or unanalyzed in this deterministic text slice. No AI inference has been substituted.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {knownGaps.map((gap, i) => (
              <div
                key={i}
                className="p-3 bg-zinc-900/70 border border-zinc-800 rounded-lg text-xs text-zinc-300 flex items-start gap-2"
              >
                <span className="text-amber-500 font-mono">⚠</span>
                <div>
                  <span className="font-mono text-zinc-200 block">
                    {gap.replace(/_/g, ' ')}
                  </span>
                  <span className="text-zinc-500 text-[11px]">
                    Requires verified media upload, audience linkage, or campaign performance data.
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: TIMELINE DOCTOR */}
      {activeTab === 'doctor' && details && (
        <TimelineDoctor
          twin={details.twin}
          scenes={details.scenes}
          claims={details.claims}
          brandClaims={brandClaims}
          onOpenSceneEditor={(sceneId) => {
            const target = details.scenes.find((s) => s.id === sceneId);
            if (target) openSceneModal(target);
          }}
          onBack={() => setActiveTab('timeline')}
        />
      )}

      {/* MODAL: EDIT SCENE */}
      <Modal
        open={editingScene !== null}
        onClose={() => setEditingScene(null)}
        title={editingScene ? `Edit Scene ${editingScene.scene_index + 1}` : 'Edit Scene'}
        maxWidth={620}
      >
        {editingScene && (
            <form onSubmit={handleSaveScene} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">
                    Shot Purpose
                  </label>
                  <select
                    value={scenePurpose}
                    onChange={(e) => setScenePurpose(e.target.value as ShotPurpose)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="hook">Hook (Opening beat)</option>
                    <option value="problem_setup">Problem Setup</option>
                    <option value="product_demonstration">Product Demonstration</option>
                    <option value="proof_testimonial">Proof / Testimonial</option>
                    <option value="feature_breakdown">Feature Breakdown</option>
                    <option value="objection_handling">Objection Handling</option>
                    <option value="cta">Call to Action (CTA)</option>
                    <option value="transition">Transition</option>
                    <option value="other">Other / Uncategorized</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-mono text-zinc-400 mb-1">
                      Start (sec)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={sceneStartSeconds}
                      onChange={(e) => setSceneStartSeconds(e.target.value)}
                      placeholder="e.g. 0.0"
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-zinc-400 mb-1">
                      End (sec)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={sceneEndSeconds}
                      onChange={(e) => setSceneEndSeconds(e.target.value)}
                      placeholder="e.g. 4.0"
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  Spoken Transcript
                </label>
                <textarea
                  rows={3}
                  value={sceneTranscript}
                  onChange={(e) => setSceneTranscript(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                  placeholder="Enter verbatim spoken transcript..."
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  User-Provided Visual Notes (Optional)
                </label>
                <input
                  type="text"
                  value={sceneVisualNotes}
                  onChange={(e) => setSceneVisualNotes(e.target.value)}
                  placeholder="e.g. Screen recording of dashboard checkout flow"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  On-Screen Text (Optional)
                </label>
                <input
                  type="text"
                  value={sceneOnScreenText}
                  onChange={(e) => setSceneOnScreenText(e.target.value)}
                  placeholder="e.g. Try Risk-Free for 14 Days"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                <label className="block text-xs font-mono text-emerald-400 mb-1">
                  Version Change Summary (Required for Snapshot)
                </label>
                <input
                  type="text"
                  required
                  value={sceneChangeSummary}
                  onChange={(e) => setSceneChangeSummary(e.target.value)}
                  placeholder="e.g. Adjusted hook timecode and corrected spoken wording"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingScene(null)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingScene || !sceneChangeSummary.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-lg transition"
                >
                  {savingScene ? 'Saving...' : 'Save & Capture Version'}
                </button>
              </div>
            </form>
        )}
      </Modal>

      {/* MODAL: EDIT CLAIM */}
      <Modal
        open={editingClaim !== null}
        onClose={() => setEditingClaim(null)}
        title="Edit Extracted Claim"
        maxWidth={620}
      >
        {editingClaim && (
            <form onSubmit={handleSaveClaim} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  Claim Text
                </label>
                <input
                  type="text"
                  required
                  value={claimText}
                  onChange={(e) => setClaimText(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">
                    Classification
                  </label>
                  <select
                    value={claimClassification}
                    onChange={(e) => setClaimClassification(e.target.value as ClaimClassification)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="explicit_brand_promise">Explicit Brand Promise</option>
                    <option value="comparative_advantage">Comparative Advantage</option>
                    <option value="product_capability">Product Capability</option>
                    <option value="testimonial_endorsement">Testimonial Endorsement</option>
                    <option value="numeric_outcome">Numeric Outcome</option>
                    <option value="pricing_offer">Pricing Offer</option>
                    <option value="unverified_statement">Unverified Statement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">
                    Brand Alignment
                  </label>
                  <select
                    value={brandAlignment}
                    onChange={(e) => setBrandAlignment(e.target.value as BrandAlignmentStatus)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="exact_brand_claim_match">Exact Brand Claim Match</option>
                    <option value="possible_term_overlap">Possible Term Overlap</option>
                    <option value="no_brand_claim_match">No Brand Claim Match</option>
                    <option value="unassessed">Unassessed</option>
                  </select>
                </div>
              </div>

              {brandClaims && brandClaims.length > 0 && (
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">
                    Link to Brand Codex Claim
                  </label>
                  <select
                    value={selectedBrandClaimId}
                    onChange={(e) => {
                      setSelectedBrandClaimId(e.target.value);
                      const matched = brandClaims.find((c: BrandClaim) => c.id === e.target.value);
                      if (matched?.source_reference) {
                        setProofReference(matched.source_reference);
                      }
                    }}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- No linked brand claim --</option>
                    {brandClaims.map((bc: BrandClaim) => (
                      <option key={bc.id} value={bc.id}>
                        [{bc.review_status}] {bc.claim_text.slice(0, 60)}...
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  Proof Reference URL / Source
                </label>
                <input
                  type="text"
                  value={proofReference}
                  onChange={(e) => setProofReference(e.target.value)}
                  placeholder="e.g. https://audit.vanta.test/2026-report"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                <label className="block text-xs font-mono text-emerald-400 mb-1">
                  Version Change Summary (Required for Snapshot)
                </label>
                <input
                  type="text"
                  required
                  value={claimChangeSummary}
                  onChange={(e) => setClaimChangeSummary(e.target.value)}
                  placeholder="e.g. Linked claim to Brand Codex SOC-2 approved rule"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingClaim(null)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingClaim || !claimChangeSummary.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-lg transition"
                >
                  {savingClaim ? 'Saving...' : 'Save & Capture Version'}
                </button>
              </div>
            </form>
        )}
      </Modal>
    </div>
  );
};
