-- ============================================================
-- Vanta: retrieval candidates via pgvector (Upgrade E)
-- Migration: 20260822000013_embeddings.sql
-- Status: PENDING LIVE APPLY (authored 2026-08-23)
-- Depends on: 011 applied. Requires the pgvector extension (available on Supabase).
--
-- Principle: vector results are retrieval CANDIDATES, not evidence.
-- PostgreSQL rows remain the permissioned record of truth. Every candidate
-- returned here must still pass the retrieval gate (shared/retrieval/gate.ts):
-- workspace scope, source freshness, evidence class, review status, citation.
--
-- Dimension: 1536 (OpenAI-compatible text-embedding-3-small and equivalents).
-- Changing models requires a new table or a re-embed job; model name and
-- version are stored per row so mixed-model rows are detectable.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.retrieval_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL CHECK (source_table IN ('brand_claims', 'brand_proof_points', 'evidence_items', 'creative_claims')),
  source_id UUID NOT NULL,
  chunk_index INT NOT NULL DEFAULT 0 CHECK (chunk_index >= 0),
  content_sha256 TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  embedding_model TEXT NOT NULL,
  embedding_model_version TEXT NOT NULL,
  job_id UUID,
  FOREIGN KEY (job_id, workspace_id) REFERENCES public.jobs(id, workspace_id) ON DELETE SET NULL (job_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, source_table, source_id, chunk_index, embedding_model)
);

CREATE INDEX IF NOT EXISTS idx_retrieval_embeddings_workspace ON public.retrieval_embeddings(workspace_id, source_table);
-- HNSW cosine index. Built per workspace filter at query time; fine at current scale.
CREATE INDEX IF NOT EXISTS idx_retrieval_embeddings_hnsw
  ON public.retrieval_embeddings USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.retrieval_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retrieval_embeddings_select" ON public.retrieval_embeddings;
DROP POLICY IF EXISTS "retrieval_embeddings_no_insert" ON public.retrieval_embeddings;
DROP POLICY IF EXISTS "retrieval_embeddings_no_update" ON public.retrieval_embeddings;
DROP POLICY IF EXISTS "retrieval_embeddings_no_delete" ON public.retrieval_embeddings;

CREATE POLICY "retrieval_embeddings_select" ON public.retrieval_embeddings FOR SELECT
  USING (public.is_workspace_member(workspace_id));
-- Only the embedding worker (service_role, bypasses RLS) writes rows. Browser roles: nothing.
CREATE POLICY "retrieval_embeddings_no_insert" ON public.retrieval_embeddings FOR INSERT
  WITH CHECK (false);
CREATE POLICY "retrieval_embeddings_no_update" ON public.retrieval_embeddings FOR UPDATE
  USING (false);
CREATE POLICY "retrieval_embeddings_no_delete" ON public.retrieval_embeddings FOR DELETE
  USING (false);

-- Candidate search. SECURITY INVOKER on purpose: RLS on retrieval_embeddings
-- applies, so a caller only ever matches inside workspaces they belong to.
-- Returns ids and similarity only; the caller joins to the source rows
-- (again under RLS) and runs the retrieval gate before any use.
CREATE OR REPLACE FUNCTION public.match_retrieval_candidates(
  p_workspace_id UUID,
  p_query vector(1536),
  p_source_tables TEXT[],
  p_limit INT
)
RETURNS TABLE (source_table TEXT, source_id UUID, chunk_index INT, similarity DOUBLE PRECISION, embedding_model TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT e.source_table, e.source_id, e.chunk_index,
         1 - (e.embedding <=> p_query) AS similarity,
         e.embedding_model
  FROM public.retrieval_embeddings e
  WHERE e.workspace_id = p_workspace_id
    AND e.source_table = ANY (p_source_tables)
  ORDER BY e.embedding <=> p_query
  LIMIT GREATEST(LEAST(p_limit, 50), 1);
$$;

REVOKE ALL ON FUNCTION public.match_retrieval_candidates(UUID, vector, TEXT[], INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_retrieval_candidates(UUID, vector, TEXT[], INT) TO authenticated, service_role;

-- Coverage helper so the UI can say honestly how much of the codex is indexed.
CREATE OR REPLACE FUNCTION public.retrieval_coverage(p_workspace_id UUID)
RETURNS TABLE (source_table TEXT, indexed_rows BIGINT, total_rows BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT 'brand_claims', (SELECT count(DISTINCT source_id) FROM public.retrieval_embeddings WHERE workspace_id = p_workspace_id AND source_table = 'brand_claims'), (SELECT count(*) FROM public.brand_claims WHERE workspace_id = p_workspace_id)
  UNION ALL
  SELECT 'brand_proof_points', (SELECT count(DISTINCT source_id) FROM public.retrieval_embeddings WHERE workspace_id = p_workspace_id AND source_table = 'brand_proof_points'), (SELECT count(*) FROM public.brand_proof_points WHERE workspace_id = p_workspace_id)
  UNION ALL
  SELECT 'evidence_items', (SELECT count(DISTINCT source_id) FROM public.retrieval_embeddings WHERE workspace_id = p_workspace_id AND source_table = 'evidence_items'), (SELECT count(*) FROM public.evidence_items WHERE workspace_id = p_workspace_id);
$$;

REVOKE ALL ON FUNCTION public.retrieval_coverage(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retrieval_coverage(UUID) TO authenticated, service_role;
