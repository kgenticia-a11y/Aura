"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Sparkles,
  Droplets,
  Sun,
  AlertTriangle,
  ArrowRight,
  Loader2,
  ChevronLeft,
  Info,
  Share2,
  Download,
} from "lucide-react";

interface Concern {
  name: string;
  severity: "mild" | "moderate" | "significant";
  description: string;
  evidence?: string;
  confidence?: "low" | "medium" | "high";
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-green-500/20 text-green-400",
  medium: "bg-amber-500/20 text-amber-400",
  low: "bg-red-500/20 text-red-400",
};

interface Analysis {
  id: string;
  skin_type: string;
  concerns: Concern[];
  hydration_level: string;
  health_score: number;
  environmental_factors: {
    sun_damage_signs: string;
    dehydration_signs: string;
  };
  overall_summary?: string;
  raw_response: Record<string, unknown>;
  model_version: string;
  created_at: string;
}

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const photoId = params.id as string;

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [benchmark, setBenchmark] = useState<{ avg_score: number; sample_size: number } | null>(null);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    async function loadOrAnalyze() {
      const supabase = createClient();

      // First check if analysis already exists for this photo
      const { data: existing } = await supabase
        .from("skin_analyses")
        .select("*")
        .eq("photo_id", photoId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        setAnalysis(existing);
        setLoading(false);
        return;
      }

      // No existing analysis — trigger one
      setAnalyzing(true);
      setLoading(false);

      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo_id: photoId }),
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || "Analysis failed");
          setAnalyzing(false);
          return;
        }

        const data = await response.json();

        // Fetch the full analysis record
        const { data: full } = await supabase
          .from("skin_analyses")
          .select("*")
          .eq("id", data.analysis_id)
          .single();

        if (full) {
          setAnalysis(full);
        }
      } catch {
        setError("Failed to analyze. Please try again.");
      } finally {
        setAnalyzing(false);
      }
    }

    loadOrAnalyze();
  }, [photoId]);

  useEffect(() => {
    async function loadBenchmark() {
      const supabase = createClient();
      const { data, error } = await supabase
        .rpc("get_health_score_benchmark")
        .single();

      if (!error && data) {
        const row = data as { avg_score: number; sample_size: number };
        if (row.sample_size >= 5) {
          setBenchmark(row);
        }
      }
    }

    loadBenchmark();
  }, []);

  useEffect(() => {
    async function loadPreviousScore() {
      if (!analysis) return;

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("skin_analyses")
        .select("health_score, created_at")
        .eq("user_id", user.id)
        .lt("created_at", analysis.created_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data) setPreviousScore(data.health_score);
    }

    loadPreviousScore();
  }, [analysis]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 page-transition">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-gold animate-pulse" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-gold/30 animate-ping" />
        </div>
        <h2 className="text-2xl font-bold">Analyzing Your Skin</h2>
        <p className="text-muted-foreground text-center max-w-sm">
          Our AI is examining texture, tone, hydration, and more. This takes a
          few seconds...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-12 h-12 text-amber-400" />
        <h2 className="text-xl font-bold">Analysis Error</h2>
        <p className="text-muted-foreground">{error}</p>
        <Link
          href="/capture"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-charcoal font-semibold hover:bg-gold-light transition-colors"
        >
          Try Again
        </Link>
      </div>
    );
  }

  if (!analysis) return null;

  const raw = analysis.raw_response as Record<string, unknown>;
  const summary =
    (raw?.overall_summary as string) ||
    "Analysis complete. Review your results below.";
  const overallConfidence = raw?.overall_confidence as string | undefined;
  const confidenceReason = raw?.confidence_reason as string | undefined;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 page-transition">
      {/* Back button */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Dashboard
      </Link>

      {/* Progress Celebration */}
      {previousScore !== null && analysis.health_score > previousScore && (
        <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl border border-gold/20 bg-gradient-to-r from-rose/10 via-card to-peach/10">
          <Sparkles className="w-5 h-5 text-gold shrink-0" />
          <p className="text-sm font-medium">
            🎉 Up {analysis.health_score - previousScore} points since your
            last analysis — your skin is trending in the right direction!
          </p>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Your Skin <span className="text-gradient-gold">Analysis</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Analyzed on{" "}
          {new Date(analysis.created_at).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-gold/20 bg-gold/5 mb-4">
        <Info className="w-5 h-5 text-gold shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          <strong className="text-gold">Cosmetic guidance only</strong> — this
          analysis evaluates visible skin attributes and is not medical advice.
          Consult a dermatologist for medical concerns.
        </p>
      </div>

      {/* Confidence */}
      {overallConfidence && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-card/50 mb-8">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0 mt-0.5 ${
              CONFIDENCE_STYLES[overallConfidence] ?? CONFIDENCE_STYLES.medium
            }`}
          >
            {overallConfidence} confidence
          </span>
          {confidenceReason && (
            <p className="text-sm text-muted-foreground">{confidenceReason}</p>
          )}
        </div>
      )}

      {/* Health Score */}
      <div className="p-6 rounded-2xl border border-border/50 bg-card/50 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Skin Health Score</h2>
          <span className="text-3xl font-bold text-gradient-gold">
            {analysis.health_score}
          </span>
        </div>
        <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${analysis.health_score}%`,
              background: `linear-gradient(90deg,
                ${analysis.health_score > 70 ? "#D4AF37" : analysis.health_score > 40 ? "#E8A0BF" : "#ef4444"},
                ${analysis.health_score > 70 ? "#E8C547" : analysis.health_score > 40 ? "#D4AF37" : "#E8A0BF"})`,
            }}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-3">{summary}</p>
        {benchmark && (
          <p className="text-xs text-muted-foreground/70 mt-3 pt-3 border-t border-border/50">
            {analysis.health_score > benchmark.avg_score
              ? `Your score is ${analysis.health_score - benchmark.avg_score} points above`
              : analysis.health_score < benchmark.avg_score
              ? `Your score is ${benchmark.avg_score - analysis.health_score} points below`
              : "Your score matches"}{" "}
            the Aura community average of {benchmark.avg_score} (last 90 days).
          </p>
        )}
      </div>

      {/* Skin Type & Hydration */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-5 rounded-2xl border border-border/50 bg-card/50">
          <Sparkles className="w-5 h-5 text-gold mb-2" />
          <p className="text-sm text-muted-foreground">Skin Type</p>
          <p className="text-lg font-semibold capitalize">
            {analysis.skin_type}
          </p>
        </div>
        <div className="p-5 rounded-2xl border border-border/50 bg-card/50">
          <Droplets className="w-5 h-5 text-blue-400 mb-2" />
          <p className="text-sm text-muted-foreground">Hydration</p>
          <p className="text-lg font-semibold capitalize">
            {analysis.hydration_level}
          </p>
        </div>
      </div>

      {/* Environmental Factors */}
      {analysis.environmental_factors && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-5 rounded-2xl border border-border/50 bg-card/50">
            <Sun className="w-5 h-5 text-amber-400 mb-2" />
            <p className="text-sm text-muted-foreground">Sun Damage</p>
            <p className="text-lg font-semibold capitalize">
              {analysis.environmental_factors.sun_damage_signs}
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-border/50 bg-card/50">
            <Droplets className="w-5 h-5 text-sky-400 mb-2" />
            <p className="text-sm text-muted-foreground">Dehydration</p>
            <p className="text-lg font-semibold capitalize">
              {analysis.environmental_factors.dehydration_signs}
            </p>
          </div>
        </div>
      )}

      {/* Concerns */}
      {analysis.concerns && analysis.concerns.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Identified Concerns</h2>
          <div className="space-y-3">
            {analysis.concerns.map((concern: Concern, i: number) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-border/50 bg-card/50"
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <h3 className="font-medium">{concern.name}</h3>
                  <div className="flex items-center gap-2 shrink-0">
                    {concern.confidence && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                          CONFIDENCE_STYLES[concern.confidence] ?? CONFIDENCE_STYLES.medium
                        }`}
                      >
                        {concern.confidence} confidence
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        concern.severity === "significant"
                          ? "bg-red-500/20 text-red-400"
                          : concern.severity === "moderate"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-green-500/20 text-green-400"
                      }`}
                    >
                      {concern.severity}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {concern.description}
                </p>
                {concern.evidence && (
                  <p className="text-xs text-muted-foreground/70 mt-1.5 italic">
                    Why: {concern.evidence}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share Report Card */}
      <div className="p-5 rounded-2xl border border-border/50 bg-card/50 mb-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Share2 className="w-4 h-4 text-gold" />
          Share Your Report
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Download or share your skin report card — a beautiful summary of this analysis.
        </p>
        <div className="flex gap-3">
          <button
            onClick={async () => {
              const res = await fetch(`/api/report-card?id=${analysis.id}`);
              if (!res.ok) return;
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `aura-report-${new Date(analysis.created_at).toISOString().split("T")[0]}.svg`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 5000);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gold/30 text-foreground hover:bg-gold/10 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <button
            onClick={async () => {
              setSharing(true);
              try {
                const res = await fetch(`/api/report-card?id=${analysis.id}`);
                if (!res.ok) return;
                const blob = await res.blob();
                const file = new File([blob], "aura-report.svg", { type: "image/svg+xml" });
                if (navigator.share && navigator.canShare({ files: [file] })) {
                  await navigator.share({
                    title: "My Aura Skin Report",
                    text: `My skin health score is ${analysis.health_score}/100!`,
                    files: [file],
                  });
                } else if (navigator.share) {
                  await navigator.share({
                    title: "My Aura Skin Report",
                    text: `My skin health score is ${analysis.health_score}/100! Check out Aura for AI-powered skincare.`,
                  });
                } else {
                  await navigator.clipboard.writeText(
                    `My skin health score is ${analysis.health_score}/100! Check out Aura for AI-powered skincare.`
                  );
                  alert("Copied to clipboard!");
                }
              } catch {
                // User cancelled share
              } finally {
                setSharing(false);
              }
            }}
            disabled={sharing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-charcoal font-semibold hover:bg-gold-light transition-colors text-sm"
          >
            {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            Share
          </button>
        </div>
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/routine"
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gold text-charcoal font-semibold hover:bg-gold-light glow-gold transition-all duration-300"
        >
          Get Your Routine
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/capture"
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-gold/30 text-foreground hover:bg-gold/10 transition-colors"
        >
          Take Another Photo
        </Link>
      </div>
    </div>
  );
}
