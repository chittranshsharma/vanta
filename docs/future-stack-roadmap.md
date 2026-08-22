# Vanta — Honest Technical Capability and Upgrade Roadmap

## Bottom line

**No: the current React/Vite/Supabase foundation alone cannot deliver the entire Vanta vision.** It is the correct foundation for the product shell, tenant-safe data, provenance, deterministic representation, and user workflows. It is deliberately not yet a media-processing, ML-calibration, live-data, or multi-agent runtime.

Vanta should grow by adding narrowly scoped services when a real feature requires them. It should not become “MERN + Python + C++” by default. Every runtime adds deployment, security, secrets, observability, testing, and operational cost.

## What exists today

| Capability | Current status | Technology currently responsible |
|---|---|---|
| Cinematic product shell and workspace UI | Implemented | React, TypeScript, Vite, CSS, Framer Motion |
| Login, workspaces, roles, tenant isolation | Implemented | Supabase Auth, PostgreSQL, Row Level Security |
| Brand context and claim rules | Implemented | Supabase/PostgreSQL + TypeScript client services |
| Provenance, evidence classes, source freshness state | Implemented | PostgreSQL constraints, RLS, deterministic TypeScript guards |
| Private text/file intake and grounded manifests | Implemented | Supabase Storage + PostgreSQL + browser-side validators |
| Deterministic script parsing, scene representation, lexical claim matching | Implemented | TypeScript pure functions + PostgreSQL snapshots |
| AI analysis, creative predictions, agents, trend research, live social data, calibration | **Not implemented** | Requires future services and authorized data sources |

## The permanent core

These components should remain central even after Vanta becomes much more capable:

| Layer | Long-term role | Why it remains |
|---|---|---|
| React + TypeScript | Product interface and interaction state | Best fit for the web workspace, rich editor, evidence views, and component ecosystem |
| PostgreSQL + RLS | System of record and tenant boundary | Vanta depends on relationships, auditability, transactions, constraints, provenance, and permissions |
| Supabase Auth/Storage | Identity and private asset storage | Provides secure workspace access and keeps files outside database rows |
| Deterministic TypeScript guards | Final claim/response gate | Model output must never bypass numeric-provenance, citability, source freshness, or approval checks |

## Required future upgrades

### Upgrade A — Secure application backend for Groq and official connectors

**Trigger:** the first Groq feature, official OAuth connector, webhook, scheduled source refresh, or notification is approved.

The browser must never receive `GROQ_API_KEY`, service-role credentials, OAuth refresh tokens, or connector secrets. Add a server-side boundary:

```text
React browser
  → authenticated API boundary
  → validation / rate limit / audit / source-policy gate
  → Groq or official provider API
  → structured result validation
  → Postgres
```

Start with **Supabase Edge Functions** for small authenticated calls and webhooks. Add a dedicated **Node.js TypeScript service** only when orchestration, queues, retry policies, connector SDKs, or request duration outgrow the edge-function model.

Node is therefore part of Vanta’s future, but Express is not automatically required. A NestJS/Fastify/Express service should be introduced only when it owns a clear responsibility such as the model gateway, OAuth connectors, or workflow scheduler.

### Upgrade B — Python analysis service

**Trigger:** Vanta begins real video/audio analysis, offline evaluation, campaign-outcome calibration, large CSV transformation, embeddings/clustering, or statistical model training.

Python is the right future language for data/ML work because it has mature tooling for:

- Dataframes, statistical analysis, model evaluation, and calibration.
- Audio/video feature extraction and transcript alignment.
- Embeddings, clustering, anomaly detection, and offline experiments.
- Reproducible batch jobs and evaluation notebooks/tests.

The first Python component should be a **small FastAPI analysis service** or worker with explicit job contracts. It should never become a second source of truth.

```text
Postgres/Supabase Storage
  → queued analysis job
  → Python worker
  → deterministic feature/evaluation result
  → evidence/feature tables with provenance and version metadata
```

Python must return typed data, source references, model/version identifiers, timestamps, coverage, and failure states. It must not return ungrounded marketing prose directly to the browser.

### Upgrade C — Durable job queue and workflow engine

**Trigger:** multi-step jobs, retries, multiple agents, scheduled refreshes, video processing, webhook recovery, or work that outlives one HTTP request.

The product will need a durable queue/workflow layer before claiming reliable multi-agent orchestration. Required properties are idempotency keys, retriable jobs, dead-letter states, step audit logs, cancellation, concurrency limits, and human approval gates.

The preferred sequence is:

1. Database-backed job records for short, simple work.
2. A managed queue/workflow service or a Node worker for reliable multi-step work.
3. A Python worker only for compute/data tasks it owns.

Do not run long video processing or autonomous agent loops in a browser tab or a request handler.

### Upgrade D — Media pipeline and scalable object storage strategy

**Trigger:** users upload real video bytes, Vanta samples frames, produces transcripts, detects scenes, or stores substantial media volume.

Ticket 3.2 correctly blocks video bytes today. Full video support needs:

- Private object storage with signed uploads/downloads and lifecycle controls.
- File type verification beyond client-declared MIME/extension.
- A media worker for metadata extraction, thumbnails, frame sampling, and optionally transcription.
- Job progress, cancellation, quota enforcement, and content-retention/deletion policies.
- A clear lineage chain from original asset → derived artifact → deterministic/ML feature → decision packet.

Supabase Storage is suitable for the first private assets. Larger video workloads may later need dedicated S3-compatible storage or a provider with economical media egress and lifecycle rules. Do not migrate before asset volume, file size, or processing needs justify it.

### Upgrade E — Retrieval, semantic memory, and vector search

**Trigger:** Brand Brain content, prior creative tests, sourced research, and campaign outcomes become too large for deterministic relational lookups alone.

Add vector retrieval only for a defined question such as “find relevant approved proof points” or “retrieve comparable past experiments.” PostgreSQL remains the permissioned record of truth. Vector results are retrieval candidates, not evidence.

Every retrieved item must still pass workspace scope, source freshness, evidence class, and citation checks before use in a model prompt or a user-facing recommendation.

### Upgrade F — Real external data and official platform integrations

**Trigger:** Vanta offers owned-account analytics, campaign metrics, audience activity, trend monitoring, or publishing-time recommendations.

No model, blog, or generic internet knowledge can reveal a platform’s private ranking system or an individual account’s true audience scroll time. Vanta must use:

- User-authorized official APIs and account exports for owned data.
- Approved RSS/news/public sources for research, stored with source URLs and timestamps.
- Source-specific recency, coverage, quota, access, and consent metadata.
- Explicit `unknown` or `insufficient evidence` states when source access is absent.

Third-party connectors should run through the secure backend, never directly from the browser. OAuth refresh tokens must be encrypted and access-scoped. Vanta may suggest **test windows** from owned history and verified data; it must never promise a perfect posting time, exact reach, or access to a private algorithm.

### Upgrade G — Observability, feature flags, and operational safety

**Trigger:** external users, paid usage, connector jobs, model calls, or background processing.

Add error tracking, structured logs, latency/cost observability, feature flags, incident alerts, and data-access audits. This is required before relying on multi-agent or connector workflows in production. Model runs need provider/model/version, input evidence IDs, output schema result, validation outcome, retry/fallback path, and user approval state.

## What Python does and does not solve

| Requirement | Python helps? | What else is still required |
|---|---:|---|
| Parse and render text/scripts | Not necessary | Current TypeScript is sufficient |
| Video/audio feature extraction | Yes | Storage, queue, worker runtime, permissions, retention policy |
| Campaign CSV normalization/calibration | Yes | Trusted imports, metric definitions, outcome provenance |
| Multi-agent coordination | Sometimes | Durable workflows, model gateway, validation, approval gates |
| Better LLM reasoning | No | Model selection, structured schemas, evidence retrieval, evaluator gates |
| Real trend/social data | No | Authorized official APIs or permitted public sources |
| Security/RLS | No | PostgreSQL constraints, RLS, secure backend, E2E testing |

## What C/C++ and other languages do not need to do

Vanta does not need C or C++ for its UI, database, agents, or ordinary media workflow. Use C/C++ indirectly through mature codecs, native libraries, browser APIs, or WebAssembly when a measured performance bottleneck appears. Writing custom C++ services now would slow the product without improving correctness.

Rust/WASM can become useful only if browser-side media extraction becomes a measured bottleneck and cannot reasonably move to the worker pipeline. It is not a planned prerequisite.

## Honest architecture after the required upgrades

```text
React / TypeScript / Vite
        │
        ├── Supabase Auth + PostgreSQL + RLS + Storage (truth, permissions, assets)
        │
        └── Secure server boundary (Edge Functions first; Node service when required)
                │
                ├── Groq structured model gateway + evidence validation
                ├── Official OAuth/API connectors + webhooks
                ├── Durable queue/workflow engine
                └── Python analysis workers for media, ML, calibration, ETL
                         │
                         └── derived features/results with lineage back to assets and evidence
```

## Upgrade order and non-negotiable triggers

| Order | Add only when this becomes true | Upgrade |
|---:|---|---|
| 1 | First Groq call or OAuth/webhook | Secure Edge Function/model gateway |
| 2 | First long-running/retriable workflow | Durable queue and job records |
| 3 | First actual video/audio processing or calibration job | Python worker + private derived-artifact pipeline |
| 4 | First significant media scale or expensive egress | Storage lifecycle/object-storage review |
| 5 | First owned account analytics connection | Official connector service + encrypted token handling |
| 6 | First multi-agent user-facing workflow | Typed task graph, model fallback, evaluator/arbiter gates, human approval |
| 7 | First external beta/user data | Real-JWT two-user E2E tests, error tracking, logging, feature flags, incident process |

## Non-negotiable limits

Vanta can become powerful, but it cannot honestly claim any of the following without the required data and validation:

- Exact future views, reach, revenue, or conversion.
- The private algorithm/ranking logic of Instagram, TikTok, YouTube, or another platform.
- Audience activity, scroll time, or trend evidence that the user has not authorized or that no permitted source supports.
- Reliable predictions without outcome calibration against real observed data.
- “Non-hallucinating AI.” The realistic goal is fail-closed behavior: citations, typed schemas, validation, confidence/disagreement, unknown states, and human escalation.

## Conclusion

The present stack is **the correct first third of Vanta**, not the entire finished system. React/TypeScript/Supabase should remain the stable core. Add a secure Node/Edge layer before live AI/connectors, Python when genuine ML/media/calibration work begins, and durable workers/queues before background jobs or multi-agent orchestration. This staged approach can achieve the full vision more reliably than adding every language and service prematurely.
