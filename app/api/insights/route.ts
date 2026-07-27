import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { GoogleGenAI } from "@google/genai";
import { rateLimit } from "@/lib/rate-limit";

const GEMINI_MODEL = "gemini-2.5-flash";

export async function GET() {
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

    const { ok } = await rateLimit(`insights:${user.id}`, 15, 60_000);
    if (!ok) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute." },
        { status: 429 }
      );
    }

    const { data: analyses } = await supabase
      .from("skin_analyses")
      .select("id, health_score, skin_type, hydration_level, concerns, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!analyses || analyses.length === 0) {
      return NextResponse.json({
        narrative: "Take your first selfie to start your skin journey.",
        trend: "none",
      });
    }

    if (analyses.length === 1) {
      return NextResponse.json({
        narrative:
          "Welcome to your skin journey! After a few more analyses, we'll begin tracking trends and providing personalized insights.",
        trend: "baseline",
        latest_score: analyses[0].health_score,
      });
    }

    const latest = analyses[0];
    const oldest = analyses[analyses.length - 1];
    const scoreDiff = latest.health_score - oldest.health_score;
    const trend = scoreDiff > 5 ? "improving" : scoreDiff < -5 ? "declining" : "stable";

    // Check cache — skip Gemini if latest analysis hasn't changed
    const { data: cached } = await supabase
      .from("cached_insights")
      .select("payload, latest_analysis_id, analysis_count")
      .eq("user_id", user.id)
      .single();

    if (
      cached &&
      cached.latest_analysis_id === latest.id &&
      cached.analysis_count === analyses.length
    ) {
      return NextResponse.json({
        ...(cached.payload as Record<string, unknown>),
        trend,
        latest_score: latest.health_score,
        previous_score: oldest.health_score,
        score_change: scoreDiff,
        cached: true,
      });
    }

    const { data: feedback } = await supabase
      .from("routine_feedback")
      .select("overall_rating, skin_feel, what_improved")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3);

    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey || geminiApiKey === "your-gemini-api-key-here") {
      const fallback =
        trend === "improving"
          ? `Your skin is improving! Your health score has risen by ${scoreDiff} points over your last ${analyses.length} analyses. Keep up the routine — it's working.`
          : trend === "declining"
          ? `Your skin score has dipped ${Math.abs(scoreDiff)} points recently. Consider reviewing your routine, hydration levels, and environmental factors.`
          : `Your skin has been stable across recent analyses with a score around ${latest.health_score}. Consistency is key to long-term skin health.`;

      return NextResponse.json({
        narrative: fallback,
        trend,
        latest_score: latest.health_score,
        previous_score: oldest.health_score,
        score_change: scoreDiff,
      });
    }

    const genai = new GoogleGenAI({ apiKey: geminiApiKey });

    const prompt = `You are a luxury skincare advisor writing a personalized "Your skin this month" narrative for the user.

ANALYSES (most recent first):
${analyses
  .map(
    (a, i) =>
      `${i === 0 ? "Latest" : `${i + 1} analyses ago`}: Score ${a.health_score}/100, ${a.skin_type} skin, ${a.hydration_level} hydration, concerns: ${JSON.stringify(a.concerns)}, date: ${new Date(a.created_at).toLocaleDateString()}`
  )
  .join("\n")}

RECENT FEEDBACK:
${
  feedback && feedback.length > 0
    ? feedback
        .map(
          (f) =>
            `Rating ${f.overall_rating}/5, felt: ${(f.skin_feel || []).join(", ")}, improved: ${f.what_improved || "N/A"}`
        )
        .join("\n")
    : "No feedback yet."
}

Write a warm, encouraging 2-3 sentence summary of the user's skin journey. Mention specific improvements or concerns. Use luxurious but accessible language. Do NOT use the word "diagnosed" or "medical".

Respond ONLY with valid JSON (no markdown):
{
  "narrative": "2-3 sentence summary",
  "key_observation": "single sentence highlighting most important pattern",
  "next_focus": "what to focus on next"
}`;

    try {
      const response = await genai.models.generateContent({
        model: GEMINI_MODEL,
        config: {
          // gemini-2.5-flash thinks by default, adding latency and token cost.
          // Insights only needs the narrative JSON, so disable thinking.
          thinkingConfig: { thinkingBudget: 0 },
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const text = response.text || "";
      const cleaned = text
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      // Cache the result
      await supabase.from("cached_insights").upsert(
        {
          user_id: user.id,
          payload: parsed,
          analysis_count: analyses.length,
          latest_analysis_id: latest.id,
        },
        { onConflict: "user_id" }
      );

      return NextResponse.json({
        ...parsed,
        trend,
        latest_score: latest.health_score,
        previous_score: oldest.health_score,
        score_change: scoreDiff,
      });
    } catch {
      return NextResponse.json({
        narrative: `Your skin score is ${latest.health_score} based on your latest analysis. ${trend === "improving" ? "You're trending up!" : trend === "declining" ? "Let's adjust your routine." : "Staying steady."}`,
        trend,
        latest_score: latest.health_score,
        score_change: scoreDiff,
      });
    }
  } catch (err) {
    console.error("Insights error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
