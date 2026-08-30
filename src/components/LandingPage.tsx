import type { User as AuthUser } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
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

      {/* TOPBAR — Deep cinematic black banner */}
      <nav className="topbar" aria-label="Main Navigation">
        <div className="wordmark-group">
          <button className="wordmark" onClick={onGoHome} aria-label="Vanta home">
            V A N T A
          </button>
          <span className="wordmark-subtitle">
            Creative intelligence, grounded in evidence.
          </span>
        </div>

        <div className={`nav-links ${navOpen ? "is-open" : ""}`}>
          <a href="#decision-room" onClick={() => setNavOpen(false)}>Product</a>
          <a href="#method" onClick={() => setNavOpen(false)}>Method</a>
          <a href="#trust" onClick={() => setNavOpen(false)}>Evidence</a>
          <a href="#twin" onClick={() => setNavOpen(false)}>Decision Room</a>
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
            Enter workspace
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

      {/* SUBTOPBAR — Light sub-header line */}
      <aside className="subtopbar" aria-label="Quick Actions">
        <span className="subtopbar-title">Decision Room</span>
        <button className="subtopbar-action" onClick={onOpenWorkspace}>
          Start a record <ChevronRight size={14} />
        </button>
      </aside>

      {/* HERO SECTION — Inspired directly by the canonical specification */}
      <section className="hero container" id="decision-room">
        <div className="hero-copy">
          <motion.p
            className="hero-eyebrow-accent"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            The Evidence Layer for Creative
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
          >
            Make creative
            <span>decisions you</span>
            <span>can defend.</span>
          </motion.h1>
          <motion.p
            className="hero-description"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
          >
            Brand truth, source provenance, creative structure, and observed outcomes in one clear record.
          </motion.p>
          <motion.div
            className="hero-cta-group"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.18 }}
          >
            <button className="primary-button" onClick={onOpenWorkspace}>
              Enter Vanta <ArrowUpRight size={15} />
            </button>
            <button className="action-link" onClick={onOpenWorkspace}>
              Explore Vanta <ChevronRight size={15} />
            </button>
            <a className="action-link" href="#method">
              See the method <ChevronRight size={15} />
            </a>
          </motion.div>
          <p className="hero-footnote" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <LockKeyhole size={13} style={{ color: "var(--v-ink-muted-48)" }} /> Built for unknowns, not invented certainty.
          </p>
        </div>

        {/* HERO GRAPHIC — The Canonically Modeled Decision Room Product Tile */}
        <motion.div
          className="decision-room-card"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          aria-label="Decision Room Interactive Overview"
        >
          <div className="dr-header">
            <span className="dr-title">Decision Room</span>
            <div className="dr-legend">
              <span className="dr-legend-item">
                <span className="dr-legend-dot dot-observed" /> Observed
              </span>
              <span className="dr-legend-item">
                <span className="dr-legend-dot dot-sourced" /> Sourced claim
              </span>
              <span className="dr-legend-item">
                <span className="dr-legend-dot dot-inference" /> Inference
              </span>
              <span className="dr-legend-item">
                <span className="dr-legend-dot dot-unknown" /> Unknown
              </span>
            </div>
          </div>

          <div className="dr-grid">
            {/* Panel 1: Brand Brain */}
            <div className="dr-quadrant">
              <span className="dr-quadrant-title">
                <span>1</span> Brand Brain
              </span>
              <ul className="dr-list">
                <li className="dr-list-item">
                  <Check size={14} color="#16a34a" /> Approved claims
                </li>
                <li className="dr-list-item">
                  <Check size={14} color="#16a34a" /> Proof points
                </li>
                <li className="dr-list-item">
                  <Check size={14} color="#16a34a" /> Boundaries
                </li>
              </ul>
            </div>

            {/* Panel 2: Source Registry */}
            <div className="dr-quadrant">
              <span className="dr-quadrant-title">
                <span>2</span> Source Registry
              </span>
              <table className="dr-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th style={{ textAlign: "center" }}>Freshness</th>
                    <th style={{ textAlign: "center" }}>Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Product proof</td>
                    <td style={{ textAlign: "center" }}>
                      <span className="status-dot green" style={{ margin: 0 }} />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <Circle size={10} color="#16a34a" />
                    </td>
                  </tr>
                  <tr>
                    <td>Customer interview</td>
                    <td style={{ textAlign: "center" }}>
                      <span className="status-dot green" style={{ margin: 0 }} />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <Circle size={10} color="#16a34a" />
                    </td>
                  </tr>
                  <tr>
                    <td>Campaign brief</td>
                    <td style={{ textAlign: "center" }}>
                      <span className="status-dot blue" style={{ margin: 0 }} />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <Circle size={10} color="#7c3aed" strokeDasharray="2 2" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Panel 3: Creative Twin */}
            <div className="dr-quadrant">
              <span className="dr-quadrant-title">
                <span>3</span> Creative Twin
              </span>
              <div className="dr-twin-container">
                <div className="dr-twin-labels">
                  <div className="dr-twin-col">
                    <span className="dr-scene-num">Scene 01</span>
                    <span className="dr-scene-tag">Hook</span>
                  </div>
                  <div className="dr-twin-col">
                    <span className="dr-scene-num">Scene 02</span>
                    <span className="dr-scene-tag">Demonstration</span>
                  </div>
                  <div className="dr-twin-col">
                    <span className="dr-scene-num">Scene 03</span>
                    <span className="dr-scene-tag">CTA</span>
                  </div>
                </div>

                <div className="dr-track-wrapper">
                  <div className="dr-track-line" />
                  <div className="dr-scrub-pin">
                    <span className="dr-scrub-circle" />
                  </div>
                </div>

                <div className="dr-twin-bottom">
                  <span className="dr-twin-time">0:00 – 0:05</span>
                  <div className="dr-twin-mid-callout">
                    <span className="dr-twin-time">0:05 – 0:15</span>
                    <span className="dr-callout-badge">Human correction</span>
                  </div>
                  <span className="dr-twin-time">0:15 – 0:20</span>
                </div>
              </div>
            </div>

            {/* Panel 4: Known Gaps */}
            <div className="dr-quadrant">
              <span className="dr-quadrant-title">
                <span>4</span> Known Gaps
              </span>
              <ul className="dr-list">
                <li className="dr-list-item" style={{ color: "var(--v-ink-muted-80)" }}>
                  <Circle size={12} color="#9ca3af" /> Observed outcome not yet available
                </li>
                <li className="dr-list-item" style={{ color: "var(--v-ink-muted-80)" }}>
                  <Circle size={12} color="#9ca3af" /> Claim requires source
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      </section>

      {/* THREE PILLAR STRIP — DIRECTLY BELOW HERO */}
      <section className="pillar-strip" aria-label="Core Value Pillars">
        <div className="container pillar-grid">
          <div className="pillar-card">
            <span className="pillar-number">01</span>
            <h2 className="pillar-title">Evidence before confidence</h2>
            <p className="pillar-desc">Ground every decision in verifiable inputs.</p>
          </div>
          <div className="pillar-card">
            <span className="pillar-number">02</span>
            <h2 className="pillar-title">Structure before speculation</h2>
            <p className="pillar-desc">Organize ideas into testable, shared structure.</p>
          </div>
          <div className="pillar-card">
            <span className="pillar-number">03</span>
            <h2 className="pillar-title">Outcomes before claims</h2>
            <p className="pillar-desc">Let observed outcomes refine what's true.</p>
          </div>
        </div>
      </section>

      {/* CINEMATIC BLACK QUOTE BANNER */}
      <section className="cinematic-quote-banner" aria-label="Cinematic Philosophy">
        <div className="container">
          <h2 className="cinematic-quote-text">
            See the work before you trust the answer.
          </h2>
        </div>
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


