"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { trackEvent } from "@/lib/events";
import { Button } from "@/components/ui/button";
import {
  User,
  Shield,
  Trash2,
  Download,
  Loader2,
  Save,
  ChevronLeft,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [skinProfile, setSkinProfile] = useState<{
    known_skin_type: string;
    budget_preference: string;
    skin_goals: string[];
    allergies: string[];
  } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || "");
        setEmail(profile.email || user.email || "");
      }

      const { data: sp } = await supabase
        .from("skin_profiles")
        .select("known_skin_type, budget_preference, skin_goals, allergies")
        .eq("user_id", user.id)
        .single();

      if (sp) {
        setSkinProfile(sp);
      }

      setLoading(false);
    }

    loadSettings();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id);

      toast.success("Settings saved.");
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleExportData() {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [
        { data: profile },
        { data: skinProfileData },
        { data: analyses },
        { data: routines },
        { data: feedback },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("skin_profiles")
          .select("*")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("skin_analyses")
          .select("*")
          .eq("user_id", user.id),
        supabase.from("routines").select("*").eq("user_id", user.id),
        supabase
          .from("routine_feedback")
          .select("*")
          .eq("user_id", user.id),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        profile,
        skin_profile: skinProfileData,
        analyses,
        routines,
        feedback,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aura-data-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      trackEvent("data_exported");
      toast.success("Data exported successfully.");
    } catch {
      toast.error("Failed to export data.");
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Delete all user data (cascade will handle most)
      await supabase.from("routine_feedback").delete().eq("user_id", user.id);
      await supabase.from("routines").delete().eq("user_id", user.id);
      await supabase.from("skin_analyses").delete().eq("user_id", user.id);
      await supabase.from("skin_photos").delete().eq("user_id", user.id);
      await supabase.from("skin_profiles").delete().eq("user_id", user.id);
      await supabase.from("profiles").delete().eq("id", user.id);

      // Delete storage files
      const { data: files } = await supabase.storage
        .from("selfies")
        .list(user.id);

      if (files && files.length > 0) {
        await supabase.storage
          .from("selfies")
          .remove(files.map((f) => `${user.id}/${f.name}`));
      }

      // Sign out
      await supabase.auth.signOut();

      toast.success("Account deleted. We're sorry to see you go.");
      router.push("/");
    } catch {
      toast.error("Failed to delete account. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 page-transition">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Dashboard
      </Link>

      <h1 className="text-3xl font-bold mb-8">
        <span className="text-gradient-gold">Settings</span>
      </h1>

      {/* Profile */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-gold" />
          Profile
        </h2>
        <div className="space-y-4 p-5 rounded-2xl border border-border/50 bg-card/50">
          <div>
            <label className="block text-sm font-medium mb-2">Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-border bg-input/50 text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              value={email}
              disabled
              className="w-full h-11 px-4 rounded-lg border border-border bg-input/30 text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground/60 mt-1">
              Email cannot be changed
            </p>
          </div>

          {skinProfile && (
            <div className="pt-3 border-t border-border/30">
              <p className="text-sm font-medium mb-2">Skin Profile</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-secondary text-muted-foreground capitalize">
                  {skinProfile.known_skin_type} skin
                </span>
                <span className="px-2 py-1 rounded-full bg-secondary text-muted-foreground capitalize">
                  {skinProfile.budget_preference} budget
                </span>
                {skinProfile.skin_goals?.map((g, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-full bg-gold/10 text-gold"
                  >
                    {g}
                  </span>
                ))}
              </div>
              <Link
                href="/onboarding"
                className="text-xs text-gold hover:underline mt-2 inline-block"
              >
                Update skin profile
              </Link>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gold text-charcoal hover:bg-gold-light font-semibold glow-gold transition-all duration-300"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </section>

      {/* Privacy & Data */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-gold" />
          Privacy & Data
        </h2>
        <div className="space-y-3 p-5 rounded-2xl border border-border/50 bg-card/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Download My Data</p>
              <p className="text-xs text-muted-foreground">
                Export all your data as JSON
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleExportData}
              className="border-gold/30 hover:bg-gold/10"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Privacy Policy</p>
              <p className="text-xs text-muted-foreground">
                Review how we handle your data
              </p>
            </div>
            <Link
              href="/privacy"
              className="text-sm text-gold hover:underline"
            >
              View
            </Link>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-red-400">
          <Trash2 className="w-4 h-4" />
          Danger Zone
        </h2>
        <div className="p-5 rounded-2xl border border-red-500/20 bg-red-500/5">
          <p className="text-sm mb-3">
            Permanently delete your account and all associated data. This
            action cannot be undone.
          </p>

          {!showDeleteConfirm ? (
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete My Account
            </Button>
          ) : (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">
                  This will permanently delete your profile, all analyses,
                  routines, photos, and feedback. Are you absolutely sure?
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-red-500 text-white hover:bg-red-600"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Yes, Delete Everything
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
