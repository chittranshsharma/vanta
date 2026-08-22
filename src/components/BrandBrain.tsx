import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  HelpCircle,
  Info,
  Layers3,
  Plus,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
  XCircle,
  Zap
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  fetchBrandForWorkspace,
  fetchBrandClaims,
  fetchBrandAudiences,
  upsertBrand,
  insertBrandClaim,
  insertBrandAudience,
  snapshotBrandCodex,
  fetchBrandCodexVersions,
  type Brand,
  type BrandClaim,
  type BrandAudience,
  type BrandCodexVersion,
  type ClaimType
} from "../lib/brandBrain";

// ─── Types ────────────────────────────────────────────────────────────────────
type BrandBrainTab = "positioning" | "claims" | "audiences" | "history";

interface BrandBrainProps {
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
}

// ─── Claim badge config ───────────────────────────────────────────────────────
const CLAIM_CONFIG: Record<
  ClaimType,
  { label: string; color: string; Icon: typeof CheckCircle2 }
> = {
  approved: { label: "Approved", color: "claim-approved", Icon: CheckCircle2 },
  prohibited: { label: "Prohibited", color: "claim-prohibited", Icon: XCircle },
  conditional: { label: "Conditional", color: "claim-conditional", Icon: AlertTriangle },
  unknown: { label: "Unknown", color: "claim-unknown", Icon: HelpCircle }
};

const REVIEW_STATUS_ICON: Record<string, typeof Circle> = {
  draft: Clock,
  in_review: Info,
  approved: CheckCircle2,
  archived: Circle
};

// ─── Main component ───────────────────────────────────────────────────────────
export function BrandBrain({ workspaceId, userId, isAdmin }: BrandBrainProps) {
  const [tab, setTab] = useState<BrandBrainTab>("positioning");
  const [brand, setBrand] = useState<Brand | null>(null);
  const [claims, setClaims] = useState<BrandClaim[]>([]);
  const [audiences, setAudiences] = useState<BrandAudience[]>([]);
  const [codexVersions, setCodexVersions] = useState<BrandCodexVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [showAudienceForm, setShowAudienceForm] = useState(false);

  // Load brand data
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      const b = await fetchBrandForWorkspace(workspaceId);
      if (!mounted) return;
      setBrand(b);
      if (b) {
        const [c, a, v] = await Promise.all([
          fetchBrandClaims(b.id),
          fetchBrandAudiences(b.id),
          fetchBrandCodexVersions(b.id)
        ]);
        if (!mounted) return;
        setClaims(c);
        setAudiences(a);
        setCodexVersions(v);
      }
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="brand-brain-loading">
        <div className="bb-spinner" />
        <span>Loading Brand Brain…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bb-error-state">
        <ShieldAlert size={20} color="#f87171" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="brand-brain-shell">
      {/* Header */}
      <div className="bb-header">
        <div className="bb-header-left">
          <div className="bb-icon-wrap">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="bb-title">Brand Brain</h2>
            <p className="bb-subtitle">
              {brand
                ? `${brand.name} · ${brand.review_status}`
                : "No brand defined yet for this workspace"}
            </p>
          </div>
        </div>
        {brand && isAdmin && (
          <div className="bb-header-actions">
            <button
              className="ghost-button-sm"
              onClick={async () => {
                setSaving(true);
                await snapshotBrandCodex(brand, claims, audiences, userId, "Manual snapshot");
                const v = await fetchBrandCodexVersions(brand.id);
                setCodexVersions(v);
                setSaving(false);
                setTab("history");
              }}
              disabled={saving}
            >
              <BookOpen size={13} /> Snapshot codex
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bb-tabs">
        {(["positioning", "claims", "audiences", "history"] as BrandBrainTab[]).map((t) => (
          <button
            key={t}
            className={`bb-tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "positioning" && <Target size={13} />}
            {t === "claims" && <Zap size={13} />}
            {t === "audiences" && <Users size={13} />}
            {t === "history" && <BookOpen size={13} />}
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === "claims" && claims.length > 0 && (
              <span className="bb-count">{claims.length}</span>
            )}
            {t === "audiences" && audiences.length > 0 && (
              <span className="bb-count">{audiences.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bb-content">
        {tab === "positioning" && (
          <PositioningTab
            brand={brand}
            workspaceId={workspaceId}
            userId={userId}
            isAdmin={isAdmin}
            showForm={showBrandForm}
            setShowForm={setShowBrandForm}
            onSave={async (payload) => {
              setSaving(true);
              const { brand: saved, error: err } = await upsertBrand(
                { ...payload, workspace_id: workspaceId },
                userId
              );
              setSaving(false);
              if (err) { setError(err.message); return; }
              setBrand(saved);
              setShowBrandForm(false);
            }}
            saving={saving}
          />
        )}

        {tab === "claims" && brand && (
          <ClaimsTab
            brandId={brand.id}
            workspaceId={workspaceId}
            userId={userId}
            claims={claims}
            isAdmin={isAdmin}
            showForm={showClaimForm}
            setShowForm={setShowClaimForm}
            onSave={async (payload) => {
              setSaving(true);
              const { claim, error: err } = await insertBrandClaim(
                { ...payload, brand_id: brand.id, workspace_id: workspaceId },
                userId
              );
              setSaving(false);
              if (err) { setError(err.message); return; }
              if (claim) setClaims((prev) => [claim, ...prev]);
              setShowClaimForm(false);
            }}
            saving={saving}
          />
        )}

        {tab === "audiences" && brand && (
          <AudiencesTab
            brandId={brand.id}
            workspaceId={workspaceId}
            userId={userId}
            audiences={audiences}
            isAdmin={isAdmin}
            showForm={showAudienceForm}
            setShowForm={setShowAudienceForm}
            onSave={async (payload) => {
              setSaving(true);
              const { audience, error: err } = await insertBrandAudience(
                { ...payload, brand_id: brand.id, workspace_id: workspaceId },
                userId
              );
              setSaving(false);
              if (err) { setError(err.message); return; }
              if (audience) setAudiences((prev) => [...prev, audience]);
              setShowAudienceForm(false);
            }}
            saving={saving}
          />
        )}

        {tab === "history" && brand && (
          <CodexHistoryTab versions={codexVersions} />
        )}

        {/* No brand state */}
        {!brand && tab !== "positioning" && (
          <div className="bb-empty">
            <Layers3 size={24} />
            <p>Define the Brand Brain positioning first before adding claims or audiences.</p>
            <button className="ghost-button-sm" onClick={() => setTab("positioning")}>
              <ChevronRight size={14} /> Start with positioning
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Positioning Tab ──────────────────────────────────────────────────────────
function PositioningTab({
  brand,
  workspaceId,
  userId,
  isAdmin,
  showForm,
  setShowForm,
  onSave,
  saving
}: {
  brand: Brand | null;
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  onSave: (payload: any) => Promise<void>;
  saving: boolean;
}) {
  const [name, setName] = useState(brand?.name || "");
  const [tagline, setTagline] = useState(brand?.tagline || "");
  const [category, setCategory] = useState(brand?.product_category || "");
  const [positioning, setPositioning] = useState(brand?.positioning_statement || "");
  const [corePromise, setCorePromise] = useState(brand?.core_promise || "");
  const [sourceRef, setSourceRef] = useState(brand?.source_reference || "");

  if (!brand && !showForm && isAdmin) {
    return (
      <div className="bb-empty">
        <Sparkles size={22} />
        <h3>No Brand Brain defined</h3>
        <p>
          Define your product name, positioning statement, core promise, and category to start.
          No data will be fabricated — every field you leave blank will remain blank.
        </p>
        <button className="primary-button" onClick={() => setShowForm(true)}>
          <Plus size={15} /> Create Brand Brain
        </button>
      </div>
    );
  }

  if (!brand && !isAdmin) {
    return (
      <div className="bb-empty">
        <Info size={20} />
        <p>Brand Brain has not been configured for this workspace. Ask a workspace admin to set it up.</p>
      </div>
    );
  }

  return (
    <div className="bb-positioning">
      {brand && !showForm && (
        <div className="bb-card-grid">
          <BrandField label="Product name" value={brand.name} />
          <BrandField label="Tagline" value={brand.tagline} />
          <BrandField label="Category" value={brand.product_category} />
          <BrandField label="Review status" value={brand.review_status} />
          <BrandField label="Positioning statement" value={brand.positioning_statement} full />
          <BrandField label="Core promise" value={brand.core_promise} full />
          <BrandField label="Source reference" value={brand.source_reference} full />
          {isAdmin && (
            <button className="ghost-button-sm" onClick={() => setShowForm(true)}>
              Edit positioning
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.form
            className="bb-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onSubmit={(e) => {
              e.preventDefault();
              onSave({
                name,
                tagline: tagline || null,
                product_category: category || null,
                positioning_statement: positioning || null,
                core_promise: corePromise || null,
                source_reference: sourceRef || null
              });
            }}
          >
            <div className="bb-form-notice">
              <Info size={13} /> Leave any field blank to record it as not yet defined. Do not invent values.
            </div>
            <BrandInput label="Product name *" required value={name} onChange={setName} />
            <BrandInput label="Tagline" value={tagline} onChange={setTagline} />
            <BrandInput label="Product category" value={category} onChange={setCategory} />
            <BrandTextarea label="Positioning statement" value={positioning} onChange={setPositioning}
              hint="How the product is meaningfully different for a specific audience." />
            <BrandTextarea label="Core promise" value={corePromise} onChange={setCorePromise}
              hint="The single most important thing the brand commits to delivering." />
            <BrandInput label="Source reference (URL or import ID)" value={sourceRef} onChange={setSourceRef}
              hint="Where did this positioning come from?" />
            <div className="bb-form-actions">
              <button type="submit" className="primary-button" disabled={saving || !name.trim()}>
                {saving ? "Saving…" : brand ? "Update Brand Brain" : "Create Brand Brain"}
              </button>
              <button type="button" className="ghost-button-sm" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Claims Tab ───────────────────────────────────────────────────────────────
function ClaimsTab({
  brandId,
  workspaceId,
  userId,
  claims,
  isAdmin,
  showForm,
  setShowForm,
  onSave,
  saving
}: {
  brandId: string;
  workspaceId: string;
  userId: string;
  claims: BrandClaim[];
  isAdmin: boolean;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  onSave: (payload: any) => Promise<void>;
  saving: boolean;
}) {
  const [claimText, setClaimText] = useState("");
  const [claimType, setClaimType] = useState<ClaimType>("unknown");
  const [rationale, setRationale] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [filter, setFilter] = useState<ClaimType | "all">("all");

  const filtered = filter === "all" ? claims : claims.filter((c) => c.claim_type === filter);

  return (
    <div className="bb-claims">
      <div className="bb-section-header">
        <div className="bb-filter-row">
          {(["all", "approved", "prohibited", "conditional", "unknown"] as const).map((f) => (
            <button
              key={f}
              className={`bb-filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : CLAIM_CONFIG[f as ClaimType]?.label}
              {f !== "all" && (
                <span className="bb-count">
                  {claims.filter((c) => c.claim_type === f).length}
                </span>
              )}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button className="ghost-button-sm" onClick={() => setShowForm(!showForm)}>
            <Plus size={13} /> Add claim
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
            onSubmit={(e) => {
              e.preventDefault();
              onSave({
                claim_text: claimText,
                claim_type: claimType,
                rationale: rationale || null,
                source_reference: sourceRef || null
              });
            }}
          >
            <div className="bb-form-notice">
              <Info size={13} /> Record what the brand can, cannot, or conditionally state. Never invent claims — only document what has been agreed by your team.
            </div>
            <BrandTextarea label="Claim text *" required value={claimText} onChange={setClaimText}
              hint='e.g. "Fastest checkout in the category" or "Do not reference competitor prices."' />
            <label className="bb-label">
              Claim type *
              <select
                className="bb-select"
                value={claimType}
                onChange={(e) => setClaimType(e.target.value as ClaimType)}
                required
              >
                <option value="approved">Approved — safe to use</option>
                <option value="prohibited">Prohibited — must not use</option>
                <option value="conditional">Conditional — only in specific contexts</option>
                <option value="unknown">Unknown — not yet classified</option>
              </select>
            </label>
            <BrandTextarea label="Rationale" value={rationale} onChange={setRationale}
              hint="Why is this claim classified this way?" />
            <BrandInput label="Source reference (URL or import ID)" value={sourceRef} onChange={setSourceRef} />
            <div className="bb-form-actions">
              <button type="submit" className="primary-button" disabled={saving || !claimText.trim()}>
                {saving ? "Saving…" : "Add Claim"}
              </button>
              <button type="button" className="ghost-button-sm" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {filtered.length === 0 ? (
        <div className="bb-empty">
          <Zap size={20} />
          <p>
            {filter === "all"
              ? "No claims defined yet. Add approved and prohibited claim language to ground every creative recommendation."
              : `No ${filter} claims yet.`}
          </p>
        </div>
      ) : (
        <div className="bb-list">
          {filtered.map((claim) => {
            const cfg = CLAIM_CONFIG[claim.claim_type as ClaimType];
            const Icon = cfg.Icon;
            const StatusIcon = REVIEW_STATUS_ICON[claim.review_status] || Circle;
            return (
              <motion.div
                key={claim.id}
                className={`bb-claim-row ${cfg.color}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="bb-claim-badge">
                  <Icon size={14} />
                  <span>{cfg.label}</span>
                </div>
                <div className="bb-claim-body">
                  <p className="bb-claim-text">{claim.claim_text}</p>
                  {claim.rationale && (
                    <p className="bb-claim-rationale">{claim.rationale}</p>
                  )}
                </div>
                <div className="bb-claim-meta">
                  <StatusIcon size={11} />
                  <span>{claim.review_status}</span>
                  {claim.source_reference && (
                    <span className="bb-source-ref" title={claim.source_reference}>
                      · source
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Audiences Tab ────────────────────────────────────────────────────────────
function AudiencesTab({
  brandId,
  workspaceId,
  userId,
  audiences,
  isAdmin,
  showForm,
  setShowForm,
  onSave,
  saving
}: {
  brandId: string;
  workspaceId: string;
  userId: string;
  audiences: BrandAudience[];
  isAdmin: boolean;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  onSave: (payload: any) => Promise<void>;
  saving: boolean;
}) {
  const [segmentName, setSegmentName] = useState("");
  const [description, setDescription] = useState("");
  const [demographics, setDemographics] = useState("");
  const [psychographics, setPsychographics] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [motivations, setMotivations] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="bb-audiences">
      <div className="bb-section-header">
        <span className="bb-section-count">{audiences.length} segment{audiences.length !== 1 ? "s" : ""}</span>
        {isAdmin && (
          <button className="ghost-button-sm" onClick={() => setShowForm(!showForm)}>
            <Plus size={13} /> Add segment
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
            onSubmit={(e) => {
              e.preventDefault();
              onSave({
                segment_name: segmentName,
                description: description || null,
                demographics: demographics || null,
                psychographics: psychographics || null,
                pain_points: painPoints || null,
                motivations: motivations || null,
                source_reference: sourceRef || null
              });
            }}
          >
            <div className="bb-form-notice">
              <Info size={13} /> Only record audience characteristics your team has actually defined. Leave fields blank rather than inventing demographics.
            </div>
            <BrandInput label="Segment name *" required value={segmentName} onChange={setSegmentName}
              hint='e.g. "Growth-stage SaaS founders"' />
            <BrandTextarea label="Description" value={description} onChange={setDescription} />
            <BrandTextarea label="Demographics" value={demographics} onChange={setDemographics} />
            <BrandTextarea label="Psychographics" value={psychographics} onChange={setPsychographics} />
            <BrandTextarea label="Pain points" value={painPoints} onChange={setPainPoints} />
            <BrandTextarea label="Motivations" value={motivations} onChange={setMotivations} />
            <BrandInput label="Source reference" value={sourceRef} onChange={setSourceRef} />
            <div className="bb-form-actions">
              <button type="submit" className="primary-button" disabled={saving || !segmentName.trim()}>
                {saving ? "Saving…" : "Add Segment"}
              </button>
              <button type="button" className="ghost-button-sm" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {audiences.length === 0 ? (
        <div className="bb-empty">
          <Users size={20} />
          <p>No audience segments defined. Add segments your team has actually researched and agreed on.</p>
        </div>
      ) : (
        <div className="bb-list">
          {audiences.map((a) => (
            <div key={a.id} className="bb-audience-row">
              <button
                className="bb-audience-header"
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                aria-expanded={expanded === a.id}
              >
                <div className="bb-audience-name">
                  <Users size={13} /> {a.segment_name}
                </div>
                <div className="bb-audience-meta">
                  <span className={`bb-status-pill status-${a.review_status}`}>{a.review_status}</span>
                  <ChevronDown size={14} className={expanded === a.id ? "rotate-180" : ""} />
                </div>
              </button>
              <AnimatePresence>
                {expanded === a.id && (
                  <motion.div
                    className="bb-audience-detail"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    {a.description && <BrandField label="Description" value={a.description} />}
                    {a.demographics && <BrandField label="Demographics" value={a.demographics} />}
                    {a.psychographics && <BrandField label="Psychographics" value={a.psychographics} />}
                    {a.pain_points && <BrandField label="Pain points" value={a.pain_points} />}
                    {a.motivations && <BrandField label="Motivations" value={a.motivations} />}
                    {a.source_reference && <BrandField label="Source" value={a.source_reference} />}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Codex History Tab ────────────────────────────────────────────────────────
function CodexHistoryTab({ versions }: { versions: BrandCodexVersion[] }) {
  return (
    <div className="bb-history">
      {versions.length === 0 ? (
        <div className="bb-empty">
          <BookOpen size={20} />
          <p>No codex snapshots yet. Snapshot the Brand Brain to create an immutable version record.</p>
        </div>
      ) : (
        <div className="bb-list">
          {versions.map((v) => (
            <div key={v.id} className="bb-version-row">
              <div className="bb-version-badge">v{v.version_number}</div>
              <div className="bb-version-body">
                <p className="bb-version-summary">{v.change_summary || "No summary provided"}</p>
                <span className="bb-version-date">
                  {new Date(v.created_at).toLocaleDateString(undefined, {
                    year: "numeric", month: "short", day: "numeric"
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function BrandField({
  label,
  value,
  full
}: {
  label: string;
  value: string | null | undefined;
  full?: boolean;
}) {
  if (!value) return null;
  return (
    <div className={`bb-field ${full ? "bb-field-full" : ""}`}>
      <span className="bb-field-label">{label}</span>
      <span className="bb-field-value">{value}</span>
    </div>
  );
}

function BrandInput({
  label,
  value,
  onChange,
  required,
  hint
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="bb-label">
      {label}
      {hint && <span className="bb-hint">{hint}</span>}
      <input
        type="text"
        className="bb-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </label>
  );
}

function BrandTextarea({
  label,
  value,
  onChange,
  required,
  hint
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="bb-label">
      {label}
      {hint && <span className="bb-hint">{hint}</span>}
      <textarea
        className="bb-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        rows={3}
      />
    </label>
  );
}
