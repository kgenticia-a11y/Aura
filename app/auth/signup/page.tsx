"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/events";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    if (!privacyAccepted) {
      toast.error("You must accept the Privacy Policy to create an account.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Could not create account.");
        return;
      }

      trackEvent("signup", { method: "email" });
      toast.success(
        "Account created! Check your email to confirm your account."
      );
      router.push("/auth/login");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center min-h-screen px-4 sm:px-6 py-8 sm:py-12">
      <div className="w-full max-w-md page-transition">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="w-6 h-6 text-gold" />
            <span className="text-2xl font-bold text-gradient-gold">Aura</span>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Create Your Account</h1>
          <p className="text-muted-foreground">
            Begin your personalized skincare journey
          </p>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <label
              htmlFor="fullName"
              className="block text-sm font-medium mb-2"
            >
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full h-11 px-4 rounded-lg border border-border bg-input/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-11 px-4 rounded-lg border border-border bg-input/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-2"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full h-11 px-4 pr-11 rounded-lg border border-border bg-input/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Privacy Policy Consent — MANDATORY */}
          <div className="border border-border/50 rounded-xl p-4 bg-card/50">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-border accent-gold"
              />
              <span className="text-sm text-muted-foreground leading-relaxed">
                I have read and agree to the{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-gold hover:underline font-medium"
                >
                  Privacy Policy
                </Link>
                . I understand that my photos will be analyzed by AI for
                cosmetic guidance only, and that Aura does not provide medical
                advice.
              </span>
            </label>
          </div>

          <Button
            type="submit"
            disabled={loading || !privacyAccepted}
            className="w-full h-11 bg-gold text-charcoal hover:bg-gold-light font-semibold glow-gold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Account...
              </span>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="text-gold hover:underline font-medium"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
