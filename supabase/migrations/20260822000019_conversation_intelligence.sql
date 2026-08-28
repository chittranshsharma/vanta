-- ============================================================
-- Vanta: Conversation Intelligence Foundation
-- Migration: 20260822000019_conversation_intelligence.sql
-- Depends on: 001 through 018 applied.
-- ============================================================

-- ------------------------------------------------------------
-- 1. CONVERSATION OBSERVATIONS (Immutable Audience Signals)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_id UUID NOT NULL,
  FOREIGN KEY (source_id, workspace_id)
    REFERENCES public.source_registry(id, workspace_id)
    ON DELETE RESTRICT,
  import_batch_id UUID,
  FOREIGN KEY (import_batch_id, workspace_id)
    REFERENCES public.import_batches(id, workspace_id)
    ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'manual_csv',
  provider_account_ref TEXT,
  external_event_id TEXT,
  external_post_id TEXT,
  idempotency_key TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  author_ref TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  text_sha256 TEXT NOT NULL,
  character_count INT NOT NULL CHECK (character_count >= 0),
  evidence_class TEXT NOT NULL DEFAULT 'observed' CHECK (evidence_class = 'observed'),
  review_state TEXT NOT NULL DEFAULT 'unreviewed' CHECK (
    review_state IN ('unreviewed', 'needs_human', 'accepted', 'rejected', 'corrected')
  ),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  retention_until TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id),
  UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_conversation_observations_workspace
  ON public.conversation_observations(workspace_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_observations_source
  ON public.conversation_observations(workspace_id, source_id);

CREATE INDEX IF NOT EXISTS idx_conversation_observations_review
  ON public.conversation_observations(workspace_id, review_state);

ALTER TABLE public.conversation_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation_observations_select" ON public.conversation_observations;
DROP POLICY IF EXISTS "conversation_observations_insert" ON public.conversation_observations;
DROP POLICY IF EXISTS "conversation_observations_update" ON public.conversation_observations;
DROP POLICY IF EXISTS "conversation_observations_delete" ON public.conversation_observations;

CREATE POLICY "conversation_observations_select" ON public.conversation_observations FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "conversation_observations_insert" ON public.conversation_observations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

CREATE POLICY "conversation_observations_update" ON public.conversation_observations FOR UPDATE
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "conversation_observations_delete" ON public.conversation_observations FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- Trigger: protect core observation text and timestamp immutability
CREATE OR REPLACE FUNCTION public.block_conversation_observation_core_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.raw_text != NEW.raw_text OR
     OLD.text_sha256 != NEW.text_sha256 OR
     OLD.author_ref != NEW.author_ref OR
     OLD.observed_at != NEW.observed_at OR
     OLD.source_id != NEW.source_id OR
     OLD.idempotency_key != NEW.idempotency_key OR
     OLD.evidence_class != NEW.evidence_class THEN
    RAISE EXCEPTION 'Core conversation observation content is immutable. Record corrections via review events or re-import.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.block_conversation_observation_core_mutation() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_block_conversation_observation_core_mutation ON public.conversation_observations;
CREATE TRIGGER trg_block_conversation_observation_core_mutation
BEFORE UPDATE ON public.conversation_observations
FOR EACH ROW
EXECUTE FUNCTION public.block_conversation_observation_core_mutation();

-- ------------------------------------------------------------
-- 2. CONVERSATION INTERPRETATIONS (Inference Layer)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_interpretations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  observation_id UUID NOT NULL,
  FOREIGN KEY (observation_id, workspace_id)
    REFERENCES public.conversation_observations(id, workspace_id)
    ON DELETE CASCADE,
  interpretation_type TEXT NOT NULL CHECK (
    interpretation_type IN (
      'topic_cluster',
      'question_detected',
      'friction_point',
      'objection_claim_link',
      'sentiment_signal',
      'cta_intent_signal',
      'other'
    )
  ),
  value JSONB NOT NULL,
  evidence_class TEXT NOT NULL DEFAULT 'inference' CHECK (evidence_class = 'inference'),
  model_ref TEXT,
  prompt_version TEXT,
  supporting_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  uncertainty_note TEXT NOT NULL,
  review_state TEXT NOT NULL DEFAULT 'unreviewed' CHECK (
    review_state IN ('unreviewed', 'accepted', 'rejected', 'corrected')
  ),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_interpretations_obs
  ON public.conversation_interpretations(workspace_id, observation_id);

ALTER TABLE public.conversation_interpretations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation_interpretations_select" ON public.conversation_interpretations;
DROP POLICY IF EXISTS "conversation_interpretations_insert" ON public.conversation_interpretations;
DROP POLICY IF EXISTS "conversation_interpretations_update" ON public.conversation_interpretations;
DROP POLICY IF EXISTS "conversation_interpretations_delete" ON public.conversation_interpretations;

CREATE POLICY "conversation_interpretations_select" ON public.conversation_interpretations FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "conversation_interpretations_insert" ON public.conversation_interpretations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

CREATE POLICY "conversation_interpretations_update" ON public.conversation_interpretations FOR UPDATE
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "conversation_interpretations_delete" ON public.conversation_interpretations FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- ------------------------------------------------------------
-- 3. CONVERSATION ATTRIBUTIONS (Explicit Twin / Claim / CTA Links)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  observation_id UUID NOT NULL,
  FOREIGN KEY (observation_id, workspace_id)
    REFERENCES public.conversation_observations(id, workspace_id)
    ON DELETE CASCADE,
  twin_id UUID,
  FOREIGN KEY (twin_id, workspace_id)
    REFERENCES public.creative_twins(id, workspace_id)
    ON DELETE SET NULL,
  variant_twin_id UUID,
  FOREIGN KEY (variant_twin_id, workspace_id)
    REFERENCES public.creative_twins(id, workspace_id)
    ON DELETE SET NULL,
  twin_version_id UUID,
  FOREIGN KEY (twin_version_id, workspace_id)
    REFERENCES public.creative_twin_versions(id, workspace_id)
    ON DELETE SET NULL,
  brand_claim_id UUID,
  FOREIGN KEY (brand_claim_id, workspace_id)
    REFERENCES public.brand_claims(id, workspace_id)
    ON DELETE SET NULL,
  experiment_id UUID,
  FOREIGN KEY (experiment_id, workspace_id)
    REFERENCES public.experiments(id, workspace_id)
    ON DELETE SET NULL,
  cta_identifier TEXT,
  destination_url TEXT,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_attributions_obs
  ON public.conversation_attributions(workspace_id, observation_id);

ALTER TABLE public.conversation_attributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation_attributions_select" ON public.conversation_attributions;
DROP POLICY IF EXISTS "conversation_attributions_insert" ON public.conversation_attributions;
DROP POLICY IF EXISTS "conversation_attributions_update" ON public.conversation_attributions;
DROP POLICY IF EXISTS "conversation_attributions_delete" ON public.conversation_attributions;

CREATE POLICY "conversation_attributions_select" ON public.conversation_attributions FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "conversation_attributions_insert" ON public.conversation_attributions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

CREATE POLICY "conversation_attributions_update" ON public.conversation_attributions FOR UPDATE
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "conversation_attributions_delete" ON public.conversation_attributions FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- ------------------------------------------------------------
-- 4. CONVERSATION REVIEW EVENTS (Append-Only Audit Ledger)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_review_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  observation_id UUID,
  FOREIGN KEY (observation_id, workspace_id)
    REFERENCES public.conversation_observations(id, workspace_id)
    ON DELETE CASCADE,
  interpretation_id UUID,
  FOREIGN KEY (interpretation_id, workspace_id)
    REFERENCES public.conversation_interpretations(id, workspace_id)
    ON DELETE SET NULL,
  event_kind TEXT NOT NULL CHECK (
    event_kind IN (
      'imported',
      'accepted',
      'rejected',
      'corrected',
      'relabeled',
      'interpretation_reviewed',
      'attribution_linked',
      'attribution_unlinked'
    )
  ),
  previous_state TEXT,
  new_state TEXT NOT NULL,
  rationale TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_review_events_workspace
  ON public.conversation_review_events(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_review_events_obs
  ON public.conversation_review_events(workspace_id, observation_id);

ALTER TABLE public.conversation_review_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation_review_events_select" ON public.conversation_review_events;
DROP POLICY IF EXISTS "conversation_review_events_insert" ON public.conversation_review_events;
DROP POLICY IF EXISTS "conversation_review_events_no_update" ON public.conversation_review_events;
DROP POLICY IF EXISTS "conversation_review_events_no_delete" ON public.conversation_review_events;

CREATE POLICY "conversation_review_events_select" ON public.conversation_review_events FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "conversation_review_events_insert" ON public.conversation_review_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

CREATE POLICY "conversation_review_events_no_update" ON public.conversation_review_events FOR UPDATE
  USING (false);

CREATE POLICY "conversation_review_events_no_delete" ON public.conversation_review_events FOR DELETE
  USING (false);

-- ------------------------------------------------------------
-- 5. ATOMIC HUMAN REVIEW RPC (Observation)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_conversation_observation_atomic(
  p_workspace_id UUID,
  p_observation_id UUID,
  p_review_state TEXT,
  p_rationale TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_previous_state TEXT;
BEGIN
  -- 1. Authentication check
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Workspace membership check
  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a workspace member';
  END IF;

  -- 3. Review state validation
  IF p_review_state NOT IN ('unreviewed', 'needs_human', 'accepted', 'rejected', 'corrected') THEN
    RAISE EXCEPTION 'Invalid review_state "%". Must be unreviewed, needs_human, accepted, rejected, or corrected.', p_review_state;
  END IF;

  -- 4. Fetch current state
  SELECT review_state INTO v_previous_state
  FROM public.conversation_observations
  WHERE id = p_observation_id AND workspace_id = p_workspace_id;

  IF v_previous_state IS NULL THEN
    RAISE EXCEPTION 'Conversation observation not found in specified workspace';
  END IF;

  -- 5. Update observation review state
  UPDATE public.conversation_observations
  SET review_state = p_review_state
  WHERE id = p_observation_id AND workspace_id = p_workspace_id;

  -- 6. Insert append-only review audit event
  INSERT INTO public.conversation_review_events (
    workspace_id,
    observation_id,
    event_kind,
    previous_state,
    new_state,
    rationale,
    metadata,
    created_by
  ) VALUES (
    p_workspace_id,
    p_observation_id,
    CASE 
      WHEN p_review_state = 'accepted' THEN 'accepted'
      WHEN p_review_state = 'rejected' THEN 'rejected'
      WHEN p_review_state = 'corrected' THEN 'corrected'
      ELSE 'relabeled'
    END,
    v_previous_state,
    p_review_state,
    p_rationale,
    p_metadata,
    v_actor_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'observation_id', p_observation_id,
    'previous_state', v_previous_state,
    'new_state', p_review_state
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_conversation_observation_atomic(UUID, UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_conversation_observation_atomic(UUID, UUID, TEXT, TEXT, JSONB) TO authenticated;

-- ------------------------------------------------------------
-- 6. ATOMIC HUMAN REVIEW RPC (Interpretation)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_conversation_interpretation_atomic(
  p_workspace_id UUID,
  p_interpretation_id UUID,
  p_review_state TEXT,
  p_rationale TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_observation_id UUID;
  v_previous_state TEXT;
BEGIN
  -- 1. Authentication check
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Workspace membership check
  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a workspace member';
  END IF;

  -- 3. Review state validation
  IF p_review_state NOT IN ('unreviewed', 'accepted', 'rejected', 'corrected') THEN
    RAISE EXCEPTION 'Invalid interpretation review_state "%". Must be unreviewed, accepted, rejected, or corrected.', p_review_state;
  END IF;

  -- 4. Fetch current state and observation ID
  SELECT review_state, observation_id INTO v_previous_state, v_observation_id
  FROM public.conversation_interpretations
  WHERE id = p_interpretation_id AND workspace_id = p_workspace_id;

  IF v_previous_state IS NULL THEN
    RAISE EXCEPTION 'Conversation interpretation not found in specified workspace';
  END IF;

  -- 5. Update interpretation review state
  UPDATE public.conversation_interpretations
  SET
    review_state = p_review_state,
    reviewed_by = v_actor_id,
    reviewed_at = NOW()
  WHERE id = p_interpretation_id AND workspace_id = p_workspace_id;

  -- 6. Insert append-only review audit event
  INSERT INTO public.conversation_review_events (
    workspace_id,
    observation_id,
    interpretation_id,
    event_kind,
    previous_state,
    new_state,
    rationale,
    metadata,
    created_by
  ) VALUES (
    p_workspace_id,
    v_observation_id,
    p_interpretation_id,
    'interpretation_reviewed',
    v_previous_state,
    p_review_state,
    p_rationale,
    p_metadata,
    v_actor_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'interpretation_id', p_interpretation_id,
    'previous_state', v_previous_state,
    'new_state', p_review_state
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_conversation_interpretation_atomic(UUID, UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_conversation_interpretation_atomic(UUID, UUID, TEXT, TEXT, JSONB) TO authenticated;
