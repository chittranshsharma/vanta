import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Database,
  ExternalLink,
  HelpCircle,
  Info,
  Link2,
  Plus,
  Radio,
  ShieldAlert,
  Tag,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { EvidenceClass } from "../lib/evidence";
import { isRetryableRead, readFailureSummary, type ReadError } from "../lib/rows";
import {
  fetchSourcesForWorkspace,
  fetchEvidenceItems,
  fetchMetricDefinitions,
  insertSource,
  updateSourceStatus,
  insertEvidenceItem,
  insertMetricDefinition,
  evaluateSourceCitability,
  type SourceRegistryRow,
  type EvidenceItemRow,
  type MetricDefinitionRow,
  type AllowedUserSourceStatus
} from "../lib/sourceRegistry";

type RegistryTab = "sources" | "evidence" | "metrics";

interface SourceRegistryProps {
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
}

const EVIDENCE_CLASS_CONFIG: Record<
  EvidenceClass,
  { label: string; color: string; desc: string }
> = {
  observed: {
    label: "Observed",
    color: "class-observed",
    desc: "Directly measured or exported metric from an authorized platform."
  },
  sourced_claim: {
    label: "Sourced Claim",
    color: "class-sourced",
    desc: "Stated fact or benchmark backed by an explicit external citation."
  },
  inference: {
    label: "Inference",
    color: "class-inference",
    desc: "Derived analytical conclusion or calculated relationship."
  },
  simulation: {
    label: "Simulation",
    color: "class-simulation",
    desc: "Model-generated or synthetic estimate; strictly directional."
  },
  unknown: {
    label: "Unknown",
    color: "class-unknown",
    desc: "Unclassified evidence; requires manual review."
  }
};

const HEALTH_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; Icon: typeof CheckCircle2 }
> = {
  connected: { label: "Connected (Verified)", color: "health-connected", Icon: CheckCircle2 },
  unverified: { label: "Unverified (Manual)", color: "health-unverified", Icon: HelpCircle },
  stale: { label: "Stale (Expired)", color: "health-stale", Icon: AlertTriangle },
  disconnected: { label: "Disconnected", color: "health-disconnected", Icon: XCircle }
};

export function SourceRegistry({ workspaceId, userId, isAdmin }: SourceRegistryProps) {
  const [tab, setTab] = useState<RegistryTab>("sources");
  const [sources, setSources] = useState<SourceRegistryRow[]>([]);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItemRow[]>([]);
  const [metricDefs, setMetricDefs] = useState<MetricDefinitionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadError | null>(null);

  // Forms
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [showMetricForm, setShowMetricForm] = useState(false);

  const [reloadToken, setReloadToken] = useState(0);

  // Initial load runs with loading=true from state init; reload() is for user-triggered refreshes.
  const reload = () => {
    setLoading(true);
    setError(null);
    setReloadToken((t) => t + 1);
  };

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [s, e, m] = await Promise.all([
          fetchSourcesForWorkspace(workspaceId),
          fetchEvidenceItems(workspaceId),
          fetchMetricDefinitions(workspaceId)
        ]);
        // The registry is read as one evidence posture. Showing sources while the
        // evidence read failed would put a citability decision in front of the
        // user on coverage that was never read, so one failed part fails the
        // panel. Each read is checked directly so its success arm narrows.
        if (s.error || e.error || m.error) {
          setError(s.error ?? e.error ?? m.error);
          return;
        }
        setSources(s.data);
        setEvidenceItems(e.data);
        setMetricDefs(m.data);
      } catch (err: unknown) {
        setError({ failure: "failed", message: err instanceof Error ? err.message : "Failed to load source registry." });
      } finally {
        setLoading(false);
      }
    };
    void loadAll();
  }, [workspaceId, reloadToken]);

  if (loading) {
    return (
      <div className="brand-brain-loading">
        <div className="bb-spinner" />
        <span>Loading Evidence Layer & Source Registry…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bb-error-state" role="alert">
        <ShieldAlert size={20} color="#f87171" />
        <div>
          <p>{readFailureSummary(error, "the source registry")}</p>
          <p className="vp-hint">
            Nothing was written. Sources, evidence and metrics are not shown as empty, because they were not read.
          </p>
          {isRetryableRead(error) && (
            <button type="button" className="ghost-button-sm" onClick={reload}>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="brand-brain-shell">
      {/* Header */}
      <div className="bb-header">
        <div className="bb-header-left">
          <div className="bb-icon-wrap" style={{ background: "rgba(133,199,233,.12)", borderColor: "rgba(133,199,233,.3)", color: "#85c7e9" }}>
            <Compass size={18} />
          </div>
          <div>
            <h2 className="bb-title">Source Registry & Evidence Layer</h2>
            <p className="bb-subtitle">
              {sources.length} source{sources.length !== 1 ? "s" : ""} · {evidenceItems.length} evidence assertion{evidenceItems.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bb-tabs">
        <button
          className={`bb-tab ${tab === "sources" ? "active" : ""}`}
          onClick={() => setTab("sources")}
        >
          <Radio size={13} />
          Sources
          {sources.length > 0 && <span className="bb-count">{sources.length}</span>}
        </button>
        <button
          className={`bb-tab ${tab === "evidence" ? "active" : ""}`}
          onClick={() => setTab("evidence")}
        >
          <Database size={13} />
          Evidence Items
          {evidenceItems.length > 0 && <span className="bb-count">{evidenceItems.length}</span>}
        </button>
        <button
          className={`bb-tab ${tab === "metrics" ? "active" : ""}`}
          onClick={() => setTab("metrics")}
        >
          <Tag size={13} />
          Metric Definitions
          {metricDefs.length > 0 && <span className="bb-count">{metricDefs.length}</span>}
        </button>
      </div>

      {/* Content */}
      <div className="bb-content">
        {tab === "sources" && (
          <SourcesTab
            workspaceId={workspaceId}
            userId={userId}
            isAdmin={isAdmin}
            sources={sources}
            showForm={showSourceForm}
            setShowForm={setShowSourceForm}
            onSourceAdded={(src) => setSources((prev) => [src, ...prev])}
            onStatusChanged={(id, newStatus) => {
              setSources((prev) =>
                prev.map((s) => (s.id === id ? { ...s, health_status: newStatus } : s))
              );
            }}
          />
        )}

        {tab === "evidence" && (
          <EvidenceItemsTab
            workspaceId={workspaceId}
            userId={userId}
            isAdmin={isAdmin}
            sources={sources}
            evidenceItems={evidenceItems}
            showForm={showEvidenceForm}
            setShowForm={setShowEvidenceForm}
            onItemAdded={(item) => setEvidenceItems((prev) => [item, ...prev])}
          />
        )}

        {tab === "metrics" && (
          <MetricDefinitionsTab
            workspaceId={workspaceId}
            userId={userId}
            isAdmin={isAdmin}
            sources={sources}
            metricDefs={metricDefs}
            showForm={showMetricForm}
            setShowForm={setShowMetricForm}
            onDefAdded={(def) => setMetricDefs((prev) => [...prev, def])}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// 1. SOURCES TAB
// ============================================================

function SourcesTab({
  workspaceId,
  userId,
  isAdmin,
  sources,
  showForm,
  setShowForm,
  onSourceAdded,
  onStatusChanged
}: {
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
  sources: SourceRegistryRow[];
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  onSourceAdded: (src: SourceRegistryRow) => void;
  onStatusChanged: (id: string, newStatus: string) => void;
}) {
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<"url" | "manual">("url");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [freshnessDays, setFreshnessDays] = useState(30);
  const [coverage, setCoverage] = useState<"complete" | "partial" | "unknown">("partial");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    const { source, error } = await insertSource(
      {
        workspace_id: workspaceId,
        name: name.trim(),
        source_type: sourceType,
        url: url.trim() || null,
        description: description.trim() || null,
        freshness_window_days: freshnessDays,
        source_coverage: coverage,
        notes: notes.trim() || null,
        health_status: "unverified" // Default for all user-added sources
      },
      userId
    );
    setSaving(false);
    setFormError(error ? error.message : null);

    if (source) {
      onSourceAdded(source);
      setShowForm(false);
      setName("");
      setUrl("");
      setDescription("");
      setNotes("");
    }
  };

  const handleUpdateStatus = async (sourceId: string, newStatus: AllowedUserSourceStatus) => {
    setStatusUpdating(sourceId);
    const { source, error } = await updateSourceStatus(sourceId, workspaceId, newStatus, userId);
    setStatusUpdating(null);
    setFormError(error ? error.message : null);
    if (source) {
      onStatusChanged(sourceId, newStatus);
    }
  };

  return (
    <div className="bb-positioning">
      <div className="bb-section-header">
        <div className="bb-filter-row">
          <span className="bb-section-count">
            {sources.length} registered source{sources.length !== 1 ? "s" : ""}
          </span>
        </div>
        {isAdmin && (
          <button className="ghost-button-sm" onClick={() => setShowForm(!showForm)}>
            <Plus size={13} /> Add source
          </button>
        )}
      </div>
      {formError && !showForm && <p className="error-text" role="alert">{formError}</p>}

      <AnimatePresence>
        {showForm && (
          <motion.form
            className="bb-form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onSubmit={handleCreate}
           aria-describedby="source-form-error-1" aria-busy={saving}>
            <div className="bb-form-notice">
              <Info size={13} /> All user-added sources register as <strong>unverified</strong> by default.
              Manual sources provide qualitative grounding but cannot back verified numeric claims without authorized platform verification.
            </div>

            <label className="bb-label">
              Source name *
              <input
                type="text"
                className="bb-input"
                required
                placeholder="e.g. Q3 Campaign Performance Report or Meta Ads Dashboard"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="bb-label">
                Source type *
                <select
                  className="bb-select"
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as "url" | "manual")}
                >
                  <option value="url">URL Link / Documentation</option>
                  <option value="manual">Manual / Internal Reference</option>
                </select>
              </label>

              <label className="bb-label">
                Coverage assessment
                <select
                  className="bb-select"
                  value={coverage}
                  onChange={(e) => setCoverage(e.target.value as "complete" | "partial" | "unknown")}
                >
                  <option value="complete">Complete (Full account / date range)</option>
                  <option value="partial">Partial (Selective sample or excerpt)</option>
                  <option value="unknown">Unknown / Unspecified</option>
                </select>
              </label>
            </div>

            {sourceType === "url" && (
              <label className="bb-label">
                Source URL
                <input
                  type="url"
                  className="bb-input"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </label>
            )}

            <label className="bb-label">
              Description
              <textarea
                className="bb-textarea"
                rows={2}
                placeholder="What data or observations does this source contain?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <label className="bb-label">
              Freshness window (days)
              <span className="bb-hint">Number of days this source remains fresh before re-verification is required.</span>
              <input
                type="number"
                className="bb-input"
                min={1}
                max={365}
                value={freshnessDays}
                onChange={(e) => setFreshnessDays(parseInt(e.target.value) || 30)}
              />
            </label>

            <div className="bb-form-actions">
              {formError && <p id="source-form-error-1" className="error-text" role="alert">{formError}</p>}
              <button type="submit" className="primary-button" disabled={saving || !name.trim()}>
                {saving ? "Registering…" : "Register Source"}
              </button>
              <button type="button" className="ghost-button-sm" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {sources.length === 0 ? (
        <div className="bb-empty">
          <Radio size={22} />
          <h3>No registered sources</h3>
          <p>
            Connect or register authorized sources to ground your creative decisions.
            Uncited assertions cannot pass evidence verification.
          </p>
          {isAdmin && (
            <button className="primary-button" onClick={() => setShowForm(true)}>
              <Plus size={15} /> Register first source
            </button>
          )}
        </div>
      ) : (
        <div className="bb-list">
          {sources.map((src) => {
            const citability = evaluateSourceCitability(src);
            const healthCfg = HEALTH_STATUS_CONFIG[src.health_status] || HEALTH_STATUS_CONFIG.unverified;
            const HealthIcon = healthCfg.Icon;

            return (
              <div key={src.id} className="bb-audience-row" style={{ padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontSize: 14, color: "#eef2f5" }}>{src.name}</strong>
                      {src.url && (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#85c7e9", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11 }}
                        >
                          <ExternalLink size={11} /> URL
                        </a>
                      )}
                    </div>
                    {src.description && (
                      <p style={{ margin: 0, fontSize: 12, color: "#8e9ba9", lineHeight: 1.45 }}>
                        {src.description}
                      </p>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <div className={`bb-status-pill ${src.health_status === "connected" ? "status-approved" : src.health_status === "stale" ? "status-in_review" : "status-draft"}`} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <HealthIcon size={10} />
                      <span>{healthCfg.label}</span>
                    </div>

                    <div style={{ fontSize: 10, fontFamily: "DM Mono, monospace", color: citability.status === "verified" ? "#6ee7b7" : citability.status === "blocked" ? "#f87171" : "#fbbf24" }}>
                      {citability.status === "verified" && "✓ Verified"}
                      {citability.status === "citable_unverified" && "⚠ Citable (Unverified)"}
                      {citability.status === "citable_stale" && "⚠ Citable (Stale)"}
                      {citability.status === "blocked" && "✕ Blocked"}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#667280" }}>
                  <div style={{ display: "flex", gap: 14 }}>
                    <span>Type: <strong>{src.source_type}</strong></span>
                    <span>Coverage: <strong>{src.source_coverage}</strong></span>
                    <span>Freshness: <strong>{src.freshness_window_days}d window</strong></span>
                  </div>

                  {isAdmin && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontFamily: "DM Mono, monospace" }}>Set Status:</span>
                      {(["unverified", "stale", "disconnected"] as AllowedUserSourceStatus[]).map((st) => (
                        <button
                          key={st}
                          disabled={src.health_status === st || statusUpdating === src.id}
                          className="bb-filter-btn"
                          style={{
                            padding: "2px 8px",
                            fontSize: 10,
                            opacity: src.health_status === st ? 0.4 : 1
                          }}
                          onClick={() => handleUpdateStatus(src.id, st)}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 2. EVIDENCE ITEMS TAB
// ============================================================

function EvidenceItemsTab({
  workspaceId,
  userId,
  isAdmin,
  sources,
  evidenceItems,
  showForm,
  setShowForm,
  onItemAdded
}: {
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
  sources: SourceRegistryRow[];
  evidenceItems: EvidenceItemRow[];
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  onItemAdded: (item: EvidenceItemRow) => void;
}) {
  const [selectedSourceId, setSelectedSourceId] = useState<string>(sources[0]?.id || "");
  const [evidenceClass, setEvidenceClass] = useState<EvidenceClass>("sourced_claim");
  const [claimText, setClaimText] = useState("");
  const [metricKey, setMetricKey] = useState("");
  const [metricValue, setMetricValue] = useState("");
  const [metricUnit, setMetricUnit] = useState("");
  const [metricDef, setMetricDef] = useState("");
  const [timeWindow, setTimeWindow] = useState("");
  const [completeness, setCompleteness] = useState<"complete" | "partial" | "unknown">("partial");
  const [citationUrl, setCitationUrl] = useState("");
  const [filterClass, setFilterClass] = useState<EvidenceClass | "all">("all");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = filterClass === "all"
    ? evidenceItems
    : evidenceItems.filter((item) => item.evidence_class === filterClass);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimText.trim() || !selectedSourceId) return;
    setSaving(true);

    const valNum = metricValue.trim() ? parseFloat(metricValue.trim()) : null;

    const { item, error } = await insertEvidenceItem(
      {
        workspace_id: workspaceId,
        source_id: selectedSourceId,
        evidence_class: evidenceClass,
        claim_text: claimText.trim(),
        metric_key: metricKey.trim() || null,
        metric_value: Number.isFinite(valNum) ? valNum : null,
        metric_unit: metricUnit.trim() || null,
        metric_definition: metricDef.trim() || null,
        time_window: timeWindow.trim() || null,
        completeness: completeness,
        citation_url: citationUrl.trim() || null
      },
      userId
    );
    setSaving(false);
    setFormError(error ? error.message : null);

    if (item) {
      onItemAdded(item);
      setShowForm(false);
      setClaimText("");
      setMetricKey("");
      setMetricValue("");
      setMetricUnit("");
      setMetricDef("");
      setTimeWindow("");
      setCitationUrl("");
    }
  };

  return (
    <div className="bb-claims">
      {/* Evidence Class Legend */}
      <div style={{ background: "rgba(0,0,0,.2)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontFamily: "DM Mono, monospace", textTransform: "uppercase", letterSpacing: ".1em", color: "#85c7e9", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <Info size={12} /> Five-Class Evidence Standard
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          {(Object.keys(EVIDENCE_CLASS_CONFIG) as EvidenceClass[]).map((cls) => {
            const cfg = EVIDENCE_CLASS_CONFIG[cls];
            return (
              <div key={cls} style={{ fontSize: 11 }}>
                <span className={`bb-status-pill ${cls === "observed" ? "status-approved" : cls === "sourced_claim" ? "status-in_review" : "status-draft"}`} style={{ marginRight: 6 }}>
                  {cfg.label}
                </span>
                <span style={{ color: "#778392", fontSize: 10 }}>{cfg.desc}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bb-section-header">
        <div className="bb-filter-row">
          <button
            className={`bb-filter-btn ${filterClass === "all" ? "active" : ""}`}
            onClick={() => setFilterClass("all")}
          >
            All ({evidenceItems.length})
          </button>
          {(Object.keys(EVIDENCE_CLASS_CONFIG) as EvidenceClass[]).map((cls) => (
            <button
              key={cls}
              className={`bb-filter-btn ${filterClass === cls ? "active" : ""}`}
              onClick={() => setFilterClass(cls)}
            >
              {EVIDENCE_CLASS_CONFIG[cls].label}
              <span className="bb-count">
                {evidenceItems.filter((i) => i.evidence_class === cls).length}
              </span>
            </button>
          ))}
        </div>
        {isAdmin && sources.length > 0 && (
          <button className="ghost-button-sm" onClick={() => setShowForm(!showForm)}>
            <Plus size={13} /> Add assertion
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            className="bb-form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onSubmit={handleCreate}
           aria-describedby="source-form-error-2" aria-busy={saving}>
            <div className="bb-form-notice">
              <Info size={13} /> Every evidence item must bind to an existing registered source in this workspace. Composite foreign key ensures cross-workspace consistency.
            </div>

            <label className="bb-label">
              Backing source *
              <select
                className="bb-select"
                required
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.health_status})
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="bb-label">
                Evidence class *
                <select
                  className="bb-select"
                  value={evidenceClass}
                  onChange={(e) => setEvidenceClass(e.target.value as EvidenceClass)}
                >
                  <option value="observed">Observed (Platform measurement)</option>
                  <option value="sourced_claim">Sourced Claim (External citation)</option>
                  <option value="inference">Inference (Analytical derivation)</option>
                  <option value="simulation">Simulation (Synthetic / directional)</option>
                  <option value="unknown">Unknown (Unreviewed)</option>
                </select>
              </label>

              <label className="bb-label">
                Completeness *
                <select
                  className="bb-select"
                  value={completeness}
                  onChange={(e) => setCompleteness(e.target.value as "complete" | "partial" | "unknown")}
                >
                  <option value="complete">Complete (Full data window & sample)</option>
                  <option value="partial">Partial (Selective segment)</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
            </div>

            <label className="bb-label">
              Claim / Assertion text *
              <textarea
                className="bb-textarea"
                rows={2}
                required
                placeholder="e.g. 3-second hook retention averaged 48% across top 5 variants."
                value={claimText}
                onChange={(e) => setClaimText(e.target.value)}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <label className="bb-label">
                Metric key (optional)
                <input
                  type="text"
                  className="bb-input"
                  placeholder="e.g. hook_rate"
                  value={metricKey}
                  onChange={(e) => setMetricKey(e.target.value)}
                />
              </label>

              <label className="bb-label">
                Metric numeric value
                <input
                  type="number"
                  step="any"
                  className="bb-input"
                  placeholder="e.g. 0.48"
                  value={metricValue}
                  onChange={(e) => setMetricValue(e.target.value)}
                />
              </label>

              <label className="bb-label">
                Metric unit
                <input
                  type="text"
                  className="bb-input"
                  placeholder="e.g. % or seconds"
                  value={metricUnit}
                  onChange={(e) => setMetricUnit(e.target.value)}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="bb-label">
                Measurement time window
                <input
                  type="text"
                  className="bb-input"
                  placeholder="e.g. 2026-08-01 to 2026-08-15"
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(e.target.value)}
                />
              </label>

              <label className="bb-label">
                Citation URL (optional)
                <input
                  type="url"
                  className="bb-input"
                  placeholder="https://..."
                  value={citationUrl}
                  onChange={(e) => setCitationUrl(e.target.value)}
                />
              </label>
            </div>

            <div className="bb-form-actions">
              {formError && <p id="source-form-error-2" className="error-text" role="alert">{formError}</p>}
              <button type="submit" className="primary-button" disabled={saving || !claimText.trim() || !selectedSourceId}>
                {saving ? "Saving…" : "Add Evidence Item"}
              </button>
              <button type="button" className="ghost-button-sm" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {sources.length === 0 ? (
        <div className="bb-empty">
          <Info size={20} />
          <p>You must register at least one source before adding evidence items.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bb-empty">
          <Database size={20} />
          <p>No evidence items found. Add assertions backed by registered sources.</p>
        </div>
      ) : (
        <div className="bb-list">
          {filtered.map((item) => {
            const backingSource = sources.find((s) => s.id === item.source_id);
            const citability = evaluateSourceCitability(backingSource || null);
            const cfg = EVIDENCE_CLASS_CONFIG[item.evidence_class as EvidenceClass] || EVIDENCE_CLASS_CONFIG.unknown;

            return (
              <div key={item.id} className="bb-claim-row" style={{ gridTemplateColumns: "120px 1fr auto" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className={`bb-status-pill ${item.evidence_class === "observed" ? "status-approved" : item.evidence_class === "sourced_claim" ? "status-in_review" : "status-draft"}`}>
                    {cfg.label}
                  </span>
                  <span style={{ fontSize: 9, fontFamily: "DM Mono, monospace", color: "#667280" }}>
                    {item.completeness}
                  </span>
                </div>

                <div className="bb-claim-body">
                  <p className="bb-claim-text">{item.claim_text}</p>
                  {item.metric_key && item.metric_value !== null && (
                    <div style={{ display: "inline-flex", gap: 8, marginTop: 6, padding: "2px 8px", background: "rgba(133,199,233,.08)", border: "1px solid rgba(133,199,233,.2)", borderRadius: 4, fontSize: 11, fontFamily: "DM Mono, monospace", color: "#85c7e9" }}>
                      <span>{item.metric_key}:</span>
                      <strong>{item.metric_value} {item.metric_unit || ""}</strong>
                      {item.time_window && <span style={{ color: "#667280" }}>({item.time_window})</span>}
                    </div>
                  )}
                  {backingSource && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "#6e7b8b", display: "flex", alignItems: "center", gap: 6 }}>
                      <Link2 size={11} /> Source: <strong>{backingSource.name}</strong>
                      <span style={{ color: citability.status === "verified" ? "#6ee7b7" : "#fbbf24", fontSize: 10 }}>
                        ({citability.status})
                      </span>
                    </div>
                  )}
                </div>

                <div className="bb-claim-meta">
                  {item.citation_url && (
                    <a href={item.citation_url} target="_blank" rel="noopener noreferrer" style={{ color: "#85c7e9" }}>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 3. METRIC DEFINITIONS TAB
// ============================================================

function MetricDefinitionsTab({
  workspaceId,
  userId,
  isAdmin,
  sources,
  metricDefs,
  showForm,
  setShowForm,
  onDefAdded
}: {
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
  sources: SourceRegistryRow[];
  metricDefs: MetricDefinitionRow[];
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  onDefAdded: (def: MetricDefinitionRow) => void;
}) {
  const [metricKey, setMetricKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [unit, setUnit] = useState("");
  const [definition, setDefinition] = useState("");
  const [method, setMethod] = useState("");
  const [sourceId, setSourceId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metricKey.trim() || !displayName.trim() || !definition.trim()) return;
    setSaving(true);

    const { definition: def, error } = await insertMetricDefinition(
      {
        workspace_id: workspaceId,
        metric_key: metricKey.trim().toLowerCase().replace(/\s+/g, "_"),
        display_name: displayName.trim(),
        unit: unit.trim() || null,
        definition: definition.trim(),
        measurement_method: method.trim() || null,
        source_id: sourceId || null
      },
      userId
    );
    setSaving(false);
    setFormError(error ? error.message : null);

    if (def) {
      onDefAdded(def);
      setShowForm(false);
      setMetricKey("");
      setDisplayName("");
      setUnit("");
      setDefinition("");
      setMethod("");
      setSourceId("");
    }
  };

  return (
    <div className="bb-audiences">
      <div className="bb-section-header">
        <span className="bb-section-count">
          {metricDefs.length} canonical definition{metricDefs.length !== 1 ? "s" : ""}
        </span>
        {isAdmin && (
          <button className="ghost-button-sm" onClick={() => setShowForm(!showForm)}>
            <Plus size={13} /> Add metric definition
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            className="bb-form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onSubmit={handleCreate}
           aria-describedby="source-form-error-3" aria-busy={saving}>
            <div className="bb-form-notice">
              <Info size={13} /> Canonical metric definitions ensure every agent, report, and decision room metric has a clear, unambiguous definition across the workspace.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="bb-label">
                Metric key * (identifier)
                <input
                  type="text"
                  className="bb-input"
                  required
                  placeholder="e.g. hook_retention_rate"
                  value={metricKey}
                  onChange={(e) => setMetricKey(e.target.value)}
                />
              </label>

              <label className="bb-label">
                Display name *
                <input
                  type="text"
                  className="bb-input"
                  required
                  placeholder="e.g. 3-Second Hook Retention"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="bb-label">
                Unit
                <input
                  type="text"
                  className="bb-input"
                  placeholder="e.g. % or seconds or ratio"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </label>

              <label className="bb-label">
                Governing source (optional)
                <select
                  className="bb-select"
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                >
                  <option value="">None / Workspace Internal</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="bb-label">
              Canonical definition *
              <textarea
                className="bb-textarea"
                rows={2}
                required
                placeholder="Exact mathematical or operational definition of this metric."
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
              />
            </label>

            <label className="bb-label">
              Measurement method
              <textarea
                className="bb-textarea"
                rows={2}
                placeholder="How is this metric calculated or sampled?"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              />
            </label>

            <div className="bb-form-actions">
              {formError && <p id="source-form-error-3" className="error-text" role="alert">{formError}</p>}
              <button type="submit" className="primary-button" disabled={saving || !metricKey.trim() || !definition.trim()}>
                {saving ? "Saving…" : "Save Definition"}
              </button>
              <button type="button" className="ghost-button-sm" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {metricDefs.length === 0 ? (
        <div className="bb-empty">
          <Tag size={20} />
          <p>No canonical metric definitions yet. Standardize definitions so that numbers are never misinterpreted.</p>
        </div>
      ) : (
        <div className="bb-list">
          {metricDefs.map((def) => (
            <div key={def.id} className="bb-audience-row" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div>
                  <strong style={{ fontSize: 13, color: "#eef2f5" }}>{def.display_name}</strong>
                  <code style={{ marginLeft: 8, fontSize: 11, color: "#85c7e9", background: "rgba(133,199,233,.1)", padding: "1px 6px", borderRadius: 4 }}>
                    {def.metric_key}
                  </code>
                </div>
                {def.unit && (
                  <span className="bb-status-pill status-draft">Unit: {def.unit}</span>
                )}
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8b98a7", lineHeight: 1.45 }}>
                {def.definition}
              </p>
              {def.measurement_method && (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#5d6978", fontStyle: "italic" }}>
                  Method: {def.measurement_method}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
