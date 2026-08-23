-- ============================================================
-- Vanta Brand Brain Row Level Security
-- Migration: 20260822000007_brand_brain_rls.sql
-- Status: PENDING LIVE APPLY (authored 2026-08-23 during repository audit)
--
-- Why this exists:
--   Migration 20260822000002_brand_brain.sql created 8 tenant tables
--   without any ENABLE ROW LEVEL SECURITY or CREATE POLICY statements.
--   docs/build-state.md records 32 Brand Brain policies as live; they
--   were never committed. This migration makes the repository the source
--   of truth. It is additive and idempotent: every policy is dropped by
--   name before creation, so it is safe to apply whether or not an
--   equivalent live policy already exists.
--
-- Policy model (matches migrations 003-005):
--   SELECT / INSERT / UPDATE : workspace member
--   DELETE                   : workspace admin or owner
--   brand_codex_versions     : append-only (SELECT + INSERT, deny UPDATE/DELETE)
--
-- Live verification steps: docs/supabase-deferred-validation.md D-1
-- ============================================================

-- 1. BRANDS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brands_select" ON public.brands;
DROP POLICY IF EXISTS "brands_insert" ON public.brands;
DROP POLICY IF EXISTS "brands_update" ON public.brands;
DROP POLICY IF EXISTS "brands_delete" ON public.brands;
DROP POLICY IF EXISTS "brand_select" ON public.brands;
DROP POLICY IF EXISTS "brand_insert" ON public.brands;
DROP POLICY IF EXISTS "brand_update" ON public.brands;
DROP POLICY IF EXISTS "brand_delete" ON public.brands;

CREATE POLICY "brands_select" ON public.brands FOR SELECT
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "brands_insert" ON public.brands FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "brands_update" ON public.brands FOR UPDATE
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "brands_delete" ON public.brands FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- 2. BRAND CODEX VERSIONS (append-only snapshot history)
ALTER TABLE public.brand_codex_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_codex_versions_select" ON public.brand_codex_versions;
DROP POLICY IF EXISTS "brand_codex_versions_insert" ON public.brand_codex_versions;
DROP POLICY IF EXISTS "brand_codex_versions_no_update" ON public.brand_codex_versions;
DROP POLICY IF EXISTS "brand_codex_versions_no_delete" ON public.brand_codex_versions;
DROP POLICY IF EXISTS "brand_codex_select" ON public.brand_codex_versions;
DROP POLICY IF EXISTS "brand_codex_insert" ON public.brand_codex_versions;

CREATE POLICY "brand_codex_versions_select" ON public.brand_codex_versions FOR SELECT
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "brand_codex_versions_insert" ON public.brand_codex_versions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "brand_codex_versions_no_update" ON public.brand_codex_versions FOR UPDATE
  USING (false);
CREATE POLICY "brand_codex_versions_no_delete" ON public.brand_codex_versions FOR DELETE
  USING (false);

-- 3. BRAND AUDIENCES
ALTER TABLE public.brand_audiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_audiences_select" ON public.brand_audiences;
DROP POLICY IF EXISTS "brand_audiences_insert" ON public.brand_audiences;
DROP POLICY IF EXISTS "brand_audiences_update" ON public.brand_audiences;
DROP POLICY IF EXISTS "brand_audiences_delete" ON public.brand_audiences;

CREATE POLICY "brand_audiences_select" ON public.brand_audiences FOR SELECT
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "brand_audiences_insert" ON public.brand_audiences FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "brand_audiences_update" ON public.brand_audiences FOR UPDATE
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "brand_audiences_delete" ON public.brand_audiences FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- 4. BRAND CLAIMS
ALTER TABLE public.brand_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_claims_select" ON public.brand_claims;
DROP POLICY IF EXISTS "brand_claims_insert" ON public.brand_claims;
DROP POLICY IF EXISTS "brand_claims_update" ON public.brand_claims;
DROP POLICY IF EXISTS "brand_claims_delete" ON public.brand_claims;

CREATE POLICY "brand_claims_select" ON public.brand_claims FOR SELECT
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "brand_claims_insert" ON public.brand_claims FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "brand_claims_update" ON public.brand_claims FOR UPDATE
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "brand_claims_delete" ON public.brand_claims FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- 5. BRAND PROOF POINTS
ALTER TABLE public.brand_proof_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_proof_points_select" ON public.brand_proof_points;
DROP POLICY IF EXISTS "brand_proof_points_insert" ON public.brand_proof_points;
DROP POLICY IF EXISTS "brand_proof_points_update" ON public.brand_proof_points;
DROP POLICY IF EXISTS "brand_proof_points_delete" ON public.brand_proof_points;
DROP POLICY IF EXISTS "brand_proof_select" ON public.brand_proof_points;
DROP POLICY IF EXISTS "brand_proof_insert" ON public.brand_proof_points;
DROP POLICY IF EXISTS "brand_proof_update" ON public.brand_proof_points;
DROP POLICY IF EXISTS "brand_proof_delete" ON public.brand_proof_points;

CREATE POLICY "brand_proof_points_select" ON public.brand_proof_points FOR SELECT
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "brand_proof_points_insert" ON public.brand_proof_points FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "brand_proof_points_update" ON public.brand_proof_points FOR UPDATE
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "brand_proof_points_delete" ON public.brand_proof_points FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- 6. BRAND COMPETITORS
ALTER TABLE public.brand_competitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_competitors_select" ON public.brand_competitors;
DROP POLICY IF EXISTS "brand_competitors_insert" ON public.brand_competitors;
DROP POLICY IF EXISTS "brand_competitors_update" ON public.brand_competitors;
DROP POLICY IF EXISTS "brand_competitors_delete" ON public.brand_competitors;

CREATE POLICY "brand_competitors_select" ON public.brand_competitors FOR SELECT
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "brand_competitors_insert" ON public.brand_competitors FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "brand_competitors_update" ON public.brand_competitors FOR UPDATE
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "brand_competitors_delete" ON public.brand_competitors FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- 7. BRAND TONE GUIDELINES
ALTER TABLE public.brand_tone_guidelines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_tone_guidelines_select" ON public.brand_tone_guidelines;
DROP POLICY IF EXISTS "brand_tone_guidelines_insert" ON public.brand_tone_guidelines;
DROP POLICY IF EXISTS "brand_tone_guidelines_update" ON public.brand_tone_guidelines;
DROP POLICY IF EXISTS "brand_tone_guidelines_delete" ON public.brand_tone_guidelines;
DROP POLICY IF EXISTS "brand_tone_select" ON public.brand_tone_guidelines;
DROP POLICY IF EXISTS "brand_tone_insert" ON public.brand_tone_guidelines;
DROP POLICY IF EXISTS "brand_tone_update" ON public.brand_tone_guidelines;
DROP POLICY IF EXISTS "brand_tone_delete" ON public.brand_tone_guidelines;

CREATE POLICY "brand_tone_guidelines_select" ON public.brand_tone_guidelines FOR SELECT
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "brand_tone_guidelines_insert" ON public.brand_tone_guidelines FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "brand_tone_guidelines_update" ON public.brand_tone_guidelines FOR UPDATE
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "brand_tone_guidelines_delete" ON public.brand_tone_guidelines FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- 8. BRAND COMPLIANCE BOUNDARIES
ALTER TABLE public.brand_compliance_boundaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_compliance_boundaries_select" ON public.brand_compliance_boundaries;
DROP POLICY IF EXISTS "brand_compliance_boundaries_insert" ON public.brand_compliance_boundaries;
DROP POLICY IF EXISTS "brand_compliance_boundaries_update" ON public.brand_compliance_boundaries;
DROP POLICY IF EXISTS "brand_compliance_boundaries_delete" ON public.brand_compliance_boundaries;
DROP POLICY IF EXISTS "brand_compliance_select" ON public.brand_compliance_boundaries;
DROP POLICY IF EXISTS "brand_compliance_insert" ON public.brand_compliance_boundaries;
DROP POLICY IF EXISTS "brand_compliance_update" ON public.brand_compliance_boundaries;
DROP POLICY IF EXISTS "brand_compliance_delete" ON public.brand_compliance_boundaries;

CREATE POLICY "brand_compliance_boundaries_select" ON public.brand_compliance_boundaries FOR SELECT
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "brand_compliance_boundaries_insert" ON public.brand_compliance_boundaries FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "brand_compliance_boundaries_update" ON public.brand_compliance_boundaries FOR UPDATE
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "brand_compliance_boundaries_delete" ON public.brand_compliance_boundaries FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- 9. INDEXES ON workspace_id (policy predicate column) where missing
-- public.brands already carries UNIQUE (workspace_id), which is indexed.
CREATE INDEX IF NOT EXISTS idx_brand_codex_versions_workspace_id ON public.brand_codex_versions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_brand_audiences_workspace_id ON public.brand_audiences(workspace_id);
CREATE INDEX IF NOT EXISTS idx_brand_claims_workspace_id ON public.brand_claims(workspace_id);
CREATE INDEX IF NOT EXISTS idx_brand_proof_points_workspace_id ON public.brand_proof_points(workspace_id);
CREATE INDEX IF NOT EXISTS idx_brand_competitors_workspace_id ON public.brand_competitors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_brand_tone_guidelines_workspace_id ON public.brand_tone_guidelines(workspace_id);
CREATE INDEX IF NOT EXISTS idx_brand_compliance_boundaries_workspace_id ON public.brand_compliance_boundaries(workspace_id);
