"use client";

import { useEffect, useState } from "react";
import { Sparkles, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";

interface Insights {
  narrative: string;
  key_observation?: string;
  next_focus?: string;
  trend?: "improving" | "declining" | "stable" | "baseline" | "none";
  latest_score?: number;
  score_change?: number;
}

export function SkinInsights() {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then((data) => {
        setInsights(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-5 rounded-2xl border border-border/50 bg-card/50 mb-8 flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-gold animate-spin" />
        <span className="text-sm text-muted-foreground">
          Generating your skin insights...
        </span>
      </div>
    );
  }

  if (!insights || !insights.narrative) return null;

  return (
    <div className="p-5 rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/5 to-rose/5 mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-gold" />
        <h3 className="font-semibold text-sm uppercase tracking-wider text-gold">
          Your Skin This Month
        </h3>
        {insights.trend && insights.trend !== "none" && insights.trend !== "baseline" && (
          <span
            className={`ml-auto flex items-center gap-1 text-xs font-medium ${
              insights.trend === "improving"
                ? "text-green-400"
                : insights.trend === "declining"
                ? "text-red-400"
                : "text-muted-foreground"
            }`}
          >
            {insights.trend === "improving" ? (
              <TrendingUp className="w-3 h-3" />
            ) : insights.trend === "declining" ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            {insights.score_change && insights.score_change > 0 ? "+" : ""}
            {insights.score_change}
          </span>
        )}
      </div>

      <p className="text-base leading-relaxed mb-3">{insights.narrative}</p>

      {insights.key_observation && (
        <div className="pt-3 border-t border-border/30 space-y-2">
          <p className="text-xs text-muted-foreground">
            <strong className="text-gold">Key insight:</strong>{" "}
            {insights.key_observation}
          </p>
          {insights.next_focus && (
            <p className="text-xs text-muted-foreground">
              <strong className="text-rose">Focus next:</strong>{" "}
              {insights.next_focus}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
