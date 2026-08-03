import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { rateLimit } from "@/lib/rate-limit";
import { validateBody, analyzeSchema } from "@/lib/validation";
import { logError } from "@/lib/log-error";
import { getPremiumStatus, FREE_LIMITS, PREMIUM_LIMITS } from "@/lib/premium";

const MIN_DIMENSION = 200;
const MAX_DIMENSION = 8000;

const GEMINI_MODEL = "gemini-2.5-flash";

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
{"is_face":true,"skin_type":"oily|dry|combination|normal|sensitive","concerns":[{"name":"str","severity":"mild|moderate|significant","description":"1 sentence","evidence":"visual cue","confidence":"low|medium|high"}],"hydration_level":"low|medium|high","health_score":1-100,"skin_age":estimated cosmetic age 10-100,"attributes":{"pores":0-100,"firmness":0-100,"radiance":0-100,"evenness":0-100},"environmental_factors":{"sun_damage_signs":"none|mild|moderate|significant","dehydration_signs":"none|mild|moderate|significant"},"overall_confidence":"low|medium|high","confidence_reason":"1 sentence","overall_summary":"2 sentences max"}
skin_age is a COSMETIC estimate from visible skin condition only, never biological/medical age. attributes are 0-100 where higher is better (100 = refined pores, firm, radiant, even tone). Set is_face to false if the image does not show a human face — return only {"is_face":false}. Max 3 concerns. Keep descriptions under 15 words each. Only report what is visible.`;
}


// Clamp the model's skin-age estimate into the DB-allowed cosmetic range
// (10–100), returning null for anything missing or non-numeric so we never
// violate the skin_analyses_skin_age_range check constraint.
function sanitizeSkinAge(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 10 || rounded > 100) return null;
  return rounded;
}

const ATTRIBUTE_KEYS = ["pores", "firmness", "radiance", "evenness"] as const;

// Keep only the known 0–100 attribute scores; drop the object entirely if none
// are valid.
function sanitizeAttributes(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object") return null;
  const src = value as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const key of ATTRIBUTE_KEYS) {
    const n = typeof src[key] === "number" ? (src[key] as number) : Number(src[key]);
    if (Number.isFinite(n)) {
      out[key] = Math.min(100, Math.max(0, Math.round(n)));
    }
  }
  return Object.keys(out).length > 0 ? out : null;
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

    const { ok } = await rateLimit(`analyze:${user.id}`, 10, 60_000);
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

    // Run independent DB lookups and the signed-URL fetch in parallel so the
    // total pre-Gemini latency is one round-trip instead of four.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [premiumResult, countResult, profileResult, signedUrlResult] =
      await Promise.all([
        getPremiumStatus(supabase, user.id),
        supabase
          .from("skin_analyses")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", today.toISOString()),
        supabase
          .from("skin_profiles")
          .select("fitzpatrick_scale")
          .eq("user_id", user.id)
          .single(),
        supabase.storage
          .from("selfies")
          .createSignedUrl(photo.storage_path, 3600),
      ]);

    // Tier-aware daily limit
    const { isPremium } = premiumResult;
    const dailyLimit = isPremium ? PREMIUM_LIMITS.analysesPerDay : FREE_LIMITS.analysesPerDay;
    const { count } = countResult;

    if (count && count >= dailyLimit) {
      const msg = isPremium
        ? `Daily analysis limit reached (${dailyLimit}/day). Try again tomorrow.`
        : `Free plan limit reached (${dailyLimit}/day). Upgrade to Premium for more analyses.`;
      return NextResponse.json({ error: msg, upgrade: !isPremium }, { status: 429 });
    }

    const analysisPrompt = buildAnalysisPrompt(profileResult.data?.fitzpatrick_scale ?? null);

    const { data: signedUrlData, error: signedError } = signedUrlResult;

    if (signedError || !signedUrlData) {
      return NextResponse.json(
        { error: "Failed to access photo" },
        { status: 500 }
      );
    }

    const imageResponse = await fetch(signedUrlData.signedUrl);
    if (!imageResponse.ok) {
      console.error(
        "Failed to fetch signed photo URL:",
        imageResponse.status,
        imageResponse.statusText
      );
      return NextResponse.json(
        { error: "Failed to access photo" },
        { status: 502 }
      );
    }
    const imageBuffer = await imageResponse.arrayBuffer();

    // Quality gate: validate the image before spending a Gemini call.
    try {
      const meta = await sharp(Buffer.from(imageBuffer)).metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      if (w < MIN_DIMENSION || h < MIN_DIMENSION) {
        return NextResponse.json(
          { error: `Photo is too small (${w}x${h}). Please use at least ${MIN_DIMENSION}x${MIN_DIMENSION} pixels.` },
          { status: 422 }
        );
      }
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        return NextResponse.json(
          { error: "Photo dimensions are too large. Please use a standard selfie." },
          { status: 422 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "The uploaded file doesn't appear to be a valid image." },
        { status: 422 }
      );
    }

    const base64Image = Buffer.from(imageBuffer).toString("base64");
    // Strip any Content-Type parameters (e.g. "image/jpeg; charset=binary") —
    // Gemini's inlineData.mimeType expects a bare type/subtype.
    const rawContentType =
      imageResponse.headers.get("content-type")?.split(";")[0].trim() || "image/webp";
    const mimeType = rawContentType.startsWith("image/") ? rawContentType : "image/webp";

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
        skin_age: 29,
        attributes: {
          pores: 68,
          firmness: 74,
          radiance: 70,
          evenness: 66,
        },
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
          skin_age: mockAnalysis.skin_age,
          attributes: mockAnalysis.attributes,
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
    const genai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: { timeout: 30_000 },
    });

    let retries = 2;
    let geminiResult: string | null = null;

    while (retries > 0) {
      try {
        const response = await genai.models.generateContent({
          model: GEMINI_MODEL,
          config: {
            maxOutputTokens: 700,
            temperature: 0.3,
            // gemini-2.5-flash enables "thinking" by default; those tokens are
            // drawn from maxOutputTokens and would starve the visible JSON answer.
            // Disable it so the full 600-token budget goes to the response.
            thinkingConfig: { thinkingBudget: 0 },
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

    if (parsed.is_face === false) {
      return NextResponse.json(
        { error: "We couldn't detect a face in this photo. Please take a clear, front-facing selfie." },
        { status: 422 }
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
        skin_age: sanitizeSkinAge(parsed.skin_age),
        attributes: sanitizeAttributes(parsed.attributes),
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
    await logError({
      errorType: "analyze_route_error",
      message: err instanceof Error ? err.message : String(err),
      endpoint: "/api/analyze",
      stackTrace: err instanceof Error ? err.stack : null,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
