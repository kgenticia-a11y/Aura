-- L2: Performance + correctness housekeeping.
--
-- (1) Covering indexes for foreign keys. Postgres does not auto-create an index
--     on the referencing side of an FK, so joins and cascade deletes on these
--     columns do sequential scans (advisor lint 0001). Add a btree index on each
--     unindexed FK column. CREATE INDEX IF NOT EXISTS keeps this idempotent.
--
-- (2) skin_analyses.model_version default was still 'gemini-2.0-flash' — a stale
--     value from before the migration to gemini-2.5-flash. All code paths set
--     model_version explicitly on insert, so this only affected rows that omit
--     it; update the default to avoid mislabeling.

CREATE INDEX IF NOT EXISTS idx_derm_consultations_analysis_id
  ON public.derm_consultations (analysis_id);

CREATE INDEX IF NOT EXISTS idx_error_logs_user_id
  ON public.error_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_product_favorites_product_id
  ON public.product_favorites (product_id);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id
  ON public.product_reviews (product_id);

CREATE INDEX IF NOT EXISTS idx_routine_feedback_routine_id
  ON public.routine_feedback (routine_id);

CREATE INDEX IF NOT EXISTS idx_routine_products_product_id
  ON public.routine_products (product_id);

CREATE INDEX IF NOT EXISTS idx_routine_products_routine_id
  ON public.routine_products (routine_id);

CREATE INDEX IF NOT EXISTS idx_routine_step_completions_routine_id
  ON public.routine_step_completions (routine_id);

CREATE INDEX IF NOT EXISTS idx_routines_analysis_id
  ON public.routines (analysis_id);

-- Fix the stale model default.
ALTER TABLE public.skin_analyses
  ALTER COLUMN model_version SET DEFAULT 'gemini-2.5-flash';
