import type { User as AuthUser } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, ChevronRight, CircleDotDashed, Compass, LockKeyhole, User } from "lucide-react";
import { useState } from "react";
import type { EvidenceClass } from "../lib/evidence";
import type { Profile } from "../lib/auth";

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
      <nav className="topbar container">
        <button className="wordmark" onClick={onGoHome} aria-label="Vanta home">
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
            <button className="primary-button" onClick={onOpenWorkspace}>
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
          <button className="primary-button" onClick={onOpenWorkspace}>
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
    </main>
  );
}
