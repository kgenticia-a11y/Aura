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
  Flame,
  CalendarClock,
  RefreshCw,
  Crown,
} from "lucide-react";
import Link from "next/link";
import { SkinInsights } from "@/components/skin-insights";
import { MotionCard } from "@/components/motion-card";
import { getSeasonalTip } from "@/lib/seasonal-tips";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, is_premium")
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

  // Fetch completion dates for streak calculation
  const { data: completions } = await supabase
    .from("routine_step_completions")
    .select("completed_date, step_type, step_index")
    .eq("user_id", user!.id)
    .order("completed_date", { ascending: false });

  // Calculate current streak: consecutive days (ending today or yesterday) with at least one completed step
  let streak = 0;
  if (completions && completions.length > 0) {
    const completedDates = new Set(completions.map((c) => c.completed_date));
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    // Allow today to be "in progress" — start counting from today if done, otherwise from yesterday
    if (!completedDates.has(cursor.toISOString().split("T")[0])) {
      cursor.setDate(cursor.getDate() - 1);
    }

    while (completedDates.has(cursor.toISOString().split("T")[0])) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

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

  // Streak milestones
  const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
  for (const m of STREAK_MILESTONES) {
    if (streak >= m) milestones.push({ label: `${m}-Day Streak`, done: true });
  }

  // Newly hit streak milestone (for celebration banner)
  const justHitStreakMilestone = STREAK_MILESTONES.includes(streak)
    ? streak
    : null;

  // Days since active routine was generated (for reorder reminder)
  const daysSinceRoutine = activeRoutine
    ? Math.floor(
        (Date.now() - new Date(activeRoutine.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;
  const REORDER_THRESHOLD_DAYS = 30;

  // Weekly adherence: % of routine steps completed over the last 7 days
  let weeklyAdherence: number | null = null;
  if (activeRoutine && completions) {
    const stepsPerDay =
      (activeRoutine.morning_steps as unknown[]).length +
      (activeRoutine.evening_steps as unknown[]).length;

    if (stepsPerDay > 0) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setHours(0, 0, 0, 0);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const cutoff = sevenDaysAgo.toISOString().split("T")[0];

      const recentCompletions = completions.filter(
        (c) =>
          c.completed_date >= cutoff &&
          (c.step_type === "morning" || c.step_type === "evening")
      );

      const possibleSteps = stepsPerDay * 7;
      weeklyAdherence = Math.round(
        (recentCompletions.length / possibleSteps) * 100
      );
    }
  }

  // Days since last analysis
  const daysSinceAnalysis = latestAnalysis
    ? Math.floor(
        (Date.now() - new Date(latestAnalysis.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  // F5 — Formal reassessment cadence. Skin change is best judged over ~6 weeks,
  // so beyond that we surface a distinct, stronger "full reassessment" prompt
  // (the 7-day nudge below is just a progress check-in).
  const REASSESS_THRESHOLD_DAYS = 42;
  const showReassessment =
    daysSinceAnalysis !== null && daysSinceAnalysis >= REASSESS_THRESHOLD_DAYS;

  // Routine is stale relative to the latest analysis when the user has
  // re-analyzed since generating their current routine — time to refresh it.
  const routineStaleVsAnalysis =
    !!activeRoutine &&
    !!latestAnalysis &&
    new Date(latestAnalysis.created_at).getTime() >
      new Date(activeRoutine.created_at).getTime();

  // Smart streak nudges
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const completedDates = new Set(
    completions?.map((c) => c.completed_date) ?? []
  );
  const completedToday = completedDates.has(todayStr);
  const completedYesterday = completedDates.has(yesterdayStr);
  const isAfternoon = new Date().getHours() >= 12;

  // "Streak at risk" — had a streak yesterday but nothing today (afternoon only)
  const streakAtRisk =
    streak > 0 && completedYesterday && !completedToday && isAfternoon;

  // "Welcome back" — last completion was 3+ days ago
  let daysSinceLastCompletion: number | null = null;
  if (completions && completions.length > 0) {
    const lastDate = new Date(completions[0].completed_date + "T00:00:00");
    daysSinceLastCompletion = Math.floor(
      (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }
  const showWelcomeBack =
    daysSinceLastCompletion !== null && daysSinceLastCompletion >= 3;

  const seasonalTip = getSeasonalTip();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 page-transition">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          Welcome, <span className="text-gradient-gold">{firstName}</span>
        </h1>
        <p className="text-muted-foreground text-lg">
          Your personalized skincare dashboard
        </p>
      </div>

      {/* Streak */}
      {streak > 0 && (
        <div className="flex items-center gap-3 mb-8 p-4 rounded-2xl border border-gold/20 bg-gradient-to-r from-rose/10 via-card to-peach/10">
          <div className="w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center text-gold shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">
              {streak} day{streak === 1 ? "" : "s"} streak
            </p>
            <p className="text-xs text-muted-foreground">
              {justHitStreakMilestone
                ? `🎉 You just hit a ${justHitStreakMilestone}-day streak — keep it going!`
                : "Keep completing your routine daily to grow your streak"}
            </p>
          </div>
        </div>
      )}

      {/* Smart Streak Nudges */}
      {streakAtRisk && (
        <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400 shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-amber-400">
              Your {streak}-day streak is at risk!
            </p>
            <p className="text-xs text-muted-foreground">
              Complete your routine today to keep the momentum going.
            </p>
          </div>
          <Link
            href="/routine"
            className="shrink-0 px-4 py-2 rounded-lg bg-amber-500 text-charcoal text-sm font-semibold hover:bg-amber-400 transition-colors"
          >
            Do It Now
          </Link>
        </div>
      )}

      {showWelcomeBack && !streakAtRisk && (
        <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl border border-gold/20 bg-gold/5">
          <div className="w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center text-gold shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Welcome back!</p>
            <p className="text-xs text-muted-foreground">
              It&apos;s been {daysSinceLastCompletion} days — let&apos;s pick up
              where you left off with your routine.
            </p>
          </div>
          <Link
            href="/routine"
            className="shrink-0 px-4 py-2 rounded-lg bg-gold text-charcoal text-sm font-semibold hover:bg-gold-light transition-colors"
          >
            Resume
          </Link>
        </div>
      )}

      {/* Seasonal Skin Tip */}
      <div className="mb-6 p-4 rounded-2xl border border-border/50 bg-card/50">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0">{seasonalTip.emoji}</span>
          <div>
            <p className="font-semibold text-sm">{seasonalTip.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {seasonalTip.tip}
            </p>
            <p className="text-xs text-gold mt-2">{seasonalTip.action}</p>
          </div>
        </div>
      </div>

      {/* Premium upgrade nudge */}
      {!profile?.is_premium && (
        <div className="mb-6 p-4 rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/5 via-card to-gold/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Unlock Premium</p>
              <p className="text-xs text-muted-foreground">
                More analyses, ingredient scans, derm consults, skin-age
                tracking, and store finder.
              </p>
            </div>
            <Link
              href="/pricing"
              className="shrink-0 px-4 py-2 rounded-lg bg-gold text-charcoal text-sm font-semibold hover:bg-gold-light transition-colors"
            >
              Upgrade
            </Link>
          </div>
        </div>
      )}

      {/* AI Insights Narrative */}
      {hasAnalyses && <SkinInsights />}

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

          {/* Weekly Adherence */}
          {weeklyAdherence !== null && (
            <div className="p-5 rounded-2xl border border-border/50 bg-card/50">
              <p className="text-sm text-muted-foreground mb-3">
                Weekly Adherence
              </p>
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-gold" />
                <p className="text-xl font-semibold">{weeklyAdherence}%</p>
              </div>
              <div className="w-full h-2 rounded-full bg-secondary mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{ width: `${Math.min(weeklyAdherence, 100)}%` }}
                />
              </div>
            </div>
          )}
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

      {/* Reorder Reminder */}
      {daysSinceRoutine !== null && daysSinceRoutine >= REORDER_THRESHOLD_DAYS && (
        <div className="p-4 rounded-xl border border-gold/20 bg-gold/5 mb-8 flex items-center gap-3">
          <FlaskConical className="w-5 h-5 text-gold shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Running low on products?</p>
            <p className="text-xs text-muted-foreground">
              It&apos;s been {daysSinceRoutine} days since your routine was
              generated — most products last 30-60 days.
            </p>
          </div>
          <Link
            href="/products"
            className="shrink-0 px-4 py-2 rounded-lg bg-gold text-charcoal text-sm font-semibold hover:bg-gold-light transition-colors"
          >
            Shop
          </Link>
        </div>
      )}

      {/* F5 — 6-week reassessment prompt (takes priority over the weekly nudge) */}
      {showReassessment && (
        <div className="p-4 rounded-xl border border-gold/40 bg-gold/10 mb-8 flex items-center gap-3">
          <CalendarClock className="w-5 h-5 text-gold shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Time for your skin reassessment</p>
            <p className="text-xs text-muted-foreground">
              It&apos;s been {daysSinceAnalysis} days since your last analysis —
              skin changes show over ~6 weeks. A fresh scan re-evaluates your
              concerns and refreshes your routine.
            </p>
          </div>
          <Link
            href="/capture"
            className="shrink-0 px-4 py-2 rounded-lg bg-gold text-charcoal text-sm font-semibold hover:bg-gold-light transition-colors"
          >
            Reassess
          </Link>
        </div>
      )}

      {/* F5 — Routine is stale relative to the newest analysis */}
      {routineStaleVsAnalysis && (
        <div className="p-4 rounded-xl border border-gold/20 bg-gold/5 mb-8 flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-gold shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Your routine may be out of date</p>
            <p className="text-xs text-muted-foreground">
              You&apos;ve analyzed your skin since this routine was created —
              refresh it to reflect your latest results.
            </p>
          </div>
          <Link
            href="/routine?refresh=1"
            className="shrink-0 px-4 py-2 rounded-lg bg-gold text-charcoal text-sm font-semibold hover:bg-gold-light transition-colors"
          >
            Refresh
          </Link>
        </div>
      )}

      {/* Analysis Reminder — weekly progress check-in (below the 6-week gate) */}
      {daysSinceAnalysis !== null &&
        daysSinceAnalysis >= 7 &&
        !showReassessment && (
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
      <div className="grid sm:grid-cols-2 gap-3 sm:gap-4 mb-8">
        <MotionCard>
          <Link
            href="/capture"
            className="group block p-5 rounded-2xl border border-border/50 bg-card/50 hover:border-gold/30 hover:glow-rose transition-all duration-300"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose/20 to-lavender/30 flex items-center justify-center text-gold group-hover:scale-110 transition-transform">
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
        </MotionCard>

        <MotionCard>
          <Link
            href="/feedback"
            className="group block p-5 rounded-2xl border border-border/50 bg-card/50 hover:border-gold/30 hover:glow-rose transition-all duration-300"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose/20 to-lavender/30 flex items-center justify-center text-gold group-hover:scale-110 transition-transform">
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
        </MotionCard>
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
