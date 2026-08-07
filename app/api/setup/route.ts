import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// One-time setup route to create missing tables
// This uses the anon key so it can only create tables via RPC
// For production, use Supabase Dashboard SQL Editor instead
export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    // Require authentication — this route probes the schema and should not be
    // callable anonymously.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if table already exists by trying to query it
    const { error } = await supabase
      .from("routine_step_completions")
      .select("id")
      .limit(1);

    if (!error) {
      return NextResponse.json({ message: "Table already exists" });
    }

    // Table doesn't exist - user needs to create it via Supabase Dashboard
    return NextResponse.json({
      message: "Table routine_step_completions needs to be created. Run the SQL from supabase/migrations/20260613_routine_step_tracking.sql in the Supabase SQL Editor.",
      sql_file: "supabase/migrations/20260613_routine_step_tracking.sql",
    });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
