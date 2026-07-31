import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { GoogleGenAI } from "@google/genai";
import { rateLimit } from "@/lib/rate-limit";
import { validateBody, scanIngredientsSchema } from "@/lib/validation";
import { getPremiumStatus, FREE_LIMITS, PREMIUM_LIMITS } from "@/lib/premium";
import {
  detectScanConflicts,
  detectAllergyMatches,
} from "@/lib/ingredient-conflicts";
import { logError } from "@/lib/log-error";

const GEMINI_MODEL = "gemini-2.5-flash";

// The LLM only extracts and normalizes the ingredient list. All conflict logic
// runs deterministically in lib/ingredient-conflicts.ts, so this prompt is kept
// tight to minimize token spend.
const EXTRACTION_PROMPT = `You read cosmetic/skincare product labels. From the provided image or text, extract the ingredient (INCI) list. NOT medical advice.
Reply with ONLY valid JSON, no markdown:
{"product_name":"best guess or null","ingredients":["normalized ingredient names"],"flagged_actives":["notable active ingredients like retinol, niacinamide, salicylic acid, vitamin c, AHAs/BHAs, benzoyl peroxide"],"is_skincare":true}
Rules: List ingredients in label order. Cap at 40 ingredients. Use common INCI names. If the image is not a skincare/cosmetic product, set is_skincare to false and ingredients to [].`;

interface ExtractionResult {
  product_name: string | null;
  ingredients: string[];
  flagged_actives: string[];
  is_skincare: boolean;
}

function buildSuitabilityNote(
  skinType: string | null,
  flaggedActives: string[]
): string {
  if (flaggedActives.length === 0) {
    return skinType
      ? `No strong actives detected — generally gentle for ${skinType} skin.`
      : "No strong actives detected — generally gentle.";
  }
  const actives = flaggedActives.slice(0, 4).join(", ");
  return skinType
    ? `Contains active ingredients (${actives}). Introduce slowly and patch-test, especially for ${skinType} skin.`
    : `Contains active ingredients (${actives}). Introduce one active at a time and patch-test first.`;
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

    const { ok } = await rateLimit(`scan:${user.id}`, 15, 60_000);
    if (!ok) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute." },
        { status: 429 }
      );
    }

    // Tier-aware daily scan limit — premium status and today's count are independent.
    const scanToday = new Date();
    scanToday.setHours(0, 0, 0, 0);

    const [{ isPremium }, { count: scanCount }] = await Promise.all([
      getPremiumStatus(supabase, user.id),
      supabase
        .from("ingredient_scans")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", scanToday.toISOString()),
    ]);
    const dailyScanLimit = isPremium ? PREMIUM_LIMITS.scansPerDay : FREE_LIMITS.scansPerDay;

    if (scanCount && scanCount >= dailyScanLimit) {
      const msg = isPremium
        ? `Daily scan limit reached (${dailyScanLimit}/day). Try again tomorrow.`
        : `Free plan limit reached (${dailyScanLimit}/day). Upgrade to Premium for more scans.`;
      return NextResponse.json({ error: msg, upgrade: !isPremium }, { status: 429 });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { data: validatedBody, error: validationError } = validateBody(
      rawBody,
      scanIngredientsSchema
    );
    if (validationError) return validationError;

    const { image, mime_type, ingredients_text } = validatedBody;
    const source = image ? "photo" : "text";

    // Load the user's context: declared allergies, latest skin type, and the
    // active ingredients already on their shelf (favorited products).
    const [{ data: skinProfile }, { data: latestAnalysis }, { data: favorites }] =
      await Promise.all([
        supabase
          .from("skin_profiles")
          .select("allergies")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("skin_analyses")
          .select("skin_type")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from("product_favorites")
          .select("product_id")
          .eq("user_id", user.id),
      ]);

    const allergies: string[] = skinProfile?.allergies ?? [];
    const skinType: string | null = latestAnalysis?.skin_type ?? null;

    // Flatten favorited products' key ingredients into the user's "shelf".
    // Fetched as a second step (matching the products page) rather than an
    // embedded join, since the FK embed isn't relied on elsewhere.
    let routineIngredients: string[] = [];
    const favoriteIds = Array.isArray(favorites)
      ? favorites.map((f) => (f as { product_id: string }).product_id).filter(Boolean)
      : [];

    if (favoriteIds.length > 0) {
      const { data: favProducts } = await supabase
        .from("products")
        .select("key_ingredients")
        .in("id", favoriteIds);
      routineIngredients = Array.isArray(favProducts)
        ? favProducts.flatMap(
            (p) => (p as { key_ingredients?: string[] }).key_ingredients ?? []
          )
        : [];
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;

    let extraction: ExtractionResult;

    if (!geminiApiKey || geminiApiKey === "your-gemini-api-key-here") {
      // Dev fallback: derive a lightweight extraction from pasted text, or a
      // sample when only an image was supplied.
      const parsed = ingredients_text
        ? ingredients_text
            .split(/[,\n;]+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 40)
        : ["Water", "Niacinamide", "Retinol", "Glycerin"];
      extraction = {
        product_name: null,
        ingredients: parsed,
        flagged_actives: parsed.filter((i) =>
          /retinol|niacinamide|salicylic|glycolic|lactic|ascorbic|vitamin c|benzoyl/i.test(i)
        ),
        is_skincare: true,
      };
    } else {
      const genai = new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: { timeout: 30_000 },
      });

      const parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [{ text: EXTRACTION_PROMPT }];

      if (image) {
        parts.push({
          inlineData: { mimeType: mime_type || "image/webp", data: image },
        });
      } else {
        parts.push({ text: `Ingredient list:\n${ingredients_text}` });
      }

      let retries = 2;
      let raw: string | null = null;

      while (retries > 0) {
        try {
          const response = await genai.models.generateContent({
            model: GEMINI_MODEL,
            config: {
              maxOutputTokens: 700,
              temperature: 0.1,
              // gemini-2.5-flash thinks by default; those tokens come out of
              // maxOutputTokens and would truncate the extracted JSON. Disable it.
              thinkingConfig: { thinkingBudget: 0 },
            },
            contents: [{ role: "user", parts }],
          });
          raw = response.text ?? null;
          break;
        } catch (err) {
          retries--;
          if (retries === 0) {
            console.error("Gemini scan failed after 2 retries:", err);
            return NextResponse.json(
              {
                error:
                  "Ingredient scanning is temporarily unavailable. Please try again in a little while.",
              },
              { status: 503 }
            );
          }
          await new Promise((r) => setTimeout(r, 1000 * (4 - retries)));
        }
      }

      if (!raw) {
        return NextResponse.json(
          { error: "Failed to read the label. Please try again." },
          { status: 500 }
        );
      }

      try {
        const cleaned = raw
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .trim();
        const parsed = JSON.parse(cleaned);
        extraction = {
          product_name:
            typeof parsed.product_name === "string" ? parsed.product_name : null,
          ingredients: Array.isArray(parsed.ingredients)
            ? parsed.ingredients.filter((i: unknown) => typeof i === "string").slice(0, 40)
            : [],
          flagged_actives: Array.isArray(parsed.flagged_actives)
            ? parsed.flagged_actives.filter((i: unknown) => typeof i === "string")
            : [],
          is_skincare: parsed.is_skincare !== false,
        };
      } catch {
        console.error("Failed to parse scan response:", raw);
        return NextResponse.json(
          { error: "Could not read the ingredients. Try a clearer photo or paste the list." },
          { status: 422 }
        );
      }
    }

    if (!extraction.is_skincare || extraction.ingredients.length === 0) {
      return NextResponse.json(
        {
          error:
            "We couldn't find a skincare ingredient list. Try a clearer photo of the back label, or paste the ingredients.",
        },
        { status: 422 }
      );
    }

    // Deterministic analysis — no LLM involved.
    const conflicts = detectScanConflicts(extraction.ingredients, routineIngredients);
    const allergyMatches = detectAllergyMatches(extraction.ingredients, allergies);
    const suitabilityNote = buildSuitabilityNote(skinType, extraction.flagged_actives);

    // Persist the scan (best-effort — don't fail the response if history write fails).
    const { data: saved } = await supabase
      .from("ingredient_scans")
      .insert({
        user_id: user.id,
        product_name: extraction.product_name,
        source,
        ingredients: extraction.ingredients,
        flagged_actives: extraction.flagged_actives,
        conflicts,
        allergy_matches: allergyMatches,
        suitability_note: suitabilityNote,
        model_version: geminiApiKey ? GEMINI_MODEL : "mock-dev",
      })
      .select("id")
      .single();

    return NextResponse.json({
      scan_id: saved?.id ?? null,
      product_name: extraction.product_name,
      ingredients: extraction.ingredients,
      flagged_actives: extraction.flagged_actives,
      conflicts,
      allergy_matches: allergyMatches,
      suitability_note: suitabilityNote,
      skin_type: skinType,
      model: geminiApiKey ? GEMINI_MODEL : "mock-dev",
    });
  } catch (err) {
    console.error("Scan error:", err);
    await logError({
      errorType: "scan_ingredients_route_error",
      message: err instanceof Error ? err.message : String(err),
      endpoint: "/api/scan-ingredients",
      stackTrace: err instanceof Error ? err.stack : null,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
