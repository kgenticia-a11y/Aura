"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { trackEvent } from "@/lib/events";
import { Button } from "@/components/ui/button";
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  ChevronLeft,
  Package,
  Heart,
} from "lucide-react";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price_tier: string;
  description: string;
  key_ingredients: string[];
}

interface Review {
  product_id: string;
  rating: number;
  would_repurchase: boolean | null;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [wouldRepurchase, setWouldRepurchase] = useState<boolean | null>(null);
  const [sideEffects, setSideEffects] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const [{ data: prods }, { data: revs }, { data: favs }] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, brand, category, price_tier, description, key_ingredients")
        .order("category", { ascending: true }),
      supabase
        .from("product_reviews")
        .select("product_id, rating, would_repurchase"),
      user
        ? supabase
            .from("product_favorites")
            .select("product_id")
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] as { product_id: string }[] }),
    ]);

    if (prods) setProducts(prods);
    if (revs) setReviews(revs);
    if (favs) setFavorites(new Set(favs.map((f) => f.product_id)));
    setLoading(false);
  }

  async function toggleFavorite(productId: string) {
    if (!userId) return;
    const supabase = createClient();
    const isFav = favorites.has(productId);

    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(productId);
      else next.add(productId);
      return next;
    });

    if (isFav) {
      await supabase
        .from("product_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("product_id", productId);
    } else {
      await supabase
        .from("product_favorites")
        .insert({ user_id: userId, product_id: productId });
    }
  }

  function getReview(productId: string) {
    return reviews.find((r) => r.product_id === productId);
  }

  function openReview(productId: string) {
    const existing = getReview(productId);
    setReviewingId(productId);
    setReviewRating(existing?.rating || 0);
    setWouldRepurchase(existing?.would_repurchase ?? null);
    setSideEffects("");
    setReviewNotes("");
  }

  async function submitReview() {
    if (!reviewingId || reviewRating === 0) {
      toast.error("Please select a rating.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase.from("product_reviews").insert({
        user_id: user.id,
        product_id: reviewingId,
        rating: reviewRating,
        would_repurchase: wouldRepurchase,
        side_effects: sideEffects || null,
        notes: reviewNotes || null,
        worked_for_concerns: [],
      });

      if (error) {
        toast.error("Failed to save review.");
        console.error(error);
        return;
      }

      trackEvent("product_reviewed", {
        product_id: reviewingId,
        rating: reviewRating,
      });

      toast.success("Review saved!");
      setReviewingId(null);
      await loadData();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const categories = [...new Set(products.map((p) => p.category))];
  const filtered =
    filter === "all"
      ? products
      : filter === "favorites"
      ? products.filter((p) => favorites.has(p.id))
      : products.filter((p) => p.category === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 page-transition">
      <Link
        href="/routine"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to routine
      </Link>

      <h1 className="text-3xl font-bold mb-2">
        Product <span className="text-gradient-gold">Catalog</span>
      </h1>
      <p className="text-muted-foreground mb-8">
        Browse and review the products in your routine.
      </p>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filter === "all"
              ? "bg-gold text-charcoal"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          All ({products.length})
        </button>
        <button
          onClick={() => setFilter("favorites")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
            filter === "favorites"
              ? "bg-gold text-charcoal"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart className="w-3 h-3 fill-current" />
          My Favorites ({favorites.size})
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
              filter === cat
                ? "bg-gold text-charcoal"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat} ({products.filter((p) => p.category === cat).length})
          </button>
        ))}
      </div>

      {/* Product list */}
      <div className="space-y-3">
        {filtered.map((product) => {
          const review = getReview(product.id);

          return (
            <div
              key={product.id}
              className="p-4 rounded-xl border border-border/50 bg-card/50 hover:border-gold/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-4 h-4 text-gold" />
                    <h3 className="font-semibold">{product.name}</h3>
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
                  <p className="text-sm text-muted-foreground mb-1">
                    {product.brand} · {product.category}
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    {product.description}
                  </p>

                  {product.key_ingredients.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {product.key_ingredients.slice(0, 4).map((ing, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-gold/5 text-gold/80 border border-gold/10"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="shrink-0 text-right flex flex-col items-end gap-2">
                  <button
                    onClick={() => toggleFavorite(product.id)}
                    title={favorites.has(product.id) ? "Remove from favorites" : "Add to favorites"}
                    className="p-1.5 rounded-full hover:bg-rose/10 transition-colors"
                  >
                    <Heart
                      className={`w-4 h-4 transition-colors ${
                        favorites.has(product.id)
                          ? "fill-rose text-rose"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                  {review ? (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3 h-3 ${
                            s <= review.rating
                              ? "fill-gold text-gold"
                              : "text-border"
                          }`}
                        />
                      ))}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => openReview(product.id)}
                      className="text-xs border-gold/30 hover:bg-gold/10"
                    >
                      Review
                    </Button>
                  )}
                </div>
              </div>

              {/* Review form inline */}
              {reviewingId === product.id && (
                <div className="mt-4 pt-4 border-t border-border/30 space-y-4">
                  {/* Star rating */}
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      Your Rating
                    </label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          onClick={() => setReviewRating(s)}
                          onMouseEnter={() => setReviewHover(s)}
                          onMouseLeave={() => setReviewHover(0)}
                        >
                          <Star
                            className={`w-5 h-5 transition-colors ${
                              s <= (reviewHover || reviewRating)
                                ? "fill-gold text-gold"
                                : "text-border"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Would repurchase */}
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      Would you repurchase?
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setWouldRepurchase(true)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          wouldRepurchase === true
                            ? "bg-green-500/10 text-green-400 border border-green-500/30"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        <ThumbsUp className="w-3 h-3" /> Yes
                      </button>
                      <button
                        onClick={() => setWouldRepurchase(false)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          wouldRepurchase === false
                            ? "bg-red-500/10 text-red-400 border border-red-500/30"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        <ThumbsDown className="w-3 h-3" /> No
                      </button>
                    </div>
                  </div>

                  {/* Side effects */}
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      Side effects? (optional)
                    </label>
                    <input
                      value={sideEffects}
                      onChange={(e) => setSideEffects(e.target.value)}
                      placeholder="e.g., mild irritation, breakout..."
                      className="w-full h-9 px-3 rounded-lg border border-border bg-input/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      Notes (optional)
                    </label>
                    <input
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Any additional thoughts..."
                      className="w-full h-9 px-3 rounded-lg border border-border bg-input/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={submitReview}
                      disabled={submitting || reviewRating === 0}
                      className="bg-gold text-charcoal hover:bg-gold-light font-semibold text-xs"
                    >
                      {submitting ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : null}
                      Submit Review
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setReviewingId(null)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
