-- ============================================================
-- Vanta: bind created_by / started_by to the authenticated caller
-- Migration: 20260822000008_bind_created_by.sql
-- Status: PENDING LIVE APPLY (authored 2026-08-23, audit finding P1-6)
-- Depends on: 20260822000007_brand_brain_rls.sql applied first.
--
-- Why:
--   INSERT policies checked workspace membership but never bound the
--   created_by column to auth.uid(). A member could attribute rows,
--   including immutable twin/codex version snapshots, to another user.
--   Authorization was unaffected; provenance was not.
--
-- What changes:
--   Every INSERT policy on a table with created_by (or started_by) is
--   recreated with the additional predicate  <col> = auth.uid().
--   SECURITY DEFINER functions (handle_new_user, correction RPCs) run as
--   the table owner and are unaffected; they already set the verified actor.
--
-- Pre-check before applying (read-only): docs/supabase-deferred-validation.md D-2
-- ============================================================

-- 1. WORKSPACES (policy name from migration 001)
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON public.workspaces;
CREATE POLICY "Authenticated users can create workspaces" ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- 2. BRAND BRAIN (policy names from migration 007)
DROP POLICY IF EXISTS "brands_insert" ON public.brands;
CREATE POLICY "brands_insert" ON public.brands FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "brand_codex_versions_insert" ON public.brand_codex_versions;
CREATE POLICY "brand_codex_versions_insert" ON public.brand_codex_versions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "brand_audiences_insert" ON public.brand_audiences;
CREATE POLICY "brand_audiences_insert" ON public.brand_audiences FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "brand_claims_insert" ON public.brand_claims;
CREATE POLICY "brand_claims_insert" ON public.brand_claims FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "brand_proof_points_insert" ON public.brand_proof_points;
CREATE POLICY "brand_proof_points_insert" ON public.brand_proof_points FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "brand_competitors_insert" ON public.brand_competitors;
CREATE POLICY "brand_competitors_insert" ON public.brand_competitors FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "brand_tone_guidelines_insert" ON public.brand_tone_guidelines;
CREATE POLICY "brand_tone_guidelines_insert" ON public.brand_tone_guidelines FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "brand_compliance_boundaries_insert" ON public.brand_compliance_boundaries;
CREATE POLICY "brand_compliance_boundaries_insert" ON public.brand_compliance_boundaries FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

-- 3. EVIDENCE LAYER (policy names from migration 003)
DROP POLICY IF EXISTS "source_registry_insert" ON public.source_registry;
CREATE POLICY "source_registry_insert" ON public.source_registry FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "evidence_items_insert" ON public.evidence_items;
CREATE POLICY "evidence_items_insert" ON public.evidence_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "metric_definitions_insert" ON public.metric_definitions;
CREATE POLICY "metric_definitions_insert" ON public.metric_definitions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

-- 4. CREATIVE INTAKE (policy names from migration 004)
DROP POLICY IF EXISTS "creative_assets_insert" ON public.creative_assets;
CREATE POLICY "creative_assets_insert" ON public.creative_assets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "ingestion_runs_insert" ON public.ingestion_runs;
CREATE POLICY "ingestion_runs_insert" ON public.ingestion_runs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND started_by = auth.uid());

-- 5. TWIN VERSIONS (policy name from migration 005)
DROP POLICY IF EXISTS "creative_twin_versions_insert" ON public.creative_twin_versions;
CREATE POLICY "creative_twin_versions_insert" ON public.creative_twin_versions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());
