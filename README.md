<div align="center">

# ❖ V A N T A

### **Evidence-Grounded Creative Intelligence & Autonomous Decision Engine**

<p align="center">
  <em>"Confidence is earned, not generated. Never replace missing evidence with plausible prose."</em>
</p>

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%7C%20RLS-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vitest](https://img.shields.io/badge/Vitest-Passing%20(920%2F920)-729B1B?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Pytest](https://img.shields.io/badge/Pytest-Passing%20(15%2F15)-0A9EDC?style=for-the-badge&logo=pytest&logoColor=white)](https://pytest.org/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E%20(47%2F47)-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![CI](https://img.shields.io/badge/CI-lint%20%7C%20typecheck%20%7C%20test%20%7C%20build-blue?style=for-the-badge&logo=githubactions&logoColor=white)](.github/workflows/ci.yml)
[![Build](https://img.shields.io/badge/Production%20Build-Clean-emerald?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)](#)

[Overview](#-executive-summary) • [Staged Architecture](#-staged-architecture--technical-roadmap) • [What Exists Today](#-what-exists-today) • [Permanent Core](#-the-permanent-core) • [Required Future Upgrades](#-required-future-upgrades) • [Evidence Standard](#-five-class-evidence-standard) • [Database & RLS](#-database-schema--tenant-isolation-rls) • [Implementation Roadmap](#-implementation-roadmap)

---

</div>

## ✦ Executive Summary

**Vanta** is a high-assurance creative decision intelligence platform built for modern growth, product marketing, and performance advertising teams. 

Modern creative optimization tools suffer from a fatal flaw: **hallucinatory certainty**. They output arbitrary "virality scores," generic copy mutations, and unverifiable predictions without citing data sources or acknowledging missing context.

Vanta replaces opaque generation with **structured creative decomposition, deterministic evidence gates, multi-agent dialectic arbitration, and closed-loop outcome calibration**.

```
                 ┌──────────────────────────────────────┐
                 │       UNTRUSTED CREATIVE INPUT       │
                 │   Scripts, Ad Videos, Landing Copy   │
                 └──────────────────┬───────────────────┘
                                    │
                                    ▼
                 ┌──────────────────────────────────────┐
                 │          THE CREATIVE TWIN           │
                 │ Deterministic parsing, scenes, WPM   │
                 └──────────────────┬───────────────────┘
                                    │
            ┌───────────────────────┴───────────────────────┐
            ▼                                               ▼
┌───────────────────────┐                       ┌───────────────────────┐
│     BRAND BRAIN       │                       │    EVIDENCE LAYER     │
│  Positioning, Claims, │                       │ Verified Connectors,  │
│  Codex, Rules & Tone  │                       │  Sources, Benchmarks  │
└───────────┬───────────┘                       └───────────┬───────────┘
            │                                               │
            └───────────────────────┬───────────────────────┘
                                    │
                                    ▼
                 ┌──────────────────────────────────────┐
                 │     CREATIVE DECISION MATRIX         │
                 │ Transparent side-by-side comparison  │
                 └──────────────────┬───────────────────┘
                                    │
                                    ▼
                 ┌──────────────────────────────────────┐
                 │          TIMELINE DOCTOR             │
                 │ Concrete failure points & edit briefs│
                 └──────────────────┬───────────────────┘
                                    │
                                    ▼
                 ┌──────────────────────────────────────┐
                 │      EVIDENCE ARBITER (GATEWAY)      │
                 │ Rejects unbacked/stale assertions    │
                 └──────────────────┬───────────────────┘
                                    │
                                    ▼
                 ┌──────────────────────────────────────┐
                 │           DECISION PACKET            │
                 │ Inspectable matrix & mutation briefs │
                 └──────────────────────────────────────┘
```

---

## 🏛 Staged Architecture & Technical Roadmap

### The Honest Reality
The current React/Vite/Supabase foundation is **the correct first third of Vanta**, not the entire finished system. It provides the product shell, tenant-safe data, provenance, deterministic representation, and user workflows. It is deliberately not yet a media-processing, ML-calibration, live-data, or multi-agent runtime.

Vanta grows by adding narrowly scoped services when a real feature requires them, avoiding premature service sprawl or unused dependencies.

```
React / TypeScript / Vite (Product Shell & Interaction State)
        │
        ├── Supabase Auth + PostgreSQL + RLS + Storage (Truth, Permissions, Assets)
        │
        └── Secure Server Boundary (Edge Functions first; Node.js service when required)
                │
                ├── Groq Structured Model Gateway + Evidence Validation
                ├── Official OAuth/API Connectors + Webhooks
                ├── Durable Queue / Workflow Engine (Retries & Background Jobs)
                └── Python Analysis Workers (FastAPI for Media, ML, Calibration, ETL)
                         │
                         └── Derived features/results with lineage back to assets and evidence
```

---

## 🔍 What Exists Today

| Capability | Current Status | Technology Currently Responsible |
|---|---|---|
| Cinematic product shell and workspace UI | **Implemented** | React 19, TypeScript 5.9, Vite 7, Vanilla CSS, Framer Motion |
| Login, workspaces, roles, tenant isolation | **Implemented** | Supabase Auth, PostgreSQL 15, Row Level Security (RLS) |
| Brand context and claim rules | **Implemented** | Supabase/PostgreSQL + TypeScript client services (`brandBrain.ts`) |
| Provenance, evidence classes, source freshness state | **Implemented** | PostgreSQL constraints, RLS triggers, deterministic TypeScript guards (`sourceRegistry.ts`, `evidence.ts`) |
| Private text/file intake and grounded manifests | **Implemented** | Supabase Storage (`workspace-assets` bucket) + PostgreSQL + browser-side validators (`creativeIntake.ts`) |
| Deterministic script parsing, scene representation, WPM pacing | **Implemented** | TypeScript pure functions + PostgreSQL immutable version snapshots (`creativeTwin.ts`) |
| Creative Decision Matrix & Timeline Doctor | **Implemented** | Pure read-time derivation engine + interactive inspection UI (`creativeDoctor.ts`, `DecisionMatrix.tsx`, `TimelineDoctor.tsx`) |
| Secure model gateway & task audits | **Implemented & Live** | Groq Model Gateway v9 Edge Function (`supabase/functions/model-gateway/`) + strict JSON schema validator (`schemas.ts`) + nonce cryptography checks. |
| Background job processing & workers | **Implemented & Live** | Node.js job worker (`services/job-worker`) registering 9 handlers with transaction-based `claim_next_job` / `complete_job` + Python analysis worker (`services/analysis-worker`) for stateless CSV parsing. |
| Conversation Intelligence & Attribution | **Implemented & Live** | Pseudonymized signal store, unreviewed inference proposals, uncertainty notes, explicit same-workspace attributions, and timezone-aware aggregation buckets. |

---

## 🛡 The Permanent Core

These components remain central throughout Vanta's evolution:

| Layer | Long-term Role | Why It Remains |
|---|---|---|
| **React + TypeScript** | Product interface and interaction state | Best fit for the web workspace, rich timeline editor, evidence views, and component ecosystem |
| **PostgreSQL + RLS** | System of record and tenant boundary | Vanta depends on relational integrity, auditability, transactions, constraints, provenance, and permissions |
| **Supabase Auth / Storage** | Identity and private asset storage | Provides secure workspace access and keeps media files safely outside database rows |
| **Deterministic TypeScript Guards** | Final claim / response gate | Model output must never bypass numeric-provenance, citability, source freshness, or approval checks |

---

## 🚀 Required Future Upgrades & Triggers

**Status (2026-08-29):** All core upgrades are fully implemented, integrated, and verified both locally and live on Supabase (Migrations 001–020 applied). The Node.js job worker and Python analysis services are active and tested locally with complete test suites.

### Upgrade A: Secure Application Backend for Groq & Connectors
- **Trigger:** The first Groq feature, official OAuth connector, webhook, scheduled source refresh, or notification is approved.
- **Architecture:** Browser never receives `GROQ_API_KEY`, service-role credentials, or OAuth secrets. Start with **Supabase Edge Functions** for authenticated calls; transition to a **Node.js TypeScript service** when orchestration, queues, retry policies, or SDKs outgrow edge functions.

### Upgrade B: Python Analysis Service (FastAPI)
- **Trigger:** Real video/audio processing, transcript alignment, offline evaluation, campaign-outcome calibration, large CSV normalization, embeddings/clustering, or statistical model training.
- **Architecture:** Small **FastAPI service / worker** with explicit job contracts. Python processes media/data and returns typed records with provenance metadata back to Postgres; it never becomes a separate source of truth or returns ungrounded marketing prose directly to the browser.

### Upgrade C: Durable Job Queue & Workflow Engine
- **Trigger:** Multi-step jobs, retries, multi-agent coordination, scheduled refreshes, video rendering, webhook recovery, or background work.
- **Architecture:** Database-backed job records for simple tasks → managed queue/workflow engine for reliable multi-step executions with idempotency keys, dead-letter queues, cancellation, and human approval gates.

### Upgrade D: Media Pipeline & Scalable Object Storage
- **Trigger:** Users upload real video bytes, frame sampling, audio transcription, or large media volume.
- **Architecture:** Signed upload/download URLs, server-side MIME/magic-byte verification, dedicated media workers for thumbnail/frame extraction, retention lifecycle rules.

### Upgrade E: Retrieval, Semantic Memory & Vector Search
- **Trigger:** Brand Brain guidelines, past creative tests, and campaign outcomes outgrow deterministic relational lookups.
- **Architecture:** Vector retrieval as candidate search only. Every retrieved item must still pass workspace scoping, source freshness, evidence class, and citation checks before use in prompts.

### Upgrade F: Real External Data & Official Platform Integrations
- **Trigger:** Owned-account analytics, live campaign metrics, audience activity, or publishing-time recommendations.
- **Architecture:** User-authorized official APIs and account exports. Explicit `unknown` or `insufficient evidence` states whenever data is absent. Never promise private platform algorithm secrets or unverified audience scroll times.

### Upgrade G: Observability, Feature Flags & Operational Safety
- **Trigger:** External users, paid usage, connector jobs, model calls, or background processing.
- **Architecture:** Error tracking, structured logs, latency/cost observability, incident alerts, data-access audits, and real-JWT two-user E2E tests.

---

## ⚖️ Technology Evaluation: What Python Does & Does Not Solve

| Requirement | Python Helps? | What Else Is Still Required |
|---|---|---|
| Parse and render text/scripts | Not necessary | Current TypeScript is sufficient |
| Video/audio feature extraction | **Yes** | Storage, queue, worker runtime, permissions, retention policy |
| Campaign CSV normalization & calibration | **Yes** | Trusted imports, metric definitions, outcome provenance |
| Multi-agent coordination | Sometimes | Durable workflows, model gateway, validation, approval gates |
| Better LLM reasoning | No | Model selection, structured schemas, evidence retrieval, evaluator gates |
| Real trend/social data | No | Authorized official APIs or permitted public sources |
| Tenant security & RLS | No | PostgreSQL constraints, RLS, secure backend, E2E testing |

> **Note on C/C++:** Vanta does not need C or C++ for UI, database, agents, or ordinary media workflows. C/C++ is used indirectly through mature codecs and native libraries. Writing custom C++ services would slow development without improving correctness.

---

## 🚫 Non-Negotiable Honesty Boundaries

Vanta can become powerful, but it will **never claim**:
- Exact future views, reach, revenue, or conversion.
- The private algorithm/ranking logic of Instagram, TikTok, YouTube, or another platform.
- Audience activity, scroll time, or trend evidence that the user has not authorized or that no permitted source supports.
- Reliable predictions without outcome calibration against real observed data.
- "Non-hallucinating AI." The realistic goal is **fail-closed behavior**: citations, typed schemas, validation, confidence/disagreement, unknown states, and human escalation.

---

## 🔬 Five-Class Evidence Standard

To eliminate AI hallucinations, every data point, benchmark, and score in Vanta is typed with an immutable **Evidence Class**:

```
 ┌─────────────────┬──────────────────────────────────────────────────────────────────────────┐
 │ Evidence Class  │ Grounding Criteria & Operational Rule                                    │
 ├─────────────────┼──────────────────────────────────────────────────────────────────────────┤
 │ 🟢 OBSERVED     │ Measured directly via authorized connectors or immutable campaign CSVs. │
 │ 🔵 SOURCED      │ Backed by an explicit, verifiable external URL or documented citation.  │
 │ 🟣 INFERENCE    │ Deterministic analytical calculation with documented assumptions.       │
 │ 🟡 SIMULATION   │ Synthetic model trajectory; strictly directional, never definitive.      │
 │ ⚪ UNKNOWN      │ Unreviewed or uncorroborated assertion; triggers guided question state.  │
 └─────────────────┴──────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄 Database Schema & Tenant Isolation (RLS)

Vanta is designed so every query executes under the authenticated user's JWT context with row-level security. **Honest status:** migrations 001 and 003-005 enable RLS and declare policies for 13 tables. Migration 002 (Brand Brain, 8 tables) shipped without RLS in the repository; migration 007 adds it and is **pending live apply**. The committed schema is contract-tested in `src/lib/migrations.test.ts` (every table must enable RLS and carry tenant-scoped policies). Whether the live project matches the repository has not been verified from this codebase; see `docs/supabase-deferred-validation.md`.

```
├── 20260822000001_auth_workspaces.sql
│   ├── profiles                        # User identities & avatar metadata
│   ├── workspaces                      # Multi-tenant workspace partitions
│   ├── workspace_members               # Role-based access (owner | admin | member | viewer)
│   └── audit_events                    # Immutable ledger of all system & user operations
│
├── 20260822000002_brand_brain.sql
│   ├── brands                          # Root workspace Brand Brain positioning & promise
│   ├── brand_codex_versions            # Immutable historical snapshots of full brand state
│   ├── brand_audiences                 # Segment demographics, pain points, motivations
│   ├── brand_claims                    # Approved, Prohibited, Conditional & Unknown claims
│   ├── brand_proof_points              # Evidence backing approved claims
│   ├── brand_competitors               # Competitor positioning & watch levels
│   ├── brand_tone_guidelines           # Dimensions, approved directions, prohibited styles
│   └── brand_compliance_boundaries    # Legal, regulatory, and channel enforcement rules
│
├── 20260822000003_evidence_layer.sql
│   ├── source_registry                 # Authorized connectors & manual URL sources
│   │   └── Trigger: trg_block_connected_status (Blocks manual 'connected' elevation)
│   ├── evidence_items                  # Assertions bound via Composite FK (source_id, workspace_id)
│   └── metric_definitions              # Canonical workspace metric dictionary (UNIQUE workspace_id, metric_key)
│
├── 20260822000004_creative_intake.sql
│   ├── creative_assets                 # Intake assets with SHA-256 deduplication
│   ├── ingestion_runs                  # Audit runs for intake jobs
│   ├── creative_twins                  # Grounded twins with deterministic manifests & known gaps
│   └── storage: workspace-assets       # Private bucket protected by storage_workspace_id RLS
│
├── 20260822000005_creative_twin_expansion.sql
│   ├── creative_scenes                 # Sequential scenes with composite FK (twin_id, workspace_id)
│   ├── creative_claims                 # Extracted claims linked to brand_claims(id, workspace_id)
│   └── creative_twin_versions          # Immutable snapshots protected by mutation-blocking trigger
│
├── 20260822000006_secure_twin_correction_rpcs.sql
│   ├── save_scene_correction_atomic    # Hardened SECURITY DEFINER procedure (auth.uid() enforced, non-anon)
│   └── save_claim_correction_atomic    # Hardened SECURITY DEFINER procedure with per-twin advisory locks
│
└── 20260822000007_brand_brain_rls.sql  # PENDING LIVE APPLY: RLS + policies for the 8 Brand Brain tables
```

---

## 💻 Tech Stack & Engineering Standards

| Layer | Technology | Rationale |
|---|---|---|
| **Core Framework** | React 19.2 + TypeScript 5.9 | Strict type safety, React Server Component compatibility, modern concurrency |
| **Build Tooling** | Vite 7.3 | Instant HMR, ESM native bundling, optimized chunk splitting |
| **Styling & Motion** | Vanilla CSS design system + Tailwind v4 utilities layer + Framer Motion | Hand-written tokens for the shell; Tailwind utilities (no preflight) for the Twin, Matrix, and Doctor panels |
| **Icons** | Lucide React | Consistent, lightweight vector iconography |
| **Database & Auth** | Supabase (PostgreSQL 15 + RLS) | Row Level Security, private file storage, automated onboarding triggers |
| **Test Runner** | Vitest 2.1 + pytest + Playwright | 816 unit and static-contract tests (60 suites), 15 pytest cases for the analysis service, 45-check QA-1 isolation suite verified live on Supabase |
| **Lint / CI** | ESLint 9 (typescript-eslint, react-hooks) + GitHub Actions | `npm run verify` = lint, typecheck, test, build; CI runs the same on push and PR |
| **Future Gateway** | Edge Functions / Node.js | Authenticated secret-holding server boundary for Groq / OAuth |
| **Future ML/Media** | Python (FastAPI workers) | Video processing, transcript alignment, outcome calibration |

---

## 📂 Codebase Directory Layout

```
vanta/
├── FABLE_CONTINUATION_PROMPT.md        # Agent operating contract for this repository
├── VANTA_FINAL_PROJECT_SPECIFICATION.md # Canonical product handoff
│
├── docs/                               # Durable Project Memory
│   ├── architecture.md                 # System boundaries & component topology
│   ├── blueprint-index.md              # Blueprint cross-reference sitemap
│   ├── build-state.md                  # Migration states, test logs & active ticket
│   ├── decisions.md                    # Architecture Decision Records (ADRs)
│   ├── fable-audit.md                  # Phase 0 audit: P0/P1/P2 findings and status
│   ├── supabase-deferred-validation.md # Live checks an operator must run (no live access here)
│   ├── model-gateway-deployment-readiness.md
│   ├── ticket-5.1-claim-grounding-audit.md # First model task: design + fail-closed output contract
│   ├── upgrade-reviews.md              # Roadmap upgrades A-G: what was built, findings, verification
│   ├── operations-runbook.md           # Kill switches, alerts, audit queries, rollback
│   ├── product-constitution.md         # Non-negotiable anti-hallucination rules
│   ├── upgrade-roadmap.md              # Honest technical capability and upgrade roadmap
│   └── archive/                        # Earlier agent scaffolding and blueprint documents
│
├── supabase/migrations/                # Canonical Database Schema
│   ├── 20260822000001_auth_workspaces.sql
│   ├── 20260822000002_brand_brain.sql
│   ├── 20260822000003_evidence_layer.sql
│   ├── 20260822000004_creative_intake.sql
│   ├── 20260822000005_creative_twin_expansion.sql
│   ├── 20260822000006_secure_twin_correction_rpcs.sql
│   ├── 20260822000007_brand_brain_rls.sql   # pending live apply
│   ├── 20260822000008_bind_created_by.sql   # pending live apply
│   ├── 20260822000009_composite_tenant_fks.sql # pending live apply
│   └── 20260822000010 … 015                # model_task_runs, jobs, derived_artifacts, embeddings, connector_accounts, workspace_quotas (pending)
│
├── supabase/functions/model-gateway/   # Edge Function (not deployed)
│   ├── index.ts                        # Auth, authorization, quota, task routing, audit, structured logs
│   ├── guards.ts / flags.ts / log.ts   # Pure guards, operator task flags, JSON logging (unit-tested)
│   ├── provider.ts                     # Provider adapter with bounded retry + schema repair
│   ├── schemas.ts                      # Task registry + health-check validation
│   └── tasks/                          # claimGroundingAudit (validator), claimGroundingPrompt (context + prompt)
│
├── services/job-worker/                # Node worker: claims jobs via service-role RPCs (not deployed)
├── services/analysis-worker/           # Python FastAPI analysis service (not deployed)
├── shared/                             # Pure modules shared by web, gateway, worker: jobs policy, magic bytes, retrieval gate, connectors, experiments, agents, publishing
├── e2e/                                # QA-1 two-user isolation suite (Playwright, needs staging credentials)
│
├── src/
│   ├── components/
│   │   ├── BrandBrain.tsx              # Brand Brain & Codex snapshot management UI
│   │   ├── CreativeIntake.tsx          # Text & file intake with client-side guards
│   │   ├── CreativeTwinEditor.tsx      # Structured Twin inspector, timeline, changelog, known gaps
│   │   ├── AuthModal.tsx               # Sign in / create account dialog
│   │   ├── AgentWorkflowPanel.tsx      # Creative Council task graph, role contracts, runtime gate (no runs)
│   │   ├── ConnectorsPanel.tsx         # Authorized-source access states, consent-intent request/revoke (flag)
│   │   ├── ExperimentsPanel.tsx        # Hypotheses, variants, readiness blockers, calibration readiness
│   │   ├── HistoryImportModal.tsx      # Posting-history CSV import with reviewed plan
│   │   ├── OutcomeImportModal.tsx      # Outcome CSV import: source, mapping, reviewed plan, provenance
│   │   ├── JobsPanel.tsx               # Durable job records, approve/cancel (flag)
│   │   ├── PublishingPlanner.tsx       # Test-window planning; unknown until owned observed history exists
│   │   ├── SetupStatus.tsx             # Build configuration rows + explicit gateway probe
│   │   ├── DecisionMatrix.tsx          # Multi-variant comparative matrix table
│   │   ├── LandingPage.tsx             # Public marketing page
│   │   ├── Modal.tsx                   # Accessible dialog (focus trap, Escape, reduced motion)
│   │   ├── SourceRegistry.tsx          # Sources, Evidence Items, and Metric Definitions UI
│   │   ├── Workspace.tsx               # Tenant workspace shell, panel routing, Decision Room
│   │   └── TimelineDoctor.tsx          # Sequential scene diagnostics & actionable edit briefs
│   │
│   ├── lib/
│   │   ├── auth.ts                     # Supabase auth & workspace switcher helpers
│   │   ├── auth.test.ts                # Auth fallback unit tests
│   │   ├── brandBrain.ts               # Typed Brand Brain read/write queries & snapshots
│   │   ├── creativeDoctor.ts           # Pure diagnostic engine & decision matrix derivation
│   │   ├── creativeDoctor.test.ts      # 12 diagnostic rule and matrix derivation tests
│   │   ├── creativeIntake.ts           # Intake validators, manifest builders, storage uploaders
│   │   ├── creativeIntake.test.ts      # 23 intake & boundary tests
│   │   ├── creativeTwin.ts             # Deterministic script decomposition, WPM, regex claims
│   │   ├── creativeTwin.test.ts        # 13 twin parsing & alignment tests
│   │   ├── evidence.ts                 # Pure synchronous numeric claim guards & citability types
│   │   ├── evidence.test.ts            # Numeric provenance validation tests
│   │   ├── migrations.test.ts          # 81 static contract tests over the committed SQL (RLS, policies, SECURITY DEFINER, composite FKs)
│   │   ├── modelGateway.ts             # Client adapter: sends only workspace_id + task_type
│   │   ├── modelGateway.test.ts        # 9 fail-closed client tests
│   │   ├── sourceRegistry.ts           # Source registry queries & async citability resolver
│   │   ├── sourceRegistry.test.ts      # 12 citability evaluation & freshness tests
│   │   ├── supabase.ts                 # Client initialization with publishable key safety
│   │   ├── workspaceOverview.ts        # Decision Room loader that reports read failures instead of faking empty states
│   │   └── workspaceOverview.test.ts
│   │
│   ├── types/
│   │   └── database.types.ts           # Auto-generated database typings (21 tables + hardened RPCs)
│   │
│   ├── App.tsx                         # Auth session + view routing shell
│   ├── styles.css                      # Tokenized cinematic design system
│   └── main.tsx                        # React application bootstrap
│
├── .github/workflows/ci.yml            # Lint, typecheck, test, build
├── eslint.config.js
├── package.json                        # Scripts & dependencies
├── todo.md                             # Live execution checklist
└── vite.config.ts                      # Bundler, manual chunks, vitest include
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Supabase Account**: (Or local Supabase CLI instance)

### 2. Clone & Install Dependencies
```bash
git clone https://github.com/chittranshsharma/vanta.git
cd vanta
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and provide your project credentials:
```bash
cp .env.example .env
```

```ini
# Client-safe Supabase credentials (RLS protected)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

### 4. Run the Full Verification
Lint, typecheck (web + worker), 816 Vitest and 15 Pytest tests (831 total tests) across 60 suites, then a production build:
```bash
npm run verify
```

### 5. Production Build
Verify clean TypeScript compilation and bundling:
```bash
npm run build
```

### 6. Start the Development Server
```bash
npm run dev
```
Open `http://localhost:5173` to launch the Vanta cinematic interface.

---

## 🗺 Implementation Roadmap & Milestone Architecture

### 📐 How the Numbering Math Works
Vanta’s architectural roadmap uses a structured **`[Phase].[Ticket]`** coordinate system:
- **Phase Index (First Digit):** Corresponds to the major architectural capability pillar (e.g., `Phase 5` = Multi-Agent Council & Model Gateway; `Phase 6` = Counterfactual Simulation Lab & Workspace Integration).
- **Ticket Index (Second Digit):** Corresponds to the sequential delivery slice within that phase (e.g., `Ticket 5.1` = First Evidence-Gated Model Task, `Ticket 5.2` = 11-Role Specialist Council Rollout).
- **Advancing from `Ticket 5.2` to `Ticket 6.1`:** Completing `Ticket 5.2` marks the completion of the Phase 5 backend foundation. The natural next step is `Ticket 6.1`—the opening milestone of Phase 6 (Counterfactual Simulation Engine).

---

### 📦 Complete Phase & Milestone Ledger

#### **Phase 0: Repository Audit & Database Infrastructure**
- [x] **Ticket 0.1: Durable Project Memory & Scaffold** (Architecture contracts, risk register, base scaffold)
- [x] **Phase 0 Live: Supabase Enterprise Ledger** (Migrations 001–020 live on Supabase with 100% RLS coverage)

#### **Phase 1: Public Interface & Creative Ingestion**
- [x] **Ticket 1.1: Cinematic Public Interface** (Marketing landing page, brand narrative, feature stages)
- [x] **Ticket 1.2: Creative Ingestion & Pipeline** (Video-byte rejection, structured metadata parsing)

#### **Phase 2: Tenant Fortress & Brand Brain**
- [x] **Ticket 2.1: Multi-Tenant Auth & Workspaces** (Supabase Auth, RLS isolation, automated signup trigger)
- [x] **Ticket 2.2: Brand Brain & Immutable Brand Codex** (Positioning, approved/prohibited claims, immutable snapshots)

#### **Phase 3: Evidence Layer & Creative Twin**
- [x] **Ticket 3.1: Evidence Layer & Source Registry** (Provenanced sources, canonical 5-class evidence taxonomy, metric dictionary)
- [x] **Ticket 3.2: Creative Intake & Grounded Twins** (Text/file intake, grounded manifests, artifact readers)

#### **Phase 4: Decision Room & Creative Diagnostics**
- [x] **Ticket 4.1: Creative Twin Scene Decomposition & Versioning** (Scene decomposition, WPM, regex claims, immutable version snapshots, atomic correction RPCs)
- [x] **Ticket 4.2: Creative Decision Matrix & Timeline Doctor** (Pure read-time derivation, multi-variant comparison, neutral policy rules, actionable edit briefs)

#### **Phase 5: Multi-Agent Council & Model Gateway**
- [x] **Ticket 5.0: Secure Groq Model Gateway** (Edge Function gateway v9 with cryptographic payload verification and structured schema validation)
- [x] **Ticket 5.1: First Evidence-Gated Model Task** (Quota-gated conversation interpretations enqueued, validated, and proposal-registered)
- [x] **Ticket 5.2: Specialist Council Rollout** (11 typed specialist role contracts, capability-based least privilege, DAG minimal subgraph planner, deterministic fallback matrix)

#### **Phase 6: Counterfactual Simulation Lab & Cinematic UI Polish**
- [x] **Ticket 6.1: Counterfactual Simulation Lab Engine** (7 bounded mutations, 6-role analysis subgraph, mandatory human review gate, traceability-only linkage)
- [x] **Phase 6B: Counterfactual Simulation Lab Persistence & Productization** (Migration 021 live on Supabase, 5 simulation tables, 4 atomic RPCs, 49/49 live disposable checks passed, 45/45 Playwright isolation checks passed)
- [ ] **Ticket 6.2: Workspace & Council UI Integration** (Connecting Specialist Council & Simulation Lab to the user interface with restrained ReactBits motion)

#### **Phase 7: Trend & Publishing Intelligence**
- [x] **Ticket 7.1: Source Cohorts & Publishing Intelligence Foundation** (Migration 022 live on Supabase, `source_cohorts` & `source_cohort_members`, 4 hardened RPCs, fail-closed client, composite tenant FKs, RSS refresh connector jobs, timezone-aware volume aggregation buckets)
- [x] **Ticket 7.2: Publishing Schedule Optimizer** (Observed-history time bucket summarizer, pure deterministic domain module `shared/publishing/scheduleOptimizer.ts`, IANA/DST wall-clock timezone conversion, fail-closed sample size gates, 16 pure unit tests)

#### **Phase 8: Outcome Calibration & Closed-Loop Learning**
- [x] **Ticket 8.1: Outcome Calibration Loop** (Import batches with atomic validation, same-workspace attribution, idempotency key checks, pure descriptive calibration domain contracts in `shared/calibration/outcomeCalibration.ts` with 19 passing tests)
- [ ] **Ticket 8.2: Official Platform OAuth Connector Ingestion** (Architecture specification complete at `docs/official-platform-connector-architecture.md`; official Meta/Instagram, YouTube Analytics, and TikTok Business OAuth sync contracts defined)

#### **Phase QA: Isolation & Security Verifications**
- [x] **Ticket QA-1: Real-JWT Two-User E2E Isolation Suite** (47/47 Playwright multi-tenant security verification tests passing live against Supabase across all 42 tenant tables)
- [ ] **Ticket QA-2: End-to-End Browser Workflow Verification** (Authenticated full-lifecycle browser testing of intake, council, and simulation workflows)

---

## 📜 The Product Constitution

Every contribution to Vanta must adhere to five non-negotiable laws:

1. **The Anti-Hallucination Invariant:** Never substitute missing evidence with plausible prose or fabricated metrics. If a data point cannot be proven, render an honest `unknown` or `insufficient` state.
2. **The Provenance Rule:** No recommendation, score, or mutation brief can be presented to a user without an explicit citation to a registered source and an assigned Evidence Class.
3. **Tenant Fortress Model:** Cross-workspace data access is denied at the database layer through RLS and composite foreign key enforcement. This is a design requirement, contract-tested against the committed schema, and must be proven live (QA-1) before external users.
4. **Inspectable Autonomy:** AI agents may diagnose, challenge, simulate, and formulate briefs, but they **never execute external publishing actions without human confirmation**.
5. **Calibrated Learning:** Directional predictions must be measured against real observed outcomes. An algorithm that cannot admit error cannot improve.

---

<div align="center">
  <sub>Grounded in evidence-first engineering principles</sub>
</div>
