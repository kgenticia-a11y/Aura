import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/log-error";
import {
  buildRemediationPlan,
  type CatalogProduct,
  type AnalysisConcern,
} from "@/lib/remediation";

// F1 + F2 — returns a named-condition + ingredient-informed remediation plan
// for a given analysis. All logic is deterministic (no LLM): the condition
// library frames each concern, and catalog products are matched by active
// overlap. This is cosmetic guidance, not medical advice.
export async function GET(request: NextRequest) {
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ok } = await rateLimit(`remediation:${user.id}`, 30, 60_000);
    if (!ok) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute." },
        { status: 429 }
      );
    }

    const analysisId = new URL(request.url).searchParams.get("analysis_id");
    if (!analysisId) {
      return NextResponse.json(
        { error: "Missing analysis_id" },
        { status: 400 }
      );
    }

    // Load the analysis (RLS ensures it belongs to the user).
    const { data: analysis } = await supabase
      .from("skin_analyses")
      .select("id, concerns, skin_type")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    const concerns = (Array.isArray(analysis.concerns)
      ? analysis.concerns
      : []) as AnalysisConcern[];

    if (concerns.length === 0) {
      return NextResponse.json({ plan: [], skin_type: analysis.skin_type });
    }

    // Pull the catalog once; matching happens in-process.
    const { data: products } = await supabase
      .from("products")
      .select(
        "id, name, brand, category, key_ingredients, skin_types, price_tier, image_url, purchase_url, description"
      );

    const plan = buildRemediationPlan(
      concerns,
      analysis.skin_type ?? null,
      (products ?? []) as CatalogProduct[]
    );

    return NextResponse.json({ plan, skin_type: analysis.skin_type });
  } catch (err) {
    console.error("Remediation error:", err);
    await logError({
      errorType: "remediation_route_error",
      message: err instanceof Error ? err.message : String(err),
      endpoint: "/api/remediation",
      stackTrace: err instanceof Error ? err.stack : null,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
