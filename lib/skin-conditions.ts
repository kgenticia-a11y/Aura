// F1 — Named skin-issue reference library.
//
// A deterministic, cosmetic-framed reference for the concern names Aura's
// analysis produces. This is NOT a medical diagnosis tool: every entry frames
// the concern in plain cosmetic language and the UI carries a "not medical
// advice" disclaimer. Keeping this deterministic (vs. asking the LLM) makes the
// "what it is / how to address it" content stable, reviewable, and free.
//
// Matching is keyword-based because the vision model returns free-form concern
// names ("Visible pores", "Enlarged pores", "Large pores" → the same entry).

export interface SkinCondition {
  /** Canonical, user-facing display name. */
  label: string;
  /** Plain-language "what this is", cosmetic framing only. */
  whatItIs: string;
  /** Why it commonly appears — accessible, non-diagnostic. */
  commonCauses: string;
  /** Cosmetic actives known to help — used to match catalog products (F2). */
  helpfulActives: string[];
  /** A gentle behavioral tip that isn't product-dependent. */
  lifestyleTip: string;
  /** If true, significant severity should nudge toward a professional. */
  escalateWhenSignificant?: boolean;
}

// Each entry lists the keywords (lowercased substrings) that map a free-form
// concern name to the canonical condition.
interface ConditionEntry extends SkinCondition {
  keywords: string[];
}

const CONDITIONS: ConditionEntry[] = [
  {
    keywords: ["acne", "breakout", "pimple", "blemish", "whitehead"],
    label: "Breakouts",
    whatItIs:
      "Clogged pores that become inflamed, appearing as raised spots. A very common, manageable cosmetic concern.",
    commonCauses:
      "Excess oil, dead-skin buildup, and bacteria — often influenced by hormones, stress, and heavy products.",
    helpfulActives: [
      "salicylic acid",
      "benzoyl peroxide",
      "niacinamide",
      "azelaic acid",
      "tea tree",
    ],
    lifestyleTip:
      "Avoid over-washing — cleanse twice daily with a gentle formula, and don't pick at spots.",
    escalateWhenSignificant: true,
  },
  {
    keywords: ["blackhead", "congestion", "clogged"],
    label: "Blackheads & congestion",
    whatItIs:
      "Open, clogged pores where trapped oil oxidizes and darkens at the surface.",
    commonCauses: "Oil and dead-skin buildup in the pore, common in the T-zone.",
    helpfulActives: ["salicylic acid", "retinol", "niacinamide", "clay"],
    lifestyleTip:
      "Use a BHA (salicylic acid) a few nights a week rather than aggressive squeezing.",
  },
  {
    keywords: [
      "hyperpigment",
      "dark spot",
      "pigmentation",
      "melasma",
      "pih",
      "post-inflammatory",
      "sun spot",
      "age spot",
    ],
    label: "Hyperpigmentation & dark spots",
    whatItIs:
      "Patches of skin that look darker than the surrounding area due to extra melanin.",
    commonCauses:
      "Sun exposure, past breakouts, and hormonal shifts can all deepen pigment.",
    helpfulActives: [
      "vitamin c",
      "niacinamide",
      "azelaic acid",
      "alpha arbutin",
      "tranexamic acid",
      "retinol",
      "kojic acid",
    ],
    lifestyleTip:
      "Daily broad-spectrum SPF is the single most effective step — pigment darkens without it.",
  },
  {
    keywords: ["uneven tone", "uneven skin", "discoloration", "blotchy"],
    label: "Uneven tone",
    whatItIs:
      "Variation in color across the face, so the complexion looks less uniform.",
    commonCauses:
      "Sun exposure, past inflammation, and dehydration can all contribute.",
    helpfulActives: ["vitamin c", "niacinamide", "alpha arbutin", "lactic acid"],
    lifestyleTip: "Consistent SPF plus a vitamin C serum evens tone over time.",
  },
  {
    keywords: ["pore", "enlarged pore", "visible pore"],
    label: "Visible pores",
    whatItIs:
      "Pores that appear larger, usually across the nose, cheeks, and forehead.",
    commonCauses:
      "Genetics, oil production, and loss of firmness make pores look more prominent.",
    helpfulActives: ["niacinamide", "salicylic acid", "retinol", "zinc"],
    lifestyleTip:
      "Pore size can't truly shrink, but keeping them clear and using niacinamide minimizes their look.",
  },
  {
    keywords: ["fine line", "wrinkle", "aging", "crow", "elasticity", "firmness", "sagging"],
    label: "Fine lines & firmness",
    whatItIs:
      "Early creases and a softening of skin's bounce as collagen naturally declines.",
    commonCauses:
      "Age, sun exposure, and repeated expression all play a role.",
    helpfulActives: ["retinol", "peptides", "vitamin c", "hyaluronic acid", "bakuchiol"],
    lifestyleTip:
      "A nightly retinoid and daily SPF are the best-studied cosmetic steps for early lines.",
  },
  {
    keywords: ["dry", "dehydrat", "flak", "tight", "rough patch"],
    label: "Dryness & dehydration",
    whatItIs:
      "Skin lacking oil (dry) or water (dehydrated), often feeling tight or looking dull.",
    commonCauses:
      "Cold or dry air, over-cleansing, and a compromised moisture barrier.",
    helpfulActives: [
      "hyaluronic acid",
      "glycerin",
      "ceramides",
      "squalane",
      "shea butter",
      "panthenol",
    ],
    lifestyleTip:
      "Apply moisturizer to slightly damp skin to seal in water, and avoid hot water.",
  },
  {
    keywords: ["redness", "sensiti", "irritat", "rosacea", "reactive"],
    label: "Redness & sensitivity",
    whatItIs:
      "Visible flushing or a reactive complexion that stings or reddens easily.",
    commonCauses:
      "A weakened barrier, harsh actives, temperature changes, and some foods or alcohol.",
    helpfulActives: ["niacinamide", "centella", "azelaic acid", "ceramides", "panthenol", "allantoin"],
    lifestyleTip:
      "Simplify your routine and introduce one gentle product at a time; avoid physical scrubs.",
    escalateWhenSignificant: true,
  },
  {
    keywords: ["dull", "radiance", "glow", "lackluster", "tired skin"],
    label: "Dullness",
    whatItIs:
      "Skin that looks flat or lacks luminosity, often from surface buildup or dehydration.",
    commonCauses:
      "Dead-skin accumulation, dehydration, and lack of sleep.",
    helpfulActives: ["vitamin c", "lactic acid", "glycolic acid", "niacinamide", "hyaluronic acid"],
    lifestyleTip:
      "Gentle weekly exfoliation plus hydration restores a healthy glow.",
  },
  {
    keywords: ["dark circle", "under eye", "under-eye", "eye bag", "puffiness"],
    label: "Under-eye circles",
    whatItIs:
      "Shadowing or darkness under the eyes, sometimes with puffiness.",
    commonCauses:
      "Genetics, thin under-eye skin, fatigue, and fluid retention.",
    helpfulActives: ["caffeine", "vitamin c", "niacinamide", "peptides", "retinol"],
    lifestyleTip:
      "Sleep, hydration, and a caffeine eye product help the look of tired eyes.",
  },
  {
    keywords: ["oil", "shine", "greasy", "sebum"],
    label: "Excess oil & shine",
    whatItIs:
      "An oily-looking complexion, usually most noticeable in the T-zone.",
    commonCauses:
      "Naturally active oil glands, humidity, and sometimes over-stripping the skin.",
    helpfulActives: ["niacinamide", "salicylic acid", "zinc", "clay"],
    lifestyleTip:
      "Don't over-cleanse — stripping oil can trigger more. Use a lightweight gel moisturizer.",
  },
  {
    keywords: ["texture", "bumpy", "uneven texture", "rough"],
    label: "Uneven texture",
    whatItIs:
      "A rough or bumpy surface that can catch the light unevenly.",
    commonCauses: "Dead-skin buildup, dehydration, and clogged pores.",
    helpfulActives: ["lactic acid", "glycolic acid", "salicylic acid", "retinol", "niacinamide"],
    lifestyleTip: "Regular gentle chemical exfoliation smooths texture better than scrubs.",
  },
];

const GENERIC_FALLBACK: SkinCondition = {
  label: "General skin health",
  whatItIs:
    "A cosmetic observation about your skin. Supporting your barrier and staying consistent helps most concerns.",
  commonCauses: "Everyday factors like sun, hydration, sleep, and product choices.",
  helpfulActives: ["niacinamide", "hyaluronic acid", "vitamin c", "ceramides"],
  lifestyleTip:
    "The fundamentals — gentle cleansing, moisturizer, and daily SPF — benefit nearly every concern.",
};

/**
 * Resolve a free-form concern name to a named condition entry. Returns a
 * generic (but still useful) fallback when nothing matches, so the UI always
 * has actives to recommend.
 */
export function matchCondition(concernName: string): SkinCondition {
  const n = concernName.toLowerCase();
  for (const entry of CONDITIONS) {
    if (entry.keywords.some((k) => n.includes(k))) {
      // Strip the internal `keywords` field from the public shape.
      const { keywords: _keywords, ...condition } = entry;
      void _keywords;
      return condition;
    }
  }
  return GENERIC_FALLBACK;
}
