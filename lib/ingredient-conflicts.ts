interface ConflictRule {
  a: string[];
  b: string[];
  reason: string;
  severity: "warning" | "caution";
}

const CONFLICT_RULES: ConflictRule[] = [
  {
    a: ["retinol", "retinoid", "tretinoin", "adapalene"],
    b: ["aha", "glycolic acid", "lactic acid", "mandelic acid", "alpha hydroxy"],
    reason: "Using retinoids with AHAs can cause excessive irritation and compromise the skin barrier. Alternate nights instead.",
    severity: "warning",
  },
  {
    a: ["retinol", "retinoid", "tretinoin", "adapalene"],
    b: ["bha", "salicylic acid", "beta hydroxy"],
    reason: "Retinoids combined with BHAs can increase dryness and peeling. Use on alternate days or at different times.",
    severity: "caution",
  },
  {
    a: ["retinol", "retinoid", "tretinoin", "adapalene"],
    b: ["benzoyl peroxide"],
    reason: "Benzoyl peroxide can deactivate retinol, reducing its effectiveness. Apply at different times of day.",
    severity: "warning",
  },
  {
    a: ["vitamin c", "ascorbic acid", "l-ascorbic"],
    b: ["benzoyl peroxide"],
    reason: "Benzoyl peroxide oxidizes vitamin C, making both less effective. Use vitamin C in the morning and benzoyl peroxide at night.",
    severity: "warning",
  },
  {
    a: ["vitamin c", "ascorbic acid", "l-ascorbic"],
    b: ["aha", "glycolic acid", "lactic acid", "alpha hydroxy"],
    reason: "Both are acidic and using them together can irritate skin. Apply at different times — vitamin C in the AM, acids in the PM.",
    severity: "caution",
  },
  {
    a: ["niacinamide"],
    b: ["vitamin c", "ascorbic acid", "l-ascorbic"],
    reason: "While newer research shows they can work together, some formulations may cause flushing. If irritation occurs, separate them.",
    severity: "caution",
  },
  {
    a: ["aha", "glycolic acid", "lactic acid", "alpha hydroxy"],
    b: ["bha", "salicylic acid", "beta hydroxy"],
    reason: "Layering AHAs and BHAs together can over-exfoliate and damage the skin barrier. Pick one per session.",
    severity: "warning",
  },
];

export interface IngredientConflict {
  ingredientA: string;
  ingredientB: string;
  stepA: { type: string; index: number; title: string };
  stepB: { type: string; index: number; title: string };
  reason: string;
  severity: "warning" | "caution";
}

interface StepInput {
  title: string;
  key_ingredients: string[];
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function matchesGroup(ingredient: string, group: string[]): boolean {
  const norm = normalize(ingredient);
  return group.some((g) => norm.includes(g));
}

export function detectConflicts(
  morningSteps: StepInput[],
  eveningSteps: StepInput[]
): IngredientConflict[] {
  const allSteps = [
    ...morningSteps.map((s, i) => ({ ...s, type: "morning", index: i })),
    ...eveningSteps.map((s, i) => ({ ...s, type: "evening", index: i })),
  ];

  const conflicts: IngredientConflict[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < allSteps.length; i++) {
    for (let j = i + 1; j < allSteps.length; j++) {
      const stepA = allSteps[i];
      const stepB = allSteps[j];

      for (const rule of CONFLICT_RULES) {
        for (const ingA of stepA.key_ingredients) {
          for (const ingB of stepB.key_ingredients) {
            const aMatchesA = matchesGroup(ingA, rule.a);
            const bMatchesB = matchesGroup(ingB, rule.b);
            const aMatchesB = matchesGroup(ingA, rule.b);
            const bMatchesA = matchesGroup(ingB, rule.a);

            if ((aMatchesA && bMatchesB) || (aMatchesB && bMatchesA)) {
              const key = [normalize(ingA), normalize(ingB)].sort().join("|");
              if (!seen.has(key)) {
                seen.add(key);
                conflicts.push({
                  ingredientA: ingA,
                  ingredientB: ingB,
                  stepA: { type: stepA.type, index: stepA.index, title: stepA.title },
                  stepB: { type: stepB.type, index: stepB.index, title: stepB.title },
                  reason: rule.reason,
                  severity: rule.severity,
                });
              }
            }
          }
        }
      }
    }
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// Ingredient scanner
//
// The routine checker above compares generated AM/PM steps. The scanner reuses
// the same CONFLICT_RULES to evaluate a flat ingredient list read off a product
// label — both within that product and against the actives already on the
// user's shelf — plus a simple allergy cross-check.
// ---------------------------------------------------------------------------

export interface ScanConflict {
  /** Ingredient from the scanned product that triggered the rule. */
  ingredient: string;
  /** The ingredient it conflicts with. */
  conflicts_with: string;
  /** Whether the counterpart is in the same product or the user's routine. */
  source: "same_product" | "your_routine";
  reason: string;
  severity: "warning" | "caution";
}

/** True when two raw ingredient names trigger a conflict rule (either direction). */
function ingredientsConflict(
  ingA: string,
  ingB: string
): ConflictRule | undefined {
  return CONFLICT_RULES.find((rule) => {
    const aInA = matchesGroup(ingA, rule.a);
    const bInB = matchesGroup(ingB, rule.b);
    const aInB = matchesGroup(ingA, rule.b);
    const bInA = matchesGroup(ingB, rule.a);
    return (aInA && bInB) || (aInB && bInA);
  });
}

/**
 * Detect conflicts for a scanned product: within its own ingredient list, and
 * against the actives already in the user's routine. Most serious first.
 *
 * @param productIngredients ingredients extracted from the scanned label
 * @param routineIngredients actives already on the user's shelf (optional)
 */
export function detectScanConflicts(
  productIngredients: string[],
  routineIngredients: string[] = []
): ScanConflict[] {
  const conflicts: ScanConflict[] = [];
  const seen = new Set<string>();

  const add = (
    ingredient: string,
    conflicts_with: string,
    source: ScanConflict["source"],
    rule: ConflictRule
  ) => {
    const key =
      [normalize(ingredient), normalize(conflicts_with)].sort().join("|") + source;
    if (seen.has(key)) return;
    seen.add(key);
    conflicts.push({
      ingredient,
      conflicts_with,
      source,
      reason: rule.reason,
      severity: rule.severity,
    });
  };

  // Within the scanned product.
  for (let i = 0; i < productIngredients.length; i++) {
    for (let j = i + 1; j < productIngredients.length; j++) {
      const rule = ingredientsConflict(productIngredients[i], productIngredients[j]);
      if (rule) add(productIngredients[i], productIngredients[j], "same_product", rule);
    }
  }

  // Scanned product vs the user's existing routine.
  for (const ing of productIngredients) {
    for (const routineIng of routineIngredients) {
      const rule = ingredientsConflict(ing, routineIng);
      if (rule) add(ing, routineIng, "your_routine", rule);
    }
  }

  return conflicts.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "warning" ? -1 : 1
  );
}

/**
 * Match extracted ingredients against a user's declared allergies. Substring
 * match in either direction, consistent with the products page.
 */
export function detectAllergyMatches(
  ingredients: string[],
  allergies: string[]
): { ingredient: string; allergy: string }[] {
  if (allergies.length === 0) return [];
  const matches: { ingredient: string; allergy: string }[] = [];
  for (const ingredient of ingredients) {
    for (const allergy of allergies) {
      const a = normalize(allergy);
      const i = normalize(ingredient);
      if (a.length > 0 && (i.includes(a) || a.includes(i))) {
        matches.push({ ingredient, allergy });
      }
    }
  }
  return matches;
}
