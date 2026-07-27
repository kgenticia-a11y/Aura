-- L1: error_logs has RLS enabled but no policies, so every client SELECT
-- returns zero rows — the admin dashboard's "Recent Errors" panel is always
-- empty, and there was no writer at all.
--
-- Design:
--   * WRITES go through the service role (see lib/log-error.ts), which bypasses
--     RLS. We deliberately do NOT add a client INSERT policy — error logs carry
--     stack traces and user ids, and a client-writable log table is a spam and
--     forgery vector.
--   * READS are limited to admins so the admin dashboard can display recent
--     errors without exposing them to regular users.

-- Admins (profiles.is_admin = true) may read error logs.
DROP POLICY IF EXISTS "Admins can read error logs" ON public.error_logs;
CREATE POLICY "Admins can read error logs"
  ON public.error_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );
