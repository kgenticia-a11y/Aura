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
