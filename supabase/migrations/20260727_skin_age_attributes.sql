-- F4: Skin-age + expanded attribute scores.
--
-- Adds an estimated cosmetic "skin age" and a set of 0–100 attribute scores
-- (pores, firmness, radiance, evenness) to each analysis. Stored as dedicated
-- columns (not just inside raw_response) so skin-age and attributes can be
-- trended over time. Both are nullable — older rows and any analysis where the
-- model omits them simply have NULL.
--
-- skin_age is a cosmetic estimate only, never a medical or biological age.

ALTER TABLE public.skin_analyses
  ADD COLUMN IF NOT EXISTS skin_age INTEGER,
  ADD COLUMN IF NOT EXISTS attributes JSONB;

-- Guard rails: keep skin_age in a sane cosmetic range when present.
ALTER TABLE public.skin_analyses
  DROP CONSTRAINT IF EXISTS skin_analyses_skin_age_range;
ALTER TABLE public.skin_analyses
  ADD CONSTRAINT skin_analyses_skin_age_range
  CHECK (skin_age IS NULL OR (skin_age >= 10 AND skin_age <= 100));
