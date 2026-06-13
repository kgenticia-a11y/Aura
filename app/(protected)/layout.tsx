import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch profile for the header
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, avatar_url")
    .eq("id", user.id)
    .single();

  // Check if onboarding is completed — redirect if not
  const headersList = await headers();
  const pathname = headersList.get("x-next-pathname") || "";
  const isOnboardingPage = pathname.includes("/onboarding");

  if (!isOnboardingPage) {
    const { data: skinProfile } = await supabase
      .from("skin_profiles")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .single();

    if (!skinProfile?.onboarding_completed) {
      redirect("/onboarding");
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        user={{
          name: profile?.full_name || user.email || "User",
          email: user.email || "",
          avatarUrl: profile?.avatar_url,
        }}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
