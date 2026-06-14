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
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraCaptureProps {
  onCapture: (blob: Blob, resolution: string) => void;
  loading?: boolean;
}

export function CameraCapture({ onCapture, loading }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedResolution, setCapturedResolution] = useState("");
  const [lightingQuality, setLightingQuality] = useState<"good" | "low" | "bright" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [flash, setFlash] = useState(false);

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

        // Start lighting analysis
        analyzeLighting();
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError(
        "Camera access denied. Please allow camera permissions or upload a photo instead."
      );
    }
  }, [facingMode]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
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

  // Analyze lighting from video frame
  const analyzeLighting = useCallback(() => {
    const checkLighting = () => {
      if (!videoRef.current || !canvasRef.current || !cameraActive) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Sample a small area for performance
      canvas.width = 64;
      canvas.height = 48;
      ctx.drawImage(video, 0, 0, 64, 48);

      const imageData = ctx.getImageData(0, 0, 64, 48);
      const data = imageData.data;

      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      const avgBrightness = totalBrightness / (data.length / 4);

      if (avgBrightness < 60) {
        setLightingQuality("low");
      } else if (avgBrightness > 220) {
        setLightingQuality("bright");
      } else {
        setLightingQuality("good");
      }

      if (cameraActive) {
        requestAnimationFrame(checkLighting);
      }
    };

    requestAnimationFrame(checkLighting);
  }, [cameraActive]);

  useEffect(() => {
    if (cameraActive) {
      analyzeLighting();
    }
  }, [cameraActive, analyzeLighting]);

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

      // Strip EXIF by re-rendering through canvas
      const img = new Image();
      img.onload = () => {
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
      img.src = URL.createObjectURL(file);
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
    startCamera();
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/webp"
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

            {/* Face alignment guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[70%] h-[78%] rounded-[50%] border-2 border-gold/50 mt-[-4%]" />
            </div>

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

            {/* Capture button */}
            <div className="absolute bottom-5 inset-x-0 flex justify-center">
              <button
                onClick={capturePhoto}
                className="w-20 h-20 rounded-full border-4 border-gold bg-gold/20 hover:bg-gold/40 transition-all duration-200 flex items-center justify-center active:scale-95"
              >
                <div className="w-16 h-16 rounded-full bg-gold" />
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
                onClick={() => startCamera()}
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
