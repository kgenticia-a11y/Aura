"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Camera,
  SwitchCamera,
  Upload,
  Sun,
  SunDim,
  Check,
  X,
  Loader2,
  User,
  ZoomIn,
  Move,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type GuidanceHint =
  | "searching"
  | "center"
  | "closer"
  | "lighting"
  | "hold"
  | "ready"
  | null;

interface CameraCaptureProps {
  onCapture: (blob: Blob, resolution: string) => void;
  loading?: boolean;
}

export function CameraCapture({ onCapture, loading }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const guidanceCanvasRef = useRef<HTMLCanvasElement>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedResolution, setCapturedResolution] = useState("");
  const [lightingQuality, setLightingQuality] = useState<"good" | "low" | "bright" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [flash, setFlash] = useState(false);
  const [guidance, setGuidance] = useState<GuidanceHint>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [readyToCapture, setReadyToCapture] = useState(false);
  const readyFramesRef = useRef(0);

  // Open the device's native camera app (most reliable on mobile browsers)
  const openNativeCamera = useCallback(() => {
    setError(null);
    captureInputRef.current?.click();
  }, []);

  // Use the in-page live camera preview (best on desktop/webcam)
  const isMobileDevice = useCallback(() => {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }, []);

  // Start camera with high-resolution constraints
  const startCamera = useCallback(async (mode: "user" | "environment" = facingMode) => {
    try {
      setError(null);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1920 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setFacingMode(mode);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError(
        "Camera access denied. Please allow camera permissions or upload a photo instead."
      );
    }
  }, [facingMode]);

  // Stop camera and reset guidance state
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setGuidance(null);
    setFaceDetected(false);
    setReadyToCapture(false);
    readyFramesRef.current = 0;
  }, []);

  // Switch between front and back cameras
  const switchCamera = useCallback(() => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    startCamera(nextMode);
  }, [facingMode, startCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Combined lighting + face analysis loop. Runs at ~10 fps to keep CPU low.
  // Uses the browser's native FaceDetector API when available (Chrome/Edge);
  // falls back to a skin-tone hue heuristic on other browsers.
  // A monotonically-increasing generation id identifies the currently-active
  // loop. Each effect run (and its cleanup) bumps the id, so a stale loop —
  // e.g. from StrictMode's double-invoke or a rapid camera restart — sees a
  // mismatch and exits instead of running concurrently with the new one.
  const analyzeGenerationRef = useRef(0);
  const faceDetectorRef = useRef<unknown>(null);

  useEffect(() => {
    if (!cameraActive) return;

    analyzeGenerationRef.current += 1;
    const generation = analyzeGenerationRef.current;

    // Try to create a native FaceDetector
    if ("FaceDetector" in window && !faceDetectorRef.current) {
      try {
        faceDetectorRef.current = new (window as unknown as { FaceDetector: new () => unknown }).FaceDetector();
      } catch {
        faceDetectorRef.current = null;
      }
    }

    let lastAnalysis = 0;
    let rafId = 0;
    const INTERVAL = 100; // ~10 fps

    const loop = async () => {
      if (analyzeGenerationRef.current !== generation) return;

      const now = performance.now();
      if (now - lastAnalysis < INTERVAL) {
        rafId = requestAnimationFrame(loop);
        return;
      }
      lastAnalysis = now;

      const video = videoRef.current;
      const canvas = guidanceCanvasRef.current ?? canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      // Read-back happens ~10x/second, so hint the browser to keep the canvas
      // on a CPU-readable backing store to avoid per-frame GPU readback stalls.
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) { rafId = requestAnimationFrame(loop); return; }

      // Sample at 160x120 for analysis. Assigning width/height resets the
      // bitmap, so only do it when the size actually needs to change.
      if (canvas.width !== 160 || canvas.height !== 120) {
        canvas.width = 160;
        canvas.height = 120;
      }
      ctx.drawImage(video, 0, 0, 160, 120);

      const imageData = ctx.getImageData(0, 0, 160, 120);
      const data = imageData.data;

      // --- Lighting ---
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      const avgBrightness = totalBrightness / (data.length / 4);
      const lighting: "good" | "low" | "bright" =
        avgBrightness < 60 ? "low" : avgBrightness > 220 ? "bright" : "good";
      setLightingQuality(lighting);

      // --- Face detection ---
      let detected = false;
      let hint: GuidanceHint = "searching";
      // Only trust the native detector when a detect() call actually returns.
      // If detect() throws (broken/experimental impl), this stays false so the
      // skin-tone heuristic still runs instead of stranding the user.
      let nativeDetectionSucceeded = false;

      const detector = faceDetectorRef.current as { detect?: (source: HTMLVideoElement) => Promise<Array<{ boundingBox: DOMRect }>> } | null;
      if (detector?.detect) {
        try {
          const faces = await detector.detect(video);
          if (analyzeGenerationRef.current !== generation) return;
          nativeDetectionSucceeded = true;
          if (faces.length > 0) {
            detected = true;
            const box = faces[0].boundingBox;
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const faceCenterX = (box.x + box.width / 2) / vw;
            const faceCenterY = (box.y + box.height / 2) / vh;
            const faceRatio = (box.width * box.height) / (vw * vh);

            if (Math.abs(faceCenterX - 0.5) > 0.15 || Math.abs(faceCenterY - 0.45) > 0.15) {
              hint = "center";
            } else if (faceRatio < 0.04) {
              hint = "closer";
            } else if (lighting !== "good") {
              hint = "lighting";
            } else {
              hint = "ready";
            }
          }
        } catch {
          // FaceDetector failed — fall through to heuristic
        }
      }

      // Fallback: skin-tone hue heuristic (counts pixels in skin-tone HSV range).
      // Runs when no native detector exists OR the native detect() threw.
      if (!detected && !nativeDetectionSucceeded) {
        const centerX = Math.floor(160 * 0.3);
        const centerW = Math.floor(160 * 0.4);
        const centerY = Math.floor(120 * 0.2);
        const centerH = Math.floor(120 * 0.5);
        let skinPixels = 0;
        let totalPixels = 0;

        for (let y = centerY; y < centerY + centerH; y++) {
          for (let x = centerX; x < centerX + centerW; x++) {
            const i = (y * 160 + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            // Simple skin-tone filter (works across Fitzpatrick tones)
            if (r > 60 && g > 40 && b > 20 && r > g && r > b &&
                Math.abs(r - g) > 10 && r - b > 15) {
              skinPixels++;
            }
            totalPixels++;
          }
        }

        const skinRatio = skinPixels / totalPixels;
        if (skinRatio > 0.25) {
          detected = true;
          hint = skinRatio > 0.35 && lighting === "good" ? "ready" : "hold";
        }
      }

      // Bail before touching state if the camera was stopped/switched while
      // detect() was in flight, so we don't clobber the reset state.
      if (analyzeGenerationRef.current !== generation) return;

      // Debounce the ready state: only surface the green "ready" affordance
      // after several consecutive ready frames to avoid flicker. This gates the
      // visual cue, not the capture button, which stays available throughout.
      let nextReady = false;
      if (hint === "ready") {
        readyFramesRef.current++;
        if (readyFramesRef.current >= 5) {
          nextReady = true;
        }
      } else {
        readyFramesRef.current = 0;
      }

      setFaceDetected(detected);
      setReadyToCapture(nextReady);
      // While ramping up to the confirmed-ready state, keep showing "hold still"
      // rather than blanking the guidance for the ~500ms debounce window.
      const displayHint: GuidanceHint = detected
        ? hint === "ready" && !nextReady
          ? "hold"
          : hint
        : "searching";
      setGuidance(displayHint);

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      // Invalidate this generation and cancel any pending frame so the loop
      // cannot resume after teardown.
      analyzeGenerationRef.current += 1;
      cancelAnimationFrame(rafId);
    };
  }, [cameraActive]);

  // Capture photo at full resolution
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Use actual video resolution
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror the image only for the front-facing camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);

    // Brief flash effect for tactile feedback
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    const resolution = `${canvas.width}x${canvas.height}`;
    setCapturedResolution(resolution);

    // Convert to WebP at high quality
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          setCapturedImage(canvas.toDataURL("image/webp", 0.92));
          stopCamera();
        }
      },
      "image/webp",
      0.92
    );
  }, [stopCamera, facingMode]);

  // Handle file upload
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
      if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith(".heic")) {
        setError("Please upload a JPEG, PNG, WebP, or HEIC image.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("Photo must be under 10 MB.");
        return;
      }

      setError(null);

      // Strip EXIF by re-rendering through canvas
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);

        const resolution = `${canvas.width}x${canvas.height}`;
        setCapturedResolution(resolution);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              setCapturedBlob(blob);
              setCapturedImage(canvas.toDataURL("image/webp", 0.92));
            }
          },
          "image/webp",
          0.92
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setError("Could not read this image file. Try a different photo.");
      };
      img.src = objectUrl;
    },
    []
  );

  // Confirm and upload
  const handleConfirm = () => {
    if (capturedBlob) {
      onCapture(capturedBlob, capturedResolution);
    }
  };

  // Retake
  const handleRetake = () => {
    setCapturedImage(null);
    setCapturedBlob(null);
    setCapturedResolution("");
    if (isMobileDevice()) {
      openNativeCamera();
    } else {
      startCamera();
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Hidden canvases for processing */}
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={guidanceCanvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/webp"
        onChange={handleFileUpload}
        className="hidden"
      />
      {/* Triggers the device's native camera app directly on mobile browsers */}
      <input
        ref={captureInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Camera View or Captured Image */}
      <div className="relative aspect-[3/4] sm:aspect-[3/4] max-h-[80vh] rounded-2xl overflow-hidden bg-charcoal-light border border-border/50">
        {capturedImage ? (
          /* Preview captured image */
          <img
            src={capturedImage}
            alt="Captured selfie"
            className="w-full h-full object-cover"
          />
        ) : cameraActive ? (
          /* Live camera feed */
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={facingMode === "user" ? { transform: "scaleX(-1)" } : undefined}
            />

            {/* Flash effect */}
            {flash && (
              <div className="absolute inset-0 bg-white animate-pulse pointer-events-none" />
            )}

            {/* Face alignment guide — color reflects detection state */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={`w-[70%] h-[78%] rounded-[50%] border-2 mt-[-4%] transition-colors duration-300 ${
                  readyToCapture
                    ? "border-green-400/70"
                    : faceDetected
                    ? "border-gold/60"
                    : "border-white/30"
                }`}
              />
            </div>

            {/* F8 — Real-time capture guidance */}
            {guidance && guidance !== "ready" && (
              <div className="absolute bottom-24 inset-x-0 flex justify-center pointer-events-none">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md text-white text-sm font-medium">
                  {guidance === "searching" && (
                    <>
                      <User className="w-4 h-4 text-amber-400" />
                      <span>Position your face in the oval</span>
                    </>
                  )}
                  {guidance === "center" && (
                    <>
                      <Move className="w-4 h-4 text-amber-400" />
                      <span>Center your face</span>
                    </>
                  )}
                  {guidance === "closer" && (
                    <>
                      <ZoomIn className="w-4 h-4 text-amber-400" />
                      <span>Move a bit closer</span>
                    </>
                  )}
                  {guidance === "lighting" && (
                    <>
                      <SunDim className="w-4 h-4 text-amber-400" />
                      <span>
                        {lightingQuality === "low"
                          ? "Find some more light"
                          : "Reduce the brightness"}
                      </span>
                    </>
                  )}
                  {guidance === "hold" && (
                    <>
                      <Check className="w-4 h-4 text-gold" />
                      <span>Hold still...</span>
                    </>
                  )}
                </div>
              </div>
            )}
            {readyToCapture && (
              <div className="absolute bottom-24 inset-x-0 flex justify-center pointer-events-none">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 backdrop-blur-md border border-green-500/30 text-green-400 text-sm font-medium">
                  <Check className="w-4 h-4" />
                  <span>Looking great — tap to capture</span>
                </div>
              </div>
            )}

            {/* Top bar: lighting indicator + switch camera */}
            <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2">
              {lightingQuality ? (
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md ${
                    lightingQuality === "good"
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : lightingQuality === "low"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}
                >
                  {lightingQuality === "good" ? (
                    <Sun className="w-3 h-3" />
                  ) : (
                    <SunDim className="w-3 h-3" />
                  )}
                  {lightingQuality === "good"
                    ? "Good lighting"
                    : lightingQuality === "low"
                    ? "Too dark"
                    : "Too bright"}
                </div>
              ) : (
                <div />
              )}

              <button
                onClick={switchCamera}
                title="Switch camera"
                className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-95 transition-transform"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
            </div>

            {/* Capture button — pulses when ready */}
            <div className="absolute bottom-5 inset-x-0 flex justify-center">
              <button
                onClick={capturePhoto}
                className={`w-20 h-20 rounded-full border-4 transition-all duration-300 flex items-center justify-center active:scale-95 ${
                  readyToCapture
                    ? "border-green-400 bg-green-400/20 hover:bg-green-400/40 animate-pulse"
                    : "border-gold bg-gold/20 hover:bg-gold/40"
                }`}
              >
                <div className={`w-16 h-16 rounded-full transition-colors ${
                  readyToCapture ? "bg-green-400" : "bg-gold"
                }`} />
              </button>
            </div>
          </>
        ) : (
          /* No camera — show start options */
          <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center">
              <Camera className="w-10 h-10 text-gold" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Take a Selfie</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Use natural lighting and align your face with the guide for
                best results.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 px-4 py-2 rounded-lg">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button
                onClick={() => (isMobileDevice() ? openNativeCamera() : startCamera())}
                className="bg-gold text-charcoal hover:bg-gold-light font-semibold glow-gold transition-all duration-300"
              >
                <Camera className="w-4 h-4 mr-2" />
                Open Camera
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="border-gold/30 hover:bg-gold/10"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Photo
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Resolution info */}
      {capturedResolution && (
        <p className="text-xs text-muted-foreground/60 text-center mt-2">
          {capturedResolution} px
        </p>
      )}

      {/* Confirm / Retake buttons */}
      {capturedImage && (
        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={handleRetake}
            disabled={loading}
            className="flex-1 border-border hover:bg-muted"
          >
            <X className="w-4 h-4 mr-2" />
            Retake
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 bg-gold text-charcoal hover:bg-gold-light font-semibold glow-gold transition-all duration-300"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                Analyze My Skin
              </span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
