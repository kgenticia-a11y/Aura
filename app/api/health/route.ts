import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET() {
  const status: Record<string, string> = {
    app: "healthy",
    supabase: "unknown",
    gemini: "unknown",
  };

  // Check Supabase
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

    const { error } = await supabase.from("profiles").select("id").limit(1);
    status.supabase = error ? "degraded" : "healthy";
  } catch {
    status.supabase = "down";
  }

  // Check Gemini API key exists
  const geminiKey = process.env.GEMINI_API_KEY;
  status.gemini =
    geminiKey && geminiKey !== "your-gemini-api-key-here"
      ? "configured"
      : "not-configured";

  const allHealthy = Object.values(status).every(
    (s) => s === "healthy" || s === "configured"
  );

  return NextResponse.json(
    { status, overall: allHealthy ? "healthy" : "degraded" },
    { status: allHealthy ? 200 : 503 }
  );
}
