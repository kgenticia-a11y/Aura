"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { trackEvent } from "@/lib/events";
import { Button } from "@/components/ui/button";
import {
  Star,
  Loader2,
  Check,
  ChevronLeft,
  Sparkles,
  Camera,
} from "lucide-react";
import Link from "next/link";

const SKIN_FEEL_OPTIONS = [
  "Hydrated",
  "Smoother",
  "Clearer",
  "Less oily",
  "Irritated",
  "Breakout",
  "Dry/tight",
  "No change",
];

export default function FeedbackPage() {
  const router = useRouter();
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [skinFeel, setSkinFeel] = useState<string[]>([]);
  const [whatImproved, setWhatImproved] = useState("");
  const [whatWorsened, setWhatWorsened] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    async function checkRoutine() {
      const supabase = createClient();

      // Get active routine
      const { data: routine } = await supabase
        .from("routines")
        .select("id, created_at")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!routine) {
        setLoading(false);
        return;
      }

      setRoutineId(routine.id);

      // Check if feedback already exists for this routine
      const { data: existing } = await supabase
        .from("routine_feedback")
        .select("id")
        .eq("routine_id", routine.id)
        .limit(1)
        .single();

      if (existing) {
        setAlreadySubmitted(true);
      }

      setLoading(false);
    }

    checkRoutine();
  }, []);

  function toggleSkinFeel(option: string) {
    setSkinFeel((prev) =>
      prev.includes(option)
        ? prev.filter((s) => s !== option)
        : [...prev, option]
    );
  }

  async function handleSubmit() {
    if (!routineId || rating === 0) {
      toast.error("Please select a rating.");
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Session expired.");
        router.push("/auth/login");
        return;
      }

      const { error } = await supabase.from("routine_feedback").insert({
        user_id: user.id,
        routine_id: routineId,
        overall_rating: rating,
        skin_feel: skinFeel,
        what_improved: whatImproved || null,
        what_worsened: whatWorsened || null,
        notes: notes || null,
      });

      if (error) {
        toast.error("Failed to save feedback.");
        console.error(error);
        return;
      }

      trackEvent("feedback_submitted", { rating, skin_feel: skinFeel });
      toast.success(
        "Thank you! Your feedback will improve your next routine."
      );
      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
      </div>
    );
  }

  if (!routineId) {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center page-transition">
        <Sparkles className="w-12 h-12 text-gold mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">No Active Routine</h1>
        <p className="text-muted-foreground mb-6">
          Generate a routine first, then come back to share your feedback.
        </p>
        <Link
          href="/routine"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold text-charcoal font-semibold hover:bg-gold-light glow-gold transition-all"
        >
          Go to Routine
        </Link>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center page-transition">
        <Check className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Feedback Submitted</h1>
        <p className="text-muted-foreground mb-6">
          You&apos;ve already shared feedback for your current routine. Generate
          a new routine to continue improving.
        </p>
        <div className="flex flex-col gap-3 items-center">
          <Link
            href="/routine"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold text-charcoal font-semibold hover:bg-gold-light glow-gold transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Generate New Routine
          </Link>
          <Link
            href="/capture"
            className="inline-flex items-center gap-2 text-sm text-gold hover:underline"
          >
            <Camera className="w-4 h-4" />
            Take a new selfie to compare
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-12 page-transition">
      <Link
        href="/routine"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to routine
      </Link>

      <h1 className="text-3xl font-bold mb-2">
        Rate Your <span className="text-gradient-gold">Routine</span>
      </h1>
      <p className="text-muted-foreground mb-8">
        Your feedback helps Aura adapt and improve your next routine.
      </p>

      <div className="space-y-8">
        {/* Star rating */}
        <div>
          <label className="block text-sm font-medium mb-3">
            Overall Rating
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-8 h-8 transition-colors ${
                    star <= (hoverRating || rating)
                      ? "fill-gold text-gold"
                      : "text-border"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Skin feel tags */}
        <div>
          <label className="block text-sm font-medium mb-3">
            How does your skin feel?{" "}
            <span className="text-muted-foreground">(select all)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {SKIN_FEEL_OPTIONS.map((option) => {
              const isNegative = [
                "Irritated",
                "Breakout",
                "Dry/tight",
              ].includes(option);
              const isSelected = skinFeel.includes(option);

              return (
                <button
                  key={option}
                  onClick={() => toggleSkinFeel(option)}
                  className={`px-3 py-2 rounded-full border text-sm font-medium transition-all duration-200 ${
                    isSelected
                      ? isNegative
                        ? "border-rose bg-rose/10 text-rose"
                        : "border-gold bg-gold/10 text-gold"
                      : "border-border/50 text-muted-foreground hover:border-gold/30"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        {/* What improved */}
        <div>
          <label className="block text-sm font-medium mb-2">
            What improved?{" "}
            <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            value={whatImproved}
            onChange={(e) => setWhatImproved(e.target.value)}
            placeholder="e.g., My skin feels more hydrated, less redness..."
            rows={2}
            className="w-full px-4 py-3 rounded-lg border border-border bg-input/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors resize-none"
          />
        </div>

        {/* What worsened */}
        <div>
          <label className="block text-sm font-medium mb-2">
            What didn&apos;t work?{" "}
            <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            value={whatWorsened}
            onChange={(e) => setWhatWorsened(e.target.value)}
            placeholder="e.g., The serum caused irritation, too heavy for summer..."
            rows={2}
            className="w-full px-4 py-3 rounded-lg border border-border bg-input/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors resize-none"
          />
        </div>

        {/* Additional notes */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Additional notes{" "}
            <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else you'd like us to know..."
            rows={2}
            className="w-full px-4 py-3 rounded-lg border border-border bg-input/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors resize-none"
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={saving || rating === 0}
          className="w-full h-12 bg-gold text-charcoal hover:bg-gold-light font-semibold glow-gold transition-all duration-300 disabled:opacity-50"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </span>
          ) : (
            "Submit Feedback"
          )}
        </Button>
      </div>
    </div>
  );
}
