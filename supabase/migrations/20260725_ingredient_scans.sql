-- Ingredient scanner history: each time a user scans a product label (photo or
-- pasted text), we persist the extracted ingredients and the conflict/allergy
-- findings so they can revisit past scans without re-spending Gemini tokens.
CREATE TABLE IF NOT EXISTS public.ingredient_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name TEXT,                       -- best-guess product name from the label
  source TEXT NOT NULL DEFAULT 'photo',    -- 'photo' | 'text'
  ingredients JSONB NOT NULL DEFAULT '[]', -- normalized ingredient list
  flagged_actives JSONB NOT NULL DEFAULT '[]',
  conflicts JSONB NOT NULL DEFAULT '[]',   -- ScanConflict[] from ingredient-conflicts
  allergy_matches JSONB NOT NULL DEFAULT '[]',
  suitability_note TEXT,                   -- short skin-type suitability summary
  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_ingredient_scans_user ON public.ingredient_scans(user_id, created_at DESC);

ALTER TABLE public.ingredient_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own ingredient scans"
  ON public.ingredient_scans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ingredient scans"
  ON public.ingredient_scans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ingredient scans"
  ON public.ingredient_scans FOR DELETE
  USING (auth.uid() = user_id);
