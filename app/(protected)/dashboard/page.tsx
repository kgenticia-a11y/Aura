import { createClient } from "@/lib/supabase/server";
import { Sparkles, Camera, ArrowRight } from "lucide-react";
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

  const firstName = profile?.full_name?.split(" ")[0] || "there";

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 page-transition">
      {/* Welcome */}
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          Welcome, <span className="text-gradient-gold">{firstName}</span>
        </h1>
        <p className="text-muted-foreground text-lg">
          Your personalized skincare dashboard
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        <Link
          href="/capture"
          className="group p-6 rounded-2xl border border-border/50 bg-card/50 hover:border-gold/30 hover:glow-gold transition-all duration-300"
        >
          <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center text-gold mb-4 group-hover:bg-gold/20 transition-colors">
            <Camera className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Take a Selfie</h3>
          <p className="text-muted-foreground mb-4">
            Capture a high-resolution photo for AI skin analysis
          </p>
          <span className="inline-flex items-center gap-1 text-sm text-gold font-medium">
            Start capture
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </Link>

        <div className="p-6 rounded-2xl border border-border/50 bg-card/50">
          <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center text-gold mb-4">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Your Skin Journey</h3>
          <p className="text-muted-foreground mb-4">
            Complete your first analysis to start tracking your skin health
            over time.
          </p>
          <span className="text-sm text-muted-foreground/60">
            No analyses yet
          </span>
        </div>
      </div>
    </div>
  );
}
