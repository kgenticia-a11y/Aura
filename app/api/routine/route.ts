import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { GoogleGenAI } from "@google/genai";
import { rateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/log-error";

const GEMINI_MODEL = "gemini-2.5-flash";

interface FeedbackHistory {
  overall_rating: number;
  skin_feel: string[];
  what_improved: string | null;
  what_worsened: string | null;
}

interface AnalysisHistory {
  health_score: number;
  skin_type: string;
  hydration_level: string;
  created_at: string;
}

function buildRoutinePrompt(
  analysis: Record<string, unknown>,
  skinProfile: Record<string, unknown> | null,
  pastFeedback?: FeedbackHistory[],
  pastAnalyses?: AnalysisHistory[]
) {
  const allergies =
    (skinProfile?.allergies as string[])?.join(", ") || "none reported";
  const goals =
    (skinProfile?.skin_goals as string[])?.join(", ") || "general skin health";
  const budget = (skinProfile?.budget_preference as string) || "mid-range";
  const lifestyle = skinProfile?.lifestyle as Record<string, string> | null;

  return `You are an expert skincare routine curator. Based on the skin analysis and user profile below, create a personalized AM and PM skincare routine.

SKIN ANALYSIS:
- Skin type: ${analysis.skin_type}
- Health score: ${analysis.health_score}/100
- Hydration level: ${analysis.hydration_level}
- Concerns: ${JSON.stringify(analysis.concerns)}
- Sun damage: ${(analysis.environmental_factors as Record<string, string>)?.sun_damage_signs || "unknown"}
- Dehydration: ${(analysis.environmental_factors as Record<string, string>)?.dehydration_signs || "unknown"}

USER PROFILE:
- Budget preference: ${budget}
- Skin goals: ${goals}
- Allergies/sensitivities: ${allergies}
- Sleep: ${lifestyle?.sleep || "unknown"}
- Water intake: ${lifestyle?.water || "unknown"}
- Sun exposure: ${lifestyle?.sunExposure || "unknown"}

PAST FEEDBACK (learn from this):
${
  pastFeedback && pastFeedback.length > 0
    ? pastFeedback
        .map(
          (f, i) =>
            `Routine ${i + 1}: Rating ${f.overall_rating}/5, Skin felt: ${(f.skin_feel || []).join(", ") || "N/A"}, Improved: ${f.what_improved || "N/A"}, Worsened: ${f.what_worsened || "N/A"}`
        )
        .join("\n")
    : "No previous feedback — this is the user's first routine."
}

SKIN TREND (last ${pastAnalyses?.length || 0} analyses):
${
  pastAnalyses && pastAnalyses.length > 1
    ? `Scores: ${pastAnalyses.map((a) => `${a.health_score} (${new Date(a.created_at).toLocaleDateString()})`).join(" → ")}
Trend: ${pastAnalyses[0].health_score > pastAnalyses[pastAnalyses.length - 1].health_score ? "Improving" : pastAnalyses[0].health_score === pastAnalyses[pastAnalyses.length - 1].health_score ? "Stable" : "Declining"}`
    : "Not enough data for trend analysis yet."
}

CURRENT MONTH: ${new Date().toLocaleDateString("en-US", { month: "long" })} (adjust for seasonal conditions)

RULES:
- AVOID any ingredients the user is allergic to
- If past feedback mentions irritation or worsening, AVOID those product types/ingredients
- If past feedback mentions improvements, lean into similar approaches
- Match product suggestions to the user's budget preference
- Order steps correctly (cleanser → toner → serum → treatment → moisturizer → SPF for AM)
- Keep it realistic: 4-6 steps max per routine
- Include one weekly treatment if applicable
- Consider seasonal factors (humidity, UV index, temperature)

Respond ONLY with valid JSON (no markdown, no code fences):

{
  "morning_steps": [
    {
      "order": 1,
      "category": "cleanser",
      "title": "Gentle Cleanse",
      "description": "Why this step matters for your skin",
      "key_ingredients": ["ingredient1", "ingredient2"],
      "avoid_ingredients": ["ingredient to avoid"],
      "application_tip": "How to apply"
    }
  ],
  "evening_steps": [
    {
      "order": 1,
      "category": "cleanser",
      "title": "Deep Cleanse",
      "description": "Why this step matters",
      "key_ingredients": ["ingredient1"],
      "avoid_ingredients": [],
      "application_tip": "How to apply"
    }
  ],
  "weekly": [
    {
      "category": "mask",
      "title": "Weekly Treatment",
      "description": "Why and when to use",
      "frequency": "1-2x per week",
      "key_ingredients": ["ingredient1"]
    }
  ]
}`;
}

export async function POST(request: NextRequest) {
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

    const { ok } = await rateLimit(`routine:${user.id}`, 10, 60_000);
    if (!ok) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute." },
        { status: 429 }
      );
    }

    // Get latest analysis
    const { data: analysis } = await supabase
      .from("skin_analyses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!analysis) {
      return NextResponse.json(
        { error: "No skin analysis found. Please take a selfie first." },
        { status: 400 }
      );
    }

    // Get skin profile
    const { data: skinProfile } = await supabase
      .from("skin_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Fetch past feedback for adaptive learning
    const { data: pastFeedback } = await supabase
      .from("routine_feedback")
      .select("overall_rating, skin_feel, what_improved, what_worsened")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    // Fetch last 3 analyses for trend detection
    const { data: pastAnalyses } = await supabase
      .from("skin_analyses")
      .select("health_score, skin_type, hydration_level, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3);

    // Deactivate previous routines
    await supabase
      .from("routines")
      .update({ active: false })
      .eq("user_id", user.id)
      .eq("active", true);

    const prompt = buildRoutinePrompt(
      analysis.raw_response as Record<string, unknown>,
      skinProfile as Record<string, unknown> | null,
      (pastFeedback as FeedbackHistory[]) || [],
      (pastAnalyses as AnalysisHistory[]) || []
    );

    let routineData;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey || geminiApiKey === "your-gemini-api-key-here") {
      // Mock routine for development
      routineData = {
        morning_steps: [
          {
            order: 1,
            category: "cleanser",
            title: "Gentle Cleanse",
            description:
              "Start with a gentle cleanser to remove overnight oils without stripping your skin barrier.",
            key_ingredients: ["ceramides", "glycerin"],
            avoid_ingredients: [],
            application_tip:
              "Massage onto damp skin for 30-60 seconds, rinse with lukewarm water.",
          },
          {
            order: 2,
            category: "serum",
            title: "Hydrating Serum",
            description:
              "Boost hydration with hyaluronic acid to plump skin and reduce the appearance of fine lines.",
            key_ingredients: ["hyaluronic acid", "vitamin B5"],
            avoid_ingredients: [],
            application_tip:
              "Apply 2-3 drops to slightly damp skin, pat gently.",
          },
          {
            order: 3,
            category: "moisturizer",
            title: "Lightweight Moisturizer",
            description:
              "Seal in hydration with a moisturizer suited to your combination skin.",
            key_ingredients: ["ceramides", "niacinamide"],
            avoid_ingredients: [],
            application_tip:
              "Apply a pea-sized amount, warm between fingers, press into skin.",
          },
          {
            order: 4,
            category: "sunscreen",
            title: "SPF Protection",
            description:
              "Essential daily protection against UV damage and premature aging.",
            key_ingredients: ["zinc oxide", "niacinamide"],
            avoid_ingredients: [],
            application_tip:
              "Apply generously 15 minutes before sun exposure. Reapply every 2 hours.",
          },
        ],
        evening_steps: [
          {
            order: 1,
            category: "cleanser",
            title: "Double Cleanse",
            description:
              "Remove sunscreen and daily buildup with a thorough evening cleanse.",
            key_ingredients: ["soy proteins", "rosewater"],
            avoid_ingredients: [],
            application_tip:
              "First pass removes surface debris, second pass cleanses skin.",
          },
          {
            order: 2,
            category: "serum",
            title: "Niacinamide Treatment",
            description:
              "Target uneven tone and visible pores with niacinamide.",
            key_ingredients: ["niacinamide", "zinc"],
            avoid_ingredients: [],
            application_tip:
              "Apply after cleansing while skin is slightly damp.",
          },
          {
            order: 3,
            category: "moisturizer",
            title: "Night Moisturizer",
            description:
              "Rich overnight moisture to support skin repair while you sleep.",
            key_ingredients: ["ceramides", "hyaluronic acid"],
            avoid_ingredients: [],
            application_tip:
              "Apply a generous layer as the last step of your routine.",
          },
        ],
        weekly: [
          {
            category: "exfoliant",
            title: "Gentle Exfoliation",
            description:
              "Chemical exfoliation to promote cell turnover and improve texture.",
            frequency: "2x per week",
            key_ingredients: ["salicylic acid"],
          },
        ],
      };
    } else {
      // Real Gemini call
      const genai = new GoogleGenAI({ apiKey: geminiApiKey });

      const response = await genai.models.generateContent({
        model: GEMINI_MODEL,
        config: {
          // gemini-2.5-flash thinks by default, adding latency and token cost.
          // Routine generation only needs the JSON output, so disable thinking.
          thinkingConfig: { thinkingBudget: 0 },
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const text = response.text || "";
      const cleaned = text
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      try {
        routineData = JSON.parse(cleaned);
      } catch {
        return NextResponse.json(
          { error: "AI returned invalid routine. Please try again." },
          { status: 500 }
        );
      }
    }

    // Save routine
    const { data: routine, error: insertError } = await supabase
      .from("routines")
      .insert({
        user_id: user.id,
        analysis_id: analysis.id,
        morning_steps: routineData.morning_steps,
        evening_steps: routineData.evening_steps,
        weekly: routineData.weekly,
        active: true,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save routine" },
        { status: 500 }
      );
    }

    // Match products to routine steps
    const { data: products } = await supabase.from("products").select("*");

    if (products && products.length > 0) {
      const matchedProducts: Array<{
        routine_id: string;
        product_id: string;
        step_type: string;
        step_index: number;
      }> = [];

      const matchStep = (
        step: { category: string; key_ingredients: string[] },
        stepType: string,
        stepIndex: number
      ) => {
        const budget = skinProfile?.budget_preference || "mid-range";
        const matches = products
          .filter((p) => {
            const categoryMatch =
              p.category === step.category ||
              (step.category === "exfoliant" && p.category === "serum");
            const budgetTiers: Record<string, string[]> = {
              drugstore: ["drugstore"],
              "mid-range": ["drugstore", "mid-range"],
              luxury: ["mid-range", "luxury"],
              "no-limit": ["drugstore", "mid-range", "luxury"],
            };
            const tierMatch = (budgetTiers[budget as string] || ["mid-range"]).includes(
              p.price_tier
            );
            return categoryMatch && tierMatch;
          })
          .slice(0, 2); // Max 2 product matches per step

        matches.forEach((p) => {
          matchedProducts.push({
            routine_id: routine.id,
            product_id: p.id,
            step_type: stepType,
            step_index: stepIndex,
          });
        });
      };

      routineData.morning_steps.forEach(
        (step: { category: string; key_ingredients: string[] }, i: number) =>
          matchStep(step, "morning", i)
      );
      routineData.evening_steps.forEach(
        (step: { category: string; key_ingredients: string[] }, i: number) =>
          matchStep(step, "evening", i)
      );
      routineData.weekly?.forEach(
        (step: { category: string; key_ingredients: string[] }, i: number) =>
          matchStep(step, "weekly", i)
      );

      if (matchedProducts.length > 0) {
        await supabase.from("routine_products").insert(matchedProducts);
      }
    }

    return NextResponse.json({
      routine_id: routine.id,
      ...routineData,
    });
  } catch (err) {
    console.error("Routine error:", err);
    await logError({
      errorType: "routine_route_error",
      message: err instanceof Error ? err.message : String(err),
      endpoint: "/api/routine",
      stackTrace: err instanceof Error ? err.stack : null,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
