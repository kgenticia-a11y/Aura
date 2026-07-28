"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Stethoscope,
  ChevronLeft,
  Loader2,
  Send,
  Clock,
  CheckCircle2,
  MessageSquare,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface Consultation {
  id: string;
  reason: string;
  urgency: "routine" | "priority" | "urgent";
  status: "pending" | "in_review" | "responded" | "closed";
  dermatologist_notes: string | null;
  created_at: string;
  responded_at: string | null;
}

const URGENCY_OPTIONS = [
  { value: "routine", label: "Routine", description: "General question, no rush" },
  { value: "priority", label: "Priority", description: "I'd like a response soon" },
  { value: "urgent", label: "Urgent", description: "New or worsening concern" },
] as const;

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-400",
  in_review: "bg-blue-500/20 text-blue-400",
  responded: "bg-green-500/20 text-green-400",
  closed: "bg-secondary text-muted-foreground",
};

function DermPageContent() {
  const searchParams = useSearchParams();
  const analysisId = searchParams.get("analysis_id");

  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState<"routine" | "priority" | "urgent">("routine");
  const [submitting, setSubmitting] = useState(false);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);

  async function loadConsultations() {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_premium")
          .eq("id", user.id)
          .single();
        setIsPremium(profile?.is_premium === true);
      }

      const res = await fetch("/api/derm-consult");
      if (res.ok) {
        const data = await res.json();
        setConsultations(data.consultations || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConsultations();
  }, []);

  async function handleSubmit() {
    if (reason.trim().length < 10) {
      toast.error("Please describe your concern in a bit more detail.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/derm-consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          urgency,
          analysis_id: analysisId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to submit request");
        return;
      }

      toast.success("Request sent! A dermatologist will review your case soon.");
      setReason("");
      setUrgency("routine");
      setConsultations((c) => [data.consultation, ...c]);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 page-transition">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Dashboard
      </Link>

      <div className="mb-8">
        <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center mb-4">
          <Stethoscope className="w-6 h-6 text-gold" />
        </div>
        <h1 className="text-3xl font-bold mb-2">
          Talk to a <span className="text-gradient-gold">Dermatologist</span>
        </h1>
        <p className="text-muted-foreground">
          When AI guidance isn&apos;t enough, request a review from a real
          professional. We&apos;ll notify you here as soon as they respond.
        </p>
      </div>

      {/* Premium gate */}
      {isPremium !== true && (
        <div className="p-6 rounded-2xl border border-gold/30 bg-gold/5 mb-8 text-center">
          <Crown className="w-10 h-10 text-gold mx-auto mb-3" />
          <h2 className="text-lg font-bold mb-2">Premium Feature</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
            Dermatologist consultations are available on the Premium plan.
            Upgrade to get expert reviews of your skin concerns.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gold text-charcoal hover:bg-gold-light font-semibold glow-gold transition-all duration-300"
          >
            <Crown className="w-4 h-4" />
            Upgrade to Premium
          </Link>
        </div>
      )}

      {/* Request form */}
      {isPremium === true && (
      <div className="p-5 rounded-2xl border border-border/50 bg-card/50 mb-8">
        <h2 className="text-lg font-semibold mb-4">New Request</h2>

        <label className="block text-sm font-medium mb-2">
          What&apos;s going on with your skin?
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Describe your concern — new breakouts, reactions, anything the AI analysis didn't address..."
          className="w-full px-3 py-2.5 rounded-lg border border-border/50 bg-background text-sm resize-none focus:outline-none focus:border-gold/50 mb-4"
        />

        <label className="block text-sm font-medium mb-2">Urgency</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
          {URGENCY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setUrgency(opt.value)}
              className={`text-left p-3 rounded-lg border transition-all duration-200 ${
                urgency === opt.value
                  ? "border-gold bg-gold/10"
                  : "border-border/50 hover:border-gold/30"
              }`}
            >
              <p className={`text-sm font-semibold ${urgency === opt.value ? "text-gold" : ""}`}>
                {opt.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
            </button>
          ))}
        </div>

        {analysisId && (
          <p className="text-xs text-muted-foreground mb-4">
            Your most recent skin analysis will be attached to this request.
          </p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-gold text-charcoal hover:bg-gold-light font-semibold w-full glow-gold transition-all duration-300"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Send className="w-4 h-4" />
              Send Request
            </span>
          )}
        </Button>

        <p className="text-xs text-muted-foreground mt-3 text-center">
          Dermatologist reviews typically cost $20–$30 per consultation.
        </p>
      </div>
      )}

      {/* History */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gold" />
          Your Requests
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-gold animate-spin" />
          </div>
        ) : consultations.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 rounded-xl border border-border/50 bg-card/50">
            No requests yet. If something feels off, don&apos;t hesitate to
            reach out above.
          </p>
        ) : (
          <div className="space-y-3">
            {consultations.map((c) => (
              <div key={c.id} className="p-4 rounded-xl border border-border/50 bg-card/50">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                      STATUS_STYLES[c.status] ?? STATUS_STYLES.pending
                    }`}
                  >
                    {c.status === "responded" ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Responded
                      </span>
                    ) : c.status === "pending" ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    ) : (
                      c.status.replace("_", " ")
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <p className="text-sm mb-2">{c.reason}</p>
                {c.dermatologist_notes && (
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <p className="text-xs text-gold font-medium mb-1">
                      Dermatologist response:
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {c.dermatologist_notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DermPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-gold animate-spin" />
        </div>
      }
    >
      <DermPageContent />
    </Suspense>
  );
}
