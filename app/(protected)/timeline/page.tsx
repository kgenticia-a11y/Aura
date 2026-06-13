import { createClient } from "@/lib/supabase/server";
import {
  Camera,
  Sparkles,
  FlaskConical,
  Star,
  TrendingUp,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";

interface TimelineEvent {
  type: "analysis" | "routine" | "feedback";
  date: string;
  data: Record<string, unknown>;
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
    <div className="max-w-3xl mx-auto px-6 py-12 page-transition">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Dashboard
      </Link>

      <h1 className="text-3xl font-bold mb-2">
        Skin <span className="text-gradient-gold">Journey</span>
      </h1>
      <p className="text-muted-foreground mb-10">
        Your complete skincare history in one place.
      </p>

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
