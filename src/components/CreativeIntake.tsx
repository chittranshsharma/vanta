import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileCode,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Layers3,
  Link2,
  Lock,
  Plus,
  ShieldAlert,
  Sparkles,
  UploadCloud,
  Zap
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  fetchWorkspaceAssets,
  fetchWorkspaceTwins,
  ingestManualTextAsset,
  ingestFileAsset,
  validateDeclaredFileMetadata,
  type CreativeAssetRow,
  type CreativeTwinRow,
  type AssetKind
} from "../lib/creativeIntake";
import { initializeStructuredTwin } from "../lib/creativeTwin";
import { MediaReadiness } from "./MediaReadiness";
import { Modal } from "./Modal";

interface CreativeIntakeProps {
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
  onOpenTwin?: (twinId: string) => void;
}

const ASSET_KIND_LABELS: Record<AssetKind, { label: string; icon: typeof FileText }> = {
  script: { label: "Ad Script", icon: FileText },
  hook: { label: "Hook Variant", icon: Zap },
  caption: { label: "Social Caption", icon: FileText },
  cta: { label: "Call-to-Action", icon: ArrowRight },
  landing_page_copy: { label: "Landing Page Copy", icon: FileCode },
  thumbnail: { label: "Thumbnail Image", icon: ImageIcon },
  short_video_metadata: { label: "Short Video Metadata", icon: FileText },
  campaign_csv: { label: "Campaign CSV (Headers only)", icon: FileSpreadsheet },
  other: { label: "Other Asset", icon: Database }
};

export function CreativeIntake({ workspaceId, userId, onOpenTwin }: CreativeIntakeProps) {
  const [assets, setAssets] = useState<CreativeAssetRow[]>([]);
  const [twins, setTwins] = useState<CreativeTwinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [intakeMethod, setIntakeMethod] = useState<"manual" | "file">("manual");
  const [title, setTitle] = useState("");
  const [assetKind, setAssetKind] = useState<AssetKind>("script");
  const [declaredPlatform, setDeclaredPlatform] = useState("");
  const [declaredObjective, setDeclaredObjective] = useState("");
  const [manualText, setManualText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileValidationErr, setFileValidationErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Detail inspection state
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const [reloadToken, setReloadToken] = useState(0);

  // Initial load runs with loading=true from state init; reload() is for user-triggered refreshes.
  const reload = () => {
    setLoading(true);
    setError(null);
    setReloadToken((t) => t + 1);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [a, t] = await Promise.all([
          fetchWorkspaceAssets(workspaceId),
          fetchWorkspaceTwins(workspaceId)
        ]);
        setAssets(a);
        setTwins(t);
        if (a.length > 0) {
          setSelectedAssetId((prev) => prev ?? a[0].id);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load creative assets.");
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, [workspaceId, reloadToken]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSubmitError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setFileValidationErr(null);
      return;
    }

    const validation = validateDeclaredFileMetadata({
      name: file.name,
      size: file.size,
      type: file.type
    });

    if (!validation.valid) {
      setFileValidationErr(validation.error || "Invalid file.");
      setSelectedFile(null);
    } else {
      setFileValidationErr(null);
      setSelectedFile(file);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "));
      }
      if (validation.category === "csv") setAssetKind("campaign_csv");
      else if (validation.category === "image") setAssetKind("thumbnail");
    }
  };

  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setSubmitError(null);

    if (intakeMethod === "manual") {
      const res = await ingestManualTextAsset(workspaceId, userId, {
        title: title.trim(),
        assetKind,
        manualText: manualText.trim(),
        declaredPlatform: declaredPlatform.trim() || undefined,
        declaredObjective: declaredObjective.trim() || undefined
      });

      setSubmitting(false);
      if (!res.success) {
        setSubmitError(res.error || "Submission failed.");
        return;
      }

      if (res.asset) {
        setAssets((prev) => [res.asset!, ...prev]);
        if (res.twin) {
          setTwins((prev) => [res.twin!, ...prev]);
          // Automatically decompose text assets into structured scenes & claims
          if (manualText.trim()) {
            await initializeStructuredTwin(res.twin.id, workspaceId, userId, manualText.trim());
          }
        }
        setSelectedAssetId(res.asset.id);
        setShowModal(false);
        resetForm();
      }
    } else {
      if (!selectedFile) {
        setSubmitting(false);
        setSubmitError("Please select a valid file.");
        return;
      }

      const res = await ingestFileAsset(workspaceId, userId, selectedFile, {
        title: title.trim(),
        assetKind,
        declaredPlatform: declaredPlatform.trim() || undefined,
        declaredObjective: declaredObjective.trim() || undefined
      });

      setSubmitting(false);
      if (!res.success) {
        setSubmitError(res.error || "Upload failed.");
        return;
      }

      if (res.asset) {
        setAssets((prev) => [res.asset!, ...prev]);
        if (res.twin) setTwins((prev) => [res.twin!, ...prev]);
        setSelectedAssetId(res.asset.id);
        setShowModal(false);
        resetForm();
      }
    }
  };

  const resetForm = () => {
    setTitle("");
    setManualText("");
    setSelectedFile(null);
    setFileValidationErr(null);
    setSubmitError(null);
    setDeclaredPlatform("");
    setDeclaredObjective("");
  };

  if (loading) {
    return (
      <div className="brand-brain-loading">
        <div className="bb-spinner" />
        <span>Loading Creative Intake & Grounded Twins…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bb-error-state" role="alert">
        <ShieldAlert size={20} color="#f87171" />
        <span>{error}</span>
        <button type="button" className="ghost-button-sm" onClick={reload}>
          Retry
        </button>
      </div>
    );
  }

  const activeAsset = assets.find((a) => a.id === selectedAssetId) || assets[0];
  const activeTwin = activeAsset ? twins.find((t) => t.asset_id === activeAsset.id) : null;

  return (
    <div className="brand-brain-shell">
      {/* Header */}
      <div className="bb-header">
        <div className="bb-header-left">
          <div
            className="bb-icon-wrap"
            style={{
              background: "rgba(194,164,255,.12)",
              borderColor: "rgba(194,164,255,.3)",
              color: "#c2a4ff"
            }}
          >
            <Layers3 size={18} />
          </div>
          <div>
            <h2 className="bb-title">Creative Intake & Grounded Twins</h2>
            <p className="bb-subtitle">
              {assets.length} ingested asset{assets.length !== 1 ? "s" : ""} · {twins.length} grounded manifest{twins.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="primary-button" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Intake new asset
          </button>
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div
        style={{
          background: "rgba(110,231,183,.05)",
          border: "1px solid rgba(110,231,183,.2)",
          borderRadius: 8,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 12,
          color: "#8ce4be",
          marginBottom: 16
        }}
      >
        <Lock size={14} />
        <span>
          <strong>Private Workspace Storage:</strong> Ingested files and text are stored securely in your tenant-isolated Supabase bucket and are not sent to AI model providers, social platforms, or external analysis services in this intake step.
        </span>
      </div>

      {/* Main Grid View */}
      {assets.length === 0 ? (
        <div className="bb-empty" style={{ padding: "48px 24px" }}>
          <UploadCloud size={32} color="#85c7e9" />
          <h3>No creative assets ingested</h3>
          <p>
            Submit an ad script, hook variation, landing copy, or campaign CSV. Vanta will construct a grounded, deterministic Creative Twin manifest without running unverified AI inference.
          </p>
          <button className="primary-button" onClick={() => setShowModal(true)} style={{ marginTop: 12 }}>
            <Plus size={14} /> Intake first asset
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
          {/* Left Column: Asset List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, fontFamily: "DM Mono, monospace", color: "#6e7b8b", textTransform: "uppercase", letterSpacing: ".08em", padding: "0 4px" }}>
              Ingested Assets ({assets.length})
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "calc(100vh - 340px)", overflowY: "auto" }}>
              {assets.map((asset) => {
                const isSelected = asset.id === activeAsset?.id;
                const kindMeta = ASSET_KIND_LABELS[asset.asset_kind as AssetKind] || ASSET_KIND_LABELS.other;
                const KindIcon = kindMeta.icon;

                return (
                  <div
                    key={asset.id}
                    onClick={() => setSelectedAssetId(asset.id)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 8,
                      border: isSelected ? "1px solid #85c7e9" : "1px solid rgba(255,255,255,.08)",
                      background: isSelected ? "rgba(133,199,233,.08)" : "rgba(255,255,255,.02)",
                      cursor: "pointer",
                      transition: "all .15s"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#eef2f5" }}>
                        <KindIcon size={14} color="#85c7e9" />
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 170 }}>
                          {asset.title}
                        </span>
                      </div>

                      <span
                        className="bb-status-pill status-approved"
                        style={{ fontSize: 9, textTransform: "uppercase" }}
                      >
                        {asset.ingestion_status}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6e7b8b", fontFamily: "DM Mono, monospace" }}>
                      <span>{kindMeta.label}</span>
                      <span>{new Date(asset.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Grounded Twin Manifest */}
          {activeAsset && (
            <div style={{ background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Asset Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid rgba(255,255,255,.07)", paddingBottom: 14 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <h3 style={{ margin: 0, fontSize: 16, color: "#f0f4f8" }}>{activeAsset.title}</h3>
                    <span className="bb-status-pill status-in_review" style={{ fontSize: 9 }}>
                      {activeTwin ? activeTwin.state : "grounded_stub"}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#8b98a7" }}>
                    Kind: <strong>{ASSET_KIND_LABELS[activeAsset.asset_kind as AssetKind]?.label || activeAsset.asset_kind}</strong>
                    {activeAsset.declared_platform && ` · Platform: ${activeAsset.declared_platform}`}
                    {activeAsset.declared_objective && ` · Objective: ${activeAsset.declared_objective}`}
                  </p>
                </div>

                <div style={{ fontSize: 10, fontFamily: "DM Mono, monospace", color: "#6e7b8b", textAlign: "right" }}>
                  <div>Asset ID: <code>{activeAsset.id.substring(0, 8)}…</code></div>
                  <div>Ingested: {new Date(activeAsset.created_at).toLocaleString()}</div>
                </div>
              </div>

              {/* Raw Content / Text Preview */}
              {activeAsset.manual_text ? (
                <div>
                  <div style={{ fontSize: 11, fontFamily: "DM Mono, monospace", color: "#85c7e9", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
                    User-Supplied Text Content
                  </div>
                  <pre
                    style={{
                      background: "rgba(0,0,0,.4)",
                      border: "1px solid rgba(255,255,255,.06)",
                      borderRadius: 6,
                      padding: 12,
                      fontSize: 12,
                      color: "#d2dae3",
                      whiteSpace: "pre-wrap",
                      fontFamily: "Inter, sans-serif",
                      lineHeight: 1.5,
                      maxHeight: 200,
                      overflowY: "auto"
                    }}
                  >
                    {activeAsset.manual_text}
                  </pre>
                </div>
              ) : activeAsset.original_filename ? (
                <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FileText size={18} color="#85c7e9" />
                    <div>
                      <strong style={{ fontSize: 13, color: "#eef2f5" }}>{activeAsset.original_filename}</strong>
                      <div style={{ fontSize: 11, color: "#6e7b8b" }}>
                        {activeAsset.byte_size ? `${(activeAsset.byte_size / 1024).toFixed(1)} KB` : ""} · {activeAsset.mime_type || "binary"}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "DM Mono, monospace", color: "#6ee7b7" }}>
                    ✓ Stored in Private Bucket
                  </div>
                </div>
              ) : null}

              <MediaReadiness workspaceId={workspaceId} asset={activeAsset} />

              {/* Grounded Twin Manifest Box */}
              <div>
                <div style={{ fontSize: 11, fontFamily: "DM Mono, monospace", color: "#c2a4ff", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={13} /> Deterministic Manifest Features
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                  {activeTwin?.deterministic_features && typeof activeTwin.deterministic_features === "object" ? (
                    Object.entries(activeTwin.deterministic_features).map(([key, val]) => (
                      <div key={key} style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 6, padding: "8px 12px" }}>
                        <div style={{ fontSize: 10, fontFamily: "DM Mono, monospace", color: "#6e7b8b", textTransform: "uppercase" }}>
                          {key.replace(/_/g, " ")}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#eef2f5", marginTop: 2, wordBreak: "break-all" }}>
                          {Array.isArray(val) ? val.join(", ") : String(val)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "#6e7b8b", fontSize: 12 }}>No deterministic features extracted.</div>
                  )}
                </div>
              </div>

              {/* Explicit Known Gaps */}
              <div>
                <div style={{ fontSize: 11, fontFamily: "DM Mono, monospace", color: "#fbbf24", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={13} /> Explicit Known Gaps (Unprocessed Dimensions)
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {activeTwin?.known_gaps && Array.isArray(activeTwin.known_gaps) ? (
                    (activeTwin.known_gaps as string[]).map((gap) => (
                      <span
                        key={gap}
                        style={{
                          fontSize: 11,
                          fontFamily: "DM Mono, monospace",
                          padding: "3px 8px",
                          borderRadius: 4,
                          background: "rgba(251,191,36,.08)",
                          border: "1px solid rgba(251,191,36,.25)",
                          color: "#fbbf24"
                        }}
                      >
                        {gap.replace(/_/g, " ")}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 12, color: "#6e7b8b" }}>No known gaps recorded.</span>
                  )}
                </div>
              </div>

              {/* Provenance Badge & Open Inspector */}
              <div style={{ fontSize: 11, color: "#5d6978", borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Link2 size={12} /> Bound to Source Registry: <code>{activeAsset.source_id.substring(0, 8)}…</code>
                </div>
                {onOpenTwin && activeTwin && (
                  <button
                    onClick={() => onOpenTwin(activeTwin.id)}
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 6,
                      background: "rgba(16,185,129,.15)",
                      border: "1px solid rgba(16,185,129,.3)",
                      color: "#10b981",
                      cursor: "pointer"
                    }}
                  >
                    Open Structured Twin Inspector →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ingestion Modal */}
      <Modal open={showModal} title="Intake Creative Material" onClose={() => setShowModal(false)} maxWidth={540}>

              {/* Mode Toggle */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                <button
                  type="button"
                  className={`bb-filter-btn ${intakeMethod === "manual" ? "active" : ""}`}
                  style={{ justifyContent: "center", padding: "8px 12px" }}
                  onClick={() => {
                    setIntakeMethod("manual");
                    setSubmitError(null);
                  }}
                >
                  <FileText size={14} /> Manual Text Input
                </button>
                <button
                  type="button"
                  className={`bb-filter-btn ${intakeMethod === "file" ? "active" : ""}`}
                  style={{ justifyContent: "center", padding: "8px 12px" }}
                  onClick={() => {
                    setIntakeMethod("file");
                    setSubmitError(null);
                  }}
                >
                  <UploadCloud size={14} /> File Upload
                </button>
              </div>

              <form onSubmit={handleIntakeSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {submitError && (
                  <div className="bb-error-state" style={{ padding: "8px 12px", fontSize: 12 }}>
                    <AlertCircle size={14} color="#f87171" />
                    <span>{submitError}</span>
                  </div>
                )}

                <label className="bb-label">
                  Asset Title *
                  <input
                    type="text"
                    className="bb-input"
                    required
                    placeholder="e.g. Q4 UGC Hook Script - Variant B"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label className="bb-label">
                    Asset Kind *
                    <select
                      className="bb-select"
                      value={assetKind}
                      onChange={(e) => setAssetKind(e.target.value as AssetKind)}
                    >
                      {(Object.keys(ASSET_KIND_LABELS) as AssetKind[]).map((kind) => (
                        <option key={kind} value={kind}>
                          {ASSET_KIND_LABELS[kind].label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="bb-label">
                    Declared Platform (optional)
                    <input
                      type="text"
                      className="bb-input"
                      placeholder="e.g. TikTok, Meta, YouTube Shorts"
                      value={declaredPlatform}
                      onChange={(e) => setDeclaredPlatform(e.target.value)}
                    />
                  </label>
                </div>

                <label className="bb-label">
                  Declared Objective (optional)
                  <input
                    type="text"
                    className="bb-input"
                    placeholder="e.g. Customer Acquisition / Trial Signups"
                    value={declaredObjective}
                    onChange={(e) => setDeclaredObjective(e.target.value)}
                  />
                </label>

                {intakeMethod === "manual" ? (
                  <label className="bb-label">
                    Manual Script / Copy Text *
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6e7b8b", marginBottom: 4 }}>
                      <span>1 to 100,000 characters</span>
                      <span>{manualText.length.toLocaleString()} / 100,000 chars</span>
                    </div>
                    <textarea
                      className="bb-textarea"
                      rows={6}
                      required
                      placeholder="Paste your ad copy, script lines, hook variants, or video transcript text..."
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                    />
                  </label>
                ) : (
                  <div>
                    <label className="bb-label">
                      Select Approved File *
                      <span className="bb-hint">
                        Allowed: CSV (≤ 5MB), TXT/MD/JSON (≤ 2MB), PNG/JPEG/WebP (≤ 10MB). Video uploads are disabled.
                      </span>
                      <input
                        type="file"
                        className="bb-input"
                        accept=".csv,.txt,.md,.json,.png,.jpg,.jpeg,.webp,text/csv,text/plain,text/markdown,application/json,image/png,image/jpeg,image/webp"
                        onChange={handleFileChange}
                      />
                    </label>

                    {fileValidationErr && (
                      <div style={{ color: "#f87171", fontSize: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <AlertCircle size={12} /> {fileValidationErr}
                      </div>
                    )}

                    {selectedFile && !fileValidationErr && (
                      <div style={{ fontSize: 11, color: "#6ee7b7", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <CheckCircle2 size={12} /> Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </div>
                    )}
                  </div>
                )}

                <div className="bb-form-actions" style={{ marginTop: 8 }}>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={
                      submitting ||
                      !title.trim() ||
                      (intakeMethod === "manual" && !manualText.trim()) ||
                      (intakeMethod === "file" && (!selectedFile || Boolean(fileValidationErr)))
                    }
                  >
                    {submitting ? "Ingesting…" : "Create Grounded Twin"}
                  </button>
                  <button
                    type="button"
                    className="ghost-button-sm"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
      </Modal>
    </div>
  );
}
