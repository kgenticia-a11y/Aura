-- Fitzpatrick skin phototype (I-VI), self-reported during onboarding.
-- Used to give the AI skin analysis explicit context for inclusive,
-- tone-aware assessments across all skin tones.
ALTER TABLE public.skin_profiles
ADD COLUMN IF NOT EXISTS fitzpatrick_scale TEXT;

COMMENT ON COLUMN public.skin_profiles.fitzpatrick_scale IS 'Fitzpatrick skin phototype I-VI, self-reported during onboarding for inclusive AI analysis';
