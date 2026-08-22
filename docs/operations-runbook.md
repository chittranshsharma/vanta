# Operations Runbook (Upgrade G)

Status: authored for a deployment that does not exist yet. Every command here needs an operator with project access and explicit approval. Nothing runs automatically.

## 1. Kill switches

| Symptom | Switch | Effect |
|---|---|---|
| Model cost spike, bad outputs | `supabase secrets unset GROQ_API_KEY` or `ENABLED_TASKS=""` | Gateway returns 503 `gateway_not_configured` / 403 `task_disabled`. No provider calls. |
| One task misbehaving | Remove it from `ENABLED_TASKS` | Only that task returns 403. Health check stays. |
| Worker runaway | Stop the worker process; `select public.release_stale_jobs(60);` after 15 min | Running jobs return to `queued` or `dead`. |
| Feed import flooding evidence | `update public.workspace_quotas set daily_limit = 0 where kind = 'feed_refresh'` (service_role) | `consume_quota` refuses. |
| Suspected token compromise | Rotate `CONNECTOR_TOKEN_KEY` (new key id), then `revoke_connector` for affected rows | Ciphertext cleared; users reconnect. |

## 2. What to alert on

Source: structured logs (`service = model-gateway`, worker logs) and `audit_events`.

| Alert | Query / signal | Threshold |
|---|---|---|
| Gateway validation failures | logs `validation_status in (schema_violation, malformed_json)` | > 20 % of runs in 15 min |
| Upstream errors | logs `error = upstream_provider_error` | > 5 in 5 min |
| Audit write failures | responses with `audit_write_failed: true` | any |
| Dead-letter growth | `select count(*) from public.jobs where status = 'dead' and finished_at > now() - interval '1 hour'` | > 10 |
| Stale locks | `select count(*) from public.jobs where status = 'running' and locked_at < now() - interval '15 minutes'` | any |
| Quota exhaustion | `select * from public.workspace_quotas where used_today >= daily_limit` | review daily |
| Client errors | telemetry endpoint events `kind = client_error` | > 10 per version per hour |

## 3. Data-access audit

```sql
-- service_role
select * from public.audit_summary('<workspace uuid>', 7);
```

Actions to expect: `workspace.created`, `creative_asset.uploaded`, `creative_twin.scene_corrected`, `creative_twin.claim_corrected`, `model_gateway.invocation`, `connector.requested`, `connector.revoked`.

## 4. Incident steps

1. Flip the relevant kill switch (section 1). Confirm with one request that the typed error is returned.
2. Capture `correlation_id`s from user reports; grep logs for them. Logs never contain prompts or tokens, so they are safe to share internally.
3. For data questions, run the audit summary and the deferred-validation queries for the table involved.
4. Write the incident note in `docs/decisions.md` only if a decision changed; otherwise in the issue tracker.
5. Re-enable by reversing the switch; verify with the readiness checklist negatives.

## 5. Rollback

- Edge Function: redeploy the previous version from git; no schema change is tied to a function version.
- Migrations 007 onward are additive. Rolling back code never requires dropping a table; leave tables in place.
- Worker: stop process, redeploy previous build; in-flight jobs are recovered by `release_stale_jobs`.

## 6. Before external users (roadmap row 7)

- [ ] QA-1 two-user suite green against the staging project (`npm run test:e2e` with `E2E_*` set).
- [ ] Telemetry endpoint configured (`VITE_TELEMETRY_ENDPOINT`) or an explicit decision to run without.
- [ ] `ENABLED_TASKS` set deliberately; `VITE_FLAGS` set deliberately.
- [ ] Quotas reviewed per workspace.
- [ ] Runbook owner named.
