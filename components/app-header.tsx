"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Sparkles,
  LayoutDashboard,
  Camera,
  FlaskConical,
  Settings,
  LogOut,
  User,
  Clock,
  Package,
} from "lucide-react";
import { toast } from "sonner";

interface AppHeaderProps {
  user: {
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}

export function AppHeader({ user }: AppHeaderProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out successfully.");
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-gold" />
          <span className="text-lg font-bold text-gradient-gold">Aura</span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          <NavLink href="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />}>
            Dashboard
          </NavLink>
          <NavLink href="/capture" icon={<Camera className="w-4 h-4" />}>
            Capture
          </NavLink>
          <NavLink href="/routine" icon={<FlaskConical className="w-4 h-4" />}>
            Routine
          </NavLink>
          <NavLink href="/products" icon={<Package className="w-4 h-4" />}>
            Products
          </NavLink>
          <NavLink href="/timeline" icon={<Clock className="w-4 h-4" />}>
            Timeline
          </NavLink>
        </nav>

        {/* User menu */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium truncate max-w-[140px]">
              {user.name}
            </p>
          </div>

          <Link
            href="/settings"
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-4 h-4" />
          </Link>

          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User className="w-4 h-4 text-gold" />
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden flex items-center justify-around border-t border-border/30 py-2 px-4">
        <NavLink href="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />}>
          Dashboard
        </NavLink>
        <NavLink href="/capture" icon={<Camera className="w-4 h-4" />}>
          Capture
        </NavLink>
        <NavLink href="/routine" icon={<FlaskConical className="w-4 h-4" />}>
          Routine
        </NavLink>
        <NavLink href="/settings" icon={<Settings className="w-4 h-4" />}>
          Settings
        </NavLink>
      </nav>
    </header>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
