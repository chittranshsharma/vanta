-- Vanta Brand Brain & Brand Codex Schema
-- Version: 20260822000002_brand_brain.sql
-- Every record is workspace-scoped, authored, timestamped, review-tracked, source-referenced.

-- ============================================================
-- 1. BRANDS (root Brand Brain per workspace)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  product_category TEXT,
  -- Positioning
  positioning_statement TEXT,
  core_promise TEXT,
  -- Meta
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'in_review', 'approved', 'archived')),
  effective_date DATE,
  archived_at TIMESTAMPTZ,
  source_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id) -- One Brand Brain root per workspace
);

-- ============================================================
-- 2. BRAND CODEX VERSIONS (immutable snapshots)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brand_codex_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, version_number)
);

-- ============================================================
-- 3. BRAND AUDIENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brand_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  segment_name TEXT NOT NULL,
  description TEXT,
  demographics TEXT,
  psychographics TEXT,
  pain_points TEXT,
  motivations TEXT,
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'in_review', 'approved', 'archived')),
  source_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. BRAND CLAIMS (approved / prohibited / conditional / unknown)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brand_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claim_text TEXT NOT NULL,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('approved', 'prohibited', 'conditional', 'unknown')),
  rationale TEXT,
  condition TEXT,
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'in_review', 'approved', 'archived')),
  effective_date DATE,
  expires_at DATE,
  source_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. BRAND PROOF POINTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brand_proof_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.brand_claims(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  proof_text TEXT NOT NULL,
  evidence_class TEXT NOT NULL CHECK (evidence_class IN ('observed', 'sourced_claim', 'inference', 'simulation', 'unknown')),
  citation_url TEXT,
  citation_date DATE,
  source_coverage TEXT CHECK (source_coverage IN ('complete', 'partial', 'unknown')),
  freshness_date DATE,
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'in_review', 'approved', 'archived')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. BRAND COMPETITORS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brand_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  competitor_name TEXT NOT NULL,
  description TEXT,
  differentiation TEXT,
  watch_level TEXT NOT NULL DEFAULT 'monitor' CHECK (watch_level IN ('primary', 'secondary', 'monitor', 'archived')),
  source_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. BRAND TONE GUIDELINES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brand_tone_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dimension TEXT NOT NULL,
  approved_direction TEXT,
  prohibited_direction TEXT,
  examples TEXT,
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'in_review', 'approved', 'archived')),
  source_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. BRAND COMPLIANCE BOUNDARIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brand_compliance_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  boundary_type TEXT NOT NULL,
  description TEXT NOT NULL,
  applies_to TEXT,
  enforcement_level TEXT NOT NULL DEFAULT 'required' CHECK (enforcement_level IN ('required', 'recommended', 'advisory')),
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'in_review', 'approved', 'archived')),
  effective_date DATE,
  expires_at DATE,
  source_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
