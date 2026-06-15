export interface DupeCandidate {
  id: string;
  name: string;
  brand: string;
  category: string;
  price_tier: string;
  key_ingredients: string[];
  description: string;
}

const TIER_RANK: Record<string, number> = {
  drugstore: 0,
  "mid-range": 1,
  luxury: 2,
};

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function sharedIngredientCount(a: string[], b: string[]): number {
  const bSet = new Set(b.map(normalize));
  return a.filter((ing) => bSet.has(normalize(ing))).length;
}

/**
 * Find cheaper alternatives to `product` from `catalog`: same category,
 * a strictly lower price tier, and at least one overlapping key ingredient.
 * Ranked by ingredient overlap (most similar first), then by price.
 */
export function findBudgetAlternatives(
  product: DupeCandidate,
  catalog: DupeCandidate[]
): DupeCandidate[] {
  const productRank = TIER_RANK[product.price_tier] ?? 0;
  if (productRank === 0) return [];

  return catalog
    .filter((candidate) => {
      if (candidate.id === product.id) return false;
      if (candidate.category !== product.category) return false;
      const candidateRank = TIER_RANK[candidate.price_tier] ?? 0;
      if (candidateRank >= productRank) return false;
      return sharedIngredientCount(product.key_ingredients, candidate.key_ingredients) > 0;
    })
    .sort((a, b) => {
      const overlapDiff =
        sharedIngredientCount(product.key_ingredients, b.key_ingredients) -
        sharedIngredientCount(product.key_ingredients, a.key_ingredients);
      if (overlapDiff !== 0) return overlapDiff;
      return (TIER_RANK[a.price_tier] ?? 0) - (TIER_RANK[b.price_tier] ?? 0);
    });
}
