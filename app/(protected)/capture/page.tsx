"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CameraCapture } from "@/components/camera-capture";
import { toast } from "sonner";
import { trackEvent } from "@/lib/events";

export default function CapturePage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);

  async function handleCapture(blob: Blob, resolution: string) {
    setUploading(true);

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

      if (blob.size > 25 * 1024 * 1024) {
        toast.error("Photo is too large (max 25 MB). Please try again.");
        return;
      }

      // Generate unique filename
      const fileId = crypto.randomUUID();
      const storagePath = `${user.id}/${fileId}.webp`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("selfies")
        .upload(storagePath, blob, {
          contentType: "image/webp",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error("Failed to upload photo. Please try again.");
        return;
      }

      // Create skin_photos record
      const { data: photo, error: dbError } = await supabase
        .from("skin_photos")
        .insert({
          user_id: user.id,
          storage_path: storagePath,
          resolution,
          lighting_quality: "good", // Will be set by camera component in future
        })
        .select("id")
        .single();

      if (dbError) {
        console.error("DB error:", dbError);
        toast.error("Failed to save photo record.");
        return;
      }

      trackEvent("photo_captured", { resolution });
      toast.success("Photo uploaded! Starting AI analysis...");

      router.push(`/analysis/${photo.id}`);
    } catch (err) {
      console.error("Capture error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 page-transition">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Capture Your <span className="text-gradient-gold">Skin</span>
        </h1>
        <p className="text-muted-foreground">
          Take a high-resolution selfie in natural lighting for the most
          accurate analysis.
        </p>
      </div>

      <CameraCapture onCapture={handleCapture} loading={uploading} />

      {/* Tips */}
      <div className="mt-10 p-6 rounded-2xl border border-border/50 bg-card/50">
        <h3 className="font-semibold mb-3">Tips for Best Results</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-gold mt-0.5">1.</span>
            Use natural, even lighting — face a window during the day
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gold mt-0.5">2.</span>
            Remove makeup for the most accurate skin analysis
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gold mt-0.5">3.</span>
            Keep a neutral expression and face the camera directly
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gold mt-0.5">4.</span>
            Align your face within the oval guide on screen
          </li>
        </ul>
      </div>
    </div>
  );
}
