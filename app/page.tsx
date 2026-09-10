import Link from "next/link";
import Image from "next/image";
import { Sparkles, Shield, Camera, TrendingUp } from "lucide-react";
import { MotionCard } from "@/components/motion-card";

const BOOKS = [
  {
    title: "The Intelligent Investor",
    author: "Benjamin Graham",
    coverUrl: "https://covers.openlibrary.org/b/isbn/0060555661-L.jpg",
  },
  {
    title: "Zero to One",
    author: "Peter Thiel",
    coverUrl: "https://covers.openlibrary.org/b/isbn/0804139021-L.jpg",
  },
  {
    title: "The Hard Thing About Hard Things",
    author: "Ben Horowitz",
    coverUrl: "https://covers.openlibrary.org/b/isbn/0062273205-L.jpg",
  },
  {
    title: "The Man Who Solved The Market",
    author: "Gregory Zuckerman",
    coverUrl: "https://covers.openlibrary.org/b/isbn/0735217980-L.jpg",
  },
  {
    title: "$100M Models",
    author: "Alex Hormozi",
    coverUrl: "https://covers.openlibrary.org/b/isbn/1737475707-L.jpg",
  },
  {
    title: "$100M Offers",
    author: "Alex Hormozi",
    coverUrl: "https://covers.openlibrary.org/b/isbn/1737475705-L.jpg",
  },
  {
    title: "$100M Leads",
    author: "Alex Hormozi",
    coverUrl: "https://covers.openlibrary.org/b/isbn/1737475736-L.jpg",
  },
  {
    title: "Think and Grow Rich",
    author: "Napoleon Hill",
    coverUrl: "https://covers.openlibrary.org/b/isbn/1585424331-L.jpg",
  },
  {
    title: "The Selfish Gene",
    author: "Richard Dawkins",
    coverUrl: "https://covers.openlibrary.org/b/isbn/0199291152-L.jpg",
  },
  {
    title: "Rich Dad Poor Dad",
    author: "Robert Kiyosaki",
    coverUrl: "https://covers.openlibrary.org/b/isbn/1612680194-L.jpg",
  },
  {
    title: "Your Next Five Moves",
    author: "Patrick Bet-David",
    coverUrl: "https://covers.openlibrary.org/b/isbn/1982154810-L.jpg",
  },
  {
    title: "The Psychology of Money",
    author: "Morgan Housel",
    coverUrl: "https://covers.openlibrary.org/b/isbn/0857197681-L.jpg",
  },
  {
    title: "Algorithmic Trading with Python",
    author: "Aiden Mercel",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9798432148612-L.jpg",
  },
  {
    title: "The Power of Your Subconscious Mind",
    author: "Joseph Murphy",
    coverUrl: "https://covers.openlibrary.org/b/isbn/0735204551-L.jpg",
  },
];

export default function LandingPage() {
  return (
    <main className="flex-1">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 text-center overflow-hidden">
        {/* Background gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-rose/20 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-lavender/25 blur-3xl" />
          <div className="absolute top-1/3 right-1/3 w-64 h-64 rounded-full bg-peach/20 blur-3xl" />

          {/* Floating sparkle accents */}
          <Sparkles className="sparkle absolute top-[18%] left-[12%] w-6 h-6 text-rose/60" />
          <Sparkles
            className="sparkle absolute top-[30%] right-[15%] w-4 h-4 text-lavender/70"
            style={{ animationDelay: "1.2s" }}
          />
          <Sparkles
            className="sparkle absolute bottom-[22%] left-[20%] w-5 h-5 text-peach/70"
            style={{ animationDelay: "2.4s" }}
          />
        </div>

        <div className="relative z-10 page-transition max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full border border-gold/20 bg-gold/5">
            <Sparkles className="w-4 h-4 text-gold" />
            <span className="text-sm text-gold font-medium">
              AI-Powered Skincare
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6">
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
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4">
            The Science of <span className="text-gradient-gold">Beautiful Skin</span>
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-16">
            Advanced AI meets luxury skincare. Every recommendation is
            personalized to your skin&apos;s unique needs.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-8">
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

      {/* Books Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-card/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4">
            Books I&apos;ve <span className="text-gradient-gold">Read</span>
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-14">
            A curated shelf of books that shaped my thinking across investing, business, and science.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-6">
            {BOOKS.map((book) => (
              <BookCard key={book.title} {...book} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Aura. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="/pricing"
              className="text-sm text-muted-foreground hover:text-gold transition-colors"
            >
              Pricing
            </Link>
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
    <MotionCard className="group p-6 rounded-2xl border border-border/50 bg-card/50 hover:border-gold/30 hover:glow-rose transition-all duration-300">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose/20 to-lavender/30 flex items-center justify-center text-gold mb-4 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </MotionCard>
  );
}

function BookCard({
  title,
  author,
  coverUrl,
}: {
  title: string;
  author: string;
  coverUrl: string;
}) {
  return (
    <div className="group flex flex-col items-center gap-3">
      <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-md ring-1 ring-border/40 group-hover:shadow-xl group-hover:ring-gold/40 transition-all duration-300">
        <Image
          src={coverUrl}
          alt={`${title} by ${author}`}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 22vw, 14vw"
        />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold leading-tight line-clamp-2">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{author}</p>
      </div>
    </div>
  );
}
