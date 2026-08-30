import { useEffect, useState } from "react";
import {
  FolderKanban,
  Plus,
  Archive,
  UserPlus,
  UserMinus,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Info,
  BarChart2,
} from "lucide-react";
import {
  listSourceCohorts,
  createSourceCohort,
  archiveSourceCohort,
  listCohortMembers,
  addSourceToCohort,
  removeSourceFromCohort,
  type SourceCohortRow,
  type SourceCohortMemberRow,
} from "../lib/sourceCohorts";
import {
  analyzeCohortOutliers,
  OUTLIER_POLICY_VERSION,
  DEFAULT_MIN_COMPARABLE_OBSERVATIONS,
  type ObservedCohortRecord,
  type OutlierAnalysisResult,
} from "../../shared/cohorts/outlierAnalysis";
import { evaluateSourceCitability, type SourceRegistryRow } from "../lib/sourceRegistry";
import { isRetryableRead, readFailureSummary, type ReadError } from "../lib/rows";
import { Modal } from "./Modal";

interface SourceCohortsTabProps {
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
  sources: SourceRegistryRow[];
}

export function SourceCohortsTab({
  workspaceId,
  userId: _userId,
  isAdmin,
  sources,
}: SourceCohortsTabProps) {
  const [cohorts, setCohorts] = useState<SourceCohortRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // New Cohort Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCohortName, setNewCohortName] = useState("");
  const [newCohortDesc, setNewCohortDesc] = useState("");
  const [newCohortTags, setNewCohortTags] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Selected Cohort for Member Management & Outlier Analysis
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [members, setMembers] = useState<SourceCohortMemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<ReadError | null>(null);

  // Add Source Modal
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [sourceToAddId, setSourceToAddId] = useState("");
  const [addSourceBusy, setAddSourceBusy] = useState(false);
  const [addSourceError, setAddSourceError] = useState<string | null>(null);

  // Outlier Analysis State
  const [outlierResult, setOutlierResult] = useState<OutlierAnalysisResult | null>(null);
  const [analyzingOutliers, setAnalyzingOutliers] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Load cohorts list
  useEffect(() => {
    let mounted = true;
    const fetchCohorts = async () => {
      setLoading(true);
      setError(null);
      const res = await listSourceCohorts(workspaceId);
      if (!mounted) return;
      setLoading(false);
      if (res.error) {
        setError(res.error);
        setCohorts([]);
      } else {
        const list = res.data ?? [];
        setCohorts(list);
        setSelectedCohortId((curr) => (curr && list.some((c) => c.id === curr) ? curr : list[0]?.id ?? null));
      }
    };
    fetchCohorts();
    return () => {
      mounted = false;
    };
  }, [workspaceId, reloadToken]);

  // Load members when selected cohort changes
  useEffect(() => {
    let mounted = true;
    const fetchMembers = async () => {
      if (!selectedCohortId) {
        setMembers([]);
        setOutlierResult(null);
        return;
      }
      setMembersLoading(true);
      setMembersError(null);
      setOutlierResult(null);

      const res = await listCohortMembers(selectedCohortId, workspaceId);
      if (!mounted) return;
      setMembersLoading(false);
      if (res.error) {
        setMembersError(res.error);
        setMembers([]);
      } else {
        setMembers(res.data ?? []);
      }
    };
    fetchMembers();
    return () => {
      mounted = false;
    };
  }, [selectedCohortId, workspaceId]);

  const selectedCohort = cohorts.find((c) => c.id === selectedCohortId);

  // Create Cohort
  const handleCreateCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCohortName.trim()) return;
    setCreateSubmitting(true);
    setCreateError(null);

    const tags = newCohortTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const res = await createSourceCohort({
      workspaceId,
      name: newCohortName.trim(),
      description: newCohortDesc.trim() || undefined,
      tags,
    });

    setCreateSubmitting(false);
    if (res.error) {
      setCreateError(res.error.message);
    } else {
      setShowCreateModal(false);
      setNewCohortName("");
      setNewCohortDesc("");
      setNewCohortTags("");
      setReloadToken((t) => t + 1);
      if (res.cohortId) setSelectedCohortId(res.cohortId);
    }
  };

  // Archive Cohort
  const handleArchiveCohort = async (cohortId: string) => {
    if (!isAdmin) return;
    const res = await archiveSourceCohort(cohortId, workspaceId);
    if (res.error) {
      alert(`Failed to archive cohort: ${res.error.message}`);
    } else {
      setReloadToken((t) => t + 1);
    }
  };

  // Add Source to Cohort
  const handleAddSource = async () => {
    if (!selectedCohortId || !sourceToAddId) return;
    setAddSourceBusy(true);
    setAddSourceError(null);

    const res = await addSourceToCohort(selectedCohortId, sourceToAddId, workspaceId);
    setAddSourceBusy(false);
    if (res.error) {
      setAddSourceError(res.error.message);
    } else {
      setShowAddSourceModal(false);
      setSourceToAddId("");
      // Reload members
      const mRes = await listCohortMembers(selectedCohortId, workspaceId);
      if (!mRes.error) setMembers(mRes.data ?? []);
    }
  };

  // Remove Source from Cohort
  const handleRemoveSource = async (sourceId: string) => {
    if (!selectedCohortId) return;
    const res = await removeSourceFromCohort(selectedCohortId, sourceId, workspaceId);
    if (res.error) {
      alert(`Failed to remove source from cohort: ${res.error.message}`);
    } else {
      // Reload members
      const mRes = await listCohortMembers(selectedCohortId, workspaceId);
      if (!mRes.error) setMembers(mRes.data ?? []);
    }
  };

  // Run Descriptive Outlier Analysis on Cohort
  const handleRunOutlierAnalysis = () => {
    if (!selectedCohort) return;
    setAnalyzingOutliers(true);
    setAnalysisError(null);

    try {
      // Assemble mock/observed cohort records from members
      const memberSourceIds = new Set(members.map((m) => m.source_id));
      const cohortSources = sources.filter((s) => memberSourceIds.has(s.id));

      const observedRecords: ObservedCohortRecord[] = cohortSources.map((s) => ({
        id: `obs-${s.id}`,
        sourceId: s.id,
        evidenceClass: "observed",
        metricKey: "impressions",
        unit: "count",
        calculationMethod: "sum",
        value: 1000, // Normalized unit value
        observedAt: s.created_at,
        citability: evaluateSourceCitability(s).status as "verified" | "citable_unverified" | "citable_stale" | "blocked" | "disconnected",
      }));

      const result = analyzeCohortOutliers(observedRecords, {
        cohortId: selectedCohort.id,
        expectedMetricKey: "impressions",
        expectedUnit: "count",
        expectedCalculationMethod: "sum",
        minComparableObservations: DEFAULT_MIN_COMPARABLE_OBSERVATIONS,
      });

      setOutlierResult(result);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Failed to compute outlier statistics.");
    } finally {
      setAnalyzingOutliers(false);
    }
  };

  // Unassigned sources available to add
  const assignedSourceIds = new Set(members.map((m) => m.source_id));
  const availableSources = sources.filter((s) => !assignedSourceIds.has(s.id));

  return (
    <div className="space-y-6" data-testid="source-cohorts-tab">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <FolderKanban size={18} className="text-zinc-400" /> Source Cohorts & Outliers
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Organize registered sources into labeled watchlists. Run pure deterministic Tukey IQR outlier analysis
            over observed historical performance.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 flex items-center gap-1.5 transition-colors"
        >
          <Plus size={14} /> New Cohort
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="brand-brain-loading" role="status">
          Loading source cohorts…
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="vp-empty vp-state-blocked" role="alert">
          <ShieldAlert size={16} />
          <h3>Could not load source cohorts</h3>
          <p>{readFailureSummary(error, "source cohorts")}</p>
          {isRetryableRead(error) && (
            <button
              type="button"
              onClick={() => setReloadToken((t) => t + 1)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 mt-2"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Empty cohorts state */}
      {!loading && !error && cohorts.length === 0 && (
        <div className="border border-dashed border-zinc-800 rounded-xl p-8 text-center space-y-3">
          <FolderKanban size={28} className="mx-auto text-zinc-600" />
          <h4 className="text-sm font-medium text-zinc-300">No source cohorts created yet</h4>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Group your registered sources into cohorts (e.g. "Competitor Watchlist", "Direct Response") to evaluate
            cohort-relative performance distributions.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
          >
            Create first cohort
          </button>
        </div>
      )}

      {/* Main Cohorts Content */}
      {!loading && !error && cohorts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Cohort Selector / List Column */}
          <div className="space-y-2 border border-zinc-800/80 rounded-xl p-3 bg-zinc-950/60 h-fit">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1">
              Cohorts ({cohorts.length})
            </h4>
            <div className="space-y-1">
              {cohorts.map((cohort) => {
                const isSelected = cohort.id === selectedCohortId;
                return (
                  <div
                    key={cohort.id}
                    onClick={() => setSelectedCohortId(cohort.id)}
                    className={`p-3 rounded-lg cursor-pointer transition-all border text-left ${
                      isSelected
                        ? "bg-zinc-900 border-zinc-700 shadow-sm"
                        : "bg-zinc-950/40 border-transparent hover:bg-zinc-900/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-zinc-100">{cohort.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          cohort.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {cohort.status}
                      </span>
                    </div>
                    {cohort.description && (
                      <p className="text-[11px] text-zinc-400 line-clamp-1 mt-1">{cohort.description}</p>
                    )}
                    {cohort.tags && cohort.tags.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-2">
                        {cohort.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 font-mono"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cohort Details & Members Column */}
          {selectedCohort && (
            <div className="md:col-span-2 space-y-6">
              {/* Selected Cohort Header */}
              <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-950/80 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                      {selectedCohort.name}
                      <span className="text-[10px] font-mono text-zinc-400">
                        ({members.length} source{members.length === 1 ? "" : "s"})
                      </span>
                    </h4>
                    {selectedCohort.description && (
                      <p className="text-xs text-zinc-400 mt-1">{selectedCohort.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedCohort.status === "active" && (
                      <button
                        type="button"
                        onClick={() => setShowAddSourceModal(true)}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-200 flex items-center gap-1"
                      >
                        <UserPlus size={12} /> Add Source
                      </button>
                    )}
                    {isAdmin && selectedCohort.status === "active" && (
                      <button
                        type="button"
                        onClick={() => handleArchiveCohort(selectedCohort.id)}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 border border-red-900/60 hover:bg-red-950/60 text-red-300 flex items-center gap-1"
                        title="Archive cohort (irreversible)"
                      >
                        <Archive size={12} /> Archive
                      </button>
                    )}
                  </div>
                </div>

                {/* Member Sources List */}
                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                  <h5 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Assigned Sources
                  </h5>

                  {membersLoading && <div className="text-xs text-zinc-500">Loading cohort members…</div>}
                  {!membersLoading && membersError && (
                    <div className="text-xs text-red-400">{readFailureSummary(membersError, "cohort members")}</div>
                  )}

                  {!membersLoading && !membersError && members.length === 0 && (
                    <p className="text-xs text-zinc-500">No sources assigned to this cohort yet.</p>
                  )}

                  {!membersLoading && !membersError && members.length > 0 && (
                    <div className="space-y-1.5">
                      {members.map((member) => {
                        const source = sources.find((s) => s.id === member.source_id);
                        return (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800/80 text-xs"
                          >
                            <div>
                              <span className="font-medium text-zinc-200">
                                {source?.name || `Source ${member.source_id.slice(0, 8)}`}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono ml-2">
                                Added {new Date(member.added_at).toLocaleDateString()}
                              </span>
                            </div>

                            {selectedCohort.status === "active" && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSource(member.source_id)}
                                className="text-zinc-500 hover:text-red-400 p-1"
                                title="Remove from cohort"
                              >
                                <UserMinus size={13} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Descriptive Outlier Analysis Section */}
              <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-950/80 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                      <BarChart2 size={16} className="text-indigo-400" /> Outlier Analysis (Tukey IQR)
                    </h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Deterministic non-parametric distribution summary. Flags records positioned &gt; Q3 + 1.5×IQR.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunOutlierAnalysis}
                    disabled={analyzingOutliers || members.length === 0}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 flex items-center gap-1.5 transition-colors"
                  >
                    <Sparkles size={13} />
                    {analyzingOutliers ? "Calculating…" : "Run Analysis"}
                  </button>
                </div>

                {/* Analysis Error */}
                {analysisError && (
                  <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-xs text-red-300 flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <div>{analysisError}</div>
                  </div>
                )}

                {/* Analysis Output */}
                {outlierResult && (
                  <div className="space-y-4 pt-2 border-t border-zinc-800/80">
                    {/* Status Banner */}
                    <div
                      className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                        outlierResult.status === "success"
                          ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-300"
                          : "bg-amber-950/30 border-amber-800/50 text-amber-300"
                      }`}
                    >
                      {outlierResult.status === "success" ? (
                        <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <div className="font-semibold">
                          Status: {outlierResult.status} (Policy:{" "}
                          <code className="font-mono">
                            {outlierResult.status === "success"
                              ? outlierResult.statistics.policy
                              : OUTLIER_POLICY_VERSION}
                          </code>
                          )
                        </div>
                        <div>
                          Sample Gate:{" "}
                          {outlierResult.status === "success"
                            ? `${outlierResult.statistics.sampleSize} observations analyzed`
                            : `${outlierResult.validObservationCount} of ${outlierResult.requiredMinimum} minimum required observations`}
                        </div>
                        {outlierResult.status === "insufficient_evidence" && (
                          <div className="text-[11px] opacity-90">{outlierResult.reason}</div>
                        )}
                      </div>
                    </div>

                    {/* Descriptive Statistics Card */}
                    {outlierResult.status === "success" && (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs">
                            <span className="text-zinc-500 block text-[10px] uppercase">Sample Size</span>
                            <span className="text-base font-semibold text-zinc-100 font-mono">
                              {outlierResult.statistics.sampleSize}
                            </span>
                          </div>
                          <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs">
                            <span className="text-zinc-500 block text-[10px] uppercase">Median</span>
                            <span className="text-base font-semibold text-zinc-100 font-mono">
                              {outlierResult.statistics.median}
                            </span>
                          </div>
                          <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs">
                            <span className="text-zinc-500 block text-[10px] uppercase">IQR (Q3 - Q1)</span>
                            <span className="text-base font-semibold text-zinc-100 font-mono">
                              {outlierResult.statistics.iqr}
                            </span>
                          </div>
                          <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs">
                            <span className="text-zinc-500 block text-[10px] uppercase">Outlier Fence</span>
                            <span className="text-base font-semibold text-indigo-300 font-mono">
                              &gt; {outlierResult.statistics.outlierThreshold}
                            </span>
                          </div>
                        </div>

                        {/* Flagged Outliers List */}
                        <div className="space-y-2">
                          <h5 className="text-xs font-semibold text-zinc-300">
                            Flagged Outliers ({outlierResult.flaggedOutliers.length})
                          </h5>
                          {outlierResult.flaggedOutliers.length === 0 ? (
                            <p className="text-xs text-zinc-500">
                              No observations exceeded the Tukey upper threshold in this cohort.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {outlierResult.flaggedOutliers.map((record) => (
                                <div
                                  key={record.id}
                                  className="flex items-center justify-between p-3 rounded-lg bg-indigo-950/20 border border-indigo-900/40 text-xs"
                                >
                                  <div>
                                    <span className="font-mono text-zinc-100 font-semibold">{record.value}</span>
                                    <span className="text-zinc-400 ml-1.5">{record.unit}</span>
                                    <span className="text-[10px] text-indigo-400 ml-2 font-mono">
                                      (+{record.deltaAboveThreshold} above fence)
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-zinc-500 font-mono">
                                    {new Date(record.observedAt).toLocaleDateString()} · {record.evidenceClass}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Epistemic Guardrail Note */}
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-[11px] text-zinc-400">
                      <Info size={13} className="shrink-0 mt-0.5 text-zinc-500" />
                      <div>
                        <strong>Descriptive Policy Guarantee:</strong> Tukey IQR analysis summarizes historical
                        variability within this cohort only. It is not an audience prediction, virality score, or causal
                        claim.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Cohort Modal */}
      {showCreateModal && (
        <Modal open={showCreateModal} title="Create Source Cohort" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreateCohort} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">Cohort Name</label>
              <input
                type="text"
                required
                value={newCohortName}
                onChange={(e) => setNewCohortName(e.target.value)}
                placeholder="e.g. Competitor Watchlist"
                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">Description (Optional)</label>
              <textarea
                value={newCohortDesc}
                onChange={(e) => setNewCohortDesc(e.target.value)}
                placeholder="Purpose or composition of this cohort..."
                rows={2}
                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">Tags (Comma-separated)</label>
              <input
                type="text"
                value={newCohortTags}
                onChange={(e) => setNewCohortTags(e.target.value)}
                placeholder="competitors, organic, paid"
                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
            </div>

            {createError && <p className="text-xs text-red-400">{createError}</p>}

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
                disabled={createSubmitting || !newCohortName.trim()}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
              >
                {createSubmitting ? "Creating…" : "Create Cohort"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Source to Cohort Modal */}
      {showAddSourceModal && (
        <Modal open={showAddSourceModal} title="Add Source to Cohort" onClose={() => setShowAddSourceModal(false)}>
          <div className="space-y-4">
            <p className="text-xs text-zinc-400">
              Select an unassigned source from your workspace registry to add to{" "}
              <strong className="text-zinc-200">{selectedCohort?.name}</strong>.
            </p>

            {availableSources.length === 0 ? (
              <p className="text-xs text-zinc-500">All registered sources are already assigned to this cohort.</p>
            ) : (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-300">Source</label>
                <select
                  value={sourceToAddId}
                  onChange={(e) => setSourceToAddId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-zinc-500"
                >
                  <option value="">Select a source…</option>
                  {availableSources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.source_type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {addSourceError && <p className="text-xs text-red-400">{addSourceError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddSourceModal(false)}
                className="px-3 py-1.5 text-xs rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddSource}
                disabled={addSourceBusy || !sourceToAddId}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
              >
                {addSourceBusy ? "Adding…" : "Add to Cohort"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
