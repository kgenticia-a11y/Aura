import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";
import { rateLimit } from "@/lib/rate-limit";
import { validateBody, chatSchema } from "@/lib/validation";
import { logError } from "@/lib/log-error";
import { getPremiumStatus } from "@/lib/premium";

const GEMINI_MODEL = "gemini-2.5-flash";

function buildChatPrompt(analysis: Record<string, unknown>): string {
  return `You are a friendly, knowledgeable skincare advisor for Aura, a luxury AI skincare app. You are answering follow-up questions about a user's skin analysis. NOT medical advice — cosmetic guidance only.

ANALYSIS CONTEXT:
- Skin type: ${analysis.skin_type}
- Health score: ${analysis.health_score}/100
- Hydration: ${analysis.hydration_level}
- Concerns: ${JSON.stringify(analysis.concerns)}
- Skin age: ${analysis.skin_age ?? "not assessed"}
- Attributes: ${JSON.stringify(analysis.attributes ?? {})}
- Environmental factors: ${JSON.stringify(analysis.environmental_factors ?? {})}

RULES:
- Answer ONLY about skincare, this analysis, and related cosmetic topics.
- Keep responses under 150 words, warm but concise.
- Never claim to diagnose or treat medical conditions.
- If asked about something outside skincare, politely redirect.
- Reference specific findings from the analysis when relevant.
- Suggest actionable next steps when appropriate (ingredients to look for, habits to change).
- Do NOT repeat the full analysis — the user can already see it.`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit, premium check, and body parse are independent — run in parallel.
    const [{ ok }, { isPremium }, rawBodyResult] = await Promise.all([
      rateLimit(`chat:${user.id}`, 20, 60_000),
      getPremiumStatus(supabase, user.id),
      request.json().catch(() => null as unknown),
    ]);

    if (!ok) {
      return NextResponse.json(
        { error: "Too many messages. Please wait a moment." },
        { status: 429 }
      );
    }
    if (!isPremium) {
      return NextResponse.json(
        {
          error:
            "The follow-up assistant is a Premium feature. Upgrade your plan to ask questions about your analysis.",
          upgrade: true,
        },
        { status: 403 }
      );
    }
    if (rawBodyResult === null) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const rawBody: unknown = rawBodyResult;

    const { data: body, error: validationError } = validateBody(
      rawBody,
      chatSchema
    );
    if (validationError) return validationError;

    const { data: analysis } = await supabase
      .from("skin_analyses")
      .select(
        "skin_type, health_score, hydration_level, concerns, skin_age, attributes, environmental_factors"
      )
      .eq("id", body.analysis_id)
      .eq("user_id", user.id)
      .single();

    if (!analysis) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 }
      );
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey || geminiApiKey === "your-gemini-api-key-here") {
      return NextResponse.json({
        reply:
          "The chat assistant is warming up — this is a placeholder while we finish setup. Try asking about your skin type, concerns, or what ingredients to look for!",
        model: "mock-dev",
      });
    }

    const genai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: { timeout: 20_000 },
    });
    const systemPrompt = buildChatPrompt(
      analysis as unknown as Record<string, unknown>
    );

    let reply: string | null = null;
    let retries = 2;

    while (retries > 0) {
      try {
        const response = await genai.models.generateContent({
          model: GEMINI_MODEL,
          config: {
            maxOutputTokens: 300,
            temperature: 0.5,
            thinkingConfig: { thinkingBudget: 0 },
          },
          contents: [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "I'm ready to answer questions about your skin analysis. What would you like to know?" }] },
            { role: "user", parts: [{ text: body.message }] },
          ],
        });
        reply = response.text?.trim() || null;
        break;
      } catch (err) {
        retries--;
        if (retries === 0) {
          console.error("Gemini chat failed after 2 retries:", err);
          return NextResponse.json(
            { error: "The assistant is temporarily unavailable. Please try again in a moment." },
            { status: 503 }
          );
        }
        await new Promise((r) => setTimeout(r, 1000 * (3 - retries)));
      }
    }

    if (!reply) {
      reply = "I wasn't able to generate a response. Please try rephrasing your question.";
    }

    return NextResponse.json({ reply, model: GEMINI_MODEL });
  } catch (err) {
    console.error("Chat error:", err);
    await logError({
      errorType: "chat_route_error",
      message: err instanceof Error ? err.message : String(err),
      endpoint: "/api/chat",
      stackTrace: err instanceof Error ? err.stack : null,
    });
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
