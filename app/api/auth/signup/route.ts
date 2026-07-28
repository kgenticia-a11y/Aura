import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";

const MIN_PASSWORD_LENGTH = 8;

function validatePassword(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[a-zA-Z]/.test(pw)) {
    return "Password must contain at least one letter.";
  }
  if (!/[0-9]/.test(pw)) {
    return "Password must contain at least one number.";
  }
  return null;
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, password, full_name } = rawBody as {
    email?: string;
    password?: string;
    full_name?: string;
  };

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const normEmail = email.toLowerCase().trim();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const pwError = validatePassword(password);
  if (pwError) {
    return NextResponse.json({ error: pwError }, { status: 400 });
  }

  const { ok } = await rateLimit(`signup:${ip}:${normEmail}`, 3, 300_000);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many signup attempts. Please wait a few minutes." },
      { status: 429 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

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

  const { data, error } = await supabase.auth.signUp({
    email: normEmail,
    password,
    options: {
      data: { full_name: full_name?.trim() || "" },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: "Could not create account. Please try again." },
      { status: 400 }
    );
  }

  if (data.user) {
    await supabase
      .from("profiles")
      .update({ privacy_accepted_at: new Date().toISOString() })
      .eq("id", data.user.id);
  }

  return NextResponse.json({ ok: true });
}
