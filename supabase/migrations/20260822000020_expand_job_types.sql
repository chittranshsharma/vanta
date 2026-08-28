-- ============================================================
-- Vanta: Expand Job Types for Conversation Intelligence
-- Migration: 20260822000020_expand_job_types.sql
-- Depends on: 001 through 019 applied.
-- ============================================================

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_job_type_check;

ALTER TABLE public.jobs ADD CONSTRAINT jobs_job_type_check CHECK (
  job_type IN (
    'model_task',
    'campaign_csv_normalize',
    'media_probe',
    'source_refresh',
    'embedding_refresh',
    'conversation_import_validate',
    'conversation_deduplicate',
    'conversation_interpretation_proposal',
    'conversation_attribution',
    'conversation_aggregate'
  )
);
