"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  Search,
  Bell,
  Sparkles,
  Kanban,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthProvider, useRequireAuth } from "@/components/auth/AuthProvider";
import { useState, useRef, useEffect } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Jobs", href: "/jobs", icon: Briefcase },
  { name: "Pipeline", href: "/pipeline", icon: Kanban },
  { name: "Offers", href: "/offers", icon: FileText },
];

function UserMenu() {
  const { user, signOut, role, isLoading } = useRequireAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="w-10 h-10 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm bg-slate-200 animate-pulse" />
    );
  }

  // Get user initials
  const getInitials = () => {
    if (!user) return "?";
    const fullName = user.user_metadata?.full_name;
    if (fullName) {
      const parts = fullName.split(" ");
      return parts.length > 1
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : parts[0][0].toUpperCase();
    }
    return user.email?.[0].toUpperCase() || "U";
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm bg-primary/20 hover:bg-primary/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        aria-label="User menu"
      >
        <div className="w-full h-full flex items-center justify-center text-primary font-bold text-sm">
          {getInitials()}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {user?.user_metadata?.full_name || "User"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {user?.email}
            </p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full capitalize">
              {role}
            </span>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/settings/profile"
              className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => setIsOpen(false)}
            >
              <UserIcon className="w-4 h-4" />
              Profile Settings
            </Link>
            <button
              onClick={() => {
                setIsOpen(false);
                signOut();
              }}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading, isAuthenticated } = useRequireAuth();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render content if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-[1440px] glass-panel rounded-3xl p-6 lg:p-8 flex flex-col gap-6 overflow-hidden">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            {/* Logo */}
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5" />
            </div>

            {/* Navigation */}
            <div className="flex bg-white/50 dark:bg-slate-800/50 p-1 rounded-2xl gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "px-5 py-2 rounded-xl text-sm font-medium transition-all",
                    isActive(item.href)
                      ? "bg-primary text-white shadow-lg shadow-primary/30"
                      : "text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50"
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative flex items-center bg-white/60 dark:bg-slate-800/60 px-4 py-2 rounded-2xl">
              <Search className="w-5 h-5 text-slate-400 mr-2" />
              <input
                type="text"
                placeholder="Global search..."
                className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-48 text-slate-800 dark:text-white placeholder-slate-400"
              />
            </div>

            {/* Date */}
            <div className="hidden lg:flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 px-4 py-2 rounded-2xl">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>

            {/* Notifications */}
            <button className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-white transition-all relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* User Menu */}
            <UserMenu />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="flex items-center justify-between glass-card p-4 rounded-3xl">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="status-dot bg-green-500" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Gemini 2.5 Flash Active
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="status-dot bg-primary" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                ADK Real-time Sync
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-1.5 bg-white/60 dark:bg-slate-800/60 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-white transition-all">
              Export Report
            </button>
            <button className="px-4 py-1.5 bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 transition-all hover:scale-105 active:scale-95">
              Open Copilot
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  );
}
