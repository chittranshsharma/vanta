-- ============================================================
-- Vanta: observed posting history (publishing intelligence input)
-- Migration: 20260822000017_post_observations.sql
-- Status: PENDING LIVE APPLY (authored 2026-08-23)
-- Depends on: 007 through 016 applied.
--
-- One row per post the workspace owns: when it was published and one
-- metric value for it, always traceable to a registered source. This is
-- the only input the test-window planner may read. Rows are append-only
-- and always 'observed'; there is no derived, predicted, or benchmark row
-- in this table, and no table anywhere stores a "best time to post".
-- ============================================================

CREATE TABLE IF NOT EXISTS public.post_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_id UUID NOT NULL,
  FOREIGN KEY (source_id, workspace_id)
    REFERENCES public.source_registry(id, workspace_id)
    ON DELETE RESTRICT,
  twin_id UUID,
  FOREIGN KEY (twin_id, workspace_id)
    REFERENCES public.creative_twins(id, workspace_id)
    ON DELETE SET NULL (twin_id),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  external_post_id TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  metric_key TEXT NOT NULL,
  value NUMERIC NOT NULL,
  evidence_class TEXT NOT NULL DEFAULT 'observed' CHECK (evidence_class = 'observed'),
  source_citability TEXT NOT NULL
    CHECK (source_citability IN ('verified', 'citable_stale', 'citable_unverified')),
  date_ambiguous BOOLEAN NOT NULL DEFAULT false,
  import_batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id)
);

-- Re-importing the same export must not inflate the observation count.
CREATE UNIQUE INDEX IF NOT EXISTS uq_post_observations_external
  ON public.post_observations(workspace_id, metric_key, external_post_id)
  WHERE external_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_post_observations_workspace
  ON public.post_observations(workspace_id, metric_key, published_at DESC);

ALTER TABLE public.post_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_observations_select" ON public.post_observations;
DROP POLICY IF EXISTS "post_observations_insert" ON public.post_observations;
DROP POLICY IF EXISTS "post_observations_no_update" ON public.post_observations;
DROP POLICY IF EXISTS "post_observations_delete" ON public.post_observations;

CREATE POLICY "post_observations_select" ON public.post_observations FOR SELECT
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "post_observations_insert" ON public.post_observations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY "post_observations_no_update" ON public.post_observations FOR UPDATE
  USING (false);
-- Deleting an import batch is an admin correction path, not a member action.
CREATE POLICY "post_observations_delete" ON public.post_observations FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

CREATE OR REPLACE FUNCTION public.block_post_observation_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'post_observations rows are immutable; delete the import batch and re-import instead.';
END;
$$;

REVOKE ALL ON FUNCTION public.block_post_observation_update() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_block_post_observation_update ON public.post_observations;
CREATE TRIGGER trg_block_post_observation_update
BEFORE UPDATE ON public.post_observations
FOR EACH ROW
EXECUTE FUNCTION public.block_post_observation_update();

-- Coverage helper: how much usable history exists, by metric. Returns counts
-- only. It deliberately returns no ranking, no score, and no time-of-day advice.
CREATE OR REPLACE FUNCTION public.posting_history_coverage(p_workspace_id UUID)
RETURNS TABLE (metric_key TEXT, observations BIGINT, first_observed TIMESTAMPTZ, last_observed TIMESTAMPTZ, unverified_rows BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT po.metric_key,
         count(*) AS observations,
         min(po.published_at) AS first_observed,
         max(po.published_at) AS last_observed,
         count(*) FILTER (WHERE po.source_citability = 'citable_unverified') AS unverified_rows
  FROM public.post_observations po
  WHERE po.workspace_id = p_workspace_id
  GROUP BY po.metric_key;
$$;

REVOKE ALL ON FUNCTION public.posting_history_coverage(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.posting_history_coverage(UUID) TO authenticated;
