-- ============================================================
-- Vanta Creative Intake & Deterministic Creative Twin Schema
-- Version: 20260822000004_creative_intake.sql
-- ============================================================

-- ============================================================
-- 1. DEFENSIVE STORAGE WORKSPACE HELPER
-- ============================================================
-- Safely extracts workspace UUID from path prefix without throwing on invalid casts
CREATE OR REPLACE FUNCTION public.storage_workspace_id(object_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
AS $$
DECLARE
  first_segment TEXT;
  segment_count INT;
BEGIN
  IF object_name IS NULL THEN
    RETURN NULL;
  END IF;

  -- Ensure path has at least 3 segments: {workspace_id}/{asset_id}/{filename}
  SELECT array_length(string_to_array(object_name, '/'), 1) INTO segment_count;
  IF segment_count IS NULL OR segment_count < 3 THEN
    RETURN NULL;
  END IF;

  first_segment := (string_to_array(object_name, '/'))[1];

  -- Check if first_segment matches strict UUID regex
  IF first_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN first_segment::uuid;
  ELSE
    RETURN NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- ============================================================
-- 2. CREATIVE ASSETS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.creative_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_id UUID NOT NULL,
  FOREIGN KEY (source_id, workspace_id)
    REFERENCES public.source_registry(id, workspace_id)
    ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  asset_kind TEXT NOT NULL CHECK (
    asset_kind IN (
      'script',
      'hook',
      'caption',
      'cta',
      'landing_page_copy',
      'thumbnail',
      'short_video_metadata',
      'campaign_csv',
      'other'
    )
  ),
  title TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT,
  byte_size BIGINT CHECK (byte_size IS NULL OR byte_size >= 0),
  storage_bucket TEXT,
  storage_path TEXT,
  CHECK (
    (storage_bucket IS NULL AND storage_path IS NULL) OR
    (storage_bucket IS NOT NULL AND storage_path IS NOT NULL)
  ),
  content_sha256 TEXT,
  manual_text TEXT,
  declared_platform TEXT,
  declared_objective TEXT,
  ingestion_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    ingestion_status IN ('pending', 'accepted', 'blocked', 'failed')
  ),
  blocked_reason TEXT,
  CHECK (
    ingestion_status NOT IN ('blocked', 'failed') OR blocked_reason IS NOT NULL
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id)
);

-- Partial unique index for non-null sha256 within the same workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_creative_assets_workspace_sha256
  ON public.creative_assets(workspace_id, content_sha256)
  WHERE content_sha256 IS NOT NULL;

-- ============================================================
-- 3. INGESTION RUNS (Durable Intake Audit Record)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.creative_assets(id) ON DELETE CASCADE,
  started_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ingestion_method TEXT NOT NULL CHECK (
    ingestion_method IN ('manual_text', 'file_upload', 'csv_header_inspection')
  ),
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'accepted', 'blocked', 'failed')
  ),
  validation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- 4. CREATIVE TWINS (Grounded Asset Manifest)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.creative_twins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL UNIQUE REFERENCES public.creative_assets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  asset_kind TEXT NOT NULL,
  declared_platform TEXT,
  declared_objective TEXT,
  source_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  deterministic_features JSONB NOT NULL DEFAULT '{}'::jsonb,
  known_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  state TEXT NOT NULL DEFAULT 'grounded_stub' CHECK (
    state IN ('grounded_stub', 'needs_input', 'blocked')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_creative_assets_workspace_id ON public.creative_assets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_creative_assets_source_id ON public.creative_assets(source_id);
CREATE INDEX IF NOT EXISTS idx_creative_assets_status ON public.creative_assets(workspace_id, ingestion_status);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_asset_id ON public.ingestion_runs(asset_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_workspace_id ON public.ingestion_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_creative_twins_workspace_id ON public.creative_twins(workspace_id);
CREATE INDEX IF NOT EXISTS idx_creative_twins_asset_id ON public.creative_twins(asset_id);

-- ============================================================
-- 6. ROW LEVEL SECURITY — TABLES
-- ============================================================
ALTER TABLE public.creative_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_twins ENABLE ROW LEVEL SECURITY;

-- CREATIVE ASSETS
CREATE POLICY "creative_assets_select" ON public.creative_assets FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "creative_assets_insert" ON public.creative_assets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE POLICY "creative_assets_update" ON public.creative_assets FOR UPDATE
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "creative_assets_delete" ON public.creative_assets FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- INGESTION RUNS
CREATE POLICY "ingestion_runs_select" ON public.ingestion_runs FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "ingestion_runs_insert" ON public.ingestion_runs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE POLICY "ingestion_runs_update" ON public.ingestion_runs FOR UPDATE
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "ingestion_runs_delete" ON public.ingestion_runs FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- CREATIVE TWINS
CREATE POLICY "creative_twins_select" ON public.creative_twins FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "creative_twins_insert" ON public.creative_twins FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE POLICY "creative_twins_update" ON public.creative_twins FOR UPDATE
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "creative_twins_delete" ON public.creative_twins FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- ============================================================
-- 7. SUPABASE STORAGE BUCKET & POLICIES
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-assets', 'workspace-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Objects policies for workspace-assets bucket
DO $$
BEGIN
  -- Drop existing policies if any
  DROP POLICY IF EXISTS "workspace_assets_select" ON storage.objects;
  DROP POLICY IF EXISTS "workspace_assets_insert" ON storage.objects;
  DROP POLICY IF EXISTS "workspace_assets_update" ON storage.objects;
  DROP POLICY IF EXISTS "workspace_assets_delete" ON storage.objects;

  -- Create defensive workspace-scoped storage policies
  CREATE POLICY "workspace_assets_select" ON storage.objects FOR SELECT
    USING (
      bucket_id = 'workspace-assets' AND
      public.is_workspace_member(public.storage_workspace_id(name))
    );

  CREATE POLICY "workspace_assets_insert" ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'workspace-assets' AND
      auth.uid() IS NOT NULL AND
      public.is_workspace_member(public.storage_workspace_id(name))
    );

  CREATE POLICY "workspace_assets_update" ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'workspace-assets' AND
      public.is_workspace_member(public.storage_workspace_id(name))
    )
    WITH CHECK (
      bucket_id = 'workspace-assets' AND
      public.is_workspace_member(public.storage_workspace_id(name))
    );

  CREATE POLICY "workspace_assets_delete" ON storage.objects FOR DELETE
    USING (
      bucket_id = 'workspace-assets' AND
      public.is_workspace_admin_or_owner(public.storage_workspace_id(name))
    );
END;
$$;
