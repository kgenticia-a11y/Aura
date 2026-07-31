"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Check,
  ChevronLeft,
  Crown,
  Camera,
  ScanLine,
  Stethoscope,
  MapPin,
  BarChart3,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { FREE_LIMITS, PREMIUM_LIMITS } from "@/lib/premium";

const FREE_FEATURES = [
  { icon: Camera, label: `${FREE_LIMITS.analysesPerDay} skin analyses per day` },
  { icon: ScanLine, label: `${FREE_LIMITS.scansPerDay} ingredient scans per day` },
  { icon: BarChart3, label: "Health score & basic insights" },
  { icon: Sparkles, label: "AI-generated routines" },
];

const PREMIUM_FEATURES = [
  { icon: Camera, label: `${PREMIUM_LIMITS.analysesPerDay} skin analyses per day` },
  { icon: ScanLine, label: `${PREMIUM_LIMITS.scansPerDay} ingredient scans per day` },
  { icon: Stethoscope, label: "Dermatologist consultations" },
  { icon: MapPin, label: "Nearest-retail store finder" },
  { icon: BarChart3, label: "Skin-age & detailed attributes" },
  { icon: Sparkles, label: "Everything in Free" },
];

export default function PricingPage() {
  const [isPremium, setIsPremium] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", user.id)
        .single();
      setIsPremium(data?.is_premium === true);
    }
    load();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 page-transition">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Dashboard
      </Link>

      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 rounded-full border border-gold/20 bg-gold/5">
          <Crown className="w-4 h-4 text-gold" />
          <span className="text-sm text-gold font-medium">Choose Your Plan</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">
          Elevate Your <span className="text-gradient-gold">Skin Journey</span>
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Start free, upgrade when you&apos;re ready. Premium unlocks the full
          power of Aura&apos;s AI skincare platform.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Free tier */}
        <div
          className={`relative rounded-2xl border p-6 ${
            isPremium === false
              ? "border-gold/40 bg-gold/5"
              : "border-border/50 bg-card/50"
          }`}
        >
          {isPremium === false && (
            <span className="absolute -top-3 left-6 px-3 py-0.5 text-xs font-semibold rounded-full bg-gold text-charcoal">
              Current plan
            </span>
          )}
          <h2 className="text-xl font-bold mb-1">Free</h2>
          <p className="text-3xl font-bold mb-1">
            $0<span className="text-sm font-normal text-muted-foreground">/month</span>
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Everything you need to get started.
          </p>

          <ul className="space-y-3">
            {FREE_FEATURES.map((f) => (
              <li key={f.label} className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Premium tier */}
        <div
          className={`relative rounded-2xl border p-6 ${
            isPremium
              ? "border-gold/40 bg-gold/5"
              : "border-border/50 bg-card/50"
          }`}
        >
          {isPremium && (
            <span className="absolute -top-3 left-6 px-3 py-0.5 text-xs font-semibold rounded-full bg-gold text-charcoal">
              Current plan
            </span>
          )}
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold">Premium</h2>
            <Crown className="w-5 h-5 text-gold" />
          </div>
          <p className="text-3xl font-bold mb-1">
            $9.99<span className="text-sm font-normal text-muted-foreground">/month</span>
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            The full Aura experience, unlocked.
          </p>

          <ul className="space-y-3 mb-6">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f.label} className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-gold" />
                </div>
                {f.label}
              </li>
            ))}
          </ul>

          {isPremium === null ? (
            <div className="flex justify-center py-3">
              <Loader2 className="w-5 h-5 text-gold animate-spin" />
            </div>
          ) : isPremium ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-lg bg-gold/10 text-gold text-sm font-medium">
              <Check className="w-4 h-4" />
              You&apos;re on Premium
            </div>
          ) : (
            <button
              onClick={() =>
                toast.info(
                  "Stripe checkout is coming soon! For now, contact support to upgrade.",
                  { duration: 5000 }
                )
              }
              className="w-full py-3 rounded-lg bg-gold text-charcoal hover:bg-gold-light font-semibold glow-gold transition-all duration-300"
            >
              Upgrade to Premium
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-center text-muted-foreground mt-8 max-w-md mx-auto">
        Premium is billed monthly. Cancel anytime. Stripe checkout is coming
        soon — contact us to activate your upgrade in the meantime.
      </p>
    </div>
  );
}
