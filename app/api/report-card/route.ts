import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(request: Request) {
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

  const { ok } = await rateLimit(`report-card:${user.id}`, 10, 60_000);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const analysisId = searchParams.get("id");

  if (!analysisId) {
    return NextResponse.json({ error: "Missing analysis id" }, { status: 400 });
  }

  const { data: analysis } = await supabase
    .from("skin_analyses")
    .select("id, skin_type, concerns, hydration_level, health_score, environmental_factors, raw_response, created_at")
    .eq("id", analysisId)
    .eq("user_id", user.id)
    .single();

  if (!analysis) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const firstName = escapeXml(profile?.full_name?.split(" ")[0] || "Aura User");
  const date = new Date(analysis.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const concerns = (analysis.concerns as { name: string; severity: string }[]) || [];
  const topConcerns = concerns.slice(0, 3);
  const score = analysis.health_score;
  const scoreColor = score > 70 ? "#4ade80" : score > 40 ? "#D4AF37" : "#ef4444";
  const raw = analysis.raw_response as Record<string, unknown>;
  const summaryRaw = (raw?.overall_summary as string) || "";
  const summary = escapeXml(summaryRaw.length > 80 ? summaryRaw.slice(0, 80) + "..." : summaryRaw);
  const skinType = escapeXml(analysis.skin_type as string);
  const hydration = escapeXml(analysis.hydration_level as string);

  const severityColor = (s: string) =>
    s === "significant" ? "#ef4444" : s === "moderate" ? "#f59e0b" : "#4ade80";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#D4AF37"/>
      <stop offset="100%" stop-color="#E8C547"/>
    </linearGradient>
  </defs>
  <rect width="600" height="400" rx="20" fill="url(#bg)"/>
  <rect x="0" y="0" width="600" height="4" rx="2" fill="url(#gold)"/>

  <!-- Header -->
  <text x="30" y="40" font-family="system-ui, sans-serif" font-size="14" fill="#D4AF37" font-weight="600">AURA</text>
  <text x="30" y="60" font-family="system-ui, sans-serif" font-size="12" fill="#8888aa">Skin Report Card</text>
  <text x="570" y="40" font-family="system-ui, sans-serif" font-size="11" fill="#8888aa" text-anchor="end">${date}</text>
  <text x="570" y="60" font-family="system-ui, sans-serif" font-size="11" fill="#8888aa" text-anchor="end">${firstName}</text>

  <!-- Score Circle -->
  <circle cx="90" cy="140" r="50" fill="none" stroke="#333355" stroke-width="6"/>
  <circle cx="90" cy="140" r="50" fill="none" stroke="${scoreColor}" stroke-width="6"
    stroke-dasharray="${(score / 100) * 314} 314" stroke-linecap="round"
    transform="rotate(-90 90 140)"/>
  <text x="90" y="135" font-family="system-ui, sans-serif" font-size="28" fill="white" text-anchor="middle" font-weight="700">${score}</text>
  <text x="90" y="155" font-family="system-ui, sans-serif" font-size="10" fill="#8888aa" text-anchor="middle">Health Score</text>

  <!-- Skin Info -->
  <text x="170" y="110" font-family="system-ui, sans-serif" font-size="11" fill="#8888aa">Skin Type</text>
  <text x="170" y="130" font-family="system-ui, sans-serif" font-size="16" fill="white" font-weight="600" text-transform="capitalize">${skinType}</text>
  <text x="170" y="155" font-family="system-ui, sans-serif" font-size="11" fill="#8888aa">Hydration</text>
  <text x="170" y="175" font-family="system-ui, sans-serif" font-size="16" fill="white" font-weight="600" text-transform="capitalize">${hydration}</text>

  <!-- Divider -->
  <line x1="30" y1="205" x2="570" y2="205" stroke="#333355" stroke-width="1"/>

  <!-- Concerns -->
  <text x="30" y="230" font-family="system-ui, sans-serif" font-size="12" fill="#D4AF37" font-weight="600">TOP CONCERNS</text>
  ${topConcerns
    .map(
      (c, i) =>
        `<circle cx="42" cy="${255 + i * 28}" r="4" fill="${severityColor(c.severity)}"/>
    <text x="54" y="${259 + i * 28}" font-family="system-ui, sans-serif" font-size="13" fill="white">${escapeXml(c.name)}</text>
    <text x="570" y="${259 + i * 28}" font-family="system-ui, sans-serif" font-size="11" fill="#8888aa" text-anchor="end">${escapeXml(c.severity)}</text>`
    )
    .join("\n  ")}

  ${
    summary
      ? `<!-- Summary -->
  <line x1="30" y1="340" x2="570" y2="340" stroke="#333355" stroke-width="1"/>
  <text x="30" y="362" font-family="system-ui, sans-serif" font-size="10" fill="#8888aa">
    <tspan x="30">${summary}</tspan>
  </text>`
      : ""
  }

  <!-- Footer -->
  <text x="300" y="390" font-family="system-ui, sans-serif" font-size="10" fill="#555577" text-anchor="middle">aura-roan-theta.vercel.app</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
