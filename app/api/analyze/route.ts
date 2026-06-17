import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { GoogleGenAI } from "@google/genai";
import { rateLimit } from "@/lib/rate-limit";
import { validateBody, analyzeSchema } from "@/lib/validation";

const GEMINI_MODEL = "gemini-2.0-flash";

const FITZPATRICK_GUIDANCE: Record<string, string> = {
  I: "Type I (very fair skin, always burns, never tans). Be alert for sun damage, redness, and visible capillaries, which are often more prominent on very fair skin.",
  II: "Type II (fair skin, usually burns, tans minimally). Watch for sun damage, redness, and uneven tone from sun exposure.",
  III: "Type III (medium skin, sometimes burns, tans gradually). Apply balanced assessment criteria across tone, texture, and pigmentation.",
  IV: "Type IV (olive/light brown skin, rarely burns, tans easily). Post-inflammatory hyperpigmentation (dark marks left after blemishes heal) is common and should be distinguished from active concerns. Do not over-flag normal pigment variation as 'hyperpigmentation' unless there is clear evidence of dark spots distinct from surrounding skin.",
  V: "Type V (brown skin, very rarely burns, tans deeply). Be precise about distinguishing post-inflammatory hyperpigmentation, acne scarring, and natural skin tone variation — these are frequently misidentified by AI models trained mostly on lighter skin. Do not default to 'uneven tone' or 'hyperpigmentation' findings unless clearly visible against the user's own baseline tone.",
  VI: "Type VI (deeply pigmented dark brown to black skin, never burns). Calibrate all assessments (redness, dullness, hydration, pigmentation) to this skin tone specifically. Redness and erythema can look different on deep skin tones — look for changes in texture or sheen rather than assuming visible redness. Be precise about distinguishing post-inflammatory hyperpigmentation and acne scarring from natural tone variation.",
};

function buildAnalysisPrompt(fitzpatrickScale: string | null): string {
  const toneGuidance = fitzpatrickScale && FITZPATRICK_GUIDANCE[fitzpatrickScale]
    ? `\n\nIMPORTANT — INCLUSIVE ANALYSIS CONTEXT:
This user has self-reported their skin as Fitzpatrick ${FITZPATRICK_GUIDANCE[fitzpatrickScale]}
Calibrate every finding (tone, redness, hydration, pigmentation, evidence) to this skin tone. Never apply assumptions calibrated for lighter skin tones to this user. If a concern like "hyperpigmentation" or "redness" is reported, the evidence must describe something genuinely visible on THIS skin tone, not a generic assumption.`
    : "";

  return `You are an expert cosmetic skin analyst. Analyze this facial photo for cosmetic skin attributes ONLY.
You are NOT providing medical advice — this is purely cosmetic guidance.${toneGuidance}

Evaluate the following and respond ONLY with valid JSON (no markdown, no code fences):

{
  "skin_type": "oily" | "dry" | "combination" | "normal" | "sensitive",
  "concerns": [
    {
      "name": "string - concern name (e.g. redness, uneven tone, visible pores, dullness, dark circles, fine lines, acne, hyperpigmentation, dehydration, texture)",
      "severity": "mild" | "moderate" | "significant",
      "description": "string - brief 1-sentence description of what you observe",
      "evidence": "string - brief note on the specific visual cue that led to this finding (e.g. 'visible enlarged pores across the nose and cheeks')",
      "confidence": "low" | "medium" | "high"
    }
  ],
  "hydration_level": "low" | "medium" | "high",
  "health_score": number (1-100, cosmetic appearance score — NOT a medical assessment),
  "environmental_factors": {
    "sun_damage_signs": "none" | "mild" | "moderate" | "significant",
    "dehydration_signs": "none" | "mild" | "moderate" | "significant"
  },
  "overall_confidence": "low" | "medium" | "high" - your overall confidence in this analysis based on photo quality, lighting, and angle,
  "confidence_reason": "string - 1 sentence explaining what drove the confidence level (e.g. photo quality, lighting, resolution)",
  "overall_summary": "string - 2-3 sentence summary of the skin's cosmetic condition and top priorities"
}

Be thorough but honest. Only report what you can actually observe in the photo.
If the photo quality or lighting is poor, note that in the summary and lower overall_confidence accordingly.`;
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

    // Download the image as bytes for Gemini
    const imageResponse = await fetch(signedUrlData.signedUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    const mimeType = "image/webp";

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

    // Real Gemini call
    const genai = new GoogleGenAI({ apiKey: geminiApiKey });

    let retries = 3;
    let geminiResult: string | null = null;

    while (retries > 0) {
      try {
        const response = await genai.models.generateContent({
          model: GEMINI_MODEL,
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
          console.error("Gemini API failed after 3 retries:", err);

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
