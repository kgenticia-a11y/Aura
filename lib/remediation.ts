// F2 — Ingredient-informed remediation engine.
//
// Given a set of analysis concerns and the user's skin type, this maps each
// concern to its named condition (F1), then to the catalog products that
// actually contain the helpful actives for that concern. Product matching is
// catalog-driven — nothing is hardcoded — so the recommendations stay in sync
// as the products table grows.

import { matchCondition, type SkinCondition } from "@/lib/skin-conditions";

export interface CatalogProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  key_ingredients: string[] | null;
  skin_types: string[] | null;
  price_tier: string | null;
  image_url: string | null;
  purchase_url: string | null;
  description: string | null;
}

export interface RecommendedProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  price_tier: string | null;
  image_url: string | null;
  purchase_url: string | null;
  /** The helpful actives this product contains, for the "why" explanation. */
  matched_actives: string[];
  /** True when the product explicitly suits the user's skin type. */
  suits_skin_type: boolean;
}

export interface ConcernRemediation {
  concern_name: string;
  severity: string;
  condition: SkinCondition;
  /** Actives to look for, from the condition library. */
  helpful_actives: string[];
  /** Catalog products that contain those actives, best match first. */
  products: RecommendedProduct[];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

/**
 * Does an ingredient string match one of the helpful actives? Uses normalized
 * substring matching in both directions so "Vitamin C (Ascorbic Acid)" matches
 * "vitamin c" and "niacinamide 10%" matches "niacinamide".
 */
function ingredientMatchesActive(ingredient: string, active: string): boolean {
  const i = normalize(ingredient);
  const a = normalize(active);
  if (!i || !a) return false;
  return i.includes(a) || a.includes(i);
}

function matchProductsForConcern(
  helpfulActives: string[],
  skinType: string | null,
  products: CatalogProduct[],
  limit: number
): RecommendedProduct[] {
  const scored = products
    .map((p) => {
      const ingredients = Array.isArray(p.key_ingredients) ? p.key_ingredients : [];
      const matched = helpfulActives.filter((active) =>
        ingredients.some((ing) => ingredientMatchesActive(ing, active))
      );
      if (matched.length === 0) return null;

      const skinTypes = Array.isArray(p.skin_types) ? p.skin_types : [];
      const suits = skinType
        ? skinTypes.some((t) => normalize(t) === normalize(skinType) || normalize(t) === "all")
        : false;

      // Rank by number of matched actives, then by skin-type suitability.
      const score = matched.length * 10 + (suits ? 3 : 0);

      return {
        product: {
          id: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          price_tier: p.price_tier,
          image_url: p.image_url,
          purchase_url: p.purchase_url,
          matched_actives: matched,
          suits_skin_type: suits,
        } as RecommendedProduct,
        score,
      };
    })
    .filter((x): x is { product: RecommendedProduct; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((x) => x.product);
}

export interface AnalysisConcern {
  name: string;
  severity?: string;
}

/**
 * Build a full remediation plan: one entry per concern, each with its named
 * condition, the helpful actives, and matching catalog products.
 */
export function buildRemediationPlan(
  concerns: AnalysisConcern[],
  skinType: string | null,
  products: CatalogProduct[],
  productsPerConcern = 3
): ConcernRemediation[] {
  return concerns.map((concern) => {
    const condition = matchCondition(concern.name);
    return {
      concern_name: concern.name,
      severity: concern.severity ?? "mild",
      condition,
      helpful_actives: condition.helpfulActives,
      products: matchProductsForConcern(
        condition.helpfulActives,
        skinType,
        products,
        productsPerConcern
      ),
    };
  });
}
