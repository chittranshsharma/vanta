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

---

## ADR-010 - 2026-08-23 - Repository-first audit phase; live Supabase checks deferred

**Decision:** Phase 0 runs without Supabase dashboard, MCP, or SQL access. Findings that need the live project are recorded in `docs/supabase-deferred-validation.md` and marked "static review only - live verification deferred" everywhere they are mentioned.

**Rationale:** The continuation prompt removed live access for this phase. Blocking all improvement on it would have left the repository with a tautological RLS test suite, a schema missing RLS on 8 tables, and a non-functional gateway audit path.

**Consequences:** Migration `20260822000007_brand_brain_rls.sql` is authored but unapplied. `src/lib/migrations.test.ts` proves only what the files declare. QA-1 remains the live isolation proof.

---

## ADR-011 - 2026-08-23 - Tailwind v4 utilities layer (no preflight) alongside the hand-written design system

**Decision:** Add `tailwindcss` + `@tailwindcss/vite` as dev dependencies and import only `theme.css` and `utilities.css` layers in `src/styles.css`.

**Rationale:** `CreativeTwinEditor.tsx`, `DecisionMatrix.tsx`, and `TimelineDoctor.tsx` (Tickets 4.1 and 4.2) were written with 268 distinct Tailwind utility classes, but Tailwind was never installed and `styles.css` defined none of them. Those panels rendered unstyled. Installing the utilities layer makes the existing code correct with zero component rewrites. Skipping preflight keeps the hand-written shell CSS byte-for-byte unaffected.

**Consequences:** Two styling idioms coexist. New shell-level UI should use the tokenized CSS; panel-internal layout may use utilities. The earlier "zero Tailwind overhead" claim in the README was false in practice and has been removed.

---

## ADR-012 - 2026-08-23 - Loading state is derived from keyed results, not set inside effects

**Decision:** Data loaders in `App.tsx` store results keyed by the request (workspace id, refresh token). "Loading" is computed as "no result for the current key". Per-workspace panels are mounted with `key={workspaceId}` so their internal state resets on workspace switch.

**Rationale:** React 19's `react-hooks` rules flag synchronous `setState` inside effects (cascading renders). Keyed results remove the need for it, make stale-response races impossible, and keep a failed read distinguishable from an empty workspace.

**Consequences:** Retry actions reset the result for the current key rather than toggling a boolean. Components that still call a loader from an effect do so with `loading` initialised `true` and a separate `reload()` for user-triggered refreshes.

## ADR-013 - 2026-08-23 - Foundations ship as honest setup-required panels before their runtimes exist

Context: the specification calls for research connectors, experiments and calibration, agent workflows, and publishing intelligence. None of their runtimes (OAuth apps, workers, agent task types, observed history) exist in this build.

Decision: build each as a pure contract (`shared/experiments/model.ts`, `shared/agents/graph.ts`, `shared/connectors/providers.ts`), a typed client where a table is authored, and a workspace panel whose default state is `unknown`, `blocked`, or `unavailable` with the exact reasons and next inputs. Panels never simulate a run, a result, or a recommendation. Capability gates treat `unknown` as unavailable (`gateRuntime`). A client flag only renders UI; it never enables a server task.

Consequences: the product shell shows the full intended surface without fabricating progress; every later live step has a place to land; reviewers can audit the contracts now. Cost: several panels are intentionally empty until operators apply migrations and deploy runtimes.
