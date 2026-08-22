-- ============================================================
-- Vanta: composite tenant foreign keys for remaining single-column FKs
-- Migration: 20260822000009_composite_tenant_fks.sql
-- Status: PENDING LIVE APPLY (authored 2026-08-23, audit finding P1-7)
-- Depends on: nothing beyond 001-005. Safe to apply after 007 and 008.
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
-- Pre-check (must return zero rows, see deferred validation D-3):
--   select t.id from public.creative_twins t join public.creative_assets a on a.id = t.asset_id where a.workspace_id <> t.workspace_id;
--   select r.id from public.ingestion_runs r join public.creative_assets a on a.id = r.asset_id where a.workspace_id <> r.workspace_id;
--   select m.id from public.metric_definitions m join public.source_registry s on s.id = m.source_id where s.workspace_id <> m.workspace_id;
--
-- Parent composite uniques already exist:
--   creative_assets  UNIQUE (id, workspace_id)   (migration 004)
--   source_registry  UNIQUE (id, workspace_id)   (migration 003)
-- ============================================================

-- 1. creative_twins.asset_id
ALTER TABLE public.creative_twins
  DROP CONSTRAINT IF EXISTS creative_twins_asset_id_fkey;
ALTER TABLE public.creative_twins
  ADD CONSTRAINT creative_twins_asset_id_workspace_id_fkey
  FOREIGN KEY (asset_id, workspace_id)
  REFERENCES public.creative_assets(id, workspace_id)
  ON DELETE CASCADE;

-- 2. ingestion_runs.asset_id
ALTER TABLE public.ingestion_runs
  DROP CONSTRAINT IF EXISTS ingestion_runs_asset_id_fkey;
ALTER TABLE public.ingestion_runs
  ADD CONSTRAINT ingestion_runs_asset_id_workspace_id_fkey
  FOREIGN KEY (asset_id, workspace_id)
  REFERENCES public.creative_assets(id, workspace_id)
  ON DELETE CASCADE;

-- 3. metric_definitions.source_id (nullable)
-- ON DELETE SET NULL with a column list (PostgreSQL 15+) nulls only source_id,
-- leaving workspace_id intact. MATCH SIMPLE (default) permits a NULL source_id.
ALTER TABLE public.metric_definitions
  DROP CONSTRAINT IF EXISTS metric_definitions_source_id_fkey;
ALTER TABLE public.metric_definitions
  ADD CONSTRAINT metric_definitions_source_id_workspace_id_fkey
  FOREIGN KEY (source_id, workspace_id)
  REFERENCES public.source_registry(id, workspace_id)
  ON DELETE SET NULL (source_id);

-- 4. Supporting indexes for the new composite lookups
CREATE INDEX IF NOT EXISTS idx_creative_twins_asset_workspace
  ON public.creative_twins(asset_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_asset_workspace
  ON public.ingestion_runs(asset_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_metric_definitions_source_workspace
  ON public.metric_definitions(source_id, workspace_id);
