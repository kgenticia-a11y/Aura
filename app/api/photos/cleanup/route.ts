import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ok } = await rateLimit(`photo-cleanup:${user.id}`, 3, 300_000);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes." },
      { status: 429 }
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Photo cleanup is not available right now." },
      { status: 500 }
    );
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  // Get user's retention preference
  const { data: profile } = await admin
    .from("profiles")
    .select("photo_retention_days")
    .eq("id", user.id)
    .single();

  const retentionDays = profile?.photo_retention_days ?? 90;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  // Find photos past retention that haven't been soft-deleted yet
  const { data: expiredPhotos } = await admin
    .from("skin_photos")
    .select("id, storage_path")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .lt("created_at", cutoff.toISOString());

  if (!expiredPhotos || expiredPhotos.length === 0) {
    return NextResponse.json({ cleaned: 0, message: "No expired photos found." });
  }

  // Soft-delete the DB records first so broken images can't appear
  const ids = expiredPhotos.map((p) => p.id);
  const { error: updateError } = await admin
    .from("skin_photos")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", ids);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to mark photos as deleted." },
      { status: 500 }
    );
  }

  // Then remove storage files (safe: DB already marks them deleted)
  const storagePaths = expiredPhotos.map((p) => p.storage_path);
  await admin.storage.from("selfies").remove(storagePaths);

  return NextResponse.json({
    cleaned: expiredPhotos.length,
    message: `${expiredPhotos.length} expired photo(s) cleaned up.`,
  });
}
