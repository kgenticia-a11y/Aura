-- F6: Add premium tier flag to profiles for feature gating.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_premium IS
  'Whether the user is on the premium plan. Manually settable; Stripe integration deferred.';
