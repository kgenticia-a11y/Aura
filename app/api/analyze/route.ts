import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { GoogleGenAI } from "@google/genai";
import { rateLimit } from "@/lib/rate-limit";
import { validateBody, analyzeSchema } from "@/lib/validation";

const GEMINI_MODEL = "gemini-2.0-flash-lite";

const FITZPATRICK_TONE: Record<string, string> = {
  I: "Very fair, always burns. Watch for sun damage, redness, visible capillaries.",
  II: "Fair, usually burns. Watch for sun damage, uneven tone.",
  III: "Medium, sometimes burns. Balanced assessment across tone/texture.",
  IV: "Olive/light brown, rarely burns. Distinguish PIH from normal pigment variation.",
  V: "Brown, very rarely burns. Distinguish PIH/scarring from natural tone — don't default to 'uneven tone'.",
  VI: "Deep brown-black, never burns. Assess redness via texture/sheen, not color. Distinguish PIH from natural tone.",
};

function buildAnalysisPrompt(fitzpatrickScale: string | null): string {
  const tone = fitzpatrickScale && FITZPATRICK_TONE[fitzpatrickScale]
    ? `\nUser skin: Fitzpatrick ${fitzpatrickScale} — ${FITZPATRICK_TONE[fitzpatrickScale]} Calibrate all findings to this tone.`
    : "";

  return `Cosmetic skin analyst. Analyze this face photo. NOT medical advice.${tone}
Reply with ONLY valid JSON, no markdown:
{"skin_type":"oily|dry|combination|normal|sensitive","concerns":[{"name":"str","severity":"mild|moderate|significant","description":"1 sentence","evidence":"visual cue","confidence":"low|medium|high"}],"hydration_level":"low|medium|high","health_score":1-100,"environmental_factors":{"sun_damage_signs":"none|mild|moderate|significant","dehydration_signs":"none|mild|moderate|significant"},"overall_confidence":"low|medium|high","confidence_reason":"1 sentence","overall_summary":"2 sentences max"}
Max 3 concerns. Keep descriptions under 15 words each. Only report what is visible.`;
}


export async function POST(request: NextRequest) {
  try {
    // Verify auth
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

    const { ok } = rateLimit(`analyze:${user.id}`, 10, 60_000);
    if (!ok) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute." },
        { status: 429 }
      );
    }

    // Parse and validate request
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { data: validatedBody, error: validationError } = validateBody(rawBody, analyzeSchema);
    if (validationError) return validationError;

    const { photo_id } = validatedBody;

    // Verify photo belongs to user
    const { data: photo, error: photoError } = await supabase
      .from("skin_photos")
      .select("id, storage_path, user_id")
      .eq("id", photo_id)
      .eq("user_id", user.id)
      .single();

    if (photoError || !photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Rate limiting check: max 5 analyses per user per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("skin_analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", today.toISOString());

    if (count && count >= 5) {
      return NextResponse.json(
        { error: "Daily analysis limit reached (5/day). Try again tomorrow." },
        { status: 429 }
      );
    }

    // Fetch user's Fitzpatrick skin tone for inclusive, tone-aware analysis
    const { data: skinProfile } = await supabase
      .from("skin_profiles")
      .select("fitzpatrick_scale")
      .eq("user_id", user.id)
      .single();

    const analysisPrompt = buildAnalysisPrompt(skinProfile?.fitzpatrick_scale ?? null);

    // Get signed URL for the photo
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from("selfies")
      .createSignedUrl(photo.storage_path, 3600); // 1 hour expiry

    if (signedError || !signedUrlData) {
      return NextResponse.json(
        { error: "Failed to access photo" },
        { status: 500 }
      );
    }

    const imageResponse = await fetch(signedUrlData.signedUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    const contentType = imageResponse.headers.get("content-type") || "image/webp";
    const mimeType = contentType.startsWith("image/") ? contentType : "image/webp";

    // Call Gemini Vision API
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey || geminiApiKey === "your-gemini-api-key-here") {
      // Fallback: return a mock analysis for development
      const mockAnalysis = {
        skin_type: "combination",
        concerns: [
          {
            name: "Uneven tone",
            severity: "mild",
            description: "Slight variation in skin tone across the cheeks and forehead.",
            evidence: "Subtle tonal contrast visible between cheeks and forehead under current lighting.",
            confidence: "medium",
          },
          {
            name: "Visible pores",
            severity: "mild",
            description: "Moderately visible pores in the T-zone area.",
            evidence: "Enlarged pore texture visible across the nose and forehead.",
            confidence: "high",
          },
        ],
        hydration_level: "medium",
        health_score: 75,
        environmental_factors: {
          sun_damage_signs: "none",
          dehydration_signs: "mild",
        },
        overall_confidence: "medium",
        confidence_reason: "Lighting and resolution were adequate but not ideal for fine detail.",
        overall_summary:
          "Our AI analysis is warming up — this is a sample result while we finish setup. Your photo was saved and you'll be able to run a real analysis shortly. Thank you for your patience!",
      };

      const { data: analysis, error: insertError } = await supabase
        .from("skin_analyses")
        .insert({
          user_id: user.id,
          photo_id: photo.id,
          skin_type: mockAnalysis.skin_type,
          concerns: mockAnalysis.concerns,
          hydration_level: mockAnalysis.hydration_level,
          health_score: mockAnalysis.health_score,
          environmental_factors: mockAnalysis.environmental_factors,
          raw_response: mockAnalysis,
          model_version: "preview",
        })
        .select("id")
        .single();

      if (insertError) {
        return NextResponse.json(
          { error: "Failed to save analysis" },
          { status: 500 }
        );
      }

      // Mark photo as analyzed
      await supabase
        .from("skin_photos")
        .update({ analyzed: true })
        .eq("id", photo.id);

      return NextResponse.json({
        analysis_id: analysis.id,
        ...mockAnalysis,
        model: "mock-dev",
      });
    }

    // Real Gemini call — capped output to minimize token spend
    const genai = new GoogleGenAI({ apiKey: geminiApiKey });

    let retries = 2;
    let geminiResult: string | null = null;

    while (retries > 0) {
      try {
        const response = await genai.models.generateContent({
          model: GEMINI_MODEL,
          config: {
            maxOutputTokens: 600,
            temperature: 0.3,
          },
          contents: [
            {
              role: "user",
              parts: [
                { text: analysisPrompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
        });

        geminiResult = response.text ?? null;
        break;
      } catch (err) {
        retries--;
        if (retries === 0) {
          console.error("Gemini API failed after 2 retries:", err);

          // Check for cached analysis
          const { data: lastAnalysis } = await supabase
            .from("skin_analyses")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (lastAnalysis) {
            return NextResponse.json({
              analysis_id: lastAnalysis.id,
              skin_type: lastAnalysis.skin_type,
              concerns: lastAnalysis.concerns,
              hydration_level: lastAnalysis.hydration_level,
              health_score: lastAnalysis.health_score,
              environmental_factors: lastAnalysis.environmental_factors,
              overall_summary:
                "AI analysis temporarily unavailable. Showing your most recent results.",
              cached: true,
              model: lastAnalysis.model_version,
            });
          }

          return NextResponse.json(
            {
              error:
                "AI analysis is temporarily unavailable — our team has been notified and is on it. Your photo was saved, so please try again in a little while.",
            },
            { status: 503 }
          );
        }
        // Exponential backoff
        await new Promise((r) => setTimeout(r, 1000 * (4 - retries)));
      }
    }

    if (!geminiResult) {
      return NextResponse.json(
        { error: "Failed to get AI response" },
        { status: 500 }
      );
    }

    // Parse Gemini response — strip any markdown fences
    let parsed;
    try {
      const cleaned = geminiResult
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse Gemini response:", geminiResult);
      return NextResponse.json(
        { error: "AI returned invalid response. Please try again." },
        { status: 500 }
      );
    }

    // Save analysis
    const { data: analysis, error: insertError } = await supabase
      .from("skin_analyses")
      .insert({
        user_id: user.id,
        photo_id: photo.id,
        skin_type: parsed.skin_type,
        concerns: parsed.concerns,
        hydration_level: parsed.hydration_level,
        health_score: parsed.health_score,
        environmental_factors: parsed.environmental_factors,
        raw_response: parsed,
        model_version: GEMINI_MODEL,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save analysis" },
        { status: 500 }
      );
    }

    // Mark photo as analyzed
    await supabase
      .from("skin_photos")
      .update({ analyzed: true })
      .eq("id", photo.id);

    return NextResponse.json({
      analysis_id: analysis.id,
      ...parsed,
      model: GEMINI_MODEL,
    });
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
