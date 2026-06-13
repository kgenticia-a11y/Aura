import Link from "next/link";
import { Sparkles, Shield, Camera, TrendingUp } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="flex-1">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center overflow-hidden">
        {/* Background gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-gold/5 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-rose/5 blur-3xl" />
        </div>

        <div className="relative z-10 page-transition max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full border border-gold/20 bg-gold/5">
            <Sparkles className="w-4 h-4 text-gold" />
            <span className="text-sm text-gold font-medium">
              AI-Powered Skincare
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Your Skin,{" "}
            <span className="text-gradient-gold">Perfected</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            Aura analyzes your unique skin with AI precision, crafting bespoke
            routines that evolve with you. Luxury skincare, reimagined.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center rounded-lg bg-gold text-charcoal hover:bg-gold-light font-semibold text-base px-8 py-3 glow-gold transition-all duration-300"
            >
              Begin Your Journey
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-lg border border-gold/30 text-foreground hover:bg-gold/10 text-base px-8 py-3 transition-all duration-300"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            The Science of <span className="text-gradient-gold">Beautiful Skin</span>
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-16">
            Advanced AI meets luxury skincare. Every recommendation is
            personalized to your skin&apos;s unique needs.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <FeatureCard
              icon={<Camera className="w-6 h-6" />}
              title="High-Resolution Analysis"
              description="Capture detailed selfies and let our AI examine your skin at a microscopic level, identifying texture, tone, and areas of concern."
            />
            <FeatureCard
              icon={<Sparkles className="w-6 h-6" />}
              title="AI-Powered Diagnostics"
              description="Our advanced AI evaluates hydration, oiliness, redness, pores, and more, creating a comprehensive skin profile unique to you."
            />
            <FeatureCard
              icon={<TrendingUp className="w-6 h-6" />}
              title="Adaptive Routines"
              description="Your skincare routine evolves with your skin. As you provide feedback, Aura learns and refines its recommendations over time."
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Privacy First"
              description="Your photos and data are encrypted, never shared, and automatically deleted after analysis. Your skin data belongs to you."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Aura. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground hover:text-gold transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
          <p className="text-xs text-muted-foreground/60">
            Aura provides cosmetic guidance only, not medical advice.
          </p>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group p-6 rounded-2xl border border-border/50 bg-card/50 hover:border-gold/30 hover:glow-gold transition-all duration-300">
      <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center text-gold mb-4 group-hover:bg-gold/20 transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
