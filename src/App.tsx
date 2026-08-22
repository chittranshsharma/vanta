import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleDotDashed,
  Compass,
  Layers3,
  LockKeyhole,
  LogOut,
  Plus,
  ShieldCheck,
  Sparkles,
  User,
  WandSparkles,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { deriveEvidenceState, type EvidenceClass } from "./lib/evidence";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { BrandBrain } from "./components/BrandBrain";
import { SourceRegistry } from "./components/SourceRegistry";
import { CreativeIntake } from "./components/CreativeIntake";
import { fetchSourcesForWorkspace, type SourceRegistryRow } from "./lib/sourceRegistry";
import { fetchWorkspaceAssets, type CreativeAssetRow } from "./lib/creativeIntake";
import { fetchBrandForWorkspace, type Brand } from "./lib/brandBrain";
import {
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  fetchUserProfile,
  fetchUserWorkspaces,
  createNewWorkspace,
  type Profile,
  type WorkspaceWithRole
} from "./lib/auth";

type View = "home" | "workspace";

const stages = [
  ["01", "Ground", "Connect the brand, asset, objective, and evidence."],
  ["02", "Understand", "Build a traceable Creative Twin from supplied material."],
  ["03", "Challenge", "Simulate, diagnose, compare, and expose disagreement."],
  ["04", "Learn", "Turn observed outcomes into the next better experiment."]
] as const;

const evidenceClasses: { label: string; kind: EvidenceClass; note: string }[] = [
  { label: "Observed", kind: "observed", note: "direct import or approved connection" },
  { label: "Sourced", kind: "sourced_claim", note: "attributable public or user-provided claim" },
  { label: "Inference", kind: "inference", note: "bounded model reasoning with assumptions" },
  { label: "Unknown", kind: "unknown", note: "stopped, explained, and never fabricated" }
];

export default function App() {
  const [view, setView] = useState<View>("home");
  const [navOpen, setNavOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  const [sessionUser, setSessionUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceWithRole[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithRole | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Listen to Supabase Auth state changes
  useEffect(() => {
    async function loadUserData(user: any) {
      if (!user) {
        setSessionUser(null);
        setProfile(null);
        setWorkspaces([]);
        setActiveWorkspace(null);
        setLoadingUser(false);
        return;
      }

      setSessionUser(user);
      const userProfile = await fetchUserProfile(user.id);
      setProfile(userProfile);

      const userWs = await fetchUserWorkspaces(user.id);
      setWorkspaces(userWs);
      if (userWs.length > 0) {
        setActiveWorkspace(userWs[0]);
      }
      setLoadingUser(false);
    }

    if (isSupabaseConfigured) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        loadUserData(user);
      });

      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((_event, session) => {
        loadUserData(session?.user || null);
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      setLoadingUser(false);
    }
  }, []);

  const handleOpenWorkspace = () => {
    if (!sessionUser && isSupabaseConfigured) {
      setAuthModalOpen(true);
    } else {
      setView("workspace");
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setView("home");
  };

  if (view === "workspace") {
    return (
      <Workspace
        user={sessionUser}
        profile={profile}
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        setActiveWorkspace={setActiveWorkspace}
        onRefreshWorkspaces={async () => {
          if (sessionUser) {
            const ws = await fetchUserWorkspaces(sessionUser.id);
            setWorkspaces(ws);
          }
        }}
        onExit={() => setView("home")}
        onSignOut={handleSignOut}
        onOpenAuth={() => setAuthModalOpen(true)}
      />
    );
  }

  return (
    <main className="page-shell">
      <div className="noise" aria-hidden="true" />
      <nav className="topbar container">
        <button className="wordmark" onClick={() => setView("home")} aria-label="Vanta home">
          <span className="wordmark-mark" />
          Vanta
        </button>
        <div className={`nav-links ${navOpen ? "is-open" : ""}`}>
          <a href="#method">Method</a>
          <a href="#trust">Trust</a>
          <a href="#workflow">Workflow</a>
        </div>
        <div className="nav-actions">
          {sessionUser ? (
            <button className="ghost-button" onClick={() => setView("workspace")}>
              <User size={14} style={{ marginRight: 6 }} />
              {profile?.full_name || sessionUser.email?.split("@")[0] || "Workspace"}
            </button>
          ) : (
            <button className="ghost-button" onClick={() => setAuthModalOpen(true)}>
              Sign in
            </button>
          )}
          <button className="primary-button-nav" onClick={handleOpenWorkspace}>
            Launch workspace <ArrowUpRight size={14} />
          </button>
          <button
            className="menu-button"
            onClick={() => setNavOpen((value) => !value)}
            aria-expanded={navOpen}
            aria-label="Toggle navigation"
          >
            <span /> <span />
          </button>
        </div>
      </nav>

      <section className="hero container">
        <div className="hero-copy">
          <motion.p
            className="eyebrow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Creative intelligence, grounded in evidence
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
          >
            Make the next
            <span>creative move</span>
            with conviction.
          </motion.h1>
          <motion.p
            className="hero-description"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Vanta turns brand context, creative analysis, trend evidence, and real outcomes into decisions
            your team can inspect, challenge, and improve.
          </motion.p>
          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.28 }}
          >
            <button className="primary-button" onClick={handleOpenWorkspace}>
              Enter Vanta <ArrowUpRight size={17} />
            </button>
            <a className="text-button" href="#workflow">
              See the decision loop <ChevronRight size={16} />
            </a>
          </motion.div>
          <div className="trust-line">
            <LockKeyhole size={14} /> No fabricated metrics. No private-algorithm claims. Ever.
          </div>
        </div>

        <motion.div
          className="hero-orbit"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.1 }}
        >
          <div className="orbital-grid" />
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="signal-core">
            <span className="signal-iris" />
            <span className="signal-dot" />
          </div>
          <div className="float-card card-source">
            <span className="status-dot amber" /> Evidence map <strong>awaiting source</strong>
          </div>
          <div className="float-card card-council">
            <span className="status-dot blue" /> Creative Council <strong>ready to ground</strong>
          </div>
          <div className="float-card card-outcome">
            <span className="status-dot muted" /> Outcome calibration <strong>not measured yet</strong>
          </div>
          <p className="orbital-caption">
            <CircleDotDashed size={15} /> Confidence is earned, not generated.
          </p>
        </motion.div>
      </section>

      <section id="method" className="method-section container">
        <div className="section-heading">
          <p className="eyebrow">A decision system, not another score</p>
          <h2>Every creative recommendation must survive the evidence layer.</h2>
        </div>
        <div className="stage-grid">
          {stages.map(([number, title, description], index) => (
            <motion.article
              className="stage-card"
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: index * 0.08 }}
            >
              <span className="stage-number">{number}</span>
              <span className="stage-line" />
              <h3>{title}</h3>
              <p>{description}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section id="trust" className="trust-section container">
        <div className="trust-copy">
          <p className="eyebrow">Designed to say “I don’t know”</p>
          <h2>Trust is a product surface.</h2>
          <p>
            Vanta separates what happened, what a source says, what a model infers, and what remains unknown.
            Your team can trace every meaningful recommendation back to its evidence.
          </p>
        </div>
        <div className="evidence-stack">
          {evidenceClasses.map((entry, index) => (
            <motion.div
              className={`evidence-row evidence-${entry.kind}`}
              key={entry.kind}
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
            >
              <span>{entry.label}</span>
              <p>{entry.note}</p>
              <CheckCircle2 size={18} />
            </motion.div>
          ))}
        </div>
      </section>

      <section id="workflow" className="workflow-section container">
        <div className="workflow-panel">
          <div>
            <p className="eyebrow">The Vanta loop</p>
            <h2>Ingest → ground → understand → challenge → learn.</h2>
          </div>
          <p>
            The workspace makes the decision path visible: evidence, assumptions, source freshness,
            disagreement, approval, and the next experiment all live in the same place.
          </p>
          <button className="primary-button" onClick={handleOpenWorkspace}>
            Explore workspace <Compass size={17} />
          </button>
        </div>
      </section>

      <footer className="footer container">
        <span className="wordmark">
          <span className="wordmark-mark" /> Vanta
        </span>
        <p>Creative decisions, backed by evidence.</p>
        <span>Tenant-isolated · Supabase Auth & RLS active</span>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
        setMode={setAuthMode}
        onSuccess={() => {
          setAuthModalOpen(false);
          setView("workspace");
        }}
      />
    </main>
  );
}

function Workspace({
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
  user: any | null;
  profile: Profile | null;
  workspaces: WorkspaceWithRole[];
  activeWorkspace: WorkspaceWithRole | null;
  setActiveWorkspace: (ws: WorkspaceWithRole) => void;
  onRefreshWorkspaces: () => Promise<void>;
  onExit: () => void;
  onSignOut: () => void;
  onOpenAuth: () => void;
}) {
  const [sources, setSources] = useState<SourceRegistryRow[]>([]);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [assets, setAssets] = useState<CreativeAssetRow[]>([]);
  const [activePanel, setActivePanel] = useState<"decision" | "brand" | "sources" | "intake">("decision");
  const [newWsModalOpen, setNewWsModalOpen] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [creatingWs, setCreatingWs] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadWorkspaceData() {
      if (!activeWorkspace) {
        setSources([]);
        setBrand(null);
        setAssets([]);
        return;
      }
      const [sRes, bRes, aRes] = await Promise.all([
        fetchSourcesForWorkspace(activeWorkspace.id),
        fetchBrandForWorkspace(activeWorkspace.id),
        fetchWorkspaceAssets(activeWorkspace.id)
      ]);
      if (mounted) {
        setSources(sRes);
        setBrand(bRes);
        setAssets(aRes);
      }
    }
    loadWorkspaceData();
    return () => {
      mounted = false;
    };
  }, [activeWorkspace?.id]);

  const connectedSources = sources.filter((s) => s.health_status === "connected");
  const unverifiedSources = sources.filter((s) => s.health_status === "unverified");
  const isFreshConnected = connectedSources.some(
    (s) =>
      s.last_verified_at &&
      Date.now() - new Date(s.last_verified_at).getTime() <
        (s.freshness_window_days || 30) * 24 * 60 * 60 * 1000
  );

  const evidenceState = deriveEvidenceState({
    sourceCount: connectedSources.length,
    hasConflict: false,
    isFresh: isFreshConnected
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

        <div className="sidebar-nav">
          <button className={`side-link ${activePanel === "decision" ? "active" : ""}`} onClick={() => setActivePanel("decision")}>
            <Layers3 size={17} /> Decision room
          </button>
          <button className={`side-link ${activePanel === "brand" ? "active" : ""}`} onClick={() => setActivePanel("brand")}>
            <Sparkles size={17} /> Brand Brain
          </button>
          <button className={`side-link ${activePanel === "intake" ? "active" : ""}`} onClick={() => setActivePanel("intake")}>
            <WandSparkles size={17} /> Creative intake
          </button>
          <button className={`side-link ${activePanel === "sources" ? "active" : ""}`} onClick={() => setActivePanel("sources")}>
            <Compass size={17} /> Source registry
          </button>
        </div>

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
              <button className="signout-button" onClick={onSignOut} title="Sign out">
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <div className="auth-prompt">
              <div className="auth-prompt-text">
                <ShieldCheck size={14} color="#85c7e9" />
                <span>Supabase RLS active</span>
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
              {activeWorkspace ? `${activeWorkspace.name} · ${activeWorkspace.role}` : "Decision Room"}
            </p>
            <h1>
              {activePanel === "brand"
                ? "Brand Brain"
                : activePanel === "intake"
                ? "Creative Intake"
                : activePanel === "sources"
                ? "Source Registry"
                : "Start with what you can prove."}
            </h1>
          </div>
          <button className="ghost-button" onClick={onExit}>
            Back to site
          </button>
        </header>

        {activePanel === "brand" && activeWorkspace && user ? (
          <div style={{ marginTop: 32 }}>
            <BrandBrain
              workspaceId={activeWorkspace.id}
              userId={user.id}
              isAdmin={activeWorkspace.role === "owner" || activeWorkspace.role === "admin"}
            />
          </div>
        ) : activePanel === "intake" && activeWorkspace && user ? (
          <div style={{ marginTop: 32 }}>
            <CreativeIntake
              workspaceId={activeWorkspace.id}
              userId={user.id}
              isAdmin={activeWorkspace.role === "owner" || activeWorkspace.role === "admin"}
            />
          </div>
        ) : activePanel === "sources" && activeWorkspace && user ? (
          <div style={{ marginTop: 32 }}>
            <SourceRegistry
              workspaceId={activeWorkspace.id}
              userId={user.id}
              isAdmin={activeWorkspace.role === "owner" || activeWorkspace.role === "admin"}
            />
          </div>
        ) : (
          <>
          <section className="state-hero">
          <div className="state-icon">
            <WandSparkles size={23} />
          </div>
          <div>
            <p className="state-overline">
              {evidenceState === "partial" ? "Partial evidence" : "No active evidence"}
            </p>
            <h2>No creative analysis is running.</h2>
            <p>
              Import a script, creative asset, landing-page copy, or campaign CSV to build the first Decision
              Packet. Vanta will keep unavailable inputs visibly unavailable.
            </p>
          </div>
          <button className="primary-button" onClick={() => setActivePanel("intake")}>
            Intake asset <ChevronRight size={17} />
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
              <span className="pill">standby</span>
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
          </article>

          <article
            className="workspace-card span-two"
            style={{ cursor: "pointer" }}
            onClick={() => {
              if (!brand || !brand.name) setActivePanel("brand");
              else if (assets.length === 0) setActivePanel("intake");
              else setActivePanel("sources");
            }}
          >
            <div className="card-heading">
              <span>Next safe action</span>
              <span className="pill">guided</span>
            </div>
            <div className="next-action">
              <span>{!brand || !brand.name ? "01" : assets.length === 0 ? "02" : "03"}</span>
              <div>
                <h3>
                  {!brand || !brand.name
                    ? "Configure Brand Brain"
                    : assets.length === 0
                    ? "Intake First Creative Asset"
                    : "Ground Sources & Evidence"}
                </h3>
                <p>
                  {!brand || !brand.name
                    ? "Define the product, target audience, approved claims, and objective before connecting sources or generating recommendations."
                    : assets.length === 0
                    ? "Submit an ad script, hook variation, or landing copy to construct a grounded Creative Twin manifest."
                    : "Connect authorized platform sources and verify citations before running agent evaluations."}
                </p>
              </div>
              <ChevronRight size={19} />
            </div>
          </article>
        </section>
          </>
        )}

      </section>

      {/* New Workspace Modal */}
      <AnimatePresence>
        {newWsModalOpen && (
          <div className="modal-backdrop">
            <motion.div
              className="auth-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="auth-card-header">
                <h3>Create Workspace</h3>
                <button className="close-btn" onClick={() => setNewWsModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

function AuthModal({
  isOpen,
  onClose,
  mode,
  setMode,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  mode: "signin" | "signup";
  setMode: (mode: "signin" | "signup") => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    if (mode === "signup") {
      const { error } = await signUpWithEmail(email, password, fullName);
      setLoading(false);
      if (error) {
        setErrorMsg(error.message);
      } else {
        onSuccess();
      }
    } else {
      const { error } = await signInWithEmail(email, password);
      setLoading(false);
      if (error) {
        setErrorMsg(error.message);
      } else {
        onSuccess();
      }
    }
  };

  return (
    <div className="modal-backdrop">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
      >
        <div className="auth-card-header">
          <div className="wordmark">
            <span className="wordmark-mark" /> Vanta
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === "signin" ? "active" : ""}`}
            onClick={() => {
              setMode("signin");
              setErrorMsg(null);
            }}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${mode === "signup" ? "active" : ""}`}
            onClick={() => {
              setMode("signup");
              setErrorMsg(null);
            }}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "signup" && (
            <label>
              Full Name
              <input
                type="text"
                required
                placeholder="Alex Morgan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
          )}

          <label>
            Email Address
            <input
              type="email"
              required
              placeholder="alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {errorMsg && <p className="error-text">{errorMsg}</p>}

          <button type="submit" className="primary-button w-full" disabled={loading}>
            {loading ? "Verifying..." : mode === "signin" ? "Sign In to Workspace" : "Create Account"}
          </button>
        </form>

        <div className="auth-footer">
          <ShieldCheck size={13} />
          <span>Tenant isolation enforced with Row Level Security</span>
        </div>
      </motion.div>
    </div>
  );
}
