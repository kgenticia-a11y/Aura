-- Durable, cross-instance rate limiting.
--
-- The previous limiter lived in a per-process in-memory Map, which on Vercel
-- serverless resets on every cold start and is not shared across concurrent
-- instances — so per-minute limits were effectively unenforced. This moves the
-- counters into Postgres so all instances share one source of truth.
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS on with no policies: the table is only ever touched by check_rate_limit()
-- (SECURITY DEFINER, which bypasses RLS). Direct PostgREST access is denied.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomically increment the counter for `p_key` within a rolling window of
-- `p_window_seconds` and return the new count. If the stored window has
-- expired, the counter resets to 1. Returns the count so the caller can decide
-- whether the request is over its limit.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_count INTEGER;
BEGIN
  INSERT INTO public.rate_limits(key, count, window_start)
    VALUES (p_key, 1, v_now)
  ON CONFLICT (key) DO UPDATE
    SET count = CASE
          WHEN rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
          THEN 1
          ELSE rate_limits.count + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
          THEN v_now
          ELSE rate_limits.window_start
        END
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
