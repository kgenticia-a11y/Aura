import { redirect } from "next/navigation";
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
