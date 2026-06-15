import { createClient } from "@/lib/supabase/server";
import {
  Camera,
  Sparkles,
  FlaskConical,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";

interface TimelineEvent {
  type: "analysis" | "routine" | "feedback";
  date: string;
  data: Record<string, unknown>;
}

interface ConcernEntry {
  name: string;
  severity: string;
}

interface ConcernTrend {
  name: string;
  direction: "improving" | "worsening" | "stable" | "new" | "resolved";
  fromSeverity?: string;
  toSeverity?: string;
}

const SEVERITY_RANK: Record<string, number> = {
  significant: 3,
  moderate: 2,
  mild: 1,
};

function computeConcernTrends(
  analyses: Array<{ concerns: ConcernEntry[]; created_at: string }>
): ConcernTrend[] {
  if (analyses.length < 2) return [];

  const latest = analyses[0];
  const previous = analyses[1];

  const latestMap = new Map(
    (latest.concerns || []).map((c) => [c.name.toLowerCase(), c])
  );
  const previousMap = new Map(
    (previous.concerns || []).map((c) => [c.name.toLowerCase(), c])
  );

  const trends: ConcernTrend[] = [];

  for (const [key, curr] of latestMap) {
    const prev = previousMap.get(key);
    if (!prev) {
      trends.push({ name: curr.name, direction: "new", toSeverity: curr.severity });
    } else {
      const diff = (SEVERITY_RANK[curr.severity] || 0) - (SEVERITY_RANK[prev.severity] || 0);
      trends.push({
        name: curr.name,
        direction: diff < 0 ? "improving" : diff > 0 ? "worsening" : "stable",
        fromSeverity: prev.severity,
        toSeverity: curr.severity,
      });
    }
  }

  for (const [key, prev] of previousMap) {
    if (!latestMap.has(key)) {
      trends.push({ name: prev.name, direction: "resolved", fromSeverity: prev.severity });
    }
  }

  return trends;
}

export default async function TimelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch all events
  const [
    { data: analyses },
    { data: routines },
    { data: feedbacks },
  ] = await Promise.all([
    supabase
      .from("skin_analyses")
      .select("id, health_score, skin_type, hydration_level, concerns, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("routines")
      .select("id, morning_steps, evening_steps, active, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("routine_feedback")
      .select("id, overall_rating, skin_feel, what_improved, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
  ]);

  // Merge into timeline
  const events: TimelineEvent[] = [];

  analyses?.forEach((a) =>
    events.push({ type: "analysis", date: a.created_at, data: a })
  );
  routines?.forEach((r) =>
    events.push({ type: "routine", date: r.created_at, data: r })
  );
  feedbacks?.forEach((f) =>
    events.push({ type: "feedback", date: f.created_at, data: f })
  );

  events.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 page-transition">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Dashboard
      </Link>

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold">
          Skin <span className="text-gradient-gold">Journey</span>
        </h1>
        <Link
          href="/compare"
          className="text-sm text-gold hover:underline font-medium"
        >
          Before & After →
        </Link>
      </div>
      <p className="text-muted-foreground mb-10">
        Your complete skincare history in one place.
      </p>

      {/* Concern Trends */}
      {analyses && analyses.length >= 2 && (() => {
        const trends = computeConcernTrends(
          analyses.map((a) => ({
            concerns: (a.concerns as ConcernEntry[]) || [],
            created_at: a.created_at,
          }))
        );

        if (trends.length === 0) return null;

        const improving = trends.filter((t) => t.direction === "improving" || t.direction === "resolved");
        const worsening = trends.filter((t) => t.direction === "worsening" || t.direction === "new");
        const stable = trends.filter((t) => t.direction === "stable");

        return (
          <div className="p-5 rounded-2xl border border-border/50 bg-card/50 mb-8">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gold" />
              Concern Trends
              <span className="text-xs text-muted-foreground font-normal ml-auto">
                vs. previous analysis
              </span>
            </h3>
            <div className="space-y-2">
              {improving.map((t) => (
                <div key={t.name} className="flex items-center gap-2 text-sm">
                  {t.direction === "resolved" ? (
                    <Sparkles className="w-4 h-4 text-green-400 shrink-0" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-green-400 shrink-0" />
                  )}
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-green-400">
                    {t.direction === "resolved"
                      ? `resolved (was ${t.fromSeverity})`
                      : `${t.fromSeverity} → ${t.toSeverity}`}
                  </span>
                </div>
              ))}
              {worsening.map((t) => (
                <div key={t.name} className="flex items-center gap-2 text-sm">
                  {t.direction === "new" ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <TrendingUp className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span className="font-medium">{t.name}</span>
                  <span className={`text-xs ${t.direction === "new" ? "text-amber-400" : "text-red-400"}`}>
                    {t.direction === "new"
                      ? `new (${t.toSeverity})`
                      : `${t.fromSeverity} → ${t.toSeverity}`}
                  </span>
                </div>
              ))}
              {stable.map((t) => (
                <div key={t.name} className="flex items-center gap-2 text-sm">
                  <Minus className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">
                    stable ({t.toSeverity})
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {events.length === 0 ? (
        <div className="text-center py-16">
          <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">
            No events yet. Start your journey with a selfie!
          </p>
          <Link
            href="/capture"
            className="inline-flex items-center gap-2 mt-4 px-6 py-3 rounded-xl bg-gold text-charcoal font-semibold hover:bg-gold-light glow-gold transition-all"
          >
            <Camera className="w-4 h-4" />
            Take First Selfie
          </Link>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border/50" />

          <div className="space-y-6">
            {events.map((event, i) => (
              <div key={i} className="relative flex gap-4">
                {/* Icon */}
                <div
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    event.type === "analysis"
                      ? "bg-gold/10 text-gold"
                      : event.type === "routine"
                      ? "bg-blue-500/10 text-blue-400"
                      : "bg-green-500/10 text-green-400"
                  }`}
                >
                  {event.type === "analysis" ? (
                    <Sparkles className="w-4 h-4" />
                  ) : event.type === "routine" ? (
                    <FlaskConical className="w-4 h-4" />
                  ) : (
                    <Star className="w-4 h-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-2">
                  <p className="text-xs text-muted-foreground mb-1">
                    {new Date(event.date).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>

                  {event.type === "analysis" && (
                    <div className="p-4 rounded-xl border border-border/50 bg-card/50">
                      <h3 className="font-semibold mb-1">Skin Analysis</h3>
                      <div className="flex items-center gap-4 text-sm">
                        <span>
                          Score:{" "}
                          <strong className="text-gold">
                            {event.data.health_score as number}
                          </strong>
                        </span>
                        <span className="capitalize">
                          {event.data.skin_type as string}
                        </span>
                        <span className="capitalize">
                          Hydration: {event.data.hydration_level as string}
                        </span>
                      </div>
                      {(() => {
                        const concerns = event.data.concerns as Array<{ name: string }> | undefined;
                        if (!concerns || concerns.length === 0) return null;
                        return (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {concerns.map((c, j) => (
                              <span
                                key={j}
                                className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground"
                              >
                                {c.name}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                      <Link
                        href={`/analysis/${event.data.id}`}
                        className="text-xs text-gold hover:underline mt-2 inline-block"
                      >
                        View details
                      </Link>
                    </div>
                  )}

                  {event.type === "routine" && (
                    <div className="p-4 rounded-xl border border-border/50 bg-card/50">
                      <h3 className="font-semibold mb-1">
                        Routine Generated
                        {event.data.active === true && (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
                            Active
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {
                          (event.data.morning_steps as unknown[]).length
                        }{" "}
                        morning steps,{" "}
                        {
                          (event.data.evening_steps as unknown[]).length
                        }{" "}
                        evening steps
                      </p>
                    </div>
                  )}

                  {event.type === "feedback" && (
                    <div className="p-4 rounded-xl border border-border/50 bg-card/50">
                      <h3 className="font-semibold mb-1">Routine Feedback</h3>
                      <div className="flex items-center gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3 h-3 ${
                              s <= (event.data.overall_rating as number)
                                ? "fill-gold text-gold"
                                : "text-border"
                            }`}
                          />
                        ))}
                      </div>
                      {(() => {
                        const feels = event.data.skin_feel as string[] | undefined;
                        if (!feels || feels.length === 0) return null;
                        return (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {feels.map((feel, j) => (
                              <span
                                key={j}
                                className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground"
                              >
                                {feel}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                      {event.data.what_improved ? (
                        <p className="text-xs text-green-400 mt-1">
                          Improved: {String(event.data.what_improved)}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
