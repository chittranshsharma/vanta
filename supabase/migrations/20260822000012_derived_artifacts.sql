-- ============================================================
-- Vanta: derived artifacts with lineage (Upgrade D)
-- Migration: 20260822000012_derived_artifacts.sql
-- Status: PENDING LIVE APPLY (authored 2026-08-23)
-- Depends on: 011 applied (jobs).
--
-- Lineage chain: creative_assets (original bytes, private Storage)
--   -> derived_artifacts (thumbnail, frame sample, transcript, media metadata,
--      normalized rows) produced by a named producer at a named version
--   -> features/results referenced by decision packets.
-- Every artifact points at its source asset and optionally its parent
-- artifact and the job that produced it. Retention is explicit.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.derived_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL,
  FOREIGN KEY (asset_id, workspace_id)
    REFERENCES public.creative_assets(id, workspace_id)
    ON DELETE CASCADE,
  parent_artifact_id UUID,
  FOREIGN KEY (parent_artifact_id, workspace_id)
    REFERENCES public.derived_artifacts(id, workspace_id)
    ON DELETE SET NULL (parent_artifact_id),
  job_id UUID,
  FOREIGN KEY (job_id, workspace_id)
    REFERENCES public.jobs(id, workspace_id)
    ON DELETE SET NULL (job_id),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  artifact_kind TEXT NOT NULL CHECK (artifact_kind IN (
    'media_metadata', 'thumbnail', 'frame_sample', 'transcript', 'normalized_rows', 'text_features'
  )),
  producer TEXT NOT NULL CHECK (producer IN ('deterministic', 'media_worker', 'analysis_service', 'model_gateway')),
  producer_version TEXT NOT NULL,
  -- Bytes, when the artifact is a file (thumbnail, frame). Same bucket, path prefix {workspace_id}/...
  storage_bucket TEXT,
  storage_path TEXT,
  CHECK ((storage_bucket IS NULL) = (storage_path IS NULL)),
  content_sha256 TEXT,
  byte_size BIGINT CHECK (byte_size IS NULL OR byte_size >= 0),
  mime_type TEXT,
  -- Structured output, when the artifact is data (metadata, transcript, rows)
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_class TEXT NOT NULL DEFAULT 'observed'
    CHECK (evidence_class IN ('observed', 'sourced_claim', 'inference', 'simulation', 'unknown')),
  coverage TEXT NOT NULL DEFAULT 'unknown' CHECK (coverage IN ('complete', 'partial', 'unknown')),
  retention_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_derived_artifacts_workspace_id ON public.derived_artifacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_derived_artifacts_asset ON public.derived_artifacts(asset_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_derived_artifacts_retention ON public.derived_artifacts(retention_until) WHERE retention_until IS NOT NULL;

ALTER TABLE public.derived_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "derived_artifacts_select" ON public.derived_artifacts;
DROP POLICY IF EXISTS "derived_artifacts_insert" ON public.derived_artifacts;
DROP POLICY IF EXISTS "derived_artifacts_no_update" ON public.derived_artifacts;
DROP POLICY IF EXISTS "derived_artifacts_delete" ON public.derived_artifacts;

CREATE POLICY "derived_artifacts_select" ON public.derived_artifacts FOR SELECT
  USING (public.is_workspace_member(workspace_id));
-- Members may record deterministic artifacts they produced client-side. Worker-produced
-- artifacts are inserted by service_role (bypasses RLS) with created_by = job creator.
CREATE POLICY "derived_artifacts_insert" ON public.derived_artifacts FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_workspace_member(workspace_id)
    AND created_by = auth.uid()
    AND producer = 'deterministic'
  );
CREATE POLICY "derived_artifacts_no_update" ON public.derived_artifacts FOR UPDATE
  USING (false);
-- Admins may delete derived artifacts (retention / right-to-delete). Originals follow creative_assets policy.
CREATE POLICY "derived_artifacts_delete" ON public.derived_artifacts FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- Retention sweeper: service_role only. Returns the storage paths to remove so the
-- worker can delete bytes after rows are gone (rows first, then bytes: no orphan rows).
CREATE OR REPLACE FUNCTION public.purge_expired_artifacts(p_limit INT)
RETURNS TABLE (workspace_id UUID, storage_bucket TEXT, storage_path TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH doomed AS (
    SELECT d.id FROM public.derived_artifacts d
    WHERE d.retention_until IS NOT NULL AND d.retention_until < NOW()
    ORDER BY d.retention_until
    LIMIT GREATEST(LEAST(p_limit, 500), 1)
    FOR UPDATE SKIP LOCKED
  ),
  deleted AS (
    DELETE FROM public.derived_artifacts d USING doomed WHERE d.id = doomed.id
    RETURNING d.workspace_id, d.storage_bucket, d.storage_path
  )
  SELECT deleted.workspace_id, deleted.storage_bucket, deleted.storage_path FROM deleted WHERE deleted.storage_path IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_artifacts(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_artifacts(INT) TO service_role;
