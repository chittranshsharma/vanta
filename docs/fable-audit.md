# Vanta Repository Audit (Phase 0)

Date: 2026-08-23
Scope: repository-only static review. No Supabase dashboard, MCP, remote SQL, deploy, or secret access was used.
Every database or Edge Function statement below is **static review only - live verification deferred**. Live checks are listed in `docs/supabase-deferred-validation.md`.

## Verified baseline

| Check | Result |
|---|---|
| `git status` | Clean after reverting an `npm install` lockfile metadata diff (42 deleted `libc` lines, npm-version noise). |
| Tracked secrets | None. `.env` ignored. Static scan for `eyJ`, `gsk_`, `sk_`, `service_role` in tracked `.ts/.tsx/.md/.json`: no hits. |
| Tracked artifacts | `antigravity_signalforge_pack.zip` (120 KB) duplicates the tracked folder `antigravity_signalforge_pack/`. Two root docs are byte-identical duplicates (`00_MASTER_INSTRUCTION.md` = `Master Instruction for Antigravity IDE.md`; `08_MODEL_HANDOFFS.md` = `Model Handoffs and Continuation Prompts.md`). |
| `npm test` | 83 passed / 83, 8 suites (vitest 2.1.9). |
| `npx tsc -b --noEmit` | Exit 0, no diagnostics. |
| `npm run build` | Clean. Warning: single JS chunk 701.31 kB (199.74 kB gzip) exceeds the 500 kB advisory. |
| Lint / CI | No ESLint config, no Prettier, no GitHub Actions workflow. |

## Severity key

- **P0**: security, tenant isolation, secret exposure, data loss, or fabrication risk. Patch before feature work.
- **P1**: correctness, reliability, accessibility, performance, or maintainability defect. Patch in bounded slices.
- **P2**: improvement opportunity. Record only.

Status values: `open`, `patched-pending-live-apply`, `fixed`, `deferred`.

---

## P0 findings

### P0-1. Brand Brain tables have no RLS in the committed schema

- **Status:** patched-pending-live-apply (migration `20260822000007_brand_brain_rls.sql`)
- **Evidence:** `supabase/migrations/20260822000002_brand_brain.sql` creates 8 tables (`brands`, `brand_codex_versions`, `brand_audiences`, `brand_claims`, `brand_proof_points`, `brand_competitors`, `brand_tone_guidelines`, `brand_compliance_boundaries`) and contains zero `ENABLE ROW LEVEL SECURITY` statements and zero `CREATE POLICY` statements. Every other table-creating migration (001, 003, 004, 005) enables RLS and defines policies in the same file. `docs/build-state.md` asserts "RLS (32 policies)" for Ticket 2.2; those policies are not in the repository.
- **Impact:** any deployment built from this repository exposes all 8 tables to every holder of the publishable anon key, which ships in the browser bundle. `src/lib/brandBrain.ts:57` (`fetchBrandClaims`) and `src/lib/creativeTwin.ts:432` filter by `brand_id` / `workspace_id` client-side only and rely entirely on RLS for tenant scoping.
- **Whether the live project is affected:** unknown. The 32 policies may exist live and simply never have been committed. Cannot be determined without live access. Treat as exposed until proven otherwise.
- **Smallest safe remediation:** additive, forward-only migration `20260822000007_brand_brain_rls.sql` that enables RLS on all 8 tables and creates idempotent member-scoped SELECT/INSERT/UPDATE and admin-scoped DELETE policies, with `brand_codex_versions` append-only. Guarded with `DROP POLICY IF EXISTS` so it is safe whether or not equivalent policies already exist live. Does not touch migrations 001-006.
- **Verification plan:** static contract test `src/lib/migrations.test.ts` asserts every `CREATE TABLE public.X` across all migrations has a matching `ENABLE ROW LEVEL SECURITY` and at least one policy. Live: see deferred checklist D-1.
- **Approval required:** yes, to apply the migration live. Authoring it in the repository needs none.

---

## P1 findings

### P1-1. RLS test suite asserts nothing

- **Status:** fixed (replaced by `src/lib/migrations.test.ts`)
- **Evidence:** all 8 tests in `src/lib/rls.test.ts` are `expect(true).toBe(true)` with comments saying SQL proof was run elsewhere on 2026-08-22. They count toward the "83 passing" figure.
- **Impact:** false assurance. The product's first law is "never substitute missing evidence with plausible prose"; these tests are exactly that.
- **Remediation:** delete the tautologies. Replace with static contract tests that parse the migration files and assert: every public table enables RLS; every table has policies; every `SECURITY DEFINER` function sets `search_path`; correction RPCs revoke `PUBLIC`/`anon`; `creative_twin_versions` has deny policies and an immutability trigger. These are real assertions about the committed schema.
- **Verification:** tests fail if any migration regresses. Live isolation proof remains QA-1.

### P1-2. Gateway audit insert omits NOT NULL column; rate limiter therefore never counts

- **Status:** fixed
- **Evidence:** `supabase/functions/model-gateway/index.ts` inserts into `audit_events` with `{workspace_id, user_id, action, metadata}` at four sites. `20260822000001_auth_workspaces.sql:38` declares `resource_type TEXT NOT NULL`. The generated `Insert` type in `src/types/database.types.ts` also requires `resource_type`. The Deno client is untyped, so this compiles. Insert results are not checked.
- **Impact:** every audit insert fails with a NOT NULL violation. No gateway invocation is ever audited. The "max 10 per hour" limiter counts `audit_events` rows and therefore always sees zero: it is not best-effort, it is absent.
- **Remediation:** add `resource_type: 'model_gateway'` and `resource_id: correlationId`; check insert errors and surface `audit_write_failed` in the response metadata (fail visibly, not silently).
- **Verification:** `supabase/functions/model-gateway/schemas.test.ts` plus a static contract test that the audit payload builder includes `resource_type`. Live: deferred D-4.

### P1-3. Gateway rate limiter fails open; body-size check trusts Content-Length

- **Status:** fixed
- **Evidence:** `index.ts` step 7: `if (!countError && recentInvocations !== null && recentInvocations >= 10)`. On `countError` the request proceeds. Step 1 compares `Content-Length` header, which a client controls; the body is then read without a size check.
- **Remediation:** on `countError` return `rate_limit_unavailable` (503) rather than proceeding; read body as text, check `byteLength <= 8192`, then parse.
- **Verification:** schemas/unit tests for the extracted pure helpers; live negative checks D-4.

### P1-4. Gateway 500 path echoes internal error text to the client

- **Status:** fixed
- **Evidence:** `index.ts` catch block returns `err.message` in the JSON body.
- **Remediation:** return fixed message; keep `correlation_id` for server-side correlation.

### P1-5. `auth.test.ts` is vacuous whenever Supabase is configured

- **Status:** fixed
- **Evidence:** all assertions sit inside `if (!isSupabaseConfigured)`. With a populated `.env` the suite passes with zero assertions executed.
- **Remediation:** mock `./supabase` with `vi.mock` so the unconfigured branch and the configured error-propagation branch are both exercised deterministically, independent of `.env`.

### P1-6. `created_by` columns accept any client-supplied UUID

- **Status:** patched-pending-live-apply (`20260822000008_bind_created_by.sql`; live pre-check D-2)
- **Evidence:** every INSERT policy in migrations 002-005 checks `is_workspace_member(workspace_id)` but no `WITH CHECK` binds `created_by = auth.uid()`. Client code passes `userId` from component state (`src/lib/creativeIntake.ts:428,444,605,653`, `src/lib/sourceRegistry.ts:151,256,313`, `src/lib/brandBrain.ts:129,161,192,247`, `src/lib/creativeTwin.ts:524`, `src/lib/auth.ts:110`).
- **Impact:** a workspace member can attribute records and immutable twin version snapshots to another user. Authorization is unaffected (membership is still enforced), provenance is.
- **Remediation:** forward-only migration adding `WITH CHECK (created_by = auth.uid())` to INSERT policies on tables with a `created_by` column, plus `audit_events.user_id = auth.uid()` is already enforced. Author only after P0 migration is applied live, to keep the pending-migration queue small.

### P1-7. Non-composite foreign keys allow cross-workspace linkage

- **Status:** patched-pending-live-apply (`20260822000009_composite_tenant_fks.sql`; live pre-check D-3)
- **Evidence:** `creative_twins.asset_id REFERENCES creative_assets(id)` (004), `ingestion_runs.asset_id REFERENCES creative_assets(id)` (004), `metric_definitions.source_id REFERENCES source_registry(id)` (003). The parent tables already carry `UNIQUE (id, workspace_id)` so composite FKs are possible. The spec (section 6.2) requires composite FKs for workspace-owned parents.
- **Impact:** a member of workspace A who learns an asset UUID from workspace B can create a twin or ingestion run in A pointing at B's asset. The correction RPCs in 006 re-check `a.workspace_id = p_workspace_id` so they fail safely, but the row itself is allowed.
- **Remediation:** forward-only migration replacing the three FKs with composite versions. Requires live data check for existing violations first.

### P1-8. Client-side re-parse is not atomic

- **Status:** deferred (needs RPC migration, listed as D-5)
- **Evidence:** `src/lib/creativeTwin.ts:441-442` deletes all scenes and claims for a twin, then inserts new rows in separate requests. A failure between delete and insert leaves the twin empty. The immutable version snapshot survives, so data is recoverable but the live twin is not.
- **Remediation:** move to a `SECURITY DEFINER` RPC with the same authorization pattern as 006. Out of scope until live apply is possible.

### P1-9. Workspace shell has no loading or error state for its data fetch

- **Status:** fixed
- **Evidence:** `src/App.tsx` `Workspace` component: `loadWorkspaceData` sets `sources`, `brand`, `assets` with no loading flag and no error surface. Every `fetch*` helper in `src/lib` swallows errors to `console.error` and returns `[]` / `null`, so a failed fetch renders as "no sources yet", which is a fabricated empty state, not an honest `unknown`.
- **Remediation:** new `src/lib/workspaceOverview.ts` returns `{ data, errors[] }`; Decision Room shows a visible `Could not load workspace data` alert with Retry, distinct from the genuine empty state. Source Registry and Creative Intake error states gained Retry; Source Registry forms now display insert/update errors they previously discarded.

### P1-10. Modals are not accessible

- **Status:** fixed
- **Evidence:** 0 occurrences of `role="dialog"`, `aria-modal`, `onKeyDown`, or `tabIndex` in `src`. Modals in `App.tsx:775,858`, `BrandBrain.tsx`, `SourceRegistry.tsx`, `CreativeTwinEditor.tsx` cannot be closed with Escape, do not trap or restore focus, and are not announced. 6 `aria-*` attributes total across 4 000 lines of TSX.
- **Remediation:** shared `Modal` component with `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape to close, initial focus, focus restore on close. Swap existing modals to it. Inputs already use wrapping `<label>`, which is accessible.

### P1-11. Single 701 kB chunk

- **Status:** fixed
- **Evidence:** `vite build` warning. All six workspace panels are eagerly imported in `App.tsx`; the landing page therefore pays for the full workspace bundle plus Supabase client.
- **Remediation:** `React.lazy` the six panel components behind `Suspense` with an honest loading state; `manualChunks` for `@supabase/supabase-js` and `framer-motion`.

### P1-12. No lint or CI

- **Status:** fixed
- **Evidence:** no ESLint config, no workflow. `tsc` strict mode is the only gate and it does not run in CI.
- **Remediation:** ESLint flat config (typescript-eslint + react-hooks), `npm run lint`, GitHub Actions workflow running `lint`, `tsc -b`, `test`, `build` on push and PR. Workflow does not deploy anything.

### P1-14. Ticket 4.1/4.2 panels depend on Tailwind classes that were never installed

- **Status:** fixed (ADR-011)
- **Evidence:** `CreativeTwinEditor.tsx` (120 usages), `DecisionMatrix.tsx` (62), `TimelineDoctor.tsx` (58) use 268 distinct Tailwind utility classes (`flex`, `bg-zinc-900`, `rounded-lg`, `space-y-4`, `grid-cols-2`, and so on). `package.json` has no Tailwind dependency; `styles.css` defines none of them; README advertised "zero Tailwind overhead".
- **Impact:** the Structured Twin inspector, Decision Matrix, and Timeline Doctor rendered with no layout, spacing, or color. Their edit dialogs had no overlay positioning.
- **Remediation:** install `tailwindcss` and `@tailwindcss/vite` (dev dependencies), import only the `theme` and `utilities` layers so the hand-written shell CSS is untouched. Verified: utility classes now appear in the built CSS; landing page unchanged.
- **Verification:** `grep -oE '\.(bg-zinc-900|rounded-lg|space-y-4)' dist/assets/*.css` non-empty after build. Visual check of the panels requires a signed-in session and is noted as a follow-up.

### P1-13. Documentation contradicts the repository

- **Status:** fixed
- **Evidence:** README badge says 74 tests (actual 83); README directory tree omits `modelGateway.ts`, `modelGateway.test.ts`, `supabase/functions/`, `docs/future-stack-roadmap.md`; README roadmap leaves 5.0 unmarked; `todo.md` leaves Ticket 4.2 unchecked; `docs/build-state.md` "Next" section still names 4.2; README claims "RLS across all PostgreSQL tables" while P0-1 stands.
- **Remediation:** sync all three; README RLS claim rewritten to state exactly which tables have committed policies and which await live verification.

---

## P2 findings

| ID | Finding | Evidence | Note |
|---|---|---|---|
| P2-1 | Root-level agent-scaffolding documents (16 files, 2 979 lines) mix with product docs. Two byte-identical pairs. Tracked `.zip` duplicates a tracked folder. | `ls` at root, `md5` | Moved to `docs/archive/`; zip removed (folder retains identical content). |
| P2-2 | `storage_workspace_id` redefined in 006 drops the `>= 3 path segments` guard from 004 | 004:L1-40 vs 006:L282-300 | Regex guard still prevents unsafe cast. Document the behavior change; restore segment check in a future migration if a policy depends on it. |
| P2-3 | `block_manual_connected_status` changed from `auth.role() = 'authenticated'` (003) to `current_setting('role') != 'service_role'` (006) | 003 vs 006 | Second form is stricter (blocks anon too). Fine. Record. |
| P2-4 | `is_workspace_member` / `is_workspace_admin_or_owner` use `SET search_path = public` without `pg_temp` | 001 | Low risk for SQL-language functions. Align with 006 style in a future migration. |
| P2-5 | `handle_new_user` slug derived from display name; collision on same-name users within the same 8-char UUID prefix is improbable but unhandled | 001 | Record. |
| P2-6 | 11 `any` usages in non-test source | grep | Fixed: all typed (`User`/`Session` from supabase-js, typed gateway error body, typed feature map, typed Brand Brain payloads). Lint warnings 0. |
| P2-7 | `App.tsx` is 946 lines with landing page, auth modal, and workspace shell in one file | wc | Fixed: split into `LandingPage.tsx`, `Workspace.tsx`, `AuthModal.tsx`; `App.tsx` now 121 lines. Mechanical move, no behavior change. |
| P2-8 | Vitest has no config; default include picks up `supabase/functions/**/*.test.ts` only if added explicitly | none | Added in gateway slice. |
| P2-9 | `matrixLoading` Decision Matrix fetch does N+1 `fetchStructuredTwin` calls | `App.tsx:395-410` | Acceptable at current scale; batch when twin count grows. |

---

## Ticket 5.0 compliance review (second assignment)

Checked against `VANTA_FINAL_PROJECT_SPECIFICATION.md` section 8.

| Requirement | Status | Evidence |
|---|---|---|
| Exact request fields `workspace_id` + allowlisted `task_type` only | Compliant | `index.ts` rejects any other key with `invalid_request` |
| Only `gateway_health_check` exists | Compliant | `schemas.ts` `ALLOWLISTED_TASKS` |
| Browser cannot submit prompt/schema/model/evidence | Compliant | field whitelist; client adapter sends two fields |
| Caller JWT validated; owner/admin membership | Compliant | `supabase.auth.getUser()` then `workspace_members.role in (owner, admin)` through the caller's RLS context |
| CORS origin-allowlisted | Compliant | env `ALLOWED_ORIGINS` plus localhost defaults; non-matching origin receives the first default, never `*` |
| Missing secret produces typed fail-closed output | Compliant | `gateway_not_configured` 503 |
| Model is server config | Compliant | `GROQ_MODEL` env, default `llama-3.3-70b-versatile` |
| Cryptographically random nonce | Compliant | `crypto.randomUUID()` |
| Output parsed and validated, unknown keys rejected | Compliant | `validateHealthCheckOutput` |
| Audit metadata excludes prompt, user text, headers, keys, full output | Compliant in intent; **non-functional** | see P1-2 |
| Rate limit labeled best-effort | Labeled; **non-functional and fails open** | see P1-2, P1-3 |
| Not deployed | Compliant | no deploy config, no secrets |

Verdict: contract-compliant after P1-2/3/4 fixes. Deployment readiness checklist: `docs/model-gateway-deployment-readiness.md`.

---

## Remediation executed in this phase

| Finding | Status | Proof |
|---|---|---|
| P0-1 | patched-pending-live-apply | `20260822000007_brand_brain_rls.sql`; `migrations.test.ts` asserts RLS on all 21 tables |
| P1-1 | fixed | `rls.test.ts` deleted; 81 static assertions added |
| P1-2, P1-3, P1-4 | fixed | `guards.ts` + 23 tests; `index.ts` rewired |
| P1-5 | fixed | `auth.test.ts` mocked, 8 assertions run regardless of `.env` |
| P1-9 | fixed | `workspaceOverview.ts` + 4 tests; retry buttons |
| P1-10 | fixed | `Modal.tsx`; browser check: `dialog` role, labelled close, Escape closes |
| P1-11 | fixed | 701 kB single chunk to 232 kB main + lazy panels + vendor chunks |
| P1-12 | fixed | `eslint.config.js`, `npm run verify`, `.github/workflows/ci.yml`; 51 lint errors cleared (4 were React 19 hook-rule violations, see ADR-012) |
| P1-13, P2-1 | fixed | README, build-state, todo synced; archive created; zip and duplicates removed |
| P1-14 | fixed | Tailwind utilities layer (ADR-011) |
| P1-6, P1-7 | patched-pending-live-apply | migrations 008, 009 authored; 21 static assertions added (actor binding on 15 tables, 3 composite FKs) |
| P1-8 | deferred | needs an RPC; `docs/supabase-deferred-validation.md` D-5 |

Final local verification: lint 0 errors / 0 warnings (P2-6 closed), typecheck clean, 209/209 tests, build clean.
