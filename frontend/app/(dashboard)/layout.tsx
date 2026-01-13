"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  ClipboardCheck,
  FileText,
  Search,
  Bell,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Jobs", href: "/jobs", icon: Briefcase },
  { name: "Candidates", href: "/candidates", icon: Users },
  { name: "Assessments", href: "/assessments", icon: ClipboardCheck },
  { name: "Offers", href: "/offers", icon: FileText },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

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

            {/* User Avatar */}
            <div className="w-10 h-10 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm bg-primary/20">
              <div className="w-full h-full flex items-center justify-center text-primary font-bold">
                U
              </div>
            </div>
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
