import { createClient as createServiceClient } from "@supabase/supabase-js";

// Server-side error logger. Writes to public.error_logs using the service-role
// key, which bypasses RLS. Error logs hold sensitive data (stack traces, user
// ids), so writes deliberately never go through the client — a client-facing
// insert policy would be a spam/forgery vector. Reads are limited to admins via
// an RLS SELECT policy (see 20260727_error_logs_policies.sql).
//
// Best-effort: logging must never throw into the request path, so all failures
// are swallowed after a console fallback.

let serviceClient: ReturnType<typeof createServiceClient> | null = null;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!serviceClient) serviceClient = createServiceClient(url, key);
  return serviceClient;
}

export interface LogErrorInput {
  errorType: string;
  message: string;
  endpoint?: string;
  userId?: string | null;
  stackTrace?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logError(input: LogErrorInput): Promise<void> {
  try {
    const client = getServiceClient();
    if (!client) {
      // No service key configured (e.g. local dev) — fall back to console.
      console.error(`[${input.errorType}] ${input.message}`, input.metadata ?? "");
      return;
    }

    await (client.from("error_logs").insert as CallableFunction)({
      error_type: input.errorType,
      message: input.message.slice(0, 4000),
      endpoint: input.endpoint ?? null,
      user_id: input.userId ?? null,
      stack_trace: input.stackTrace?.slice(0, 8000) ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    // Never let logging break the request.
    console.error("Failed to write error_logs:", err);
  }
}
