import type { User as AuthUser } from "@supabase/supabase-js";
import { Bot, CalendarRange, ChevronRight, Columns3, Compass, Film, FlaskConical, Layers3, Link2, ListChecks, LogOut, Plus, SlidersHorizontal, Sparkles, WandSparkles } from "lucide-react";
import { isFlagOn } from "../lib/flags";
import { Suspense, lazy, useEffect, useState } from "react";
import { deriveEvidenceState } from "../lib/evidence";
import { supabase } from "../lib/supabase";
import { Modal } from "./Modal";
import { fetchBrandClaims, brandReadSummary, type BrandClaim } from "../lib/brandBrain";
import { EMPTY_OVERVIEW, fetchWorkspaceOverview, type LoadStatus, type WorkspaceOverview } from "../lib/workspaceOverview";
import { evaluateSourceCitability } from "../lib/sourceRegistry";
import { deriveGuidance, type ApprovedClaimCount, type WorkspacePanel } from "../lib/decisionRoom";
import {
  fetchStructuredTwin,
  type CreativeTwinRow,
  type CreativeSceneRow,
  type CreativeClaimRow
} from "../lib/creativeTwin";
import { createNewWorkspace, type Profile, type WorkspaceWithRole } from "../lib/auth";

// Workspace panels are code-split so the public landing page does not pay for them.
const BrandBrain = lazy(() => import("./BrandBrain").then((m) => ({ default: m.BrandBrain })));
const SourceRegistry = lazy(() => import("./SourceRegistry").then((m) => ({ default: m.SourceRegistry })));
const CreativeIntake = lazy(() => import("./CreativeIntake").then((m) => ({ default: m.CreativeIntake })));
const CreativeTwinEditor = lazy(() =>
  import("./CreativeTwinEditor").then((m) => ({ default: m.CreativeTwinEditor }))
);
const DecisionMatrix = lazy(() => import("./DecisionMatrix").then((m) => ({ default: m.DecisionMatrix })));
const ConnectorsPanel = lazy(() => import("./ConnectorsPanel").then((m) => ({ default: m.ConnectorsPanel })));
const PublishingPlanner = lazy(() => import("./PublishingPlanner").then((m) => ({ default: m.PublishingPlanner })));
const ExperimentsPanel = lazy(() => import("./ExperimentsPanel").then((m) => ({ default: m.ExperimentsPanel })));
const AgentWorkflowPanel = lazy(() => import("./AgentWorkflowPanel").then((m) => ({ default: m.AgentWorkflowPanel })));
const JobsPanel = lazy(() => import("./JobsPanel").then((m) => ({ default: m.JobsPanel })));
const SetupStatus = lazy(() => import("./SetupStatus").then((m) => ({ default: m.SetupStatus })));

export type PanelId = "decision" | "brand" | "sources" | "intake" | "twin" | "matrix" | "connectors" | "publishing" | "experiments" | "agents" | "jobs" | "status";

const PANEL_TITLES: Record<PanelId, string> = {
  decision: "Start with what you can prove.",
  brand: "Brand Brain",
  intake: "Creative Intake",
  twin: "Structured Creative Twin",
  matrix: "Creative Decision Matrix",
  sources: "Source Registry",
  connectors: "Source connectors",
  publishing: "Test-window planning",
  experiments: "Experiments",
  agents: "Agent workflow",
  jobs: "Background jobs",
  status: "Setup and status"
};

/**
 * Shown when a panel cannot render its own content. The header already names
 * the panel, so falling through to a different panel's body would be a lie
 * about what the user is looking at.
 */
function PanelUnavailable({ title, reason, action }: { title: string; reason: string; action?: { label: string; onClick: () => void } }) {
  return (
    <section className="vp-panel">
      <div className="vp-empty" role="status">
        <span className="vp-row-state">Unavailable</span>
        <h3>{title}</h3>
        <p>{reason}</p>
        {action && (
          <div className="vp-actions">
            <button type="button" className="ghost-button-sm" onClick={action.onClick}>{action.label}</button>
          </div>
        )}
      </div>
    </section>
  );
}

function PanelFallback({ label }: { label: string }) {
  return (
    <div className="brand-brain-loading" role="status" aria-live="polite">
      Loading {label}…
    </div>
  );
}

export function Workspace({
  user,
  profile,
  workspaces,
  activeWorkspace,
  setActiveWorkspace,
  onRefreshWorkspaces,
  onExit,
  onSignOut,
  onOpenAuth
}: {
  user: AuthUser | null;
  profile: Profile | null;
  workspaces: WorkspaceWithRole[];
  activeWorkspace: WorkspaceWithRole | null;
  setActiveWorkspace: (ws: WorkspaceWithRole) => void;
  onRefreshWorkspaces: () => Promise<void>;
  onExit: () => void;
  onSignOut: () => void;
  onOpenAuth: () => void;
}) {
  // Overview is keyed by workspace id so loading is derived, never set synchronously in an effect.
  const [overviewResult, setOverviewResult] = useState<{
    workspaceId: string;
    data: WorkspaceOverview;
    errors: string[];
  } | null>(null);
  const overviewIsCurrent = Boolean(activeWorkspace && overviewResult?.workspaceId === activeWorkspace.id);
  const overview: WorkspaceOverview = overviewIsCurrent && overviewResult ? overviewResult.data : EMPTY_OVERVIEW;
  const overviewErrors: string[] = overviewIsCurrent && overviewResult ? overviewResult.errors : [];
  const overviewStatus: LoadStatus = !activeWorkspace
    ? "idle"
    : !overviewIsCurrent
    ? "loading"
    : overviewErrors.length > 0
    ? "error"
    : "ready";
  const { sources, brand, assets } = overview;
  const [activePanel, setActivePanel] = useState<PanelId>("decision");
  const [selectedTwinId, setSelectedTwinId] = useState<string | null>(null);
  // Matrix data is keyed by workspace + open count so "loading" is derived rather than set in an effect.
  const [matrixRefreshToken, setMatrixRefreshToken] = useState(0);
  const [matrixResult, setMatrixResult] = useState<{
    key: string;
    twins: CreativeTwinRow[];
    scenesMap: Record<string, CreativeSceneRow[]>;
    claimsMap: Record<string, CreativeClaimRow[]>;
    brandClaims: BrandClaim[];
    /** Set when the grounding claims could not be read, so an empty list is never read as "no claims". */
    brandClaimsError: string | null;
  } | null>(null);
  const matrixKey = activeWorkspace ? `${activeWorkspace.id}:${matrixRefreshToken}` : null;
  const matrixIsCurrent = matrixResult !== null && matrixResult.key === matrixKey;
  const matrixLoading = activePanel === "matrix" && !matrixIsCurrent;
  const matrixTwins = matrixIsCurrent ? matrixResult.twins : [];
  const matrixScenesMap = matrixIsCurrent ? matrixResult.scenesMap : {};
  const matrixClaimsMap = matrixIsCurrent ? matrixResult.claimsMap : {};
  const matrixBrandClaims = matrixIsCurrent ? matrixResult.brandClaims : [];
  const matrixBrandClaimsError = matrixIsCurrent ? matrixResult.brandClaimsError : null;
  // Gateway readiness is only known after an explicit probe in Setup and status; it stays "unknown" until then.
  const [gatewayState, setGatewayState] = useState<"configured" | "missing" | "unknown">("unknown");
  const [newWsModalOpen, setNewWsModalOpen] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [creatingWs, setCreatingWs] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  useEffect(() => {
    if (activePanel !== "matrix" || !activeWorkspace || !matrixKey) return;
    const workspaceId = activeWorkspace.id;
    const key = matrixKey;
    const brandId = brand?.id ?? null;
    let mounted = true;

    (async () => {
      const { data: twinsData } = await supabase
        .from("creative_twins")
        .select("*")
        .eq("workspace_id", workspaceId);

      const twins = (twinsData || []) as CreativeTwinRow[];
      const scenesMap: Record<string, CreativeSceneRow[]> = {};
      const claimsMap: Record<string, CreativeClaimRow[]> = {};

      await Promise.all(
        twins.map(async (t) => {
          const details = await fetchStructuredTwin(t.id, workspaceId);
          if (details.data) {
            scenesMap[t.id] = details.data.scenes;
            claimsMap[t.id] = details.data.claims;
          }
        })
      );

      const claimsRead = brandId ? await fetchBrandClaims(brandId) : null;
      if (mounted)
        setMatrixResult({
          key,
          twins,
          scenesMap,
          claimsMap,
          brandClaims: claimsRead?.data ?? [],
          brandClaimsError: claimsRead?.error ? brandReadSummary(claimsRead.error) : null
        });
    })();

    return () => {
      mounted = false;
    };
  }, [activePanel, matrixKey, activeWorkspace, brand?.id]);

  const loadOverview = async () => {
    if (!activeWorkspace) return;
    const workspaceId = activeWorkspace.id;
    setOverviewResult(null);
    const { data, errors } = await fetchWorkspaceOverview(workspaceId);
    setOverviewResult({ workspaceId, data, errors });
  };

  useEffect(() => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) return;
    let mounted = true;
    fetchWorkspaceOverview(workspaceId).then(({ data, errors }) => {
      if (mounted) setOverviewResult({ workspaceId, data, errors });
    });
    return () => {
      mounted = false;
    };
  }, [activeWorkspace?.id]);

  const connectedSources = sources.filter((s) => s.health_status === "connected");
  const unverifiedSources = sources.filter((s) => s.health_status === "unverified");
  const isFreshConnected = connectedSources.some((s) => evaluateSourceCitability(s).status === "verified");

  const evidenceState = deriveEvidenceState({
    sourceCount: connectedSources.length,
    hasConflict: false,
    isFresh: isFreshConnected
  });

  // While the overview is in flight the placeholder overview carries no count, so
  // the ladder says it is counting rather than reporting a stale or invented zero.
  const approvedClaims: ApprovedClaimCount =
    overviewStatus === "loading" ? { state: "loading" } : overview.approvedClaims;

  const guidance = deriveGuidance({
    hasBrandName: Boolean(brand?.name),
    approvedClaims,
    assetCount: assets.length,
    twinCount: overview.counts.twins,
    sourceCount: sources.length,
    citableSourceCount: sources.filter((s) => {
      const c = evaluateSourceCitability(s);
      return c.status === "verified" || c.status === "citable_stale" || c.status === "citable_unverified";
    }).length,
    metricDefinitionCount: overview.counts.metricDefinitions,
    experimentCount: overview.counts.experiments ?? 0,
    observedOutcomeCount: overview.counts.observedOutcomes,
    postObservationCount: overview.counts.postObservations
  });

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim() || !user) return;
    setCreatingWs(true);
    setWsError(null);

    const { workspace, error } = await createNewWorkspace(newWsName.trim(), user.id);
    setCreatingWs(false);

    if (error || !workspace) {
      setWsError(error?.message || "Failed to create workspace.");
    } else {
      setNewWsName("");
      setNewWsModalOpen(false);
      await onRefreshWorkspaces();
      setActiveWorkspace({ ...workspace, role: "owner" });
    }
  };

  return (
    <main className="workspace-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <button className="wordmark" onClick={onExit}>
            <span className="wordmark-mark" /> Vanta
          </button>
        </div>

        {/* Tenant Workspace Selector */}
        <div className="workspace-selector-box">
          <div className="workspace-label">TENANT WORKSPACE</div>
          {user ? (
            <div className="workspace-dropdown-wrap">
              <select
                className="workspace-select"
                aria-label="Tenant workspace"
                value={activeWorkspace?.id || ""}
                onChange={(e) => {
                  const selected = workspaces.find((w) => w.id === e.target.value);
                  if (selected) setActiveWorkspace(selected);
                }}
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name} ({ws.role})
                  </option>
                ))}
              </select>
              <button
                className="add-ws-button"
                onClick={() => setNewWsModalOpen(true)}
                title="Create workspace"
                aria-label="Create workspace"
              >
                <Plus size={14} />
              </button>
            </div>
          ) : (
            <div className="demo-badge">
              <span>Local Demo Session</span>
              <button className="link-button" onClick={onOpenAuth}>
                Sign in to save
              </button>
            </div>
          )}
        </div>

        <nav className="sidebar-nav" aria-label="Workspace sections">
          <button className={`side-link ${activePanel === "decision" ? "active" : ""}`} aria-current={activePanel === "decision" ? "page" : undefined} onClick={() => setActivePanel("decision")}>
            <Layers3 size={17} /> Decision room
          </button>
          <button className={`side-link ${activePanel === "brand" ? "active" : ""}`} aria-current={activePanel === "brand" ? "page" : undefined} onClick={() => setActivePanel("brand")}>
            <Sparkles size={17} /> Brand Brain
          </button>
          <button className={`side-link ${activePanel === "intake" ? "active" : ""}`} aria-current={activePanel === "intake" ? "page" : undefined} onClick={() => setActivePanel("intake")}>
            <WandSparkles size={17} /> Creative intake
          </button>
          {selectedTwinId && (
            <button className={`side-link ${activePanel === "twin" ? "active" : ""}`} aria-current={activePanel === "twin" ? "page" : undefined} onClick={() => setActivePanel("twin")}>
              <Film size={17} /> Structured Twin
            </button>
          )}
          <button
            className={`side-link ${activePanel === "matrix" ? "active" : ""}`} aria-current={activePanel === "matrix" ? "page" : undefined}
            onClick={() => {
              setActivePanel("matrix");
              setMatrixRefreshToken((t) => t + 1);
            }}
          >
            <Columns3 size={17} /> Decision matrix
          </button>
          <button className={`side-link ${activePanel === "sources" ? "active" : ""}`} aria-current={activePanel === "sources" ? "page" : undefined} onClick={() => setActivePanel("sources")}>
            <Compass size={17} /> Source registry
          </button>
          {isFlagOn("connectors_panel") && (
            <button className={`side-link ${activePanel === "connectors" ? "active" : ""}`} aria-current={activePanel === "connectors" ? "page" : undefined} onClick={() => setActivePanel("connectors")}>
              <Link2 size={17} /> Connectors
            </button>
          )}
          <button className={`side-link ${activePanel === "experiments" ? "active" : ""}`} aria-current={activePanel === "experiments" ? "page" : undefined} onClick={() => setActivePanel("experiments")}>
            <FlaskConical size={17} /> Experiments
          </button>
          <button className={`side-link ${activePanel === "publishing" ? "active" : ""}`} aria-current={activePanel === "publishing" ? "page" : undefined} onClick={() => setActivePanel("publishing")}>
            <CalendarRange size={17} /> Test windows
          </button>
          <button className={`side-link ${activePanel === "agents" ? "active" : ""}`} aria-current={activePanel === "agents" ? "page" : undefined} onClick={() => setActivePanel("agents")}>
            <Bot size={17} /> Agent workflow
          </button>
          {isFlagOn("jobs_panel") && (
            <button className={`side-link ${activePanel === "jobs" ? "active" : ""}`} aria-current={activePanel === "jobs" ? "page" : undefined} onClick={() => setActivePanel("jobs")}>
              <ListChecks size={17} /> Jobs
            </button>
          )}
          <button className={`side-link ${activePanel === "status" ? "active" : ""}`} aria-current={activePanel === "status" ? "page" : undefined} onClick={() => setActivePanel("status")}>
            <SlidersHorizontal size={17} /> Setup and status
          </button>
        </nav>

        <div className="sidebar-bottom">
          {user ? (
            <div className="user-profile-widget">
              <div className="user-info">
                <div className="user-avatar">{profile?.full_name?.charAt(0) || user.email?.charAt(0) || "U"}</div>
                <div className="user-details">
                  <strong>{profile?.full_name || user.email?.split("@")[0]}</strong>
                  <span>{user.email}</span>
                </div>
              </div>
              <button className="signout-button" onClick={onSignOut} title="Sign out" aria-label="Sign out">
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <div className="auth-prompt">
              <div className="auth-prompt-text">
                <span>Not signed in. Nothing is saved.</span>
              </div>
              <button className="ghost-button-sm" onClick={onOpenAuth}>
                Sign in
              </button>
            </div>
          )}
        </div>
      </aside>

      <section className="workspace-content">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">
              {activeWorkspace ? `${activeWorkspace.name} · ${activeWorkspace.role}` : "Local demo session, nothing is stored"}
            </p>
            <h1>{PANEL_TITLES[activePanel]}</h1>
          </div>
          <button className="ghost-button" onClick={onExit}>
            Back to site
          </button>
        </header>

        <Suspense fallback={<PanelFallback label="panel" />}>
        {activePanel !== "decision" && activePanel !== "status" && (!activeWorkspace || !user) ? (
          <PanelUnavailable
            title={`${PANEL_TITLES[activePanel]} needs a signed-in workspace`}
            reason="This session is a local demo: there is no authenticated workspace, so there is nothing to read or write here. Nothing on this screen is stored."
            action={{ label: "Sign in", onClick: onOpenAuth }}
          />
        ) : activePanel === "twin" && !selectedTwinId ? (
          <PanelUnavailable
            title="No Creative Twin is selected"
            reason="Open a twin from Creative intake or the Decision matrix first."
            action={{ label: "Go to Creative intake", onClick: () => setActivePanel("intake") }}
          />
        ) : activePanel === "connectors" && !isFlagOn("connectors_panel") ? (
          <PanelUnavailable title="Connectors are not enabled in this build" reason="Add connectors_panel to VITE_FLAGS and rebuild. A client flag only renders UI; server access stays gated separately." />
        ) : activePanel === "jobs" && !isFlagOn("jobs_panel") ? (
          <PanelUnavailable title="The jobs panel is not enabled in this build" reason="Add jobs_panel to VITE_FLAGS and rebuild." />
        ) : activePanel === "brand" && activeWorkspace && user ? (
          <div style={{ marginTop: 32 }}>
            <BrandBrain
              key={activeWorkspace.id}
              workspaceId={activeWorkspace.id}
              userId={user.id}
              isAdmin={activeWorkspace.role === "owner" || activeWorkspace.role === "admin"}
            />
          </div>
        ) : activePanel === "intake" && activeWorkspace && user ? (
          <div style={{ marginTop: 32 }}>
            <CreativeIntake
              key={activeWorkspace.id}
              workspaceId={activeWorkspace.id}
              userId={user.id}
              isAdmin={activeWorkspace.role === "owner" || activeWorkspace.role === "admin"}
              onOpenTwin={(twinId) => {
                setSelectedTwinId(twinId);
                setActivePanel("twin");
              }}
            />
          </div>
        ) : activePanel === "twin" && activeWorkspace && user && selectedTwinId ? (
          <div style={{ marginTop: 32 }}>
            <CreativeTwinEditor
              key={`${activeWorkspace.id}:${selectedTwinId}`}
              twinId={selectedTwinId}
              workspaceId={activeWorkspace.id}
              userId={user.id}
              userRole={activeWorkspace.role}
              onBack={() => setActivePanel("intake")}
            />
          </div>
        ) : activePanel === "matrix" && activeWorkspace && user ? (
          <div style={{ marginTop: 32 }}>
            {matrixLoading ? (
              <div className="brand-brain-loading" role="status" aria-live="polite">Loading workspace variants…</div>
            ) : (
              <>
                {matrixBrandClaimsError && (
                  <p className="error-text" role="alert" style={{ marginBottom: 12 }}>
                    Grounding claims could not be read, so claim coverage below is unknown rather than absent.{" "}
                    {matrixBrandClaimsError}{" "}
                    <button className="ghost-button" onClick={() => setMatrixRefreshToken((t) => t + 1)}>Retry</button>
                  </p>
                )}
                <DecisionMatrix
                  twins={matrixTwins}
                  scenesByTwinId={matrixScenesMap}
                  claimsByTwinId={matrixClaimsMap}
                  brandClaims={matrixBrandClaims}
                  onOpenTwin={(twinId) => {
                    setSelectedTwinId(twinId);
                    setActivePanel("twin");
                  }}
                  onOpenTimelineDoctor={(twinId) => {
                    setSelectedTwinId(twinId);
                    setActivePanel("twin");
                  }}
                />
              </>
            )}
          </div>
        ) : activePanel === "connectors" && activeWorkspace && user && isFlagOn("connectors_panel") ? (
          <ConnectorsPanel key={activeWorkspace.id} workspaceId={activeWorkspace.id} isAdmin={activeWorkspace.role === "owner" || activeWorkspace.role === "admin"} />
        ) : activePanel === "experiments" && activeWorkspace && user ? (
          <ExperimentsPanel key={activeWorkspace.id} workspaceId={activeWorkspace.id} userId={user.id} />
        ) : activePanel === "publishing" && activeWorkspace && user ? (
          <PublishingPlanner
            key={activeWorkspace.id}
            workspaceId={activeWorkspace.id}
            userId={user.id}
            isAdmin={activeWorkspace.role === "owner" || activeWorkspace.role === "admin"}
          />
        ) : activePanel === "agents" && activeWorkspace && user ? (
          <AgentWorkflowPanel key={activeWorkspace.id} workspaceId={activeWorkspace.id} gatewayState={gatewayState} />
        ) : activePanel === "jobs" && activeWorkspace && user && isFlagOn("jobs_panel") ? (
          <JobsPanel key={activeWorkspace.id} workspaceId={activeWorkspace.id} isAdmin={activeWorkspace.role === "owner" || activeWorkspace.role === "admin"} />
        ) : activePanel === "status" ? (
          <SetupStatus key={activeWorkspace?.id ?? "none"} workspaceId={activeWorkspace?.id ?? ""} canProbe={Boolean(activeWorkspace && user)} onGatewayProbe={setGatewayState} />
        ) : activePanel === "sources" && activeWorkspace && user ? (
          <div style={{ marginTop: 32 }}>
            <SourceRegistry
              key={activeWorkspace.id}
              workspaceId={activeWorkspace.id}
              userId={user.id}
              isAdmin={activeWorkspace.role === "owner" || activeWorkspace.role === "admin"}
            />
          </div>
        ) : (
          <>
          {overviewStatus === "loading" && (
            <div className="brand-brain-loading" role="status" aria-live="polite">
              Loading workspace evidence…
            </div>
          )}
          {overviewStatus === "error" && (
            <section className="load-error" role="alert">
              <div>
                <p className="state-overline">Could not load workspace data</p>
                <p>
                  The counts below are not an empty workspace; they are unknown because a read failed.
                </p>
                <ul>
                  {overviewErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
              <button className="ghost-button" onClick={loadOverview}>
                Retry
              </button>
            </section>
          )}
          <section className="state-hero">
          <div className="state-icon">
            <WandSparkles size={23} />
          </div>
          <div>
            <p className="state-overline">
              {evidenceState === "partial" ? "Partial evidence" : "No active evidence"}
            </p>
            <h2>
              {overview.counts.twins === 0
                ? "No creative analysis is running."
                : `${overview.counts.twins} Creative Twin(s) are ready to inspect.`}
            </h2>
            <p>
              {overview.counts.twins === 0
                ? "Import a script, creative asset, landing-page copy, or campaign CSV to build the first Decision Packet. Vanta will keep unavailable inputs visibly unavailable."
                : "Diagnostics are deterministic derivations of what you provided. They are not audience prediction, and every unknown stays labelled unknown."}
            </p>
          </div>
          <button className="primary-button" onClick={() => setActivePanel(guidance.next ? (guidance.next.panel as WorkspacePanel) : overview.counts.twins > 0 ? "matrix" : "intake")}>
            {guidance.next ? guidance.next.title : overview.counts.twins > 0 ? "Open decision matrix" : "Intake asset"} <ChevronRight size={17} />
          </button>
        </section>

        <section className="workspace-grid">
          <article className="workspace-card">
            <div className="card-heading">
              <span>Evidence status</span>
              <span className="pill">{evidenceState}</span>
            </div>
            <div className="blank-chart">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <p>
              {connectedSources.length > 0
                ? `${connectedSources.length} verified connector(s) connected.`
                : unverifiedSources.length > 0
                ? `${unverifiedSources.length} manual unverified source(s) registered. Authorized platform connection required for verified numeric metrics.`
                : "No sources connected. Metrics will not appear until a source is registered or connected."}
            </p>
          </article>

          <article className="workspace-card">
            <div className="card-heading">
              <span>Creative Council</span>
              <span className="pill">runtime not deployed</span>
            </div>
            <ul className="agent-list">
              <li>
                <span className="agent-dot" /> Discovery Agent <em>needs a decision brief</em>
              </li>
              <li>
                <span className="agent-dot" /> Creative Analyst <em>needs an asset</em>
              </li>
              <li>
                <span className="agent-dot" /> Evidence Arbiter <em>waiting for source links</em>
              </li>
            </ul>
            <p className="vp-hint">No agent run has happened. Roles are contracts, not results.</p>
            <button className="link-button" onClick={() => setActivePanel("agents")}>View workflow and runtime gate</button>
          </article>

          <article className="workspace-card span-two">
            <div className="card-heading">
              <span>Guided setup</span>
              <span className="pill">{guidance.next ? "next step ready" : "no next step"}</span>
            </div>
            <p className="vp-hint">{guidance.summary}</p>
            <ol className="vp-steps" aria-label="Workspace readiness ladder">
              {guidance.steps.map((step, i) => (
                <li key={step.id} className={`vp-state-${step.state === "done" ? "configured" : step.state === "blocked" ? "blocked" : step.state === "next" ? "unknown" : "disabled"}`}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <strong style={{ display: "block" }}>{step.title}</strong>
                    <span className="vp-hint">{step.detail}</span>
                  </div>
                  {step.state === "next" ? (
                    <button className="link-button" onClick={() => setActivePanel(step.panel as WorkspacePanel)}>
                      Go
                    </button>
                  ) : (
                    <em>{step.state}</em>
                  )}
                </li>
              ))}
            </ol>
          </article>
        </section>
          </>
        )}
        </Suspense>

      </section>

      <Modal open={newWsModalOpen} title="Create Workspace" onClose={() => setNewWsModalOpen(false)}>
              <form onSubmit={handleCreateWorkspace} className="auth-form">
                <label>
                  Workspace Name
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Creative Lab"
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                  />
                </label>
                {wsError && <p className="error-text">{wsError}</p>}
                <button type="submit" className="primary-button w-full" disabled={creatingWs}>
                  {creatingWs ? "Creating..." : "Create Workspace"}
                </button>
              </form>
      </Modal>
    </main>
  );
}
