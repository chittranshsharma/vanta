# Ordered Build Tickets

## How to use

Work one ticket at a time. Add concrete sub-tasks to repository `todo.md`; mark them complete only after the listed acceptance criteria pass. Do not jump to a later ticket because it looks more exciting.

### Ticket 0.1 — Durable project memory and repository audit

**Goal:** establish continuation files and inspect the actual repository.

**Work:** Create the six durable docs from `00_MASTER_INSTRUCTION.md`. Inventory framework, auth, database, routes, existing components, scripts, test setup, secrets, assets, and deployment constraints. Create a small design direction and a risk register.

**Acceptance:** `todo.md`, blueprint index, constitution, architecture, decisions, and build state exist; no fake live feature added; baseline type check/test status captured.

### Ticket 0.2 — Design system and information architecture

**Goal:** define the public site and workspace navigation before feature pages.

**Work:** Establish color tokens, typography, elevation, grid, motion, reduced motion, responsive breakpoints, ReactBits wrapper API, marketing routes, and workspace shell.

**Acceptance:** design tokens documented; global navigation and empty state patterns specified; accessibility and visual-test plan recorded.

### Ticket 1.1 — Cinematic marketing site

**Goal:** implement the public landing experience.

**Work:** Build a distinctive hero, product narrative, evidence-first differentiators, workflow section, agent resilience section, source-compliance section, CTA, and responsive footer. Use original UI—not copied competitor copy or fabricated testimonials.

**Acceptance:** no layout overflow at mobile/desktop, keyboard navigation, readable contrast, reduced-motion behavior, screenshot review, no fake social proof.

### Ticket 2.1 — Auth, workspaces, roles, and audit foundation

**Goal:** create the secure product boundary.

**Work:** Implement workspace membership, roles, authorization, audit events, and workspace selector using scaffold conventions.

**Acceptance:** cross-workspace access tests fail safely; every protected route verifies ownership; audit records exist for membership/policy changes.

### Ticket 2.2 — Brand Brain and Brand Codex

**Goal:** create durable brand context.

**Work:** Add product positioning, approved/prohibited claims, audience segments, competitors, tone, proof points, compliance rules, version history, and approval state.

**Acceptance:** all fields are versioned and tenant-scoped; user edits are auditable; incomplete brand state creates a guided question/unknown state.

### Ticket 3.1 — Evidence Layer and source registry

**Goal:** implement provenance before intelligence.

**Work:** Add source connections, manual URL/import metadata, evidence classes, freshness/coverage, source health, and canonical metric definitions.

**Acceptance:** an uncited claim cannot pass validation; stale and disconnected source states render; no source is displayed as connected without verified status.

### Ticket 3.2 — Ingestion workflows

**Goal:** import scripts, hooks, captions, CTAs, first frames, landing copy, links, and campaign CSVs.

**Work:** Build schema validation, import previews, required fields, parsing errors, mappings, provenance, and delete/retention states.

**Acceptance:** malformed imports are rejected with actionable errors; imported data has timestamp/source metadata; no hidden transformation alters observed records.

### Ticket 4.1 — Creative Twin

**Goal:** create a structured creative representation.

**Work:** Add asset records, extraction jobs, transcript/scene/claim/CTA features, confidence, manual correction, and partial asset states.

**Acceptance:** unavailable media details remain unavailable; each derived feature links to raw input/extract run; manual corrections are versioned.

### Ticket 4.2 — Creative Decision Matrix and Timeline Doctor

**Goal:** make decisions inspectable.

**Work:** Build variant comparison, audience/objective dimensions, evidence cards, timeline findings, unsupported-claim flags, and precise-edit brief.

**Acceptance:** every score/claim has class and provenance; empty/stale/conflict states are designed; no single opaque “viral score.”

### Ticket 5.1 — Agent task graph and Evidence Arbiter

**Goal:** build durable multi-agent orchestration safely.

**Work:** Implement Decision Packets, task state machine, Agent Findings, provider adapter, evidence validation, audit records, and health console foundation.

**Acceptance:** typed output validation; tasks resume from persisted state; unsupported facts block; run history includes model/provider/prompt/fallback.

### Ticket 5.2 — Specialist agents and fallback matrix

**Goal:** add the specialized council one role at a time.

**Work:** Implement Discovery, Brand Guardian, Creative Analyst, Audience Strategist, Journey Simulator, Trend Researcher, Publishing Engineer, Creative Director, Mutation Engineer, Experiment Manager, and Outcome Analyst behind one orchestrator.

**Acceptance:** each role has typed input/output, fallback, independent gate, user-facing failure state, and unit tests; no agent can execute external action.

### Ticket 6.1 — Simulation, Counterfactual Lab, and mutations

**Goal:** provide directional creative learning, not fake certainty.

**Work:** Add audience panels, simulations, disagreement, hypotheses, controlled variable changes, retests, mutation logs, and human-validation recommendations.

**Acceptance:** simulation label always visible; same-audience definition preserved for comparisons; mutations retain exact diff and no unsupported claims.

### Ticket 7.1 — Trend Intelligence and Publishing Intelligence

**Goal:** use approved sources for timely creative and publishing context.

**Work:** Add permitted RSS/news/imported sources, citations, source health, trend briefs, timing evidence hierarchy, test window recommendations, and Distribution Readiness Audit.

**Acceptance:** no private scraping; timing has data basis/confidence/coverage; no exact reach or “perfect time” claim; no timing result without account context is represented as personalized.

### Ticket 8.1 — Experiments, outcomes, and calibration

**Goal:** connect predictions to measured results.

**Work:** Add hypotheses, approvals, publication records, campaign CSV import, observed metrics, result completeness, ranking accuracy, absolute accuracy, and next-experiment recommendation.

**Acceptance:** observed outcomes are immutable; metric definitions/time windows visible; incomplete exports cannot produce false calibration.

### Ticket 9.1 — Durable refreshes, notifications, and source health

**Goal:** operate evidence sources safely over time.

**Work:** Add source-scoped durable schedules, idempotent jobs, staleness, rate-limit handling, alert thresholds, dedupe, preferences, and review links.

**Acceptance:** no in-process timers; jobs are restart-safe; alerts cite triggering evidence; failures do not fabricate summaries.

### Ticket 10.1 — Hardening and release readiness

**Goal:** verify correctness, safety, performance, and polish.

**Work:** Audit auth, RLS, prompt injection, secret exposure, uploads, source policy, fallback behavior, mobile layout, accessibility, visual regression, error states, and empty states.

**Acceptance:** all relevant gates in `07_QA_AND_RELEASE_GATES.md` pass; known limitations are documented; release notes do not overclaim integrations or intelligence.
