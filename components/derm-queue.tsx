"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

interface Consultation {
  id: string;
  user_id: string;
  reason: string;
  urgency: "routine" | "priority" | "urgent";
  status: "pending" | "in_review" | "responded" | "closed";
  dermatologist_notes: string | null;
  created_at: string;
}

const URGENCY_STYLES: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-400",
  priority: "bg-amber-500/20 text-amber-400",
  routine: "bg-secondary text-muted-foreground",
};

export function DermQueue() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/derm-consult?queue=1")
      .then((r) => r.json())
      .then((data) => setConsultations(data.consultations || []))
      .finally(() => setLoading(false));
  }, []);

  async function respond(id: string) {
    const notes = drafts[id]?.trim();
    if (!notes) {
      toast.error("Write a response before sending.");
      return;
    }

    setSubmitting(id);
    try {
      const res = await fetch("/api/derm-consult", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, dermatologist_notes: notes, status: "responded" }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to send response");
        return;
      }

      setConsultations((cs) => cs.map((c) => (c.id === id ? data.consultation : c)));
      toast.success("Response sent.");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-gold animate-spin" />
      </div>
    );
  }

  const pending = consultations.filter((c) => c.status !== "closed" && c.status !== "responded");

  if (pending.length === 0) {
    return (
      <p className="text-sm text-muted-foreground p-4 rounded-xl border border-border/50 bg-card/50">
        No open dermatologist requests.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {pending.map((c) => (
        <div key={c.id} className="p-4 rounded-xl border border-border/50 bg-card/50">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                URGENCY_STYLES[c.urgency] ?? URGENCY_STYLES.routine
              }`}
            >
              {c.urgency}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(c.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-sm mb-3">{c.reason}</p>
          <textarea
            value={drafts[c.id] ?? ""}
            onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
            rows={2}
            placeholder="Write a response..."
            className="w-full px-3 py-2 rounded-lg border border-border/50 bg-background text-sm resize-none focus:outline-none focus:border-gold/50 mb-2"
          />
          <button
            onClick={() => respond(c.id)}
            disabled={submitting === c.id}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gold text-charcoal text-xs font-semibold hover:bg-gold-light transition-colors"
          >
            {submitting === c.id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Send className="w-3 h-3" />
            )}
            Send Response
          </button>
        </div>
      ))}
    </div>
  );
}
