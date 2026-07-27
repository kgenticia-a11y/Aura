import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Scheduled photo-retention enforcement (see vercel.json crons).
// Runs daily: soft-deletes every selfie past its owner's photo_retention_days
// and removes the underlying storage objects. This is what makes the Settings
// "auto-delete after N days" promise actually true.
//
// Vercel Cron authenticates by sending "Authorization: Bearer <CRON_SECRET>".
// We require CRON_SECRET to be set and matched, so the endpoint can't be run by
// anyone else.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    return NextResponse.json(
      { error: "Cleanup is not available right now." },
      { status: 500 }
    );
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  // Atomically soft-delete expired rows and get their storage paths.
  const { data, error } = await admin.rpc("cleanup_expired_photos");

  if (error) {
    console.error("cleanup_expired_photos failed:", error);
    return NextResponse.json({ error: "Cleanup failed." }, { status: 500 });
  }

  const paths = ((data ?? []) as { storage_path: string }[])
    .map((r) => r.storage_path)
    .filter(Boolean);

  let storageRemoved = 0;
  if (paths.length > 0) {
    const { error: removeError } = await admin.storage
      .from("selfies")
      .remove(paths);
    if (removeError) {
      // DB rows are already soft-deleted (hidden from users); log and report so
      // orphaned storage objects can be retried on the next run.
      console.error("Storage removal failed:", removeError);
    } else {
      storageRemoved = paths.length;
    }
  }

  return NextResponse.json({
    soft_deleted: paths.length,
    storage_removed: storageRemoved,
    ran_at: new Date().toISOString(),
  });
}
