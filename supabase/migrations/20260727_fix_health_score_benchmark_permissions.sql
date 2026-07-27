-- M3: Remove the SECURITY DEFINER function from the REST-exposed API surface.
--
-- get_health_score_benchmark() computes a community-wide average health score
-- across ALL users' skin_analyses, which requires bypassing RLS — hence
-- SECURITY DEFINER. But the Supabase advisor (lint 0029) flags any DEFINER
-- function reachable via /rest/v1/rpc, because a DEFINER function on the
-- exposed API is a common privilege-escalation footgun.
--
-- Fix: move the privileged aggregation into a `private` schema that PostgREST
-- does NOT expose, and keep a thin SECURITY INVOKER wrapper in `public` for the
-- client to call. The wrapper carries no elevated privileges itself; only the
-- private function runs as owner, and it can only be reached through the
-- wrapper (never directly over REST).

CREATE SCHEMA IF NOT EXISTS private;

-- Privileged aggregation — not on the exposed API surface.
CREATE OR REPLACE FUNCTION private.compute_health_score_benchmark()
RETURNS TABLE(avg_score numeric, sample_size bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ROUND(AVG(health_score), 0), COUNT(*)
  FROM public.skin_analyses
  WHERE created_at > NOW() - INTERVAL '90 days';
$$;

-- Lock the private function down: only the public wrapper (running as the
-- authenticated caller) and service_role may execute it. It is unreachable via
-- REST because the `private` schema is not in PostgREST's exposed schemas.
REVOKE ALL ON FUNCTION private.compute_health_score_benchmark() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.compute_health_score_benchmark() TO authenticated, service_role;

-- Public wrapper — SECURITY INVOKER, so the advisor no longer flags it. It only
-- returns the aggregate (average + sample size), never per-user rows.
CREATE OR REPLACE FUNCTION public.get_health_score_benchmark()
RETURNS TABLE(avg_score numeric, sample_size bigint)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT * FROM private.compute_health_score_benchmark();
$$;

REVOKE ALL ON FUNCTION public.get_health_score_benchmark() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_health_score_benchmark() TO authenticated, service_role;
