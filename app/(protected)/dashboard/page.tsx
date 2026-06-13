import { createClient } from "@/lib/supabase/server";
import {
  Sparkles,
  Camera,
  ArrowRight,
  FlaskConical,
  TrendingUp,
  TrendingDown,
  Minus,
  Droplets,
  Award,
  Star,
  Clock,
} from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();

  // Fetch latest analyses for score trend
  const { data: analyses } = await supabase
    .from("skin_analyses")
    .select("health_score, skin_type, hydration_level, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Fetch active routine
  const { data: activeRoutine } = await supabase
    .from("routines")
    .select("id, morning_steps, evening_steps, created_at")
    .eq("user_id", user!.id)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Fetch feedback count
  const { count: feedbackCount } = await supabase
    .from("routine_feedback")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user!.id);

  // Fetch photo count
  const { count: photoCount } = await supabase
    .from("skin_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user!.id);

  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const latestAnalysis = analyses?.[0];
  const previousAnalysis = analyses?.[1];
  const hasAnalyses = analyses && analyses.length > 0;

  // Calculate trend
  let trend: "improving" | "declining" | "stable" | null = null;
  if (latestAnalysis && previousAnalysis) {
    const diff = latestAnalysis.health_score - previousAnalysis.health_score;
    trend = diff > 3 ? "improving" : diff < -3 ? "declining" : "stable";
  }

  // Milestones
  const milestones = [];
  if (photoCount && photoCount >= 1)
    milestones.push({ label: "First Analysis", done: true });
  if (photoCount && photoCount >= 5)
    milestones.push({ label: "5 Analyses", done: true });
  if (feedbackCount && feedbackCount >= 1)
    milestones.push({ label: "First Feedback", done: true });
  if (analyses && analyses.length >= 2) {
    const scoreImproved =
      analyses[0].health_score > analyses[analyses.length - 1].health_score;
    if (scoreImproved)
      milestones.push({ label: "Score Improved", done: true });
  }

  // Days since last analysis
  const daysSinceAnalysis = latestAnalysis
    ? Math.floor(
        (Date.now() - new Date(latestAnalysis.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 page-transition">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          Welcome, <span className="text-gradient-gold">{firstName}</span>
        </h1>
        <p className="text-muted-foreground text-lg">
          Your personalized skincare dashboard
        </p>
      </div>

      {/* Score Overview */}
      {hasAnalyses ? (
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {/* Health Score */}
          <div className="p-5 rounded-2xl border border-border/50 bg-card/50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Health Score</p>
              {trend && (
                <span
                  className={`flex items-center gap-1 text-xs font-medium ${
                    trend === "improving"
                      ? "text-green-400"
                      : trend === "declining"
                      ? "text-red-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {trend === "improving" ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : trend === "declining" ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : (
                    <Minus className="w-3 h-3" />
                  )}
                  {trend}
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-gradient-gold">
              {latestAnalysis!.health_score}
            </p>
            <div className="w-full h-2 rounded-full bg-secondary mt-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-gold"
                style={{ width: `${latestAnalysis!.health_score}%` }}
              />
            </div>
          </div>

          {/* Skin Type */}
          <div className="p-5 rounded-2xl border border-border/50 bg-card/50">
            <p className="text-sm text-muted-foreground mb-3">Skin Type</p>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-gold" />
              <p className="text-xl font-semibold capitalize">
                {latestAnalysis!.skin_type}
              </p>
            </div>
          </div>

          {/* Hydration */}
          <div className="p-5 rounded-2xl border border-border/50 bg-card/50">
            <p className="text-sm text-muted-foreground mb-3">Hydration</p>
            <div className="flex items-center gap-2">
              <Droplets className="w-5 h-5 text-blue-400" />
              <p className="text-xl font-semibold capitalize">
                {latestAnalysis!.hydration_level}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Score Trend Chart (simple text-based) */}
      {analyses && analyses.length > 1 && (
        <div className="p-5 rounded-2xl border border-border/50 bg-card/50 mb-8">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gold" />
            Score History
          </h3>
          <div className="flex items-end gap-2 h-24">
            {[...analyses].reverse().map((a, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {a.health_score}
                </span>
                <div
                  className="w-full rounded-t-md bg-gold/60 transition-all"
                  style={{
                    height: `${(a.health_score / 100) * 80}px`,
                  }}
                />
                <span className="text-[10px] text-muted-foreground/50">
                  {new Date(a.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Routine Summary */}
      {activeRoutine && (
        <div className="p-5 rounded-2xl border border-border/50 bg-card/50 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-gold" />
              Active Routine
            </h3>
            <Link
              href="/routine"
              className="text-sm text-gold hover:underline flex items-center gap-1"
            >
              View full routine
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">Morning</p>
              <p className="font-medium">
                {(activeRoutine.morning_steps as unknown[]).length} steps
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Evening</p>
              <p className="font-medium">
                {(activeRoutine.evening_steps as unknown[]).length} steps
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-3">
            Generated{" "}
            {new Date(activeRoutine.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      )}

      {/* Analysis Reminder */}
      {daysSinceAnalysis !== null && daysSinceAnalysis >= 7 && (
        <div className="p-4 rounded-xl border border-gold/20 bg-gold/5 mb-8 flex items-center gap-3">
          <Clock className="w-5 h-5 text-gold shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Time for a check-in!</p>
            <p className="text-xs text-muted-foreground">
              It&apos;s been {daysSinceAnalysis} days since your last analysis.
              A weekly selfie helps track your progress.
            </p>
          </div>
          <Link
            href="/capture"
            className="shrink-0 px-4 py-2 rounded-lg bg-gold text-charcoal text-sm font-semibold hover:bg-gold-light transition-colors"
          >
            Capture
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <Link
          href="/capture"
          className="group p-5 rounded-2xl border border-border/50 bg-card/50 hover:border-gold/30 hover:glow-gold transition-all duration-300"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold group-hover:bg-gold/20 transition-colors">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">New Analysis</h3>
              <p className="text-xs text-muted-foreground">
                Take a selfie for AI skin analysis
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/feedback"
          className="group p-5 rounded-2xl border border-border/50 bg-card/50 hover:border-gold/30 hover:glow-gold transition-all duration-300"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold group-hover:bg-gold/20 transition-colors">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">Rate Routine</h3>
              <p className="text-xs text-muted-foreground">
                Share feedback to improve recommendations
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Milestones */}
      {milestones.length > 0 && (
        <div className="p-5 rounded-2xl border border-border/50 bg-card/50">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-gold" />
            Milestones
          </h3>
          <div className="flex flex-wrap gap-2">
            {milestones.map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/10 text-gold text-xs font-medium"
              >
                <Award className="w-3 h-3" />
                {m.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
