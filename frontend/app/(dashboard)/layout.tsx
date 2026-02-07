"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Bell,
  Sparkles,
  Kanban,
  User as UserIcon,
  Users,
  Phone,
  Menu,
  X,
  Settings,
  HelpCircle,
  Mail,
  LayoutGrid,
  Search,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Jobs", href: "/jobs", icon: Briefcase },
  { name: "Candidates", href: "/candidates", icon: Users },
  { name: "Sourcing", href: "/sourcing", icon: Search },
  { name: "Add Candidate", href: "/sourcing/new", icon: UserPlus },
  { name: "Phone Screens", href: "/phone-screens", icon: Phone },
  { name: "Pipeline", href: "/pipeline", icon: Kanban },
  { name: "Offers", href: "/offers", icon: FileText },
];

function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Overview";
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  const titles: Record<string, string> = {
    jobs: "Jobs",
    candidates: "Candidates",
    "phone-screens": "Phone Screens",
    pipeline: "Pipeline",
    offers: "Offers",
    assessments: "Assessments",
    campaigns: "Campaigns",
    sourcing: "Sourcing",
    marathon: "Marathon",
  };
  return titles[first] || first.charAt(0).toUpperCase() + first.slice(1).replace(/-/g, " ");
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center text-white">
          <Sparkles className="w-5 h-5" />
        </div>
        <span className="text-base font-bold text-zinc-900 tracking-wide uppercase">TalentAI</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navigation.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
                active
                  ? "bg-zinc-50 text-zinc-900 font-semibold"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
              )}
            >
              <item.icon className={cn("w-5 h-5", active ? "text-zinc-900" : "text-zinc-400")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-4 space-y-1">
        <Link
          href="#"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
        >
          <Settings className="w-5 h-5 text-zinc-400" />
          Settings
        </Link>
        <Link
          href="#"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
        >
          <HelpCircle className="w-5 h-5 text-zinc-400" />
          Help center
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-zinc-100 z-50">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-600 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 bg-white border-r border-zinc-100">
        {sidebar}
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-zinc-100">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 text-zinc-500 hover:text-zinc-700 rounded-xl lg:hidden"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-semibold text-zinc-900">{getPageTitle(pathname)}</h1>
            </div>

            <div className="flex items-center gap-2">
              <button className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors">
                <LayoutGrid className="w-5 h-5 text-zinc-500" />
              </button>
              <button className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors">
                <Mail className="w-5 h-5 text-zinc-500" />
              </button>
              <button className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors relative">
                <Bell className="w-5 h-5 text-zinc-500" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full" />
              </button>
              <button className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-white hover:bg-zinc-800 transition-colors">
                <UserIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="max-w-7xl mx-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
