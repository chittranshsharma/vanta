-- ============================================================
-- Vanta: composite tenant foreign keys for remaining single-column FKs
-- Migration: 20260822000009_composite_tenant_fks.sql
-- Status: PENDING LIVE APPLY (authored 2026-08-23, audit finding P1-7, hardened Phase 2)
-- Depends on: 007 and 008 applied. Safe forward-only migration.
--
-- Why:
--   Three child tables referenced a workspace-owned parent by id only:
--     creative_twins.asset_id      -> creative_assets(id)
--     ingestion_runs.asset_id      -> creative_assets(id)
--     metric_definitions.source_id -> source_registry(id)
--   A member of workspace A could therefore create a row in A that points
--   at a parent row in workspace B if they knew its UUID. The correction
--   RPCs already re-check parent workspace, but the row itself was allowed.
--   Specification section 6.2 requires (parent_id, workspace_id) FKs.
--
-- Staged Safety Strategy:
--   1. Transaction Isolation: The migration runner (supabase db push / supabase migration up)
--      automatically wraps this entire migration in a single transaction. If applied via direct
--      SQL editor/MCP query batch, the operator/tool wraps the statements in BEGIN...COMMIT.
--   2. Add new composite FKs FIRST as NOT VALID (fast, non-blocking check).
--   3. VALIDATE CONSTRAINT on the new composite FKs (scans table safely under SHARE UPDATE EXCLUSIVE lock).
--   4. Only after the new composite FKs are fully valid, drop the old single-column FKs.
--   A failure at any validation step aborts the transaction,
--   leaving the original foreign keys 100% intact.
--
-- Pre-check (must return zero rows, see deferred validation D-3):
--   select t.id from public.creative_twins t join public.creative_assets a on a.id = t.asset_id where a.workspace_id <> t.workspace_id;
--   select r.id from public.ingestion_runs r join public.creative_assets a on a.id = r.asset_id where a.workspace_id <> r.workspace_id;
--   select m.id from public.metric_definitions m join public.source_registry s on s.id = m.source_id where s.workspace_id <> m.workspace_id;
--
-- Parent composite uniques already exist:
--   creative_assets  UNIQUE (id, workspace_id)   (migration 004)
--   source_registry  UNIQUE (id, workspace_id)   (migration 003)
-- ============================================================

-- 1. ADD NEW COMPOSITE CONSTRAINTS (NOT VALID first)
ALTER TABLE public.creative_twins
  ADD CONSTRAINT creative_twins_asset_id_workspace_id_fkey
  FOREIGN KEY (asset_id, workspace_id)
  REFERENCES public.creative_assets(id, workspace_id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.ingestion_runs
  ADD CONSTRAINT ingestion_runs_asset_id_workspace_id_fkey
  FOREIGN KEY (asset_id, workspace_id)
  REFERENCES public.creative_assets(id, workspace_id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.metric_definitions
  ADD CONSTRAINT metric_definitions_source_id_workspace_id_fkey
  FOREIGN KEY (source_id, workspace_id)
  REFERENCES public.source_registry(id, workspace_id)
  ON DELETE SET NULL (source_id)
  NOT VALID;

-- 2. VALIDATE NEW CONSTRAINTS (verifies all rows satisfy composite constraints)
ALTER TABLE public.creative_twins
  VALIDATE CONSTRAINT creative_twins_asset_id_workspace_id_fkey;

ALTER TABLE public.ingestion_runs
  VALIDATE CONSTRAINT ingestion_runs_asset_id_workspace_id_fkey;

ALTER TABLE public.metric_definitions
  VALIDATE CONSTRAINT metric_definitions_source_id_workspace_id_fkey;

-- 3. DROP OLD SUPERSEDED SINGLE-COLUMN CONSTRAINTS (only after new ones validated)
ALTER TABLE public.creative_twins
  DROP CONSTRAINT IF EXISTS creative_twins_asset_id_fkey;

ALTER TABLE public.ingestion_runs
  DROP CONSTRAINT IF EXISTS ingestion_runs_asset_id_fkey;

ALTER TABLE public.metric_definitions
  DROP CONSTRAINT IF EXISTS metric_definitions_source_id_fkey;

-- 4. Supporting indexes for the new composite lookups
CREATE INDEX IF NOT EXISTS idx_creative_twins_asset_workspace
  ON public.creative_twins(asset_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_asset_workspace
  ON public.ingestion_runs(asset_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_metric_definitions_source_workspace
  ON public.metric_definitions(source_id, workspace_id);


