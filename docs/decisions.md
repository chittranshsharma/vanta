# Vanta — Architecture Decision Records

Append-only. Never edit past entries. One ADR per decision.

---

## ADR-001 — 2026-08-22 — React + Vite + TypeScript for frontend

**Decision:** Use React 19, Vite 7, TypeScript 5.9 (strict), Framer Motion, and Lucide React.

**Rationale:** Scaffold was already initialized with this stack. Blueprint §tech-stack recommends React + Vite. Avoids framework churn before core evidence model is stable.

**Consequences:** No SSR at this stage. Cloudflare Pages static hosting is sufficient for Phase 0–1. SSR can be added later if needed for SEO or server rendering.

**Blueprint section:** §Canonical free-first technology stack

---

## ADR-002 — 2026-08-22 — Supabase for Auth, Postgres, RLS, and Storage

**Decision:** Use Supabase as the database, authentication, row-level security, and file storage layer.

**Rationale:** Blueprint recommends Supabase as the free-first database + auth foundation. Project already has `@supabase/supabase-js` installed and a named Supabase project `vanta` is available via Supabase MCP. No alternative was evaluated because the scaffold already committed to this path.

**Consequences:** Free tier: 500 MB database, 1 GB storage, 5 GB egress, 2 active projects. Free projects may pause after inactivity. RLS is mandatory before exposing the anon key to the browser.

**Blueprint section:** §Authentication and database

---

## ADR-003 — 2026-08-22 — Vanilla CSS (no Tailwind) for initial styling

**Decision:** Use custom CSS with CSS custom properties rather than Tailwind CSS.

**Rationale:** `src/styles.css` already implements the full design system in ~15 KB of hand-crafted CSS with the cinematic dark aesthetic. Adopting Tailwind at this stage would require rewriting all existing styles and adds build complexity. Blueprint allows Tailwind but does not require it.

**Consequences:** Tailwind can be introduced later (ADR required) if component count grows large enough to benefit from utility-first classes. All design tokens must remain in `:root` custom properties.

**Blueprint section:** §1 Cinematic public site

---

## ADR-004 — 2026-08-22 — Groq as primary LLM gateway (server-side only)

**Decision:** Route all structured LLM calls through a server-side Groq adapter. Gemini Developer API is the declared fallback.

**Rationale:** Blueprint mandates server-side model key handling. Groq provides fast structured outputs. Gemini API is multimodal and covers long-context reasoning. Neither key may appear in browser code.

**Consequences:** Cloudflare Workers gateway is required before any model call can be made in production. In Phase 0–1 (local dev only), no real model calls are made. Keys are kept in `.env` (gitignored).

**Blueprint section:** §LLM gateway

---

## ADR-005 — 2026-08-22 — Custom TypeScript task-graph orchestrator (no LangChain/AutoGen)

**Decision:** Implement agent orchestration as a custom TypeScript task graph backed by Postgres state tables.

**Rationale:** Blueprint explicitly says "Use a custom typed task-graph orchestrator first. Do not add heavy agent frameworks until the task graph, evidence contract, retries, and observability are stable." This avoids early lock-in to a framework that may not fit the evidence-gating model.

**Consequences:** Higher initial implementation cost for the orchestrator. Benefit is full control over evidence validation, retries, and audit trails. Framework can be adopted later with a new ADR.

**Blueprint section:** §Agent orchestrator
