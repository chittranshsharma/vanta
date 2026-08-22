-- ============================================================
-- Vanta Evidence Layer — Ticket 3.1
-- Migration: 20260822000003_evidence_layer
-- Tables: source_registry, evidence_items, metric_definitions
-- Constraints:
--   * connected status reserved for service-role connectors only (trigger)
--   * evidence_items workspace-source consistency via composite FK
--   * metric_key unique per workspace
-- ============================================================

-- ============================================================
-- 1. SOURCE REGISTRY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.source_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('url', 'file_import', 'api_feed', 'manual')),
  url TEXT,
  description TEXT,
  -- Health: 'connected' can only be set by service-role (future authorized connector)
  -- Authenticated users may set: unverified | stale | disconnected
  health_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (health_status IN ('unverified', 'stale', 'disconnected', 'connected')),
  last_verified_at TIMESTAMPTZ,
  freshness_window_days INTEGER NOT NULL DEFAULT 30,
  source_coverage TEXT NOT NULL DEFAULT 'unknown'
    CHECK (source_coverage IN ('complete', 'partial', 'unknown')),
  review_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'in_review', 'approved', 'archived')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Composite unique enables FK reference from evidence_items
  UNIQUE (id, workspace_id)
);

-- Trigger: block authenticated users from setting health_status = 'connected'
-- Service-role (future connectors) bypasses RLS and this trigger check
CREATE OR REPLACE FUNCTION public.block_manual_connected_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- auth.role() returns 'authenticated' for JWT callers, 'service_role' for service key
  IF NEW.health_status = 'connected' AND auth.role() = 'authenticated' THEN
    RAISE EXCEPTION
      'source health_status cannot be manually set to connected. '
      'connected is reserved for authorized system connectors.'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_block_connected_status
  BEFORE INSERT OR UPDATE ON public.source_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.block_manual_connected_status();

-- ============================================================
-- 2. EVIDENCE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.evidence_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Composite FK ensures source and evidence item are in the same workspace at DB level
  source_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  FOREIGN KEY (source_id, workspace_id)
    REFERENCES public.source_registry(id, workspace_id)
    ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  evidence_class TEXT NOT NULL DEFAULT 'unknown'
    CHECK (evidence_class IN ('observed', 'sourced_claim', 'inference', 'simulation', 'unknown')),
  claim_text TEXT NOT NULL,
  metric_key TEXT,
  metric_value NUMERIC,
  metric_unit TEXT,
  metric_definition TEXT,
  time_window TEXT,
  completeness TEXT NOT NULL DEFAULT 'unknown'
    CHECK (completeness IN ('complete', 'partial', 'unknown')),
  citation_url TEXT,
  citation_date DATE,
  freshness_date DATE,
  review_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'in_review', 'approved', 'archived')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. METRIC DEFINITIONS (canonical vocabulary per workspace)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.metric_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metric_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  unit TEXT,
  definition TEXT NOT NULL,
  measurement_method TEXT,
  source_id UUID REFERENCES public.source_registry(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Canonical: one definition per metric key per workspace
  UNIQUE (workspace_id, metric_key)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_source_registry_workspace_id
  ON public.source_registry(workspace_id);
CREATE INDEX IF NOT EXISTS idx_source_registry_health
  ON public.source_registry(workspace_id, health_status);
CREATE INDEX IF NOT EXISTS idx_evidence_items_workspace_id
  ON public.evidence_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_evidence_items_source_id
  ON public.evidence_items(source_id);
CREATE INDEX IF NOT EXISTS idx_evidence_items_class
  ON public.evidence_items(workspace_id, evidence_class);
CREATE INDEX IF NOT EXISTS idx_metric_definitions_workspace_id
  ON public.metric_definitions(workspace_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.source_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_definitions ENABLE ROW LEVEL SECURITY;

-- SOURCE REGISTRY
CREATE POLICY "source_registry_select"
  ON public.source_registry FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "source_registry_insert"
  ON public.source_registry FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE POLICY "source_registry_update"
  ON public.source_registry FOR UPDATE
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "source_registry_delete"
  ON public.source_registry FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- EVIDENCE ITEMS
CREATE POLICY "evidence_items_select"
  ON public.evidence_items FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "evidence_items_insert"
  ON public.evidence_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE POLICY "evidence_items_update"
  ON public.evidence_items FOR UPDATE
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "evidence_items_delete"
  ON public.evidence_items FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- METRIC DEFINITIONS
CREATE POLICY "metric_definitions_select"
  ON public.metric_definitions FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "metric_definitions_insert"
  ON public.metric_definitions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE POLICY "metric_definitions_update"
  ON public.metric_definitions FOR UPDATE
  USING (public.is_workspace_admin_or_owner(workspace_id))
  WITH CHECK (public.is_workspace_admin_or_owner(workspace_id));

CREATE POLICY "metric_definitions_delete"
  ON public.metric_definitions FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));
