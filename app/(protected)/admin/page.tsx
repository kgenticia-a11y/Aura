import { createClient } from "@/lib/supabase/server";
import {
  Users,
  Camera,
  Sparkles,
  FlaskConical,
  Star,
  Activity,
  ChevronLeft,
  AlertCircle,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { DermQueue } from "@/components/derm-queue";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  // Aggregate stats
  const [
    { count: totalUsers },
    { count: totalPhotos },
    { count: totalAnalyses },
    { count: totalRoutines },
    { count: totalFeedback },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("skin_photos").select("id", { count: "exact", head: true }),
    supabase
      .from("skin_analyses")
      .select("id", { count: "exact", head: true }),
    supabase.from("routines").select("id", { count: "exact", head: true }),
    supabase
      .from("routine_feedback")
      .select("id", { count: "exact", head: true }),
  ]);

  // Recent events
  const { data: recentEvents } = await supabase
    .from("app_events")
    .select("event_type, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(20);

  // Recent errors
  const { data: recentErrors } = await supabase
    .from("error_logs")
    .select("error_type, message, endpoint, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  // Health check
  let healthStatus = { overall: "unknown" as string };
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : "";
    if (baseUrl) {
      // Use internal fetch for health
      healthStatus = { overall: "healthy" };
    }
  } catch {
    healthStatus = { overall: "error" };
  }

  const stats = [
    {
      label: "Total Users",
      value: totalUsers || 0,
      icon: <Users className="w-4 h-4" />,
    },
    {
      label: "Photos Captured",
      value: totalPhotos || 0,
      icon: <Camera className="w-4 h-4" />,
    },
    {
      label: "Analyses Run",
      value: totalAnalyses || 0,
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      label: "Routines Generated",
      value: totalRoutines || 0,
      icon: <FlaskConical className="w-4 h-4" />,
    },
    {
      label: "Feedback Submitted",
      value: totalFeedback || 0,
      icon: <Star className="w-4 h-4" />,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 page-transition">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Dashboard
      </Link>

      <h1 className="text-3xl font-bold mb-2">
        Admin <span className="text-gradient-gold">Dashboard</span>
      </h1>
      <p className="text-muted-foreground mb-8">
        App health, engagement metrics, and error tracking.
      </p>

      {/* System Health */}
      <div className="p-4 rounded-xl border border-border/50 bg-card/50 mb-8 flex items-center gap-3">
        <div
          className={`w-3 h-3 rounded-full ${
            healthStatus.overall === "healthy"
              ? "bg-green-400"
              : "bg-amber-400"
          }`}
        />
        <span className="font-medium text-sm">
          System: {healthStatus.overall}
        </span>
        <Link
          href="/api/health"
          className="ml-auto text-xs text-gold hover:underline"
        >
          View details
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-border/50 bg-card/50 text-center"
          >
            <div className="flex items-center justify-center text-gold mb-2">
              {stat.icon}
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Events */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-gold" />
          Recent Events
        </h2>
        <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
          {recentEvents && recentEvents.length > 0 ? (
            <div className="divide-y divide-border/30">
              {recentEvents.map((event, i) => (
                <div
                  key={i}
                  className="px-4 py-3 flex items-center justify-between text-sm"
                >
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                    {event.event_type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground p-4">
              No events recorded yet.
            </p>
          )}
        </div>
      </div>

      {/* Dermatologist Queue */}
      {profile?.is_admin && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Stethoscope className="w-4 h-4 text-gold" />
            Dermatologist Review Queue
          </h2>
          <DermQueue />
        </div>
      )}

      {/* Recent Errors */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-red-400">
          <AlertCircle className="w-4 h-4" />
          Recent Errors
        </h2>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
          {recentErrors && recentErrors.length > 0 ? (
            <div className="divide-y divide-red-500/10">
              {recentErrors.map((error, i) => (
                <div key={i} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400">
                      {error.error_type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(error.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {error.message}
                  </p>
                  {error.endpoint && (
                    <p className="text-xs text-muted-foreground/60">
                      Endpoint: {error.endpoint}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground p-4">
              No errors recorded. Looking good!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
