-- Automatic photo-retention enforcement.
--
-- The Settings screen promises selfies are auto-deleted after each user's
-- photo_retention_days, but until now cleanup only ran on a manual button.
-- This function soft-deletes every selfie past its owner's retention window and
-- returns the storage paths, so a scheduled job (running with the service role)
-- can remove the underlying image files.
--
-- SECURITY DEFINER so it can see across users; EXECUTE is revoked from anon and
-- authenticated and granted only to service_role, so it is not part of the
-- public API surface (and won't trip the security-definer linter).
CREATE OR REPLACE FUNCTION public.cleanup_expired_photos()
RETURNS TABLE(storage_path TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.skin_photos p
  SET deleted_at = now()
  FROM public.profiles pr
  WHERE pr.id = p.user_id
    AND p.deleted_at IS NULL
    AND p.created_at < now() - make_interval(days => COALESCE(pr.photo_retention_days, 90))
  RETURNING p.storage_path;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_photos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_photos() TO service_role;
