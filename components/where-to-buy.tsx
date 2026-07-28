"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingBag, MapPin, ExternalLink, Loader2, ChevronDown, Crown } from "lucide-react";
import {
  buildOnlineBuyUrl,
  getNearbyStoreLinks,
  type NearbyStoreLink,
} from "@/lib/retail";

interface WhereToBuyProps {
  productName: string;
  brand: string | null;
  priceTier: string | null;
  purchaseUrl: string | null;
  isPremium?: boolean;
}

// F3 — "Where to buy": online link + privacy-preserving nearest-retail lookup.
// Location is requested only on demand (with a clear note), used to build maps
// deep links on-device, and never sent to a server or stored.
export function WhereToBuy({
  productName,
  brand,
  priceTier,
  purchaseUrl,
  isPremium = false,
}: WhereToBuyProps) {
  const [expanded, setExpanded] = useState(false);
  const [locating, setLocating] = useState(false);
  const [stores, setStores] = useState<NearbyStoreLink[] | null>(null);
  const [usedLocation, setUsedLocation] = useState(false);

  const onlineUrl = buildOnlineBuyUrl(productName, brand, purchaseUrl);

  function showStores(coords?: { lat: number; lng: number }) {
    setStores(getNearbyStoreLinks({ brand, priceTier, ...coords }));
    setUsedLocation(!!coords);
  }

  function findNearby() {
    if (!("geolocation" in navigator)) {
      showStores();
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        showStores({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        // Denied or unavailable — fall back to generic "near me" links.
        showStores();
        setLocating(false);
      },
      { timeout: 8000, maximumAge: 300_000 }
    );
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-medium text-gold hover:underline"
      >
        <ShoppingBag className="w-3.5 h-3.5" />
        Where to buy
        <ChevronDown
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg border border-border/40 bg-background/40 p-3 space-y-3">
          {/* Online */}
          <a
            href={onlineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-gold"
          >
            <ExternalLink className="w-3.5 h-3.5 text-gold" />
            {purchaseUrl ? "Buy online" : "Shop online"}
          </a>

          {/* Nearby — premium only */}
          <div>
            {!isPremium ? (
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-gold"
              >
                <Crown className="w-3.5 h-3.5 text-gold" />
                Find in a store near me
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold font-semibold">
                  Premium
                </span>
              </Link>
            ) : !stores ? (
              <button
                onClick={findNearby}
                disabled={locating}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-gold disabled:opacity-60"
              >
                {locating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-gold" />
                ) : (
                  <MapPin className="w-3.5 h-3.5 text-gold" />
                )}
                Find in a store near me
              </button>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground">
                  Retailers that typically stock this
                  {usedLocation ? " — showing near your location" : ""}:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {stores.map((s) => (
                    <a
                      key={s.retailerName}
                      href={s.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-border/50 bg-card/50 hover:border-gold/50 hover:text-gold"
                    >
                      <MapPin className="w-3 h-3" />
                      {s.retailerName}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
            Your location is used only to open a map and is never saved. Store
            availability isn&apos;t guaranteed — call ahead to confirm stock.
          </p>
        </div>
      )}
    </div>
  );
}
