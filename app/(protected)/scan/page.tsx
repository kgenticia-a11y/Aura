"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/events";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Loader2,
  ChevronLeft,
  ScanLine,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  FlaskConical,
  Type,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Crop,
} from "lucide-react";
import Link from "next/link";

interface ScanConflict {
  ingredient: string;
  conflicts_with: string;
  source: "same_product" | "your_routine";
  reason: string;
  severity: "warning" | "caution";
}

interface ScanResult {
  scan_id: string | null;
  product_name: string | null;
  ingredients: string[];
  flagged_actives: string[];
  conflicts: ScanConflict[];
  allergy_matches: { ingredient: string; allergy: string }[];
  suitability_note: string;
  skin_type: string | null;
}

async function fileToBase64(
  file: File,
  maxDim: number
): Promise<{ data: string; mimeType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx)
    return { data: dataUrl.split(",")[1], mimeType: file.type || "image/jpeg" };
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const out = canvas.toDataURL("image/jpeg", 0.88);
  return { data: out.split(",")[1], mimeType: "image/jpeg" };
}

function ZoomablePreview({
  src,
  onConfirm,
  onCancel,
  loading,
}: {
  src: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const pinchRef = useRef<{ initialDistance: number; initialZoom: number } | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 6;

  const clampPan = useCallback(
    (x: number, y: number, z: number) => {
      const el = containerRef.current;
      if (!el) return { x, y };
      const maxPanX = Math.max(0, ((z - 1) * el.clientWidth) / 2);
      const maxPanY = Math.max(0, ((z - 1) * el.clientHeight) / 2);
      return {
        x: Math.max(-maxPanX, Math.min(maxPanX, x)),
        y: Math.max(-maxPanY, Math.min(maxPanY, y)),
      };
    },
    []
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.25 : 0.25;
      setZoom((prev) => {
        const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta));
        setPan((p) => clampPan(p.x, p.y, next));
        return next;
      });
    },
    [clampPan]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "touch") return;
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      setIsInteracting(true);
    },
    [pan]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || e.pointerType === "touch") return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPan(clampPan(dragRef.current.panX + dx, dragRef.current.panY + dy, zoom));
    },
    [zoom, clampPan]
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    setIsInteracting(false);
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = {
          initialDistance: Math.hypot(dx, dy),
          initialZoom: zoom,
        };
        setIsInteracting(true);
      } else if (e.touches.length === 1 && zoom > 1) {
        dragRef.current = {
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          panX: pan.x,
          panY: pan.y,
        };
        setIsInteracting(true);
      }
    },
    [zoom, pan]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.hypot(dx, dy);
        const scale = distance / pinchRef.current.initialDistance;
        const next = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, pinchRef.current.initialZoom * scale)
        );
        setZoom(next);
        setPan((p) => clampPan(p.x, p.y, next));
      } else if (e.touches.length === 1 && dragRef.current && zoom > 1) {
        const dx = e.touches[0].clientX - dragRef.current.startX;
        const dy = e.touches[0].clientY - dragRef.current.startY;
        setPan(clampPan(dragRef.current.panX + dx, dragRef.current.panY + dy, zoom));
      }
    },
    [zoom, clampPan]
  );

  const handleTouchEnd = useCallback(() => {
    pinchRef.current = null;
    dragRef.current = null;
    setIsInteracting(false);
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => el.removeEventListener("touchmove", prevent);
  }, []);

  return (
    <div className="space-y-3">
      {/* Zoom controls */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Crop className="w-3.5 h-3.5" />
          Pinch or scroll to zoom — verify the text is readable
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const next = Math.max(MIN_ZOOM, zoom - 0.5);
              setZoom(next);
              setPan((p) => clampPan(p.x, p.y, next));
            }}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => {
              const next = Math.min(MAX_ZOOM, zoom + 0.5);
              setZoom(next);
              setPan((p) => clampPan(p.x, p.y, next));
            }}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          {zoom > 1 && (
            <button
              onClick={resetView}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Reset zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Zoomable image container */}
      <div
        ref={containerRef}
        className="relative rounded-2xl border border-border/50 overflow-hidden bg-black/50 aspect-[3/4] max-h-[65vh] cursor-grab active:cursor-grabbing select-none touch-none"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={src}
          alt="Label preview"
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isInteracting ? "none" : "transform 0.15s ease-out",
          }}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 border-border hover:bg-muted"
        >
          <X className="w-4 h-4 mr-2" />
          Retake
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 bg-gold text-charcoal hover:bg-gold-light font-semibold glow-gold transition-all duration-300"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Scanning…
            </>
          ) : (
            <>
              <ScanLine className="w-4 h-4 mr-2" />
              Scan ingredients
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function ScanPage() {
  const [mode, setMode] = useState<"photo" | "text">("photo");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [preview, setPreview] = useState<{
    url: string;
    data: string;
    mimeType: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function runScan(body: Record<string, unknown>) {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/scan-ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Scan failed. Please try again.");
        return;
      }
      setResult(data);
      setPreview(null);
      trackEvent("ingredient_scanned", {
        source: body.image ? "photo" : "text",
        conflicts: data.conflicts?.length ?? 0,
      });
      if (data.conflicts?.length > 0 || data.allergy_matches?.length > 0) {
        toast.warning("Heads up — we found some interactions to check.");
      } else {
        toast.success("Scan complete — no conflicts found.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Image is too large (max 25 MB).");
      return;
    }
    try {
      const previewUrl = URL.createObjectURL(file);
      const { data, mimeType } = await fileToBase64(file, 2560);
      setPreview({ url: previewUrl, data, mimeType });
      setResult(null);
    } catch {
      toast.error("Couldn't read that image. Try another photo.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleTextScan() {
    if (text.trim().length < 3) {
      toast.error("Paste an ingredient list first.");
      return;
    }
    runScan({ ingredients_text: text.trim() });
  }

  function handlePreviewConfirm() {
    if (!preview) return;
    runScan({ image: preview.data, mime_type: preview.mimeType });
  }

  function handlePreviewCancel() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 page-transition">
      <Link
        href="/routine"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to routine
      </Link>

      <h1 className="text-3xl font-bold mb-2">
        Ingredient <span className="text-gradient-gold">Scanner</span>
      </h1>
      <p className="text-muted-foreground mb-8">
        Scan a product label or paste its ingredients. We&apos;ll flag interactions with
        your current routine and your allergies before you buy.
      </p>

      {/* Photo preview with zoom */}
      {preview ? (
        <ZoomablePreview
          src={preview.url}
          onConfirm={handlePreviewConfirm}
          onCancel={handlePreviewCancel}
          loading={loading}
        />
      ) : !result ? (
        <>
          {/* Mode toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode("photo")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                mode === "photo"
                  ? "bg-gold text-charcoal"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <Camera className="w-4 h-4" />
              Scan label
            </button>
            <button
              onClick={() => setMode("text")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                mode === "text"
                  ? "bg-gold text-charcoal"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <Type className="w-4 h-4" />
              Paste ingredients
            </button>
          </div>

          {/* Input area */}
          {mode === "photo" ? (
            <div className="p-8 rounded-2xl border border-dashed border-border/70 bg-card/50 text-center">
              <ScanLine className="w-10 h-10 text-gold mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">
                Take a clear, close-up photo of the ingredient list on the back label.
              </p>
              <p className="text-xs text-muted-foreground/60 mb-4">
                You can zoom in to verify the text is readable before scanning.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFile}
                className="hidden"
                disabled={loading}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="bg-gold text-charcoal hover:bg-gold-light font-semibold"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Camera className="w-4 h-4 mr-2" />
                )}
                {loading ? "Processing…" : "Upload or take a photo"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the ingredient list, e.g. Water, Niacinamide, Glycolic Acid, Retinol…"
                rows={5}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-border bg-input/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors resize-y"
              />
              <Button
                onClick={handleTextScan}
                disabled={loading}
                className="bg-gold text-charcoal hover:bg-gold-light font-semibold"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ScanLine className="w-4 h-4 mr-2" />
                )}
                {loading ? "Scanning…" : "Check ingredients"}
              </Button>
            </div>
          )}
        </>
      ) : null}

      {/* Results */}
      {result && (
        <div className="mt-8 space-y-5">
          {result.product_name && (
            <h2 className="text-xl font-semibold">{result.product_name}</h2>
          )}

          {/* Allergy alerts — highest priority */}
          {result.allergy_matches.length > 0 && (
            <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/5">
              <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
                <ShieldAlert className="w-4 h-4" />
                Allergy warning
              </div>
              <ul className="space-y-1 text-sm text-red-400/90">
                {result.allergy_matches.map((m, i) => (
                  <li key={i}>
                    Contains <strong>{m.ingredient}</strong> — matches your listed allergy
                    &ldquo;{m.allergy}&rdquo;.
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Conflicts */}
          {result.conflicts.length > 0 ? (
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-gold" />
                {result.conflicts.length} interaction
                {result.conflicts.length > 1 ? "s" : ""} to check
              </h3>
              {result.conflicts.map((c, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl border ${
                    c.severity === "warning"
                      ? "border-red-400/40 bg-red-400/5"
                      : "border-amber-400/40 bg-amber-400/5"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 text-sm font-medium flex-wrap">
                    <span
                      className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full font-semibold ${
                        c.severity === "warning"
                          ? "bg-red-400/15 text-red-400"
                          : "bg-amber-400/15 text-amber-500"
                      }`}
                    >
                      {c.severity}
                    </span>
                    <span>
                      {c.ingredient} + {c.conflicts_with}
                    </span>
                    {c.source === "your_routine" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold">
                        in your routine
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{c.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            result.allergy_matches.length === 0 && (
              <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/5 flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                No ingredient conflicts detected with your current routine.
              </div>
            )
          )}

          {/* Suitability */}
          <div className="p-4 rounded-xl border border-border/50 bg-card/50">
            <div className="flex items-center gap-2 font-semibold mb-1">
              <FlaskConical className="w-4 h-4 text-gold" />
              Suitability
            </div>
            <p className="text-sm text-muted-foreground">{result.suitability_note}</p>
          </div>

          {/* Flagged actives */}
          {result.flagged_actives.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Key actives</h3>
              <div className="flex flex-wrap gap-1.5">
                {result.flagged_actives.map((a, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded-full bg-gold/10 text-gold border border-gold/20"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Full ingredient list */}
          <details className="rounded-xl border border-border/50 bg-card/30 p-4">
            <summary className="text-sm font-medium cursor-pointer">
              Full ingredient list ({result.ingredients.length})
            </summary>
            <p className="mt-2 text-xs text-muted-foreground/80 leading-relaxed">
              {result.ingredients.join(", ")}
            </p>
          </details>

          {/* Scan another */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setText("");
              }}
              className="border-border hover:bg-muted"
            >
              <ScanLine className="w-4 h-4 mr-2" />
              Scan another product
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground/60">
            Cosmetic guidance only — not medical advice. When in doubt, patch-test and
            consult a dermatologist.
          </p>
        </div>
      )}
    </div>
  );
}
