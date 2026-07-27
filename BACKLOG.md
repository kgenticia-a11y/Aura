# Aura — Competitive Research & Feature Backlog (Phase 1)

_Compiled 2026-07-27. Sources at the bottom. Stop-for-review deliverable — no code changes._

## 1. Competitor scan (what the AI actually does)

| App / Platform | Skin analysis | Diagnosis presentation | Product recs | Retail / location | Monetization & luxury touch |
|----------------|--------------|------------------------|--------------|-------------------|------------------------------|
| **L'Oréal Skin Genius** | 8 attributes vs 10k+ clinically graded photos (~95%) | Attribute scores (lines, pores, pigmentation, radiance) | Immediate product suggestions | Brand storefront only | Free brand tool; "AI Beauty Mirror" hardware |
| **Perfect Corp / YouCam** | Live-video skin analysis + AR try-on | Conversational **AI agent** (selfie + dialogue) | Dynamic product/routine via chat | Brand/retailer integrations | B2B SaaS; AR virtual try-on |
| **Revieve** | Skin age + 200+ metrics | Metric dashboard, skin-age | Personalized routine, guided shopping | Retailer partnerships (add-to-cart) | B2B; measured conversion lift |
| **Haut.AI** | 150+ data points | Concern detection, tracking | Product matching | Ulta/Beiersdorf partners | B2B engine |
| **La Roche-Posay Spotscan+** | 3 selfies, 6k+ graded images | **Named acne grading** (Global Acne Severity scale): pore visibility, redness, inflammation, lesion count | Dermatologist-validated routine | Brand storefront | Free brand tool, derm-validated |
| **Neutrogena Skin360** | 150 facial biomarkers | "Skin score" + coach | Routine coaching | Brand storefront | Companion to devices |
| **Olay Skin Advisor** | Selfie diagnostics + skin age | Skin age vs actual | Product recs | Brand storefront | Free brand tool |
| **Sephora / Ulta apps** | (Virtual try-on, shade finder) | — | Catalog + reviews | **Store locator + BOPIS / curbside, per-store availability**, rewards | Retail; loyalty program |
| **Proven / Curology / Dermatica** | Questionnaire + photos | Custom protocol | **Custom-formulated** products | Ship-to-door | Subscription $10–$29/mo; re-assess every 6–8 wks |

**Takeaways for Aura**
- Analysis + product recs are table stakes. Two things separate the leaders: **named,
  clinically-framed diagnosis** (Spotscan) and **ingredient-driven personalization** (Revieve/Haut/Proven).
- **Where-to-buy + nearest physical store** is essentially absent from analysis apps and
  only lives in retailer apps (Sephora/Ulta). Combining AI diagnosis with what/why/**where +
  nearest store** is a genuine differentiator — and exactly the directive's core ask.
- Luxury tier = subscription + concierge/derm review (Aura already has derm-consult) +
  polished progress tracking.

## 2. Feature matrix vs Aura (have / partial / missing)

| Capability | Aura today | Gap |
|-----------|-----------|-----|
| Photo skin analysis (vision AI) | ✅ Have (Gemini, Fitzpatrick-calibrated) | — |
| Health score + trend/history | ✅ Have (blocked by bug H1) | Fix navigation |
| Routine generation | ✅ Have | — |
| Ingredient conflict scanner | ✅ Have (new) | — |
| Dermatologist escalation | ✅ Have | — |
| Progress photos / timeline / compare | ✅ Have | — |
| **Named skin-issue detection + clinical framing** | 🟡 Partial (concerns labeled + severity, no condition library/scale) | Upgrade |
| **Ingredient-informed positive remediation** (concern→active→product) | 🟡 Partial (conflicts only) | Build |
| **What/Why/Where product recs + nearest retail (maps)** | 🔴 Missing | Build (differentiator) |
| Skin-age & expanded attribute set (pores, firmness, radiance) | 🔴 Missing | Build |
| Conversational follow-up assistant | 🔴 Missing | Optional |
| Routine reassessment cadence (6–8 wk re-scan) | 🟡 Partial (7-day nudge) | Formalize |
| Premium/subscription gating | 🟡 Partial (pricing page, no gating) | Build |
| AR virtual try-on | 🔴 Missing | Likely out of scope |

## 3. Prioritized backlog

Effort: **S** ≤1 batch · **M** 1–2 batches · **L** multi-batch. Priority: **P0** core directive · **P1** strong differentiator · **P2** later.

| # | Opportunity | Aura | Effort | Priority | Notes / dependencies |
|---|-------------|------|--------|----------|----------------------|
| F1 | **Named skin-issue detection + remediation path** — recognized condition names, what it is, how to address it | Partial | M | **P0** | Extend `/api/analyze` output + a condition reference library; depends on M1 face/quality gate for trustworthy input |
| F2 | **Ingredient-informed remediation engine** — map each concern → helpful actives → catalog products containing them (backend-driven, not hardcoded) | Partial | M | **P0** | Reuses `products.key_ingredients`; pairs with F1 and the scanner |
| F3 | **What / Why / Where recommendations + nearest retail** — per product: what it is, why it fits you, buy-online links **and nearest store via maps/places lookup** | Missing | L | **P0** | Needs a Places provider (decision below) + location handling as sensitive data |
| F4 | **Skin-age + expanded attributes** (pores, firmness, radiance, evenness) | Missing | M | P1 | Prompt + schema + UI additions |
| F5 | **Routine reassessment cadence** — formal 6–8 wk re-scan → auto-refresh routine | Partial | S | P1 | Builds on existing reminders |
| F6 | **Premium tier gating** — gate nearest-retail concierge / unlimited scans / derm review behind subscription | Partial | M | P1 | Pricing page exists; needs billing (Stripe) decision |
| F7 | **Conversational follow-up assistant** — ask questions about your analysis | Missing | L | P2 | Chat over the user's own analysis context |
| F8 | **Real-time capture guidance** (face-in-frame + quality) | Missing | M | P2 | Overlaps fix M1 |

**Recommended build order (Phase 3):** F1 → F2 → F3, since F3's "why this product" leans on
F1's named issues and F2's ingredient mapping. Fixes H1–H3 + M1 (Phase 2) come first regardless.

## 4. Decisions needed before Phase 3

1. **Maps/Places provider for F3** — Google Places API (best coverage, needs billing + key)
   vs Mapbox vs a lighter store-locator dataset. Location is sensitive personal data —
   we'd request it per-search, not store it, and disclose usage.
2. **Product catalog reality** — nearest-retail needs real products with retailer/SKU data.
   Current `products` is a curated catalog without purchase/store links. Do we integrate a
   retailer feed/affiliate API, or start with online links + a store locator for stocking retailers?
3. **Monetization (F6)** — is a Stripe subscription in scope now, or do we build features
   ungated first and add billing later?

## Sources
- https://www.perfectcorp.com/business/blog/ai-skincare/top-ai-skin-analysis-app
- https://www.revieve.com/insider/articles/loreals-ai-skin-diagnostic-and-the-future-of-beauty
- https://www.laroche-posay.com.au/spotscan.html
- https://cosmeticsbusiness.com/best-ai-skin-analysis-tools-in-2026
- https://lumino.skin/blog/top-ai-skincare-apps-personalized-routines-2026
- https://www.ulta.com/guestservices/ways-to-shop/all
- https://www.alibaba.com/product-insights/are-ai-powered-skincare-apps-actually-worth-the-subscription-or-just-repackaged-dermatology-basics.html
