# Upgrade Reviews

One entry per roadmap upgrade (A through G). Each upgrade is built as repository-level code, then reviewed against the checklist below before the next starts. Nothing here is deployed or live-verified; live checks are appended to `docs/supabase-deferred-validation.md`.

Review checklist applied to every upgrade:

1. Boundary: browser never receives secrets; server validates JWT and membership through the caller's RLS context.
2. Fail closed: every missing input, disabled flag, provider failure, or validation failure returns a typed error and shows nothing fabricated.
3. Evidence: outputs carry one of the five evidence classes and provenance (model, prompt version, schema version, run id).
4. Tenant: new tables have RLS, composite FKs, actor binding, and append-only protection where they are audit records.
5. Tests: pure logic unit-tested; static contract tests updated; `npm run verify` clean.
6. Honesty: docs say what is authored versus live; no roadmap line claims a runtime exists.

---

## Upgrade A: Secure application backend for Groq (Ticket 5.0 + 5.1 wiring)

Date: 2026-08-23. Status: authored, not deployed.

### What was built

| Piece | File | Notes |
|---|---|---|
| Task registry + default-enabled set | `supabase/functions/model-gateway/schemas.ts` | `ALLOWLISTED_TASKS` = health check + claim grounding; `DEFAULT_ENABLED_TASKS` = health check only |
| Operator flags | `flags.ts` | `ENABLED_TASKS` env; unknown names ignored; health check cannot be disabled |
| Provider adapter | `provider.ts` | fetch injected; key only in header; strict JSON-schema response format; bounded retry: 1 transient retry, 1 schema repair, hard cap 3 calls |
| Request guards | `guards.ts` | per-task extra fields (`twin_id` only for grounding); new audit status `refused` |
| Grounding prompt + context | `tasks/claimGroundingPrompt.ts` | fixed versioned system prompt; rows serialized as delimited untrusted data; only `review_status = approved` brand claims/proof points participate; size limits refuse rather than truncate |
| Gateway routing | `index.ts` | task branch; member authorization for content task, owner/admin for health; loads rows via caller's RLS client; persists `model_task_runs`; audit row per run |
| Run records | `20260822000010_model_task_runs.sql` | append-only, RLS, composite FK to twin, actor-bound insert, CHECK that output exists only when passed |
| Client adapter | `src/lib/modelGateway.ts` | `invokeClaimGroundingAudit(workspaceId, twinId)`; ids only |
| Review UI | `src/components/ClaimGroundingPanel.tsx` in the Claims tab | labelled inference, needs review, confidence uncalibrated; nothing writes to claims |

### Review findings

| # | Finding | Severity | Resolution |
|---|---|---|---|
| A-1 | Rate limiter counts all gateway invocations, not per task. A member running grounding audits consumes the owner's health-check budget. | P2 | Acceptable for 5.1; per-task quota belongs with the job records in Upgrade C. Recorded. |
| A-2 | `model_task_runs` insert goes through the caller's RLS client. If migration 010 is not live, the insert fails; response carries `run_persisted: false` so the gap is visible. | P2 | Intentional fail-visible behavior; D-4 step 8 verifies. |
| A-3 | Provider `response_format: json_schema strict` is supported by Groq for a subset of models. If the configured model rejects it, the call returns an HTTP 400 which is non-transient and surfaces as `upstream_provider_error` with no retry. | P2 | Correct failure mode. Operator picks a model that supports strict schemas; documented in readiness checklist. |
| A-4 | `confidence` is model self-report. UI says so. | Accepted | Spec requirement met. |
| A-5 | Panel is visible even when the task is disabled on the deployment; clicking returns a typed `task_disabled` message. | P2 | Honest; a flags endpoint for the client is Upgrade G scope. |
| A-6 | No per-workspace budget or cost telemetry. | P1 (deferred to G) | Recorded in Upgrade G plan. |

### Verification

`npm run verify`: lint 0/0, tsc clean, 259 tests (13 suites), build clean. Static contract tests cover migration 010 (RLS, actor binding, composite FK, deny update/delete, trigger).

Checklist: 1 pass, 2 pass, 3 pass, 4 pass, 5 pass, 6 pass.

Live verification deferred: `docs/supabase-deferred-validation.md` D-4 steps 1-8.

---

## Upgrade C: Durable job queue and workflow engine (step 1: database-backed records; step 2: Node worker)

Date: 2026-08-23. Status: authored, not deployed. Migration 011 PENDING LIVE APPLY.

### What was built

| Piece | File | Notes |
|---|---|---|
| Job records | `supabase/migrations/20260822000011_jobs.sql` | `jobs` table: idempotency key unique per workspace, attempts/max_attempts, run_after backoff, lock columns, `requires_approval` gate, append-only `step_log`, CHECKs tying result/error to status |
| Transitions | same | RPCs only: `claim_next_job` (FOR UPDATE SKIP LOCKED), `complete_job`, `fail_job` (requeue or dead-letter), `release_stale_jobs`; members get `cancel_job` and admins `approve_job`. Direct UPDATE/DELETE denied by policy |
| Grants | same | Worker RPCs revoked from PUBLIC, anon, authenticated; granted to service_role only. Member RPCs require non-null `auth.uid()` and membership |
| Shared policy | `shared/jobs/policy.ts` | state machine, approval-required types, jittered exponential backoff (30s base, 15 min cap), dead-letter decision, deterministic idempotency key. 12 tests |
| Browser client | `src/lib/jobs.ts` | enqueue (duplicate detection on 23505), list, cancel, approve. Typed errors when migration not live |
| Worker | `services/job-worker/` | own package; service-role key only in its process; loop separated from I/O and tested (8 tests): timeout, thrown handler, unregistered type, claim errors, finalization errors |
| First handler | `handlers/campaignCsvNormalize.ts` | forwards to the Python analysis service (Upgrade B); fails permanently with `analysis_unconfigured` when unset |

### Review findings

| # | Finding | Severity | Resolution |
|---|---|---|---|
| C-1 | `jobs` insert policy lets any member enqueue any job type, including `source_refresh` which has external side effects. | P1 | Fixed in 011 before apply: CHECK constraints bind `requires_approval` to the job type and forbid `awaiting_approval` without it. Only admins/owners can `approve_job`. |
| C-2 | The worker uses `Promise.race` for timeouts; a timed-out handler keeps running in the background until it finishes. | P2 | Handlers receive `deadlineMs` and the CSV handler aborts its HTTP call. Other handlers must honor the deadline; documented in README. |
| C-3 | No per-workspace concurrency limit; a workspace can flood the queue. | P2 | Idempotency key prevents duplicates of the same job. Per-workspace cap belongs in Upgrade G quotas. |
| C-4 | Generated database types do not include `jobs`; client casts through `never`. | P2 | Resolves when types are regenerated after live apply (D-1 procedure). |
| C-5 | `fail_job` treats `p_retriable = true` with attempts >= max as dead; the two identical branches in the SQL are intentional readability, not a bug. | Note | Left as written. |

### Verification

`npm run verify` (now includes `typecheck:worker`): lint 0/0, root tsc clean, worker tsc clean, 290 tests (16 suites), build clean. Static contract tests: 011 in the applied list, 23 tables, `jobs` RLS + actor binding + deny update/delete, 6 new SECURITY DEFINER functions with search_path, worker RPC revokes and service_role grants, member RPC auth checks.

Checklist: 1 pass, 2 pass, 3 n/a (no model output), 4 pass, 5 pass, 6 pass.

Live verification deferred: D-11 (added).

---

## Upgrade B: Python analysis service (FastAPI worker with explicit job contracts)

Date: 2026-08-23. Status: authored, tested locally (15 pytest cases), not deployed.

### What was built

| Piece | File | Notes |
|---|---|---|
| Contracts | `services/analysis-worker/app/contracts.py` | Pydantic v2 request/response models; `Provenance` carries service version, schema version, processed_at, header map, row counts, coverage, notes; each row carries `evidence_class = observed` and `source_row` |
| Normalizer | `app/normalize.py` | Pure: header synonyms + explicit `column_map` override, ISO and slash dates (ambiguous M/D vs D/M flagged, never guessed), number parsing (commas, currency, percent), duplicate detection, per-row skip reasons, honest row cap |
| Service | `app/main.py` | FastAPI; bearer token via constant-time compare; unconfigured token refuses everything (503); 422 typed error when no metric column; no docs endpoints exposed |
| Packaging | `pyproject.toml`, `Dockerfile`, `README.md` | No secrets in the image; stdlib csv, no pandas dependency yet |
| Worker hook | `services/job-worker/src/handlers/campaignCsvNormalize.ts` | Node worker forwards the job and records the typed result |
| CI | `.github/workflows/ci.yml` | second job runs pytest on Python 3.12 |

### Review findings

| # | Finding | Severity | Resolution |
|---|---|---|---|
| B-1 | CSV text travels inline in the job payload (2 MB cap). Larger imports need the Storage signed-URL path from Upgrade D. | P2 | Documented in contracts; `storage_path` variant arrives with D. |
| B-2 | Metric synonyms are a fixed English list. Platform exports with localized headers need `column_map`. | P2 | `column_map` override exists and is tested; UI for it is future work. |
| B-3 | Results are returned to the worker but nothing yet writes normalized rows into `evidence_items`/a campaign table. Calibration (Upgrade F/8) owns that. | P1 (next) | Recorded; `derived_artifacts` (Upgrade D) will hold the typed result with lineage until the calibration tables exist. |
| B-4 | `date_ambiguous` rows are kept rather than dropped. | Accepted | Spec: flag, never fabricate. The UI must show the flag. |

### Verification

`pytest -q`: 15 passed. Node side: 290 vitest tests still pass; lint and both typechecks clean.

Checklist: 1 pass (token only in worker env), 2 pass, 3 pass, 4 n/a (no tables), 5 pass, 6 pass.

---

## Upgrade D: Media pipeline and object storage strategy

Date: 2026-08-23. Status: authored, not deployed. Migration 012 PENDING LIVE APPLY. Video intake still disabled (`VIDEO_INTAKE_ENABLED = false`).

### What was built

| Piece | File | Notes |
|---|---|---|
| Magic-byte verification | `shared/media/magicBytes.ts` | PNG/JPEG/GIF/WebP/PDF/MP4/QuickTime/WebM/ZIP/text detection; `verifyDeclaredType` rejects mismatches. 12 tests |
| Intake hardening | `src/lib/creativeIntake.ts` | verification runs on the first 8 KB before any DB or Storage write; mismatch returns a typed error, asset never created |
| Lineage table | `supabase/migrations/20260822000012_derived_artifacts.sql` | asset -> artifact -> parent artifact chain with composite FKs to `creative_assets` and `jobs`; producer + version; evidence class + coverage; `retention_until`; members insert only `deterministic` artifacts, workers insert via service_role; admins may delete |
| Retention sweeper | same | `purge_expired_artifacts(limit)` service_role only; deletes rows first and returns storage paths so bytes are removed after, never before |
| Media worker handler | `services/job-worker/src/handlers/mediaProbe.ts` | signed download (120 s), path must start with the job's workspace prefix, 512 MB cap, magic bytes re-verified server-side, `ffprobe` via `execFile` with the job deadline, temp dir always cleaned; missing ffprobe = permanent `ffprobe_missing`, never a fake success |
| ffprobe parser | `handlers/ffprobe.ts` | pure; nulls for missing fields. 3 tests |
| Client helpers | `src/lib/media.ts` | signed download URL scoped to workspace prefix (5 min), default 90-day retention, build-time video flag |

### Review findings

| # | Finding | Severity | Resolution |
|---|---|---|---|
| D-1 | Worker writes `derived_artifacts` rows with service_role, bypassing RLS. The handler therefore validates that `storage_path` begins with `job.workspace_id/` before touching anything. | P1 | Enforced in handler; a CHECK `storage_path LIKE workspace_id::text || '/%'` cannot reference another column's cast in all PG versions portably, so the static test asserts the handler guard instead. |
| D-2 | Thumbnail and frame sampling are not implemented; only `media_metadata`. | P2 | Table supports them (`artifact_kind`). Next media slice. |
| D-3 | Supabase Storage remains the store. No S3 migration, per roadmap: not before volume justifies it. | Accepted | Recorded. |
| D-4 | Retention sweeper returns paths; the worker must delete bytes and log failures. Bytes whose row deletion succeeded but byte deletion failed become orphans. | P2 | Orphan scan job (`media_probe` variant) listed for Upgrade G operational tasks. |
| D-5 | Video intake remains off. Enabling it is a product decision plus worker deployment. | Accepted | Flag is build-time in `media.ts`. |

### Verification

`npm run verify`: lint 0/0, root + worker tsc clean, 310 tests (19 suites), build clean. Migration tests: 24 tables, 012 RLS + actor binding, composite FKs to `creative_assets` and `jobs`, sweeper revoked to service_role.

Checklist: 1 pass, 2 pass, 3 pass (observed/coverage on every artifact), 4 pass, 5 pass, 6 pass.

Live verification deferred: D-12.

---

## Upgrade E: Retrieval, semantic memory, and vector search

Date: 2026-08-23. Status: authored, not deployed. Migration 013 PENDING LIVE APPLY (needs pgvector).

### What was built

| Piece | File | Notes |
|---|---|---|
| Embedding store | `supabase/migrations/20260822000013_embeddings.sql` | `retrieval_embeddings` (1536-dim, HNSW cosine), per-row model + version + content hash + job lineage; browser roles read-only (insert/update/delete denied); only the worker writes |
| Candidate search | same | `match_retrieval_candidates` is SECURITY INVOKER so RLS applies; returns ids + similarity only, never text; capped at 50 |
| Coverage | same | `retrieval_coverage(workspace)` so the UI can state indexed vs total rows honestly |
| Gate | `shared/retrieval/gate.ts` | every candidate must pass: row visible under RLS, workspace match, same embedding model, similarity floor, approved, allowed evidence class, citable freshness, per-source and total caps. Output is typed `retrieval_candidate`, never evidence. 10 tests |
| Chunking | same | deterministic whitespace-aware chunks with overlap. 2 tests |
| Worker handler | `services/job-worker/src/handlers/embeddingRefresh.ts` | OpenAI-compatible `/embeddings` endpoint chosen by operator; content-hash skip; deadline-aware; unconfigured = permanent failure; vector dimension validated before write |
| Client | `src/lib/retrieval.ts` | coverage only; the browser never embeds or queries vectors |

### Review findings

| # | Finding | Severity | Resolution |
|---|---|---|---|
| E-1 | `match_retrieval_candidates` is callable by any member for any workspace id, but RLS on the table returns only rows from their workspaces, so a foreign id yields zero rows. | Accepted | Verified by static test that the function is SECURITY INVOKER and filters by `p_workspace_id`. |
| E-2 | HNSW index is global, not per workspace; query filters after index scan, which can reduce recall for small workspaces in a large table. | P2 | Acceptable at current scale; partition or per-workspace `ef_search` tuning later. |
| E-3 | No embedding provider is chosen. Groq does not offer embeddings; the handler is provider-agnostic over the OpenAI-compatible shape. | Product decision | Operator picks a provider; requires approval (external account, cost). |
| E-4 | Retrieval is not yet used by the claim-grounding prompt; the prompt sends all approved rows (bounded at 120/200). | P2 | Gate exists for when row counts exceed the bounds; wiring into `claimGroundingPrompt` is the first consumer. |

### Verification

`npm run verify`: lint 0/0, root + worker tsc clean, 327 tests (21 suites), build clean. Migration tests: 25 tables, 013 read-only policies, SECURITY INVOKER search, composite FK to `jobs`.

Checklist: 1 pass, 2 pass, 3 pass (candidates never labelled evidence), 4 pass, 5 pass, 6 pass.

Live verification deferred: D-13.

---

## Upgrade F: Real external data and official platform integrations

Date: 2026-08-23. Status: authored, not deployed. Migration 014 PENDING LIVE APPLY. No provider OAuth app exists yet (product and operator decision).

### What was built

| Piece | File | Notes |
|---|---|---|
| Connector accounts | `supabase/migrations/20260822000014_connector_accounts.sql` | consent fields (who, when, requested vs granted scopes), status machine, AES-GCM ciphertext columns + key id; base table revoked from anon/authenticated; column-level grant excludes secrets; `connector_accounts_public` view (security_invoker) exposes no token columns |
| Member RPCs | same | `request_connector` (admin/owner, audit event) and `revoke_connector` (admin/owner, clears ciphertext immediately, audit event) |
| Token crypto | `services/job-worker/src/connectors/tokenCrypto.ts` | AES-256-GCM, random IV, key from backend env only, key id for rotation. 3 tests including tamper and wrong-key |
| Permitted public source | `shared/connectors/rss.ts` | RSS/Atom parser; dates never guessed; https public hosts only (no localhost, IPs, internal). 7 tests |
| Access state | `shared/connectors/access.ts` | `describeAccess` returns `unknown` with the smallest next input for every missing-consent case; `suggestTestWindows` yields `inference` windows from owned history or `unknown`, never a best-time claim. 5 tests |
| Feed refresh job | `services/job-worker/src/handlers/sourceRefresh.ts` | approval-gated job type; writes `sourced_claim` evidence rows with citation URL and date, marks the source `connected` (service_role path the trigger allows); 2 MB cap; UA header; dedupe by citation URL |
| Client | `src/lib/connectors.ts` | list via view, request, revoke, access state |

### Review findings

| # | Finding | Severity | Resolution |
|---|---|---|---|
| F-1 | Official OAuth flows (Meta, Google, YouTube, TikTok, LinkedIn, X) are not implemented. Each needs a provider app, review process, redirect URIs, and credentials. | Product decision | Table, consent model, encryption, and access-state helper are ready; the flow is a Node service endpoint in a later slice after the operator registers apps. |
| F-2 | RSS refresh writes evidence rows as `draft`. Users must review before the rows can support anything. | Accepted | Matches the evidence standard: imported claims are `sourced_claim`, not verified. |
| F-3 | Feed fetching follows redirects; a redirect to a non-permitted host was not re-checked. | P1 | Fixed before review close: the final `response.url` is re-validated with `isPermittedFeedUrl`; a redirect off a permitted host fails permanently with `redirect_not_permitted`. |
| F-4 | `source_refresh` needs admin approval via `approve_job` every time. No scheduling. | P2 | Scheduling belongs to the durable workflow layer once a cron trigger exists (G operational task). |

### Verification

`npm run verify`: lint 0/0, root + worker tsc clean, 350 tests (24 suites), build clean. Migration tests: 26 tables, 014 view/grant checks, revoke clears ciphertext, RPC auth checks.

Checklist: 1 pass (tokens never readable by browser roles), 2 pass, 3 pass, 4 pass, 5 pass, 6 pass.

Live verification deferred: D-14.

---

## Upgrade G: Observability, feature flags, and operational safety

Date: 2026-08-23. Status: authored. Migration 015 PENDING LIVE APPLY. QA-1 suite authored; runs only with a staging project.

### What was built

| Piece | File | Notes |
|---|---|---|
| Structured gateway logs | `supabase/functions/model-gateway/log.ts` | one JSON line per event with correlation id, task, workspace, latency, model, attempts, validation status; forbidden keys (prompt, messages, content, authorization, keys, body, output) dropped. 1 test. Wired into `index.ts` for health check, grounding, quota, internal errors |
| Per-workspace quotas | `20260822000015_workspace_quotas.sql` | atomic daily counter per kind via `consume_quota` (auth + membership, fail closed); browser roles cannot write; `audit_summary` for operators (service_role) |
| Gateway quota use | `index.ts` | prefers `consume_quota`; if the function is not deployed (42883) falls back to the audit-count limiter and reports `quota_mode`; any other error refuses (503) |
| Client flags | `src/lib/flags.ts` | build-time `VITE_FLAGS`, closed list, all off by default; grounding panel now hidden unless `claim_grounding_panel` (closes A-5). 3 tests |
| Error boundary | `src/components/ErrorBoundary.tsx` | honest failure state with a correlation id; wraps the app in `main.tsx` |
| Client telemetry | `src/lib/telemetry.ts` | no SDK; optional operator endpoint; scrubs JWTs, bearer tokens, emails; route ids masked; failures swallowed. 4 tests |
| QA-1 isolation suite | `e2e/isolation.spec.ts`, `playwright.config.ts` | two real accounts, 25 tenant tables, write/update/delete denial, worker RPC denial, token column denial, snapshot immutability. Skips with a reason when `E2E_*` is unset (30 skipped locally, never "passed") |
| Runbook | `docs/operations-runbook.md` | kill switches, alert queries, data-access audit, incident steps, rollback, pre-beta checklist |

### Review findings

| # | Finding | Severity | Resolution |
|---|---|---|---|
| G-1 | Logs go to stdout only; no log shipping or alerting product is wired (would need an external account). | Product decision | Runbook lists the queries and thresholds so any log sink can alert on them. |
| G-2 | Quota fallback to the best-effort limiter exists only so the health check works before 015 is live. Once 015 is applied, the fallback path is dead code. | P2 | Remove after D-15 confirms `consume_quota` live. |
| G-3 | Worker and analysis service emit structured logs but have no quota enforcement of their own; they rely on `jobs` approval gates and the enqueue quota kind `job_enqueue`, which the client does not call yet. | P1, fixed 2026-08-23 | `enqueueJob` now calls `consume_quota('job_enqueue')` first and fails closed on error or `allowed = false`. |
| G-4 | ErrorBoundary catches render errors only; async failures are already surfaced by the typed `{ data, error }` results in lib code. | Accepted | By design. |

### Verification

`npm run verify`: lint 0/0, root + worker tsc clean, 365 tests (28 suites), build clean. `npm run test:e2e`: 30 skipped with reason (no staging credentials). Migration tests: 27 tables, 015 policies, `consume_quota` auth checks, `audit_summary` service_role only.

Checklist: 1 pass, 2 pass, 3 n/a, 4 pass, 5 pass, 6 pass.

Live verification deferred: D-15, D-10 (QA-1 run).

---

## Summary across A-G

| Upgrade | Code | Tests | Migration | Live |
|---|---|---|---|---|
| A Secure backend | gateway + 5.1 task + UI panel | 60 | 010 | not deployed |
| B Python service | FastAPI + normalizer | 15 (pytest) | none | not deployed |
| C Durable queue | jobs + RPCs + Node worker | 20 | 011 | not applied |
| D Media pipeline | magic bytes + lineage + ffprobe handler | 15 | 012 | not applied |
| E Retrieval | pgvector + gate + embedding handler | 12 | 013 | not applied |
| F Connectors | consent + encrypted tokens + RSS refresh | 15 | 014 | not applied |
| G Observability | logs + quotas + flags + boundary + telemetry + QA-1 | 8 + 30 e2e (skipped) | 015 | not applied |

Total: 365 unit/contract tests, 15 pytest, 30 e2e authored. Nine migrations (007-015) pending live apply in order. Every runtime (Edge Function, Node worker, Python service) is authored and typechecked, none deployed.
