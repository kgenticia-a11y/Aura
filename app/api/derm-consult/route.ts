import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  validateBody,
  dermConsultSchema,
  dermConsultResponseSchema,
} from "@/lib/validation";
import { getPremiumStatus } from "@/lib/premium";

// GET — list the current user's consultation requests.
// Admins additionally pass ?queue=1 to see the full pending queue.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const wantsQueue = searchParams.get("queue") === "1";

  if (wantsQueue) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("derm_consultations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to load queue" }, { status: 500 });
    }

    return NextResponse.json({ consultations: data });
  }

  const { data, error } = await supabase
    .from("derm_consultations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load consultations" }, { status: 500 });
  }

  return NextResponse.json({ consultations: data });
}

// POST — request a dermatologist review.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ok } = await rateLimit(`derm-consult:${user.id}`, 5, 60_000);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute." },
      { status: 429 }
    );
  }

  const { isPremium } = await getPremiumStatus(supabase, user.id);
  if (!isPremium) {
    return NextResponse.json(
      { error: "Dermatologist consultations are a Premium feature. Upgrade your plan to access expert reviews.", upgrade: true },
      { status: 403 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { data: body, error: validationError } = validateBody(rawBody, dermConsultSchema);
  if (validationError) return validationError;

  if (body.analysis_id) {
    const { data: analysis } = await supabase
      .from("skin_analyses")
      .select("id")
      .eq("id", body.analysis_id)
      .eq("user_id", user.id)
      .single();

    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }
  }

  const { data: consultation, error: insertError } = await supabase
    .from("derm_consultations")
    .insert({
      user_id: user.id,
      analysis_id: body.analysis_id ?? null,
      reason: body.reason,
      urgency: body.urgency,
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
  }

  await supabase.from("app_events").insert({
    user_id: user.id,
    event_type: "derm_consult_requested",
    metadata: { urgency: body.urgency, analysis_id: body.analysis_id ?? null },
  });

  return NextResponse.json({ consultation });
}

// PATCH — admin responds to a consultation request.
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { data: body, error: validationError } = validateBody(rawBody, dermConsultResponseSchema);
  if (validationError) return validationError;

  const { data: consultation, error: updateError } = await supabase
    .from("derm_consultations")
    .update({
      dermatologist_notes: body.dermatologist_notes,
      status: body.status,
      responded_at: new Date().toISOString(),
    })
    .eq("id", body.id)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Failed to update consultation" }, { status: 500 });
  }

  return NextResponse.json({ consultation });
}
