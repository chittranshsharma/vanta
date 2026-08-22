-- ============================================================
-- Vanta Creative Twin Expansion & Deterministic Structure
-- Version: 20260822000005_creative_twin_expansion.sql
-- ============================================================

-- 1. Ensure composite unique constraints on parent tables for workspace isolation
ALTER TABLE public.creative_twins
  ADD CONSTRAINT creative_twins_id_workspace_id_key UNIQUE (id, workspace_id);

ALTER TABLE public.brand_claims
  ADD CONSTRAINT brand_claims_id_workspace_id_key UNIQUE (id, workspace_id);

-- 2. CREATIVE SCENES (Sequential Decomposition)
CREATE TABLE IF NOT EXISTS public.creative_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  FOREIGN KEY (twin_id, workspace_id)
    REFERENCES public.creative_twins(id, workspace_id)
    ON DELETE CASCADE,
  scene_index INT NOT NULL CHECK (scene_index >= 0),
  start_seconds NUMERIC(6, 2) CHECK (start_seconds IS NULL OR start_seconds >= 0),
  end_seconds NUMERIC(6, 2) CHECK (end_seconds IS NULL OR end_seconds >= 0),
  CHECK (start_seconds IS NULL OR end_seconds IS NULL OR end_seconds > start_seconds),
  shot_purpose TEXT NOT NULL CHECK (
    shot_purpose IN (
      'hook',
      'problem_setup',
      'product_demonstration',
      'proof_testimonial',
      'feature_breakdown',
      'objection_handling',
      'cta',
      'transition',
      'other'
    )
  ),
  spoken_transcript TEXT,
  on_screen_text TEXT,
  provided_visual_notes TEXT,
  reading_burden_wpm INT CHECK (reading_burden_wpm IS NULL OR reading_burden_wpm >= 0),
  is_user_corrected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (twin_id, scene_index),
  UNIQUE (id, workspace_id)
);

-- 3. CREATIVE CLAIMS (Extracted Assertions & Brand Codex Linkage)
CREATE TABLE IF NOT EXISTS public.creative_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  FOREIGN KEY (twin_id, workspace_id)
    REFERENCES public.creative_twins(id, workspace_id)
    ON DELETE CASCADE,
  brand_claim_id UUID,
  FOREIGN KEY (brand_claim_id, workspace_id)
    REFERENCES public.brand_claims(id, workspace_id)
    ON DELETE SET NULL,
  claim_text TEXT NOT NULL,
  claim_classification TEXT NOT NULL CHECK (
    claim_classification IN (
      'explicit_brand_promise',
      'comparative_advantage',
      'product_capability',
      'testimonial_endorsement',
      'numeric_outcome',
      'pricing_offer',
      'unverified_statement'
    )
  ),
  brand_alignment_status TEXT NOT NULL DEFAULT 'unassessed' CHECK (
    brand_alignment_status IN (
      'exact_brand_claim_match',
      'possible_term_overlap',
      'no_brand_claim_match',
      'unassessed'
    )
  ),
  extraction_method TEXT NOT NULL DEFAULT 'deterministic_regex' CHECK (
    extraction_method IN ('deterministic_regex', 'user_added')
  ),
  source_char_offset_start INT CHECK (source_char_offset_start IS NULL OR source_char_offset_start >= 0),
  source_char_offset_end INT CHECK (source_char_offset_end IS NULL OR source_char_offset_end >= 0),
  source_excerpt TEXT,
  scene_indices INT[] DEFAULT '{}',
  proof_reference TEXT,
  is_user_corrected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id)
);

-- 4. CREATIVE TWIN VERSIONS (Immutable Full Snapshot History)
CREATE TABLE IF NOT EXISTS public.creative_twin_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  FOREIGN KEY (twin_id, workspace_id)
    REFERENCES public.creative_twins(id, workspace_id)
    ON DELETE CASCADE,
  version_number INT NOT NULL CHECK (version_number > 0),
  snapshot JSONB NOT NULL,
  change_summary TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (twin_id, version_number)
);

-- 5. IMMUTABILITY TRIGGER ON CREATIVE TWIN VERSIONS
CREATE OR REPLACE FUNCTION public.block_twin_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'creative_twin_versions is an immutable snapshot table. UPDATE and DELETE operations are prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_block_twin_version_mutation ON public.creative_twin_versions;
CREATE TRIGGER trg_block_twin_version_mutation
BEFORE UPDATE OR DELETE ON public.creative_twin_versions
FOR EACH ROW
EXECUTE FUNCTION public.block_twin_version_mutation();

-- 6. INDEXES
CREATE INDEX IF NOT EXISTS idx_creative_scenes_twin_id ON public.creative_scenes(twin_id);
CREATE INDEX IF NOT EXISTS idx_creative_scenes_workspace_id ON public.creative_scenes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_creative_claims_twin_id ON public.creative_claims(twin_id);
CREATE INDEX IF NOT EXISTS idx_creative_claims_workspace_id ON public.creative_claims(workspace_id);
CREATE INDEX IF NOT EXISTS idx_creative_claims_brand_claim_id ON public.creative_claims(brand_claim_id);
CREATE INDEX IF NOT EXISTS idx_creative_twin_versions_twin_id ON public.creative_twin_versions(twin_id);
CREATE INDEX IF NOT EXISTS idx_creative_twin_versions_workspace_id ON public.creative_twin_versions(workspace_id);

-- 7. ROW LEVEL SECURITY
ALTER TABLE public.creative_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_twin_versions ENABLE ROW LEVEL SECURITY;

-- CREATIVE SCENES
CREATE POLICY "creative_scenes_select" ON public.creative_scenes FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "creative_scenes_insert" ON public.creative_scenes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE POLICY "creative_scenes_update" ON public.creative_scenes FOR UPDATE
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "creative_scenes_delete" ON public.creative_scenes FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- CREATIVE CLAIMS
CREATE POLICY "creative_claims_select" ON public.creative_claims FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "creative_claims_insert" ON public.creative_claims FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE POLICY "creative_claims_update" ON public.creative_claims FOR UPDATE
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "creative_claims_delete" ON public.creative_claims FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- CREATIVE TWIN VERSIONS (Read and Append only)
CREATE POLICY "creative_twin_versions_select" ON public.creative_twin_versions FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "creative_twin_versions_insert" ON public.creative_twin_versions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id));

-- Deny UPDATE/DELETE at policy level as well
CREATE POLICY "creative_twin_versions_no_update" ON public.creative_twin_versions FOR UPDATE
  USING (false);

CREATE POLICY "creative_twin_versions_no_delete" ON public.creative_twin_versions FOR DELETE
  USING (false);

-- 8. ATOMIC STORED PROCEDURE: CORRECT SCENE & RECORD IMMUTABLE SNAPSHOT
CREATE OR REPLACE FUNCTION public.save_scene_correction_atomic(
  p_scene_id UUID,
  p_workspace_id UUID,
  p_user_id UUID,
  p_shot_purpose TEXT,
  p_spoken_transcript TEXT,
  p_on_screen_text TEXT,
  p_provided_visual_notes TEXT,
  p_start_seconds NUMERIC,
  p_end_seconds NUMERIC,
  p_reading_burden_wpm INT,
  p_change_summary TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_twin_id UUID;
  v_next_version INT;
  v_twin_row RECORD;
  v_scenes_json JSONB;
  v_claims_json JSONB;
  v_snapshot JSONB;
  v_version_id UUID;
BEGIN
  -- Verify workspace membership if in user context
  IF auth.uid() IS NOT NULL AND NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a workspace member';
  END IF;

  -- 1. Update scene
  UPDATE public.creative_scenes
  SET
    shot_purpose = p_shot_purpose,
    spoken_transcript = p_spoken_transcript,
    on_screen_text = p_on_screen_text,
    provided_visual_notes = p_provided_visual_notes,
    start_seconds = p_start_seconds,
    end_seconds = p_end_seconds,
    reading_burden_wpm = p_reading_burden_wpm,
    is_user_corrected = true,
    updated_at = NOW()
  WHERE id = p_scene_id AND workspace_id = p_workspace_id
  RETURNING twin_id INTO v_twin_id;

  IF v_twin_id IS NULL THEN
    RAISE EXCEPTION 'Scene not found in specified workspace';
  END IF;

  -- 2. Fetch full twin record
  SELECT * INTO v_twin_row FROM public.creative_twins WHERE id = v_twin_id AND workspace_id = p_workspace_id;

  -- 3. Fetch all current scenes & claims for the twin
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.scene_index), '[]'::jsonb)
    INTO v_scenes_json
    FROM public.creative_scenes s
    WHERE s.twin_id = v_twin_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at), '[]'::jsonb)
    INTO v_claims_json
    FROM public.creative_claims c
    WHERE c.twin_id = v_twin_id;

  -- 4. Build comprehensive snapshot
  v_snapshot := jsonb_build_object(
    'twin_id', v_twin_id,
    'title', v_twin_row.title,
    'asset_kind', v_twin_row.asset_kind,
    'declared_platform', v_twin_row.declared_platform,
    'declared_objective', v_twin_row.declared_objective,
    'deterministic_features', v_twin_row.deterministic_features,
    'known_gaps', v_twin_row.known_gaps,
    'state', v_twin_row.state,
    'scenes', v_scenes_json,
    'claims', v_claims_json,
    'snapshotted_at', NOW()
  );

  -- 5. Calculate next version number monotonically
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
    FROM public.creative_twin_versions
    WHERE twin_id = v_twin_id;

  -- 6. Insert immutable snapshot
  INSERT INTO public.creative_twin_versions (
    twin_id, workspace_id, version_number, snapshot, change_summary, created_by
  ) VALUES (
    v_twin_id, p_workspace_id, v_next_version, v_snapshot, p_change_summary, p_user_id
  ) RETURNING id INTO v_version_id;

  -- 7. Record audit event
  INSERT INTO public.audit_events (
    workspace_id, user_id, action, resource_type, resource_id, metadata
  ) VALUES (
    p_workspace_id, p_user_id, 'creative_twin.scene_corrected', 'creative_twin', v_twin_id::text,
    jsonb_build_object(
      'scene_id', p_scene_id,
      'version_number', v_next_version,
      'change_summary', p_change_summary
    )
  );

  RETURN jsonb_build_object(
    'version_id', v_version_id,
    'version_number', v_next_version,
    'snapshot', v_snapshot
  );
END;
$$;

-- 9. ATOMIC STORED PROCEDURE: CORRECT CLAIM & RECORD IMMUTABLE SNAPSHOT
CREATE OR REPLACE FUNCTION public.save_claim_correction_atomic(
  p_claim_id UUID,
  p_workspace_id UUID,
  p_user_id UUID,
  p_brand_claim_id UUID,
  p_claim_text TEXT,
  p_claim_classification TEXT,
  p_brand_alignment_status TEXT,
  p_proof_reference TEXT,
  p_change_summary TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_twin_id UUID;
  v_next_version INT;
  v_twin_row RECORD;
  v_scenes_json JSONB;
  v_claims_json JSONB;
  v_snapshot JSONB;
  v_version_id UUID;
BEGIN
  -- Verify workspace membership if in user context
  IF auth.uid() IS NOT NULL AND NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a workspace member';
  END IF;

  -- 1. Update claim
  UPDATE public.creative_claims
  SET
    brand_claim_id = p_brand_claim_id,
    claim_text = p_claim_text,
    claim_classification = p_claim_classification,
    brand_alignment_status = p_brand_alignment_status,
    proof_reference = p_proof_reference,
    is_user_corrected = true,
    updated_at = NOW()
  WHERE id = p_claim_id AND workspace_id = p_workspace_id
  RETURNING twin_id INTO v_twin_id;

  IF v_twin_id IS NULL THEN
    RAISE EXCEPTION 'Claim not found in specified workspace';
  END IF;

  -- 2. Fetch full twin record
  SELECT * INTO v_twin_row FROM public.creative_twins WHERE id = v_twin_id AND workspace_id = p_workspace_id;

  -- 3. Fetch all current scenes & claims for the twin
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.scene_index), '[]'::jsonb)
    INTO v_scenes_json
    FROM public.creative_scenes s
    WHERE s.twin_id = v_twin_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at), '[]'::jsonb)
    INTO v_claims_json
    FROM public.creative_claims c
    WHERE c.twin_id = v_twin_id;

  -- 4. Build comprehensive snapshot
  v_snapshot := jsonb_build_object(
    'twin_id', v_twin_id,
    'title', v_twin_row.title,
    'asset_kind', v_twin_row.asset_kind,
    'declared_platform', v_twin_row.declared_platform,
    'declared_objective', v_twin_row.declared_objective,
    'deterministic_features', v_twin_row.deterministic_features,
    'known_gaps', v_twin_row.known_gaps,
    'state', v_twin_row.state,
    'scenes', v_scenes_json,
    'claims', v_claims_json,
    'snapshotted_at', NOW()
  );

  -- 5. Calculate next version number monotonically
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
    FROM public.creative_twin_versions
    WHERE twin_id = v_twin_id;

  -- 6. Insert immutable snapshot
  INSERT INTO public.creative_twin_versions (
    twin_id, workspace_id, version_number, snapshot, change_summary, created_by
  ) VALUES (
    v_twin_id, p_workspace_id, v_next_version, v_snapshot, p_change_summary, p_user_id
  ) RETURNING id INTO v_version_id;

  -- 7. Record audit event
  INSERT INTO public.audit_events (
    workspace_id, user_id, action, resource_type, resource_id, metadata
  ) VALUES (
    p_workspace_id, p_user_id, 'creative_twin.claim_corrected', 'creative_twin', v_twin_id::text,
    jsonb_build_object(
      'claim_id', p_claim_id,
      'version_number', v_next_version,
      'change_summary', p_change_summary
    )
  );

  RETURN jsonb_build_object(
    'version_id', v_version_id,
    'version_number', v_next_version,
    'snapshot', v_snapshot
  );
END;
$$;
