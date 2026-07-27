import { createClient as createServiceClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// In-memory fallback (per-process). Used only when the shared Postgres limiter
// is unavailable — e.g. the service-role key isn't configured, or a transient
// DB error — so requests degrade gracefully instead of being hard-blocked.
// ---------------------------------------------------------------------------
const requests = new Map<string, { count: number; resetAt: number }>();
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, val] of requests) {
    if (val.resetAt < now) requests.delete(key);
  }
}

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number } {
  cleanup();
  const now = Date.now();
  const entry = requests.get(key);

  if (!entry || entry.resetAt < now) {
    requests.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  entry.count++;
  if (entry.count > limit) return { ok: false, remaining: 0 };
  return { ok: true, remaining: limit - entry.count };
}

// ---------------------------------------------------------------------------
// Shared Postgres limiter. A lazily-created service-role client (server only,
// bypasses RLS) is the sole caller of check_rate_limit().
// ---------------------------------------------------------------------------
let serviceClient: ReturnType<typeof createServiceClient> | null = null;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!serviceClient) serviceClient = createServiceClient(url, key);
  return serviceClient;
}

/**
 * Durable, cross-instance rate limiter backed by Postgres. Falls back to a
 * per-process in-memory limiter if the shared store is unavailable so requests
 * are never hard-blocked by an infra hiccup.
 *
 * Now async (was synchronous) — all call sites must `await` it.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: boolean; remaining: number }> {
  const client = getServiceClient();
  if (!client) return memoryRateLimit(key, limit, windowMs);

  try {
    const { data, error } = await (client.rpc as CallableFunction)(
      "check_rate_limit",
      {
        p_key: key,
        p_limit: limit,
        p_window_seconds: Math.ceil(windowMs / 1000),
      }
    );

    if (error || typeof data !== "number") {
      return memoryRateLimit(key, limit, windowMs);
    }

    const count = data;
    return { ok: count <= limit, remaining: Math.max(0, limit - count) };
  } catch {
    return memoryRateLimit(key, limit, windowMs);
  }
}
