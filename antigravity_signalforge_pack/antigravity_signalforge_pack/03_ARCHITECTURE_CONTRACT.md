# Architecture Contract

## Principle

Choose the smallest stable stack compatible with the existing repository. This document is the preferred baseline, not permission to ignore the scaffold or add every dependency immediately.

## Recommended free-first stack

| Layer | Preferred technology | Boundary |
|---|---|---|
| Frontend | React, TypeScript, Vite, Tailwind, accessible component primitives, Framer Motion | Marketing site, workspace, timelines, evidence cards, dashboards, empty states |
| Visual zones | Local wrapper components around ReactBits imports | Future effects never bypass design tokens, a11y, reduced motion, or performance limits |
| Database/auth | Supabase Auth + PostgreSQL + Row Level Security + `pgvector` | Identity, tenants, evidence, jobs, experiments, outcomes, audit events |
| File storage | Supabase Storage or S3-compatible signed storage | Private assets and derived artifacts; never store binary files in database rows |
| Static hosting | Cloudflare Pages | Public application delivery |
| API/policy edge | Cloudflare Workers + TypeScript + Zod | Authentication, validation, quota, signed upload, provider proxy, rate limits |
| Task graph | Custom TypeScript orchestrator with PostgreSQL task state | Bounded agent runs, retries, dependency graph, approvals, recovery |
| LLM gateway | Server-side provider adapter: Groq, Gemini, optional BYOK | Structured outputs only; model keys never cross the client boundary |
| Lightweight local ML | Transformers.js, ONNX Runtime Web, WebGPU, Ollama for local development | Browser-side embeddings/basic classification and private development experiments |
| Media preprocessing | WebCodecs, HTML5 media APIs, canvas, Tesseract.js, MediaPipe/ONNX where suitable | Progressive client-side work; no early reliance on server GPU video processing |
| Source ingestion | RSS, official APIs, user CSV/link/export inputs, approved public sources | Provenance and collection policy mandatory |
| Notifications | In-app center, browser notification permission, optional email provider after term review | Threshold-based, deduplicated, evidence-linked alerts |
| Test/observability | Vitest, Playwright, accessibility checks, visual screenshots, structured logs, error tracking | Demonstrate correctness, source integrity, agent recovery, and visual quality |

## Architecture boundaries

### Client

The client may display evidence and request tasks. It may not hold provider secrets, resolve authority conflicts, calculate trusted metrics from unverified fields, or execute privileged integration actions.

### API and policy gateway

All user input, imports, agent tasks, and provider calls pass through typed validation. The API enforces user/workspace membership, source policy, input limits, rate limits, idempotency, task state transitions, and audit logging.

### Database

Store immutable observed imports separately from derived AI findings. Store a source record, raw metadata, normalized fields, extraction version, agent run, model/prompt version, and evidence links. Do not overwrite historic observed outcomes or prior decisions.

### Worker/task graph

Tasks must be durable and resumable. States: `queued`, `running`, `waiting_for_input`, `waiting_for_approval`, `retry_scheduled`, `blocked`, `failed`, `completed`, `cancelled`. No task depends on in-memory chat state or process-local timers.

### Provider adapter

Every provider call receives a bounded Decision Packet and returns schema-validated data. The adapter records provider/model, prompt version, token/cost metadata where available, failure class, retry count, and fallback path. A provider response is not evidence on its own.

## External-source policy

Use only official APIs, user-authorized data, RSS, approved public sources, and manual imports. Each source connection stores owner, consent, scope, last success, freshness window, rate-limit status, and known limitations.

If unavailable, show a disconnected/manual-import state. Never emulate a live connection with mock data.

## Scheduling rule

Refresh jobs must be durable, authenticated, idempotent, rate-limited, and source-scoped. Never use `setInterval`, local cron, or a timer that disappears on a server restart. A source panel must show last refresh, next refresh, coverage, failure, and staleness.
