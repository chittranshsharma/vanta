# Model Gateway Deployment Readiness (Ticket 5.0)

Status: code reviewed and patched locally. **Not deployed. No secrets configured. No Groq call has been made.**
Nothing in this document may be executed without explicit user approval.

## What the gateway does today

Two tasks are allowlisted; only `gateway_health_check` is enabled without configuration. `claim_grounding_audit` (Ticket 5.1) is dark until `ENABLED_TASKS` names it.

`gateway_health_check`: It sends a fixed server-owned prompt containing a random nonce to Groq, requires the model to echo the nonce in a fixed JSON shape, validates the response, and writes one sanitized audit row. No user or creative content is sent anywhere. This proves the secret, the model, the auth chain, and the validation path work before any real task is designed.

## Required server secrets (Supabase Edge Function environment)

| Name | Purpose | Set by |
|---|---|---|
| `GROQ_API_KEY` | Provider credential. Never prefixed `VITE_`. Never in `.env` that Vite reads. | Operator, via `supabase secrets set` |
| `GROQ_MODEL` | Optional. Defaults to `llama-3.3-70b-versatile`. Server-side only. | Operator |
| `ALLOWED_ORIGINS` | Comma-separated production origins, for example `https://vanta.example.com`. Localhost 5173/3000 are built in for development. | Operator |
| `ENABLED_TASKS` | Comma-separated task names to enable beyond the health check. Unset = health check only. `claim_grounding_audit` stays off until migration 010 is live and the health check passed. Unknown names are ignored. | Operator |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Injected automatically by the Supabase runtime. | Platform |

The browser bundle must contain none of these. Static check: `grep -r GROQ src/` returns only the comment in `.env.example` and the type name in `modelGateway.ts` docs.

## Model allowlist

Single model from `GROQ_MODEL`. The client cannot name a model. Changing the model is a configuration change by the operator, recorded in `docs/build-state.md`.

## Approval required before each of these

1. `supabase secrets set GROQ_API_KEY=...` (creates billable capability).
2. `supabase functions deploy model-gateway` (exposes an authenticated endpoint).
3. First health-check invocation (first Groq call, first cost).

## One owner/admin health-check procedure

1. Sign in as a workspace owner or admin in the app.
2. From the browser console on the app origin, run `invokeGatewayHealthCheck("<workspace uuid>")` (exported from `src/lib/modelGateway.ts`), or wire a temporary admin-only button.
3. Expect `{ success: true, data: { status: "healthy", service: "vanta-model-gateway", echo_nonce }, latencyMs, correlationId, model }`.
4. Confirm one `audit_events` row: `action = 'model_gateway.invocation'`, `resource_type = 'model_gateway'`, `resource_id = correlationId`, `metadata.validation_status = 'passed'`.

## Negative checks (run after the positive check)

| Check | Expected |
|---|---|
| Same call as a `member` or `viewer` | 403 `forbidden` |
| No `Authorization` header | 401 `unauthorized` |
| Body with an extra key (`prompt`, `model`) | 400 `invalid_request` |
| `task_type: "anything_else"` | 400 `invalid_task_type` |
| Body over 8192 bytes | 413 `payload_too_large` |
| 11th call within one hour from the same workspace | 429 `rate_limited` |
| `GROQ_API_KEY` temporarily unset | 503 `gateway_not_configured` |
| Request from an origin not in `ALLOWED_ORIGINS` | Browser CORS failure; response origin header is never `*` |
| `audit_events` insert blocked (simulate by revoking insert) | Response carries `audit_write_failed: true`; request still reports the validation result |
| `task_type: "claim_grounding_audit"` with `ENABLED_TASKS` unset | 403 `task_disabled` |
| Same with the task enabled, as a `viewer` member, twin from another workspace | 404 `twin_not_found` (RLS hides it) |
| Same, twin with zero claims | 400 `nothing_to_audit` |
| Same, workspace with no approved brand claims | 400 `brand_codex_empty` |
| Same, valid inputs | 200 with `needs_human_review: true`; one `model_task_runs` row with `status = passed` |

## Rollback and disable

- Disable: `supabase functions delete model-gateway` or unset `GROQ_API_KEY` (gateway then returns 503 for every call and makes no provider requests).
- No database rollback is needed. The gateway writes only to `audit_events`, which is append-only by design.
- The client adapter degrades to a typed `function_invocation_error`; no UI depends on the gateway today.

## Known limits

- Rate limiting counts `audit_events` rows through the caller's RLS context. It is best-effort and fails closed when the count cannot be read. A dedicated quota table or provider-side budget is required before any user-facing task.
- No retry, no provider fallback, no cost telemetry. Those are Ticket 5.2.
