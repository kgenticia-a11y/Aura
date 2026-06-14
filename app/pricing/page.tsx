import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { MotionCard } from "@/components/motion-card";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    description: "Try Aura and see your first results.",
    features: [
      "1 skin analysis / month",
      "Basic routine",
      "Limited product recommendations",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Basic",
    price: "$9.99",
    period: "/mo",
    description: "For a consistent skincare routine.",
    features: [
      "4 skin analyses / month",
      "Full AM/PM/Weekly routines",
      "Personalized product recommendations",
    ],
    cta: "Start Basic",
    highlighted: false,
  },
  {
    name: "Premium",
    price: "$24.99",
    period: "/mo",
    description: "Unlimited insight into your skin's journey.",
    features: [
      "Unlimited skin analyses",
      "Adaptive, learning routines",
      "Full skin journey timeline",
      "Priority support",
    ],
    cta: "Go Premium",
    highlighted: true,
  },
  {
    name: "VIP",
    price: "$49.99",
    period: "/mo",
    description: "The full luxury concierge experience.",
    features: [
      "Everything in Premium",
      "Concierge skin coaching",
      "Exclusive product access",
    ],
    cta: "Join VIP",
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <main className="flex-1 px-6 py-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16 page-transition">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full border border-gold/20 bg-gold/5">
            <Sparkles className="w-4 h-4 text-gold" />
            <span className="text-sm text-gold font-medium">
              Simple, Beautiful Pricing
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Choose Your <span className="text-gradient-gold">Glow Plan</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Every plan starts with a free skin analysis. Upgrade anytime as
            your routine evolves with you.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {TIERS.map((tier) => (
            <MotionCard
              key={tier.name}
              className={`relative rounded-3xl border p-6 flex flex-col transition-all duration-300 ${
                tier.highlighted
                  ? "border-gold/40 bg-gradient-to-b from-rose/10 via-card to-lavender/10 glow-rose"
                  : "border-border/50 bg-card/50 hover:border-gold/30"
              }`}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold bg-gold text-charcoal">
                  Most Popular
                </span>
              )}

              <h3 className="text-xl font-semibold mb-1">{tier.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {tier.description}
              </p>

              <div className="mb-6">
                <span className="text-4xl font-bold">{tier.price}</span>
                <span className="text-muted-foreground">{tier.period}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-gold mt-0.5 shrink-0" />
                    <span className="text-foreground/90">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/auth/signup"
                className={`inline-flex items-center justify-center rounded-lg text-sm font-semibold px-4 py-2.5 transition-all duration-300 ${
                  tier.highlighted
                    ? "bg-gold text-charcoal hover:bg-gold-light glow-gold"
                    : "border border-gold/30 text-foreground hover:bg-gold/10"
                }`}
              >
                {tier.cta}
              </Link>
            </MotionCard>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-12">
          All plans include encrypted, private photo storage. Cancel anytime.
        </p>
      </div>
    </main>
  );
}
