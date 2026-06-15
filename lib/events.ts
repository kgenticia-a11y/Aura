import { createClient } from "@/lib/supabase/client";

export type EventType =
  | "signup"
  | "login"
  | "photo_captured"
  | "analysis_completed"
  | "routine_generated"
  | "routine_step_completed"
  | "feedback_submitted"
  | "product_reviewed"
  | "settings_updated"
  | "data_exported"
  | "onboarding_completed"
  | "derm_consult_requested";

export async function trackEvent(
  eventType: EventType,
  metadata: Record<string, unknown> = {}
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("app_events").insert({
      user_id: user.id,
      event_type: eventType,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        user_agent:
          typeof window !== "undefined" ? window.navigator.userAgent : null,
      },
    });
  } catch (err) {
    // Silently fail — analytics should never break the app
    console.error("Event tracking error:", err);
  }
}
