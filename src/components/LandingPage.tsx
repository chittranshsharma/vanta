import type { User as AuthUser } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleDotDashed,
  Compass,
  FileCheck,
  LockKeyhole,
  ShieldCheck,
  User
} from "lucide-react";
import { useState } from "react";
import type { EvidenceClass } from "../lib/evidence";
import type { Profile } from "../lib/auth";

const stages = [
  ["01", "Ground", "Connect brand context, approved claims, and audience segments in Brand Brain."],
  ["02", "Understand", "Decompose assets into a deterministic Creative Twin with verified scene pacing."],
  ["03", "Challenge", "Simulate counterfactual hook/CTA mutations and expose structural disagreement."],
  ["04", "Calibrate", "Link observed campaign outcomes to eliminate conjecture and refine future runs."]
] as const;

const evidenceClasses: { label: string; kind: EvidenceClass; note: string }[] = [
  { label: "Observed", kind: "observed", note: "Direct platform API sync, user import, or measured campaign outcome" },
  { label: "Sourced", kind: "sourced_claim", note: "Attributable third-party evidence with explicit cited origin and date" },
  { label: "Inference", kind: "inference", note: "Bounded model reasoning with visible assumptions, input IDs, and uncertainty" },
  { label: "Simulation", kind: "simulation", note: "Counterfactual structural delta; never labeled as human feedback or fact" },
  { label: "Unknown", kind: "unknown", note: "Stopped, explained, and never fabricated when evidence is absent or stale" }
];

interface LandingPageProps {
  sessionUser: AuthUser | null;
  profile: Profile | null;
  /** Primary CTA: opens the workspace, or the auth dialog when signed out. */
  onOpenWorkspace: () => void;
  onOpenAuth: () => void;
  onGoWorkspace: () => void;
  onGoHome: () => void;
}

export function LandingPage({ sessionUser, profile, onOpenWorkspace, onOpenAuth, onGoWorkspace, onGoHome }: LandingPageProps) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <main className="page-shell">
      <div className="noise" aria-hidden="true" />
      <nav className="topbar container" aria-label="Main Navigation">
        <button className="wordmark" onClick={onGoHome} aria-label="Vanta home">
          <span className="wordmark-mark" />
          Vanta
        </button>
        <div className={`nav-links ${navOpen ? "is-open" : ""}`}>
          <a href="#method" onClick={() => setNavOpen(false)}>Method</a>
          <a href="#twin" onClick={() => setNavOpen(false)}>Creative Twin</a>
          <a href="#trust" onClick={() => setNavOpen(false)}>Evidence</a>
          <a href="#workflow" onClick={() => setNavOpen(false)}>Workflow</a>
        </div>
        <div className="nav-actions">
          {sessionUser ? (
            <button className="ghost-button" onClick={onGoWorkspace}>
              <User size={14} style={{ marginRight: 6 }} />
              {profile?.full_name || sessionUser.email?.split("@")[0] || "Workspace"}
            </button>
          ) : (
            <button className="ghost-button" onClick={onOpenAuth}>
              Sign in
            </button>
          )}
          <button className="primary-button-nav" onClick={onOpenWorkspace}>
            Enter Vanta <ArrowUpRight size={14} />
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

      {/* HERO SECTION — Pristine light canvas */}
      <section className="hero container">
        <div className="hero-copy">
          <motion.p
            className="eyebrow"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            Creative intelligence, grounded in evidence
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            Make the next
            <span>creative move</span>
            with conviction.
          </motion.h1>
          <motion.p
            className="hero-description"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12 }}
          >
            Vanta turns brand context, creative analysis, trend evidence, and real outcomes into decisions
            your team can inspect, challenge, and improve.
          </motion.p>
          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
          >
            <button className="primary-button" onClick={onOpenWorkspace}>
              Enter Vanta <ArrowUpRight size={17} />
            </button>
            <a className="text-button" href="#twin">
              Inspect Creative Twin <ChevronRight size={16} />
            </a>
          </motion.div>
          <div className="trust-line">
            <LockKeyhole size={14} /> No fabricated metrics. No private-algorithm claims. Ever.
          </div>
        </div>

        <motion.div
          className="hero-orbit"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.08 }}
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
            <span className="status-dot green" /> Brand Brain <strong>Codex v2.4 Active</strong>
          </div>
          <div className="float-card card-council">
            <span className="status-dot blue" /> Creative Twin <strong>4 Scenes · 138 WPM</strong>
          </div>
          <div className="float-card card-simulation">
            <span className="status-dot amber" /> Simulation Lab <strong>Δ Structural Delta</strong>
          </div>
          <div className="float-card card-outcome">
            <span className="status-dot muted" /> Outcome Calibration <strong>Awaiting Data</strong>
          </div>
          <p className="orbital-caption">
            <CircleDotDashed size={15} /> Confidence is earned, not generated.
          </p>
        </motion.div>
      </section>

      {/* METHOD SECTION — Systematic 4-stage process */}
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
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.35, delay: index * 0.06 }}
            >
              <span className="stage-number">{number}</span>
              <span className="stage-line" />
              <h3>{title}</h3>
              <p>{description}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* EDITORIAL GALLERY TILE — Dark surface showcasing the Creative Twin */}
      <section id="twin" className="gallery-section container">
        <div className="gallery-tile-dark">
          <div className="gallery-header">
            <p className="eyebrow">Structured Creative Twins</p>
            <h2>A deterministic mirror of your creative asset.</h2>
            <p>
              No black-box virality scores. Vanta decomposes every script and creative asset into verifiable
              scenes, shot purposes, reading burden, and lexical claims aligned to your Brand Codex.
            </p>
          </div>

          <div className="twin-showcase-grid">
            <div className="twin-scenes-deck">
              <div className="twin-scene-card">
                <div className="twin-scene-meta">
                  <span className="twin-scene-purpose">Hook</span>
                  <span className="twin-scene-timing">0.0s – 3.2s · 142 WPM</span>
                </div>
                <p className="twin-scene-text">
                  “Stop guessing what worked in your last campaign. The evidence already exists.”
                </p>
                <span className="twin-scene-claim">
                  <FileCheck size={13} /> Grounded: Brand Codex Core Proposition
                </span>
              </div>

              <div className="twin-scene-card">
                <div className="twin-scene-meta">
                  <span className="twin-scene-purpose">Problem</span>
                  <span className="twin-scene-timing">3.2s – 7.7s · 136 WPM</span>
                </div>
                <p className="twin-scene-text">
                  “Every platform optimization tool gives you a different black-box score without showing its work.”
                </p>
                <span className="twin-scene-claim">
                  <CheckCircle2 size={13} /> Sourced Claim: Industry Diagnostic Benchmark
                </span>
              </div>

              <div className="twin-scene-card">
                <div className="twin-scene-meta">
                  <span className="twin-scene-purpose">Proof</span>
                  <span className="twin-scene-timing">7.7s – 12.8s · 128 WPM</span>
                </div>
                <p className="twin-scene-text">
                  “Vanta separates what is observed from what is inferred, so your team can challenge every move.”
                </p>
                <span className="twin-scene-claim">
                  <ShieldCheck size={13} /> Grounded: Epistemic Invariant #1
                </span>
              </div>

              <div className="twin-scene-card">
                <div className="twin-scene-meta">
                  <span className="twin-scene-purpose">CTA</span>
                  <span className="twin-scene-timing">12.8s – 15.8s · 120 WPM</span>
                </div>
                <p className="twin-scene-text">
                  “Enter your workspace, connect your sources, and inspect the evidence trail.”
                </p>
                <span className="twin-scene-claim">
                  <FileCheck size={13} /> Verified Action Link
                </span>
              </div>
            </div>

            <div className="twin-diagnostic-panel">
              <div className="diagnostic-item">
                <span className="diagnostic-label">Pacing & Reading Burden</span>
                <span className="diagnostic-value">132 WPM Average</span>
                <span className="diagnostic-note">Optimal conversational cadence · zero dense spikes</span>
              </div>
              <div className="diagnostic-item">
                <span className="diagnostic-label">Brand Codex Alignment</span>
                <span className="diagnostic-value">3 of 3 Grounded</span>
                <span className="diagnostic-note">Zero prohibited or unverified assertions detected</span>
              </div>
              <div className="diagnostic-item">
                <span className="diagnostic-label">Media Context</span>
                <span className="diagnostic-value">Unknown · Flagged</span>
                <span className="diagnostic-note">Audio layer not provided; never fabricated or assumed</span>
              </div>
              <div className="diagnostic-item">
                <span className="diagnostic-label">Evidence Coverage</span>
                <span className="diagnostic-value">100% Citable</span>
                <span className="diagnostic-note">All statements traceable to registered source records</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST / EVIDENCE SECTION — All 5 canonical evidence classes */}
      <section id="trust" className="trust-section container">
        <div className="trust-copy">
          <p className="eyebrow">Designed to say “I don’t know”</p>
          <h2>Trust is a product surface.</h2>
          <p>
            Vanta strictly separates what happened, what a source says, what a model infers, what a
            simulation mutates, and what remains unknown. Your team can trace every recommendation back
            to its verified evidence trail.
          </p>
        </div>
        <div className="evidence-stack">
          {evidenceClasses.map((entry, index) => (
            <motion.div
              className={`evidence-row evidence-${entry.kind}`}
              key={entry.kind}
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
            >
              <span className={`bb-status-pill class-${entry.kind === "sourced_claim" ? "sourced" : entry.kind}`}>
                {entry.label}
              </span>
              <p>{entry.note}</p>
              <CheckCircle2 size={18} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* WORKFLOW / CLOSING SECTION — Reassuring technical guarantees */}
      <section id="workflow" className="workflow-section container">
        <div className="workflow-panel">
          <div>
            <p className="eyebrow">The Closed-Loop Decision Architecture</p>
            <h2>Ingest → ground → understand → challenge → calibrate.</h2>
          </div>
          <p>
            The workspace makes the decision path visible: evidence provenance, source freshness,
            counterfactual simulations, human approvals, and calibrated outcomes all live in the same place.
          </p>
          <button className="primary-button" onClick={onOpenWorkspace}>
            Explore workspace <Compass size={17} />
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer container">
        <span className="wordmark">
          <span className="wordmark-mark" /> Vanta
        </span>
        <p>Creative decisions, backed by evidence.</p>
        <span>Tenant-isolated · Supabase Auth & RLS active</span>
      </footer>
    </main>
  );
}

