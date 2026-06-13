"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ChevronLeft, ArrowRight, ImageOff } from "lucide-react";
import Link from "next/link";

interface PhotoWithAnalysis {
  id: string;
  storage_path: string;
  captured_at: string;
  signed_url?: string;
  analysis?: {
    health_score: number;
    skin_type: string;
    hydration_level: string;
    concerns: Array<{ name: string; severity: string }>;
  };
}

export default function ComparePage() {
  const [photos, setPhotos] = useState<PhotoWithAnalysis[]>([]);
  const [beforeId, setBeforeId] = useState<string>("");
  const [afterId, setAfterId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhotos();
  }, []);

  async function loadPhotos() {
    const supabase = createClient();

    const { data: photoData } = await supabase
      .from("skin_photos")
      .select("id, storage_path, captured_at, analyzed")
      .eq("analyzed", true)
      .order("captured_at", { ascending: false })
      .limit(20);

    if (!photoData || photoData.length === 0) {
      setLoading(false);
      return;
    }

    // Get signed URLs and analyses
    const enriched = await Promise.all(
      photoData.map(async (p) => {
        const { data: urlData } = await supabase.storage
          .from("selfies")
          .createSignedUrl(p.storage_path, 3600);

        const { data: analysis } = await supabase
          .from("skin_analyses")
          .select("health_score, skin_type, hydration_level, concerns")
          .eq("photo_id", p.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        return {
          id: p.id,
          storage_path: p.storage_path,
          captured_at: p.captured_at,
          signed_url: urlData?.signedUrl,
          analysis: analysis || undefined,
        } as PhotoWithAnalysis;
      })
    );

    setPhotos(enriched);

    // Auto-select most recent and oldest by default
    if (enriched.length >= 2) {
      setAfterId(enriched[0].id);
      setBeforeId(enriched[enriched.length - 1].id);
    } else if (enriched.length === 1) {
      setAfterId(enriched[0].id);
    }

    setLoading(false);
  }

  const before = photos.find((p) => p.id === beforeId);
  const after = photos.find((p) => p.id === afterId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
      </div>
    );
  }

  if (photos.length < 2) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center page-transition">
        <ImageOff className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Not Enough Photos Yet</h1>
        <p className="text-muted-foreground mb-6">
          Take at least 2 analyzed selfies to compare your skin progress over
          time.
        </p>
        <Link
          href="/capture"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold text-charcoal font-semibold hover:bg-gold-light glow-gold transition-all"
        >
          Take a Selfie
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 page-transition">
      <Link
        href="/timeline"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to timeline
      </Link>

      <h1 className="text-3xl font-bold mb-2">
        Before & <span className="text-gradient-gold">After</span>
      </h1>
      <p className="text-muted-foreground mb-8">
        Compare two analyses side-by-side to see your skin journey.
      </p>

      {/* Photo selectors */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <PhotoSelector
          label="Before"
          value={beforeId}
          onChange={setBeforeId}
          photos={photos}
        />
        <PhotoSelector
          label="After"
          value={afterId}
          onChange={setAfterId}
          photos={photos}
        />
      </div>

      {/* Comparison */}
      <div className="grid md:grid-cols-2 gap-6">
        {before && <ComparisonCard label="Before" photo={before} />}
        {after && <ComparisonCard label="After" photo={after} />}
      </div>

      {/* Score Diff */}
      {before?.analysis && after?.analysis && (
        <div className="mt-8 p-5 rounded-2xl border border-gold/20 bg-gold/5 text-center">
          <p className="text-sm text-muted-foreground mb-2">Score Change</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-2xl font-bold">
              {before.analysis.health_score}
            </span>
            <ArrowRight className="w-5 h-5 text-gold" />
            <span className="text-3xl font-bold text-gradient-gold">
              {after.analysis.health_score}
            </span>
            <span
              className={`text-lg font-bold ${
                after.analysis.health_score > before.analysis.health_score
                  ? "text-green-400"
                  : after.analysis.health_score < before.analysis.health_score
                  ? "text-red-400"
                  : "text-muted-foreground"
              }`}
            >
              {after.analysis.health_score > before.analysis.health_score
                ? "+"
                : ""}
              {after.analysis.health_score - before.analysis.health_score}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoSelector({
  label,
  value,
  onChange,
  photos,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  photos: PhotoWithAnalysis[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-2 text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-lg border border-border bg-input/50 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
      >
        {photos.map((p) => (
          <option key={p.id} value={p.id}>
            {new Date(p.captured_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {p.analysis ? ` (Score: ${p.analysis.health_score})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function ComparisonCard({
  label,
  photo,
}: {
  label: string;
  photo: PhotoWithAnalysis;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
      <div className="aspect-square bg-charcoal-light relative">
        {photo.signed_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.signed_url}
            alt={label}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageOff className="w-8 h-8" />
          </div>
        )}
        <span className="absolute top-3 left-3 px-2 py-1 rounded-md bg-charcoal/80 backdrop-blur-sm text-xs font-semibold text-gold">
          {label}
        </span>
      </div>

      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-2">
          {new Date(photo.captured_at).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>

        {photo.analysis ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Score</span>
              <span className="font-bold text-gold">
                {photo.analysis.health_score}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="capitalize">{photo.analysis.skin_type}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Hydration</span>
              <span className="capitalize">{photo.analysis.hydration_level}</span>
            </div>
            {photo.analysis.concerns &&
              photo.analysis.concerns.length > 0 && (
                <div className="pt-2 border-t border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Concerns</p>
                  <div className="flex flex-wrap gap-1">
                    {photo.analysis.concerns.slice(0, 4).map((c, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground"
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No analysis available</p>
        )}
      </div>
    </div>
  );
}
