"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { trackEvent } from "@/lib/events";
import {
  Sun,
  Moon,
  Calendar,
  Loader2,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ShoppingBag,
  Star,
  Camera,
  Check,
  AlertTriangle,
} from "lucide-react";
import { detectConflicts, type IngredientConflict } from "@/lib/ingredient-conflicts";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface RoutineStep {
  order?: number;
  category: string;
  title: string;
  description: string;
  key_ingredients: string[];
  avoid_ingredients?: string[];
  application_tip?: string;
  frequency?: string;
}

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price_tier: string;
  description: string;
}

interface RoutineProductMatch {
  step_type: string;
  step_index: number;
  products: { id: string; name: string; brand: string; price_tier: string; description: string }[];
}

type Tab = "morning" | "evening" | "weekly";

interface RoutineData {
  id: string;
  morning_steps: RoutineStep[];
  evening_steps: RoutineStep[];
  weekly: RoutineStep[];
  created_at: string;
}

interface RoutineBundle {
  routine: RoutineData;
  conflicts: IngredientConflict[];
  productMatches: RoutineProductMatch[];
}

// Fetch the active routine plus its ingredient conflicts and matched products.
async function fetchRoutineBundle(): Promise<RoutineBundle | null> {
  const supabase = createClient();

  const { data: routineData } = await supabase
    .from("routines")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!routineData) return null;

  const conflicts = detectConflicts(
    routineData.morning_steps || [],
    routineData.evening_steps || []
  );

  let productMatches: RoutineProductMatch[] = [];

  const { data: rp } = await supabase
    .from("routine_products")
    .select("step_type, step_index, product_id")
    .eq("routine_id", routineData.id);

  if (rp && rp.length > 0) {
    const productIds = [...new Set(rp.map((r) => r.product_id))];
    const { data: products } = await supabase
      .from("products")
      .select("id, name, brand, price_tier, description")
      .in("id", productIds);

    if (products) {
      const grouped: RoutineProductMatch[] = [];
      const seen = new Set<string>();

      rp.forEach((match) => {
        const key = `${match.step_type}-${match.step_index}`;
        if (!seen.has(key)) {
          seen.add(key);
          grouped.push({
            step_type: match.step_type,
            step_index: match.step_index,
            products: [],
          });
        }
        const group = grouped.find(
          (g) =>
            g.step_type === match.step_type && g.step_index === match.step_index
        );
        const product = products.find((p) => p.id === match.product_id);
        if (group && product) {
          group.products.push(product);
        }
      });

      productMatches = grouped;
    }
  }

  return { routine: routineData as RoutineData, conflicts, productMatches };
}

// Fetch today's completed step keys ("<type>-<index>") for a routine.
async function fetchTodayCompletions(routineId: string): Promise<Set<string>> {
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("routine_step_completions")
    .select("step_type, step_index")
    .eq("routine_id", routineId)
    .eq("completed_date", today);

  return new Set((data ?? []).map((c) => `${c.step_type}-${c.step_index}`));
}

function RoutinePageContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("morning");
  const [refreshDismissed, setRefreshDismissed] = useState(false);

  const routineQuery = useQuery({
    queryKey: ["routine"],
    queryFn: fetchRoutineBundle,
  });

  const routine = routineQuery.data?.routine ?? null;
  const conflicts = routineQuery.data?.conflicts ?? [];
  const productMatches = routineQuery.data?.productMatches ?? [];
  const loading = routineQuery.isLoading;
  const routineId = routine?.id;

  const completionsQuery = useQuery({
    queryKey: ["routine-completions", routineId],
    queryFn: () => fetchTodayCompletions(routineId!),
    enabled: !!routineId,
  });
  const completedSteps = completionsQuery.data ?? new Set<string>();

  // F5 — arriving from the dashboard "routine may be out of date" nudge.
  const refreshPrompt =
    !refreshDismissed && searchParams.get("refresh") === "1";

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate routine");
      }
    },
    onSuccess: () => {
      toast.success("New routine generated!");
      queryClient.invalidateQueries({ queryKey: ["routine"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    },
  });
  const generating = generateMutation.isPending;

  const toggleMutation = useMutation({
    mutationFn: async ({
      stepType,
      stepIndex,
      add,
    }: {
      stepType: string;
      stepIndex: number;
      add: boolean;
    }) => {
      if (!routineId) throw new Error("No active routine");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const today = new Date().toISOString().split("T")[0];

      if (!add) {
        await supabase
          .from("routine_step_completions")
          .delete()
          .eq("user_id", user.id)
          .eq("routine_id", routineId)
          .eq("step_type", stepType)
          .eq("step_index", stepIndex)
          .eq("completed_date", today);
      } else {
        await supabase.from("routine_step_completions").insert({
          user_id: user.id,
          routine_id: routineId,
          step_type: stepType,
          step_index: stepIndex,
        });
        trackEvent("routine_step_completed", {
          step_type: stepType,
          step_index: stepIndex,
        });
      }
    },
    // Optimistically flip the step in the cached completions set.
    onMutate: async ({ stepType, stepIndex }) => {
      const qk = ["routine-completions", routineId] as const;
      await queryClient.cancelQueries({ queryKey: qk });
      const prev = queryClient.getQueryData<Set<string>>(qk);
      const key = `${stepType}-${stepIndex}`;
      const next = new Set(prev ?? []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      queryClient.setQueryData(qk, next);
      return { prev, qk };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(ctx.qk, ctx.prev);
      }
    },
  });

  function toggleStep(stepType: string, stepIndex: number) {
    if (!routine) return;
    const add = !completedSteps.has(`${stepType}-${stepIndex}`);
    toggleMutation.mutate({ stepType, stepIndex, add });
  }

  function generateRoutine() {
    generateMutation.mutate();
  }

  function getProductsForStep(stepType: string, stepIndex: number) {
    return (
      productMatches.find(
        (m) => m.step_type === stepType && m.step_index === stepIndex
      )?.products || []
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
      </div>
    );
  }

  if (!routine) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center page-transition">
        <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-10 h-10 text-gold" />
        </div>
        <h1 className="text-3xl font-bold mb-3">
          Your Personalized <span className="text-gradient-gold">Routine</span>
        </h1>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Generate a tailored AM/PM skincare routine based on your latest skin
          analysis and profile.
        </p>
        <Button
          onClick={generateRoutine}
          disabled={generating}
          className="bg-gold text-charcoal hover:bg-gold-light font-semibold px-8 py-3 glow-gold transition-all duration-300"
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Generate My Routine
            </span>
          )}
        </Button>
      </div>
    );
  }

  const steps =
    activeTab === "morning"
      ? routine.morning_steps
      : activeTab === "evening"
      ? routine.evening_steps
      : routine.weekly;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 page-transition">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">
            Your <span className="text-gradient-gold">Routine</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Generated{" "}
            {new Date(routine.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={generateRoutine}
          disabled={generating}
          className="border-gold/30 hover:bg-gold/10"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span className="ml-2 hidden sm:inline">Regenerate</span>
        </Button>
      </div>

      {/* F5 — refresh prompt when arriving from a reassessment nudge */}
      {refreshPrompt && (
        <div className="mb-6 p-4 rounded-xl border border-gold/40 bg-gold/10 flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-gold shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              You&apos;ve re-analyzed your skin since this routine
            </p>
            <p className="text-xs text-muted-foreground">
              Regenerate to reflect your latest results and concerns.
            </p>
          </div>
          <Button
            onClick={() => {
              setRefreshDismissed(true);
              generateRoutine();
            }}
            disabled={generating}
            className="shrink-0 bg-gold text-charcoal hover:bg-gold-light font-semibold"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Regenerate now"
            )}
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl mb-8">
        <TabButton
          active={activeTab === "morning"}
          onClick={() => setActiveTab("morning")}
          icon={<Sun className="w-4 h-4" />}
          label="Morning"
        />
        <TabButton
          active={activeTab === "evening"}
          onClick={() => setActiveTab("evening")}
          icon={<Moon className="w-4 h-4" />}
          label="Evening"
        />
        <TabButton
          active={activeTab === "weekly"}
          onClick={() => setActiveTab("weekly")}
          icon={<Calendar className="w-4 h-4" />}
          label="Weekly"
        />
      </div>

      {/* Ingredient Conflict Warnings */}
      {conflicts.length > 0 && (
        <div className="mb-6 space-y-2">
          {conflicts.map((c, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-4 rounded-xl border ${
                c.severity === "warning"
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-yellow-500/20 bg-yellow-500/5"
              }`}
            >
              <AlertTriangle
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  c.severity === "warning" ? "text-amber-400" : "text-yellow-400"
                }`}
              />
              <div>
                <p className="text-sm font-medium">
                  {c.ingredientA} + {c.ingredientB}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.reason}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Found in {c.stepA.type} step &quot;{c.stepA.title}&quot; and{" "}
                  {c.stepB.type} step &quot;{c.stepB.title}&quot;
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Daily check-in progress */}
      {activeTab !== "weekly" && (steps as RoutineStep[]).length > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="w-4 h-4 text-gold" />
          <span>
            Today: {
              [...completedSteps].filter((k) => k.startsWith(activeTab)).length
            }{" "}
            / {(steps as RoutineStep[]).length} steps complete
          </span>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-4">
        {(steps as RoutineStep[]).map((step, i) => {
          const matchedProducts = getProductsForStep(activeTab, i);
          const isCompleted = completedSteps.has(`${activeTab}-${i}`);

          return (
            <div
              key={i}
              className={`p-5 rounded-2xl border bg-card/50 transition-colors ${
                isCompleted
                  ? "border-gold/40 bg-gold/5"
                  : "border-border/50 hover:border-gold/20"
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Check-off circle (skip for weekly) */}
                {activeTab !== "weekly" ? (
                  <button
                    onClick={() => toggleStep(activeTab, i)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200 ${
                      isCompleted
                        ? "bg-gold text-charcoal"
                        : "border-2 border-gold/30 text-gold hover:border-gold hover:bg-gold/10"
                    }`}
                    aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <span className="text-sm font-semibold">
                        {step.order || i + 1}
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold font-semibold text-sm shrink-0 mt-0.5">
                    {step.order || i + 1}
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3
                      className={`font-semibold ${isCompleted ? "line-through text-muted-foreground" : ""}`}
                    >
                      {step.title}
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">
                      {step.category}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground mb-3">
                    {step.description}
                  </p>

                  {/* Key ingredients */}
                  {step.key_ingredients && step.key_ingredients.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {step.key_ingredients.map((ing, j) => (
                        <span
                          key={j}
                          className="text-xs px-2 py-0.5 rounded-full border border-gold/20 text-gold bg-gold/5"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Application tip */}
                  {step.application_tip && (
                    <p className="text-xs text-muted-foreground/70 italic">
                      Tip: {step.application_tip}
                    </p>
                  )}

                  {/* Frequency for weekly */}
                  {step.frequency && (
                    <p className="text-xs text-gold mt-1">
                      {step.frequency}
                    </p>
                  )}

                  {/* Product recommendations */}
                  {matchedProducts.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border/30">
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3" />
                        Recommended Products
                      </p>
                      <div className="space-y-2">
                        {matchedProducts.map((product) => (
                          <div
                            key={product.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-secondary/30"
                          >
                            <div>
                              <p className="text-sm font-medium">
                                {product.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {product.brand}
                              </p>
                            </div>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                product.price_tier === "luxury"
                                  ? "bg-gold/10 text-gold"
                                  : product.price_tier === "mid-range"
                                  ? "bg-blue-500/10 text-blue-400"
                                  : "bg-green-500/10 text-green-400"
                              }`}
                            >
                              {product.price_tier}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Feedback + Capture CTAs */}
      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        <Link
          href="/feedback"
          className="p-5 rounded-2xl border border-gold/20 bg-gold/5 hover:bg-gold/10 transition-colors text-center"
        >
          <Star className="w-6 h-6 text-gold mx-auto mb-2" />
          <p className="font-semibold text-sm mb-1">Rate This Routine</p>
          <p className="text-xs text-muted-foreground">
            Your feedback improves future recommendations
          </p>
        </Link>
        <Link
          href="/capture"
          className="p-5 rounded-2xl border border-border/50 bg-card/50 hover:border-gold/20 transition-colors text-center"
        >
          <Camera className="w-6 h-6 text-gold mx-auto mb-2" />
          <p className="font-semibold text-sm mb-1">Track Progress</p>
          <p className="text-xs text-muted-foreground">
            Take a new selfie to compare your skin
          </p>
        </Link>
      </div>
    </div>
  );
}

export default function RoutinePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-gold animate-spin" />
        </div>
      }
    >
      <RoutinePageContent />
    </Suspense>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-gold text-charcoal shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
