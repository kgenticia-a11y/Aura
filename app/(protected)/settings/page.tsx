"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
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
  Bell,
} from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [photoRetentionDays, setPhotoRetentionDays] = useState(90);
  const [cleaningUp, setCleaningUp] = useState(false);
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
        .select("full_name, email, email_notifications, weekly_summary, photo_retention_days")
        .eq("id", user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || "");
        setEmail(profile.email || user.email || "");
        setEmailNotifications(profile.email_notifications ?? true);
        setWeeklySummary(profile.weekly_summary ?? true);
        setPhotoRetentionDays(profile.photo_retention_days ?? 90);
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
        .update({
          full_name: fullName,
          email_notifications: emailNotifications,
          weekly_summary: weeklySummary,
          photo_retention_days: photoRetentionDays,
        })
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

      const response = await fetch("/api/account/delete", { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete account");
      }

      queryClient.clear();
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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 page-transition">
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

      {/* Notifications */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-gold" />
          Notifications
        </h2>
        <div className="space-y-4 p-5 rounded-2xl border border-border/50 bg-card/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Email Notifications</p>
              <p className="text-xs text-muted-foreground">
                Get notified about routine reminders and updates
              </p>
            </div>
            <button
              onClick={() => setEmailNotifications((v) => !v)}
              role="switch"
              aria-checked={emailNotifications}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                emailNotifications ? "bg-gold" : "bg-secondary"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  emailNotifications ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Weekly Summary</p>
              <p className="text-xs text-muted-foreground">
                Receive a weekly recap of your skin progress
              </p>
            </div>
            <button
              onClick={() => setWeeklySummary((v) => !v)}
              role="switch"
              aria-checked={weeklySummary}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                weeklySummary ? "bg-gold" : "bg-secondary"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  weeklySummary ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

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
              <p className="font-medium text-sm">Photo Retention</p>
              <p className="text-xs text-muted-foreground">
                Auto-delete selfie photos after this many days
              </p>
            </div>
            <select
              value={photoRetentionDays}
              onChange={(e) => setPhotoRetentionDays(Number(e.target.value))}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            >
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
              <option value={365}>1 year</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Clean Up Now</p>
              <p className="text-xs text-muted-foreground">
                Delete photos older than your retention period
              </p>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                setCleaningUp(true);
                try {
                  const res = await fetch("/api/photos/cleanup", { method: "POST" });
                  const data = await res.json();
                  if (res.ok) {
                    toast.success(data.message);
                  } else {
                    toast.error(data.error || "Cleanup failed.");
                  }
                } catch {
                  toast.error("Cleanup failed.");
                } finally {
                  setCleaningUp(false);
                }
              }}
              disabled={cleaningUp}
              className="border-gold/30 hover:bg-gold/10"
            >
              {cleaningUp ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Clean Up
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
