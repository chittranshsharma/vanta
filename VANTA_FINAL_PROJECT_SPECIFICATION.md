# Vanta — Final Project Specification

> **Product promise:** Vanta helps teams make creative and publishing decisions using transparent evidence. It separates what is observed, sourced, inferred, simulated, and unknown. Confidence is earned—not generated.

## 1. What Vanta is

Vanta is a cinematic, evidence-grounded creative intelligence workspace for growth, product-marketing, creative, and performance teams. Users build a reusable **Brand Brain**, import creative inputs, preserve provenance, create an honest **Creative Twin**, compare variants, inspect deterministic timeline/claim diagnostics, and later connect authorized outcome data to calibrate future recommendations.

Vanta is **not** a generic chatbot, a virality-score generator, a social scraping product, a black-box “AI employee,” or a claim to reproduce platform ranking algorithms.

### Core user loop

```text
Brand context
  → creative/source intake
  → grounded Creative Twin
  → deterministic comparison and Timeline Doctor
  → future evidence-gated model task
  → human-approved experiment/publishing action
  → authorized observed outcome
  → calibration and next experiment
```

## 2. Non-negotiable product rules

| Rule | Required behavior |
|---|---|
| No fabrication | Never invent metrics, trends, audience activity, social posts, campaign outcomes, testimonials, citations, or model outputs. |
| Evidence visible | User-facing claims must show evidence class, source/provenance, timestamp/freshness, coverage, gaps, and relevant assumptions. |
| Fail closed | If proof, source access, freshness, or output validation is absent, return `unknown`, `partial`, `blocked`, or `insufficient evidence`. Never substitute plausible prose. |
| No private algorithm claims | Never claim exact reach, guaranteed virality, literal scroll time, or knowledge/reproduction of Instagram, TikTok, YouTube, Reddit, X, or another private ranking algorithm. |
| Human control | No external side effect—publishing, connecting an account, spending, sending, deleting, or retaining sensitive content—without explicit user approval and a reversible preview. |
| Platform compliance | Use only official APIs, user-authorized OAuth, permitted public sources, RSS/news feeds, and manual imports. Never bypass access controls, paywalls, login walls, robots restrictions, or rate limits. |
| Tenant safety | Every workspace record, asset, source, model task, audit event, and connector must be workspace-scoped and protected by database constraints and RLS. |

## 3. Canonical evidence taxonomy

Vanta has exactly five evidence classes. Do not introduce unofficial variants.

| Class | Meaning | Display requirement |
|---|---|---|
| `observed` | Directly present in an authorized integration, user import, or measured outcome | Source, field/value, timestamp, coverage, and import/connector status |
| `sourced_claim` | Statement from an explicit cited third party | Attribution, source URL, and source date |
| `inference` | Bounded deterministic/model synthesis from explicit inputs | Assumptions, derivation/model version, input evidence IDs, and uncertainty |
| `simulation` | Directional synthetic persona/model response | Audience assumptions and uncertainty; never label as observed human feedback |
| `unknown` | Missing, stale, conflicting, unavailable, unverified, or out of scope | Insufficient-evidence state and smallest useful next input |

### Numeric claim gate

A user-facing number requires all of: `metricKey`, `value`, `unit`, `definition`, `sourceEvidenceId`, `timeWindow`, and `completeness = complete`. Otherwise render `not available` or `insufficient evidence`.

## 4. Current implementation state — factual

The repository already contains a working React/Vite/TypeScript application backed by Supabase. **Do not recreate completed tickets or reapply listed migrations.** Current unit/contract test status is **83 tests across 8 suites passing**; the production build is clean.

| Ticket | Status | Delivered boundary |
|---|---|---|
| 0.1 | Complete | Durable project docs, architecture, decisions, state tracking |
| 1.1 | Complete | Cinematic Vanta public/workspace interface foundation |
| 2.1 | Complete | Supabase Auth, workspaces, roles, RLS, onboarding trigger, audit foundation |
| 2.2 | Complete | Brand Brain, versioned Codex, claims, proof, audiences, tone, competitors, compliance boundaries |
| 3.1 | Complete | Source Registry, evidence items, metric definitions, citability/freshness guards |
| 3.2 | Complete | Private creative intake, private Storage bucket, grounded asset manifests, deterministic known gaps |
| 4.1 | Complete | Structured Creative Twin, scenes, lexical claim candidates, immutable versions, hardened correction RPCs |
| 4.2 | Complete | Read-time deterministic Decision Matrix and Timeline Doctor; no persisted/stale diagnoses |
| 5.0 | Local code complete; deployment pending | Secure model-gateway code and client contract authored locally; no Edge Function deployment, Groq secret, or live Groq call is approved yet |

### Applied database migrations — never reapply

| Migration | Purpose |
|---|---|
| `20260822000001_auth_workspaces` | Profiles, workspaces, members, audit events |
| `20260822000002_brand_brain` | Brand Brain/Codex tables and constraints |
| `20260822000003_evidence_layer` | Sources, evidence items, metric definitions, citability protection |
| `20260822000004_creative_intake` | Assets, ingestion runs, grounded twins, private Storage bucket |
| `20260822000005_creative_twin_expansion` | Structured scenes, claims, immutable version snapshots |
| `20260822000006_secure_twin_correction_rpcs` | Secured atomic correction RPCs; required auth/authorization; no anonymous execution |

## 5. Current product capabilities

### Brand Brain

Workspace-scoped product positioning, audience segments, approved/prohibited/conditional claims, proof points, competitors, tone guides, and compliance boundaries. Brand Codex snapshots are versioned. No fake brand/customer data is seeded.

### Evidence and source governance

Sources are `verified`, `citable_unverified`, `citable_stale`, or `blocked` through deterministic resolution. Manual and file-import sources start unverified. An unverified/stale source cannot support a verified numeric claim.

### Creative intake and grounded twins

Users can import allowed text/CSV/JSON/image metadata or enter text manually. Original file bytes are private in Supabase Storage; metadata/provenance is in PostgreSQL. Video bytes are intentionally blocked in the current slice. The Creative Twin currently contains user-provided or deterministic fields only, never a fabricated visual/audio interpretation.

### Structured Twin

Scripts can be split only by explicit scene headers, bracketed time ranges, `Hook`, `Body`, `CTA`, or blank paragraphs. WPM is calculated only when valid user-supplied timing exists. Claim candidates have source offsets/excerpts and lexical Brand Codex alignment. Missing media context stays unknown.

### Decision Matrix and Timeline Doctor

The current comparison/diagnostic system is pure read-time TypeScript. It does not save stale diagnoses. It shows policy-rule derivations, supplied values, evidence class, unknowns, calculation provenance, and neutral rule-suggested edits. It does not produce virality, engagement, audience-fit, reach, or conversion scores.

## 6. Security requirements

1. Every exposed tenant table requires RLS and workspace-safe relationships.
2. Use composite foreign keys when a child points to a workspace-owned parent, such as `(parent_id, workspace_id)`.
3. Private Storage objects must have workspace path policies and safe path parsing. Never cast unchecked path text to UUID.
4. Immutable snapshots require database-level denial of update/delete, not only UI controls.
5. `SECURITY DEFINER` functions require explicit safe `search_path`, mandatory `auth.uid()`, in-function authorization, no client-supplied actor identity, and revoked `PUBLIC`/`anon` execution.
6. Never expose `GROQ_API_KEY`, service-role keys, OAuth refresh tokens, or privileged connector credentials to the browser.
7. Keep **QA-1** open: run a real two-user, real-JWT browser/API RLS test before external production use.

## 7. Current stack and the real future stack

| Layer | Now | Later when justified |
|---|---|---|
| Product UI | React, TypeScript, Vite, CSS, Framer Motion | Remains the primary UI stack |
| Truth, identity, storage | Supabase Auth, PostgreSQL, RLS, Storage | Remains the system of record |
| Server boundary | Edge Function code authored locally | Deploy after explicit user approval and secret configuration; add Node service only for complex connector/orchestration needs |
| Model provider | Groq integration contract authored; not live | Server-only structured model gateway with audit, quotas, validation, and evidence gates |
| Video/ML/calibration | Not implemented | Python/FastAPI worker after real media analysis, ETL, calibration, or statistical workloads begin |
| Long jobs/agents | Not implemented | Durable queue/workflow engine before retries, scheduled refreshes, media work, or multi-agent runtime |
| External data | Not implemented | Authorized official APIs, permitted public feeds, secure OAuth/token handling, fresh source metadata |
| Observability | Basic tests/build only | Error tracking, structured logs, feature flags, cost/latency telemetry before external beta |

### Why this is not full MERN

React and Node tooling already exist. MongoDB and Express are not current requirements: Vanta depends on PostgreSQL transactions, relational provenance, RLS, composite foreign keys, audit constraints, and immutable snapshots. Python becomes necessary for actual media/ML/calibration work—not before. C/C++ is not justified unless a measured media-performance bottleneck appears.

## 8. Model gateway contract — Ticket 5.0

The local `model-gateway` is a foundation only. It must remain bounded until deployment is expressly approved.

### Browser may send only

```json
{
  "workspace_id": "valid workspace UUID",
  "task_type": "gateway_health_check"
}
```

### Gateway must own

- Model identifier, fixed system prompt, runtime schema, temperature, output cap, and CORS allow-list.
- JWT authentication and workspace owner/admin authorization.
- Request-size limit and strict rejection of unknown request fields.
- Rate/budget protection, safe audit entries, generated nonce, and defensive JSON/schema validation.
- Typed failure states such as `unauthorized`, `forbidden`, `invalid_request`, `rate_limited`, `gateway_not_configured`, `validation_failed`, and `provider_unavailable`.

### Gateway must not do yet

- Send user creative/evidence content to Groq.
- Accept browser-provided prompts, schemas, model names, raw evidence text, or instructions.
- Offer claim analysis, scene clarity, persona simulation, trend analysis, virality predictions, or user-facing model results.
- Deploy, configure secrets, or invoke Groq without explicit user approval.

## 9. Roadmap after current state

### Immediate next actions

1. **Reconcile the repository.** Verify the local Ticket 5.0 code against this specification; do not rewrite it blindly.
2. **Prepare but do not deploy.** Validate unit tests/build and write a deployment readiness checklist for the model gateway.
3. **Await explicit user approval.** Only then configure the server secret, deploy the Edge Function, and run one owner/admin health-check request.
4. **Ticket 5.1 planning:** design a single narrow, evidence-gated model task—likely a claim-grounding audit—not full multi-agent orchestration.

### Later milestones

| Order | Milestone | Required boundary |
|---:|---|---|
| 5.1 | First model task | Server-owned structured schema, evidence retrieval by ID, cited outputs, human review, no performance prediction |
| 5.2 | Model-task resilience | Provider fallback, bounded retries, output evaluator, task/audit state machine |
| 6 | Counterfactual lab | Controlled text alternatives and retesting; clear simulation label |
| 7 | Trend/publishing intelligence | Official/authorized feeds only; freshness/citation controls; test windows, never exact reach claims |
| 8 | Outcome calibration | Authorized campaign imports, metric definitions, observed-vs-predicted evaluation |
| 9 | Media/Python pipeline | Private derived artifacts, queue, FastAPI worker, deterministic media metadata before ML interpretation |
| QA-1 | Two-user RLS E2E | Real browser/JWT/API isolation proof before external production users |

## 10. Source-of-truth hierarchy

When files conflict, use this order:

1. The current repository code, applied migrations, and generated database types.
2. `docs/build-state.md` and `todo.md`.
3. This specification.
4. `docs/product-constitution.md`, `docs/architecture.md`, and `docs/decisions.md`.
5. Older blueprint/handoff/archive files.

Never trust a stale roadmap line over an applied migration or verified code. Document discrepancies before fixing them.

## 11. Definition of done for every future ticket

Every ticket must specify scope, out-of-scope behavior, data contract, RLS/authorization effects, error/unknown states, tests, build verification, browser checks where relevant, build-state update, and a concise walkthrough. No ticket may silently deploy, push, create a paid resource, or send external data without user approval.

## 12. Mandatory Fable audit and improvement phase

The existing repository is a working foundation, not unquestionable truth. Fable must review and improve it before continuing feature development, but it must do so through **small verified changes**, not a broad rewrite.

### Audit areas

| Area | Required review |
|---|---|
| Repository hygiene | Git status, tracked secrets, ignored local files, dependency scripts, stale/duplicate documentation |
| Build quality | Unit/contract tests, TypeScript compilation, production build, code-splitting/performance warnings, dead/duplicated code |
| Database integrity | Applied migrations vs repository files, RLS enabled, policy intent, composite foreign keys, constraints, indexes, trigger behavior, generated types |
| Privileged SQL | Every `SECURITY DEFINER` function: explicit search path, auth requirement, in-function authorization, execution grants, client-controlled argument review |
| Storage | Private buckets, safe path parsing, object policies, orphan-object behavior, upload validation boundary |
| Client quality | Loading/empty/error states, accessibility, keyboard behavior, reduced motion, mobile layout, tokenized styles, no misleading data |
| Edge boundary | Local model-gateway request allow-list, secret absence from browser, CORS, output validation, safe audit data, no deployment until approved |
| Product truth | Implemented/planned feature distinction, evidence labels, non-promise compliance, source/provenance visibility |

### Audit outcomes

Fable must write a compact `docs/fable-audit.md` with findings categorized as:

- **P0:** security, tenant-isolation, secret exposure, data-loss, or fabrication risk; patch before any feature work.
- **P1:** correctness, reliability, accessibility, performance, or maintainability defect; patch in a bounded follow-up slice.
- **P2:** improvement opportunity; record for later rather than expanding the first audit pass.

Every proposed code change must identify the concrete defect, the smallest safe remediation, tests proving the remedy, and a regression risk. Never alter an applied migration; use a forward-only migration for any database fix. Never refactor merely for stylistic preference.
