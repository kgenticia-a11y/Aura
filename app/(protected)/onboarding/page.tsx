"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const TOTAL_STEPS = 5;

const SKIN_TYPES = ["Oily", "Dry", "Combination", "Normal", "Sensitive", "Not sure"];
const AGE_RANGES = ["Under 18", "18-24", "25-34", "35-44", "45-54", "55+"];
const SKIN_GOALS = [
  "Hydration",
  "Anti-aging",
  "Acne control",
  "Even skin tone",
  "Reduce redness",
  "Minimize pores",
  "Brighten & glow",
  "Sun protection",
  "Dark circles",
  "Sensitive skin care",
];
const COMMON_ALLERGIES = [
  "Fragrance",
  "Parabens",
  "Sulfates",
  "Retinol",
  "Salicylic acid",
  "Benzoyl peroxide",
  "Niacinamide",
  "Vitamin C",
  "Essential oils",
  "None known",
];
const BUDGET_OPTIONS = [
  { value: "drugstore", label: "Drugstore", description: "Under $20 per product" },
  { value: "mid-range", label: "Mid-Range", description: "$20-50 per product" },
  { value: "luxury", label: "Luxury", description: "$50-150 per product" },
  { value: "no-limit", label: "No Limit", description: "Best available, any price" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  // Form state
  const [ageRange, setAgeRange] = useState("");
  const [skinType, setSkinType] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [lifestyle, setLifestyle] = useState({
    sleep: "",
    water: "",
    sunExposure: "",
    diet: "",
  });
  const [budget, setBudget] = useState("mid-range");

  function nextStep() {
    setDirection("forward");
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function prevStep() {
    setDirection("backward");
    setStep((s) => Math.max(s - 1, 0));
  }

  function toggleItem(item: string, list: string[], setList: (v: string[]) => void) {
    if (item === "None known") {
      setList(list.includes(item) ? [] : ["None known"]);
      return;
    }
    const filtered = list.filter((i) => i !== "None known");
    setList(
      filtered.includes(item)
        ? filtered.filter((i) => i !== item)
        : [...filtered, item]
    );
  }

  async function handleComplete() {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Session expired. Please sign in again.");
        router.push("/auth/login");
        return;
      }

      const { error } = await supabase.from("skin_profiles").upsert({
        user_id: user.id,
        age_range: ageRange,
        known_skin_type: skinType,
        allergies,
        current_products: [],
        skin_goals: goals,
        lifestyle,
        budget_preference: budget,
        onboarding_completed: true,
      });

      if (error) {
        toast.error("Failed to save profile. Please try again.");
        console.error(error);
        return;
      }

      toast.success("Profile complete! Let's analyze your skin.");
      router.push("/capture");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-10">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full transition-all duration-500"
              style={{
                background:
                  i <= step
                    ? "linear-gradient(90deg, #D4AF37, #E8C547)"
                    : "oklch(0.30 0.01 280)",
              }}
            />
          ))}
        </div>

        {/* Step content with animation */}
        <div
          key={step}
          className={direction === "forward" ? "animate-slide-in-right" : "animate-slide-in-left"}
        >
          {step === 0 && <StepWelcome />}
          {step === 1 && (
            <StepSkinBasics
              ageRange={ageRange}
              setAgeRange={setAgeRange}
              skinType={skinType}
              setSkinType={setSkinType}
            />
          )}
          {step === 2 && (
            <StepGoalsAllergies
              goals={goals}
              setGoals={setGoals}
              allergies={allergies}
              setAllergies={setAllergies}
              toggleItem={toggleItem}
            />
          )}
          {step === 3 && (
            <StepLifestyle lifestyle={lifestyle} setLifestyle={setLifestyle} />
          )}
          {step === 4 && (
            <StepBudget budget={budget} setBudget={setBudget} />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10">
          {step > 0 ? (
            <button
              onClick={prevStep}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < TOTAL_STEPS - 1 ? (
            <Button
              onClick={nextStep}
              className="bg-gold text-charcoal hover:bg-gold-light font-semibold px-6 glow-gold transition-all duration-300"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={saving}
              className="bg-gold text-charcoal hover:bg-gold-light font-semibold px-6 glow-gold transition-all duration-300"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Complete & Take Selfie
                </span>
              )}
            </Button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(24px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-24px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.4s ease-out;
        }
        .animate-slide-in-left {
          animation: slideInLeft 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}

/* ----- Step Components ----- */

function StepWelcome() {
  return (
    <div className="text-center">
      <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-6">
        <Sparkles className="w-10 h-10 text-gold" />
      </div>
      <h2 className="text-3xl font-bold mb-3">
        Your Skin Journey <span className="text-gradient-gold">Begins</span>
      </h2>
      <p className="text-muted-foreground text-lg leading-relaxed max-w-md mx-auto">
        Let&apos;s learn about your skin so we can craft the perfect routine.
        This takes about 2 minutes.
      </p>
    </div>
  );
}

function StepSkinBasics({
  ageRange,
  setAgeRange,
  skinType,
  setSkinType,
}: {
  ageRange: string;
  setAgeRange: (v: string) => void;
  skinType: string;
  setSkinType: (v: string) => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">The Basics</h2>
      <p className="text-muted-foreground mb-8">
        Help us understand your skin starting point.
      </p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-3">Age Range</label>
          <div className="grid grid-cols-3 gap-2">
            {AGE_RANGES.map((range) => (
              <button
                key={range}
                onClick={() => setAgeRange(range)}
                className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200 ${
                  ageRange === range
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border/50 text-muted-foreground hover:border-gold/30 hover:text-foreground"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-3">
            Skin Type (if known)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SKIN_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setSkinType(type)}
                className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200 ${
                  skinType === type
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border/50 text-muted-foreground hover:border-gold/30 hover:text-foreground"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepGoalsAllergies({
  goals,
  setGoals,
  allergies,
  setAllergies,
  toggleItem,
}: {
  goals: string[];
  setGoals: (v: string[]) => void;
  allergies: string[];
  setAllergies: (v: string[]) => void;
  toggleItem: (item: string, list: string[], setList: (v: string[]) => void) => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Goals & Sensitivities</h2>
      <p className="text-muted-foreground mb-8">
        Select all that apply to you.
      </p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-3">
            Skin Goals <span className="text-muted-foreground">(select multiple)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {SKIN_GOALS.map((goal) => (
              <button
                key={goal}
                onClick={() => toggleItem(goal, goals, setGoals)}
                className={`px-3 py-2 rounded-full border text-sm font-medium transition-all duration-200 ${
                  goals.includes(goal)
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border/50 text-muted-foreground hover:border-gold/30 hover:text-foreground"
                }`}
              >
                {goals.includes(goal) && <Check className="w-3 h-3 inline mr-1" />}
                {goal}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-3">
            Known Allergies / Sensitivities
          </label>
          <div className="flex flex-wrap gap-2">
            {COMMON_ALLERGIES.map((allergy) => (
              <button
                key={allergy}
                onClick={() => toggleItem(allergy, allergies, setAllergies)}
                className={`px-3 py-2 rounded-full border text-sm font-medium transition-all duration-200 ${
                  allergies.includes(allergy)
                    ? "border-rose bg-rose/10 text-rose"
                    : "border-border/50 text-muted-foreground hover:border-rose/30 hover:text-foreground"
                }`}
              >
                {allergies.includes(allergy) && (
                  <Check className="w-3 h-3 inline mr-1" />
                )}
                {allergy}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepLifestyle({
  lifestyle,
  setLifestyle,
}: {
  lifestyle: { sleep: string; water: string; sunExposure: string; diet: string };
  setLifestyle: (v: typeof lifestyle) => void;
}) {
  const update = (key: keyof typeof lifestyle, value: string) =>
    setLifestyle({ ...lifestyle, [key]: value });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Lifestyle Factors</h2>
      <p className="text-muted-foreground mb-8">
        These help us fine-tune your routine.
      </p>

      <div className="space-y-6">
        <LifestyleQuestion
          label="Average Sleep"
          options={["Under 6 hours", "6-7 hours", "7-8 hours", "8+ hours"]}
          value={lifestyle.sleep}
          onChange={(v) => update("sleep", v)}
        />
        <LifestyleQuestion
          label="Daily Water Intake"
          options={["Under 4 cups", "4-6 cups", "6-8 cups", "8+ cups"]}
          value={lifestyle.water}
          onChange={(v) => update("water", v)}
        />
        <LifestyleQuestion
          label="Sun Exposure"
          options={["Minimal", "Moderate", "Frequent", "Daily/outdoor work"]}
          value={lifestyle.sunExposure}
          onChange={(v) => update("sunExposure", v)}
        />
        <LifestyleQuestion
          label="Diet"
          options={["Balanced", "Plant-based", "High sugar/processed", "Varies"]}
          value={lifestyle.diet}
          onChange={(v) => update("diet", v)}
        />
      </div>
    </div>
  );
}

function LifestyleQuestion({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200 ${
              value === opt
                ? "border-gold bg-gold/10 text-gold"
                : "border-border/50 text-muted-foreground hover:border-gold/30 hover:text-foreground"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepBudget({
  budget,
  setBudget,
}: {
  budget: string;
  setBudget: (v: string) => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Budget Preference</h2>
      <p className="text-muted-foreground mb-8">
        We&apos;ll match products to your comfort level.
      </p>

      <div className="space-y-3">
        {BUDGET_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setBudget(opt.value)}
            className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
              budget === opt.value
                ? "border-gold bg-gold/10 glow-gold"
                : "border-border/50 hover:border-gold/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-semibold ${budget === opt.value ? "text-gold" : ""}`}>
                  {opt.label}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {opt.description}
                </p>
              </div>
              {budget === opt.value && (
                <div className="w-6 h-6 rounded-full bg-gold flex items-center justify-center">
                  <Check className="w-4 h-4 text-charcoal" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
