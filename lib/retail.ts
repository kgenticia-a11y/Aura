// F3 — "Where to buy" retail layer.
//
// Curated, dependency-free implementation of nearest-retail lookup. It maps a
// product's brand/price tier to the retail chains that typically stock it, then
// builds Google Maps "near me" deep links (optionally centered on the user's
// coordinates). This gives a genuine nearest-store experience without a paid
// Places API and without a server round-trip — the user's location never leaves
// their device and is never stored.
//
// The RetailProvider interface below is the seam: a real Places/Maps provider
// (live store list, stock, distance) can be dropped in later without changing
// callers. `curatedRetailProvider` is the default implementation.

export interface Retailer {
  name: string;
  /** Search phrase used for the maps deep link, e.g. "Sephora". */
  query: string;
}

export interface NearbyStoreLink {
  retailerName: string;
  /** Google Maps deep link — opens nearby results for this retailer. */
  mapsUrl: string;
}

export interface RetailLookupInput {
  brand?: string | null;
  priceTier?: string | null;
  /** Optional coordinates; when present, maps results center on the user. */
  lat?: number;
  lng?: number;
}

export interface RetailProvider {
  /** Retail chains likely to stock this product, ordered best-first. */
  getRetailers(input: RetailLookupInput): Retailer[];
  /** Build a maps deep link for a retailer, optionally centered on coords. */
  buildStoreLink(retailer: Retailer, coords?: { lat: number; lng: number }): string;
}

// Curated brand → retailer chains. Keys are lowercased brand fragments.
const BRAND_RETAILERS: Record<string, Retailer[]> = {
  tatcha: [
    { name: "Sephora", query: "Sephora" },
    { name: "Nordstrom", query: "Nordstrom" },
  ],
  "sk-ii": [
    { name: "Nordstrom", query: "Nordstrom" },
    { name: "Sephora", query: "Sephora" },
  ],
  "la mer": [
    { name: "Nordstrom", query: "Nordstrom" },
    { name: "Neiman Marcus", query: "Neiman Marcus" },
  ],
  "drunk elephant": [
    { name: "Sephora", query: "Sephora" },
  ],
  "the ordinary": [
    { name: "Ulta Beauty", query: "Ulta Beauty" },
    { name: "Sephora", query: "Sephora" },
  ],
  cerave: [
    { name: "Target", query: "Target" },
    { name: "CVS Pharmacy", query: "CVS Pharmacy" },
    { name: "Walgreens", query: "Walgreens" },
  ],
  "la roche-posay": [
    { name: "Ulta Beauty", query: "Ulta Beauty" },
    { name: "Target", query: "Target" },
    { name: "CVS Pharmacy", query: "CVS Pharmacy" },
  ],
  neutrogena: [
    { name: "Target", query: "Target" },
    { name: "Walgreens", query: "Walgreens" },
  ],
  thayers: [
    { name: "Target", query: "Target" },
    { name: "CVS Pharmacy", query: "CVS Pharmacy" },
  ],
  fresh: [{ name: "Sephora", query: "Sephora" }],
  "youth to the people": [{ name: "Sephora", query: "Sephora" }],
  glossier: [
    { name: "Sephora", query: "Sephora" },
  ],
  skinceuticals: [
    { name: "Dermstore", query: "Dermstore" },
    { name: "Nordstrom", query: "Nordstrom" },
    { name: "Sephora", query: "Sephora" },
  ],
  "paula's choice": [
    { name: "Sephora", query: "Sephora" },
    { name: "Ulta Beauty", query: "Ulta Beauty" },
    { name: "Nordstrom", query: "Nordstrom" },
  ],
  cosrx: [
    { name: "Ulta Beauty", query: "Ulta Beauty" },
    { name: "Target", query: "Target" },
  ],
  "sunday riley": [
    { name: "Sephora", query: "Sephora" },
    { name: "Nordstrom", query: "Nordstrom" },
  ],
  olehenriksen: [
    { name: "Sephora", query: "Sephora" },
    { name: "Ulta Beauty", query: "Ulta Beauty" },
  ],
  "supergoop": [
    { name: "Sephora", query: "Sephora" },
    { name: "Nordstrom", query: "Nordstrom" },
  ],
  farmacy: [
    { name: "Sephora", query: "Sephora" },
    { name: "Ulta Beauty", query: "Ulta Beauty" },
  ],
  rhode: [
    { name: "Sephora", query: "Sephora" },
  ],
  laneige: [
    { name: "Sephora", query: "Sephora" },
    { name: "Target", query: "Target" },
  ],
  lancôme: [
    { name: "Sephora", query: "Sephora" },
    { name: "Nordstrom", query: "Nordstrom" },
    { name: "Ulta Beauty", query: "Ulta Beauty" },
  ],
  lancome: [
    { name: "Sephora", query: "Sephora" },
    { name: "Nordstrom", query: "Nordstrom" },
    { name: "Ulta Beauty", query: "Ulta Beauty" },
  ],
  "dear klairs": [
    { name: "Ulta Beauty", query: "Ulta Beauty" },
    { name: "Target", query: "Target" },
  ],
  "aztec secret": [
    { name: "Target", query: "Target" },
    { name: "Walmart", query: "Walmart" },
    { name: "CVS Pharmacy", query: "CVS Pharmacy" },
  ],
};

// Fallbacks by price tier when the brand isn't in the curated map.
const TIER_RETAILERS: Record<string, Retailer[]> = {
  luxury: [
    { name: "Sephora", query: "Sephora" },
    { name: "Nordstrom", query: "Nordstrom" },
  ],
  "mid-range": [
    { name: "Ulta Beauty", query: "Ulta Beauty" },
    { name: "Sephora", query: "Sephora" },
  ],
  drugstore: [
    { name: "Target", query: "Target" },
    { name: "CVS Pharmacy", query: "CVS Pharmacy" },
    { name: "Walgreens", query: "Walgreens" },
  ],
};

const GENERIC_RETAILERS: Retailer[] = [
  { name: "Ulta Beauty", query: "Ulta Beauty" },
  { name: "Sephora", query: "Sephora" },
  { name: "Target", query: "Target" },
];

export const curatedRetailProvider: RetailProvider = {
  getRetailers({ brand, priceTier }) {
    if (brand) {
      const key = brand.toLowerCase().trim();
      for (const [frag, retailers] of Object.entries(BRAND_RETAILERS)) {
        if (key.includes(frag)) return retailers;
      }
    }
    if (priceTier && TIER_RETAILERS[priceTier.toLowerCase()]) {
      return TIER_RETAILERS[priceTier.toLowerCase()];
    }
    return GENERIC_RETAILERS;
  },

  buildStoreLink(retailer, coords) {
    // Google Maps universal deep link. With coords we center the search on the
    // user; without, Maps resolves "near me" from the browser/app context.
    const params = new URLSearchParams({ api: "1" });
    if (coords) {
      params.set("query", retailer.query);
      // `query` + a center via the ll-style is not supported on the universal
      // URL, so we encode the coordinates into the query text, which Maps honors.
      params.set(
        "query",
        `${retailer.query} near ${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`
      );
    } else {
      params.set("query", `${retailer.query} near me`);
    }
    return `https://www.google.com/maps/search/?${params.toString()}`;
  },
};

/**
 * Convenience: online purchase link. Prefers a real product URL; otherwise
 * falls back to a Google Shopping search for the product so every item is
 * shoppable even before the catalog has affiliate links.
 */
export function buildOnlineBuyUrl(
  productName: string,
  brand: string | null,
  purchaseUrl: string | null
): string {
  if (purchaseUrl && /^https?:\/\//i.test(purchaseUrl)) return purchaseUrl;
  const q = encodeURIComponent(`${brand ? brand + " " : ""}${productName}`);
  return `https://www.google.com/search?tbm=shop&q=${q}`;
}

/**
 * Build the nearby-store links for a product using the given provider
 * (defaults to the curated one). Pure — safe to run on the client so the
 * user's coordinates never touch the server.
 */
export function getNearbyStoreLinks(
  input: RetailLookupInput,
  provider: RetailProvider = curatedRetailProvider
): NearbyStoreLink[] {
  const coords =
    typeof input.lat === "number" && typeof input.lng === "number"
      ? { lat: input.lat, lng: input.lng }
      : undefined;
  return provider.getRetailers(input).map((r) => ({
    retailerName: r.name,
    mapsUrl: provider.buildStoreLink(r, coords),
  }));
}
