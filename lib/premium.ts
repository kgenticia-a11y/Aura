import type { SupabaseClient } from "@supabase/supabase-js";

export interface PremiumStatus {
  isPremium: boolean;
}

export async function getPremiumStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<PremiumStatus> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("getPremiumStatus failed for user", userId, error.message);
  }

  return { isPremium: data?.is_premium === true };
}

export const FREE_LIMITS = {
  analysesPerDay: 2,
  scansPerDay: 5,
} as const;

export const PREMIUM_LIMITS = {
  analysesPerDay: 10,
  scansPerDay: 50,
} as const;
