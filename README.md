<div align="center">

<br/>

```
██╗   ██╗ █████╗ ███╗   ██╗████████╗ █████╗
██║   ██║██╔══██╗████╗  ██║╚══██╔══╝██╔══██╗
██║   ██║███████║██╔██╗ ██║   ██║   ███████║
╚██╗ ██╔╝██╔══██║██║╚██╗██║   ██║   ██╔══██║
 ╚████╔╝ ██║  ██║██║ ╚████║   ██║   ██║  ██║
  ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝
```

### **Evidence-Grounded Creative Intelligence Platform**

*"Confidence is earned, not generated."*

<br/>

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_RLS-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

[![Tests](https://img.shields.io/badge/Vitest-971_Passing-729B1B?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Pytest](https://img.shields.io/badge/Pytest-15_Passing-0A9EDC?style=for-the-badge&logo=pytest&logoColor=white)](https://pytest.org/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E_Verified-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![CI](https://img.shields.io/badge/CI-lint_|_typecheck_|_test_|_build-blue?style=for-the-badge&logo=githubactions&logoColor=white)](.github/workflows/ci.yml)

<br/>

</div>

---

## What is Vanta?

**Vanta** is a premium creative decision intelligence platform for growth, product-marketing, and performance-advertising teams.

Most AI tools for creatives have one fatal flaw: they **hallucinate with confidence**. They generate virality scores, copy mutations, audience predictions — all without citing a single real source. You're left trusting a black box.

**Vanta breaks that pattern entirely.**

Every number has a source. Every claim has an evidence class. Every recommendation is traceable back to verified data — or it doesn't render at all. Vanta **fails closed** when evidence is missing instead of making things up.

---

## Core Architecture

```
        CREATIVE INPUT  →  CREATIVE TWIN  →  BRAND BRAIN
               │                  │               │
               └──────────────────┼───────────────┘
                                  │
                          EVIDENCE LAYER
                    (5-class typed evidence gate)
                                  │
               ┌──────────────────┼───────────────┐
               │                  │               │
        DECISION MATRIX    TIMELINE DOCTOR    SIMULATION LAB
      (compare variants)  (edit briefs)    (counterfactuals)
               │                  │               │
               └──────────────────┼───────────────┘
                                  │
                         DECISION PACKET
                    (inspectable · cited · traceable)
```

---

## Features

### 🧠 Brand Brain & Creative Twin
Maintain a structured, versioned Brand Codex — approved claims, prohibited language, audience segments, tone guidelines, compliance boundaries. Parse any script or creative asset into a deterministic **Creative Twin**: structured scenes, WPM pacing, extracted claims, and known gaps — all without hallucination.

### 🔬 Five-Class Evidence System
Every data point in Vanta is typed with an immutable evidence class:

| Class | What it means |
|---|---|
| 🟢 **Observed** | Directly measured via authorized connectors or campaign imports |
| 🔵 **Sourced** | Backed by an explicit, verifiable external citation |
| 🟣 **Inference** | Deterministic analytical calculation with documented assumptions |
| 🟡 **Simulation** | Structured directional AI output — never called observed human data |
| ⚪ **Unknown** | Absent, stale, or unverified — triggers an honest "insufficient evidence" state |

If a metric doesn't have a source, a definition, a time window, and a completeness flag — **it doesn't render**.

### 📊 Decision Matrix & Timeline Doctor
Compare multiple creative variants side-by-side with transparent scoring. The Timeline Doctor surfaces concrete, actionable edit briefs — not vague suggestions — directly tied to scene-level data.

### 🔬 Counterfactual Simulation Lab
Run bounded mutations across your creative (hook, CTA, pacing, claim order) to produce directional "what if" analyses. Every simulation is clearly labelled as a simulation, never presented as observed human feedback.

### 🔒 Tenant-Isolated Multi-Workspace Architecture
Built on **Supabase + PostgreSQL Row-Level Security** from the ground up. Every table, every query, every result is scoped to the authenticated user's workspace at the database layer. Cross-workspace data access is structurally impossible — not just policy, but enforced at the DB constraint level.

### 🤖 Multi-Agent Specialist Council
An 11-role specialist agent council with capability-based least privilege, a DAG minimal subgraph planner, and a deterministic fallback matrix. Agents diagnose, simulate, and formulate briefs — but **never execute external actions without human confirmation**.

### 📡 Conversation Intelligence & Attribution
Pseudonymized signal store, timezone-aware aggregation buckets, explicit same-workspace attribution, and unreviewed inference proposals. Attribution is transparent, not assumed.

### 📈 Outcome Calibration Loop
Import real campaign outcome batches with atomic validation and idempotency checks. Connect predictions to observed outcomes over time — because a model that can't admit error can't improve.

### 🔌 Connector & Publishing Intelligence
Source Cohorts, RSS refresh connector jobs, deterministic publishing schedule optimizer with IANA/DST timezone conversion and fail-closed sample-size gates.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19.2 + TypeScript 5.9 + Vite 7.3 |
| **Styling** | Vanilla CSS design system + Framer Motion |
| **Database** | Supabase PostgreSQL 15 + Row Level Security |
| **Auth** | Supabase Auth + automated workspace provisioning |
| **Backend Workers** | Node.js TypeScript job worker (9 handlers) |
| **Analysis Service** | Python FastAPI (stateless CSV parsing, media workers) |
| **Model Gateway** | Supabase Edge Functions + Groq gateway with cryptographic nonce validation |
| **Testing** | Vitest (971 tests) + Pytest (15 tests) + Playwright E2E |
| **CI** | GitHub Actions — lint, typecheck, test, build on every push |

---

## Database Schema (22 Migrations)

22 production-applied migrations covering:
- Multi-tenant auth, workspaces, roles, and audit ledger
- Brand Brain (8 tables) with full RLS
- Evidence Layer — source registry, evidence items, metric dictionary
- Creative intake, twins, scenes, claims, and immutable version snapshots
- Secure atomic correction RPCs with advisory locks
- Model task runs, durable job queue, derived artifacts
- Embeddings, connector accounts, workspace quotas
- Experiments, post observations, conversation intelligence
- Simulation Lab (5 tables, 4 atomic RPCs)
- Source cohorts and cohort members

---

## Test Coverage

```
✅ 971 Vitest unit + integration tests   (71 suites)
✅  15 Pytest tests                       (analysis worker)
✅  53 Playwright E2E isolation tests     (multi-tenant security)
✅   0 lint errors
✅   0 TypeScript errors
✅   Production build: clean
```

---

## Non-Negotiable Honesty Boundaries

Vanta will **never claim**:
- Exact future views, reach, revenue, or conversion numbers
- The private algorithm logic of Instagram, TikTok, YouTube, or any platform
- Audience activity or trend evidence that the user hasn't authorized
- Reliable predictions without calibration against real observed data

The realistic goal is **fail-closed behaviour**: citations, typed schemas, validation, disagreement, unknown states, and human escalation.

---

## Installation

**Prerequisites:** Node 20+, a Supabase project (or local Supabase CLI)

```bash
# 1. Clone
git clone https://github.com/chittranshsharma/vanta.git
cd vanta

# 2. Install
npm install

# 3. Configure — add your Supabase URL and anon key (publishable only)
cp .env.example .env

# 4. Run
npm run dev
# → http://localhost:5173

# 5. Full verification suite (lint + typecheck + 971 tests + build)
npm run verify
```

> **Note:** The `.env` file contains only client-safe publishable keys. No secrets, API keys, or service-role credentials are ever exposed to the browser.

---

<div align="center">

**Vanta — Creative intelligence you can actually trust.**

*Built to fail closed. Never to hallucinate.*

</div>
