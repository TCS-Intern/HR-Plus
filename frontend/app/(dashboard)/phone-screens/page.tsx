"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Phone,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  PlayCircle,
  RotateCcw,
  User,
  MessageSquare,
  Globe,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PhoneScreen } from "@/types";
import { supabase } from "@/lib/supabase/client";

const statusConfig: Record<
  string,
  { color: string; icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  scheduled: { color: "bg-blue-100 text-blue-600", icon: Clock, label: "Scheduled" },
  calling: { color: "bg-amber-100 text-amber-600", icon: Phone, label: "Calling" },
  in_progress: { color: "bg-purple-100 text-purple-600", icon: PlayCircle, label: "In Progress" },
  completed: { color: "bg-green-100 text-green-600", icon: CheckCircle, label: "Completed" },
  analyzed: { color: "bg-emerald-100 text-emerald-600", icon: CheckCircle, label: "Analyzed" },
  failed: { color: "bg-red-100 text-red-600", icon: XCircle, label: "Failed" },
  no_answer: { color: "bg-orange-100 text-orange-600", icon: AlertCircle, label: "No Answer" },
  cancelled: { color: "bg-slate-100 text-slate-600", icon: XCircle, label: "Cancelled" },
};

const recommendationColors: Record<string, string> = {
  STRONG_YES: "text-emerald-600 bg-emerald-100",
  YES: "text-green-600 bg-green-100",
  MAYBE: "text-amber-600 bg-amber-100",
  NO: "text-red-600 bg-red-100",
};

function PhoneScreenCard({ phoneScreen }: { phoneScreen: PhoneScreen & { applications?: { candidates?: { first_name: string; last_name: string }; jobs?: { title: string } }; interview_mode?: string; access_token?: string } }) {
  const status = statusConfig[phoneScreen.status] || statusConfig.scheduled;
  const StatusIcon = status.icon;

  const candidateName = phoneScreen.applications?.candidates
    ? `${phoneScreen.applications.candidates.first_name} ${phoneScreen.applications.candidates.last_name}`
    : "Unknown Candidate";
  const jobTitle = phoneScreen.applications?.jobs?.title || "Unknown Position";

  const isWebInterview = phoneScreen.interview_mode === "web" || phoneScreen.interview_mode === "simulation";
  const canPreview = isWebInterview && phoneScreen.access_token && phoneScreen.status !== "completed" && phoneScreen.status !== "analyzed";

  return (
    <Link
      href={`/phone-screens/${phoneScreen.id}`}
      className="glass-card rounded-2xl p-5 hover:shadow-lg transition-all group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            isWebInterview ? "bg-blue-100 dark:bg-blue-900/40" : "bg-primary/10"
          )}>
            {isWebInterview ? (
              <MessageSquare className="w-5 h-5 text-blue-600" />
            ) : (
              <User className="w-5 h-5 text-primary" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors">
              {candidateName}
            </h3>
            <p className="text-sm text-slate-500">{jobTitle}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1",
              status.color
            )}
          >
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </span>
          {phoneScreen.interview_mode && phoneScreen.interview_mode !== "phone" && (
            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1",
              phoneScreen.interview_mode === "simulation"
                ? "bg-amber-100 text-amber-700"
                : "bg-blue-100 text-blue-700"
            )}>
              {phoneScreen.interview_mode === "simulation" ? (
                <>
                  <Eye className="w-2.5 h-2.5" />
                  Simulation
                </>
              ) : (
                <>
                  <Globe className="w-2.5 h-2.5" />
                  Web
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Call/Interview Info */}
      <div className="flex flex-wrap gap-3 mb-4">
        {phoneScreen.phone_number && !isWebInterview && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Phone className="w-3 h-3" />
            {phoneScreen.phone_number}
          </div>
        )}
        {phoneScreen.duration_seconds && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            {Math.floor(phoneScreen.duration_seconds / 60)}m {phoneScreen.duration_seconds % 60}s
          </div>
        )}
        {phoneScreen.attempt_number > 1 && (
          <div className="flex items-center gap-1 text-xs text-orange-500">
            <RotateCcw className="w-3 h-3" />
            Attempt {phoneScreen.attempt_number}
          </div>
        )}
        {canPreview && (
          <Link
            href={`/phone-screens/preview/${phoneScreen.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <PlayCircle className="w-3 h-3" />
            Preview Interview
          </Link>
        )}
      </div>

      {/* Analysis Summary */}
      {phoneScreen.recommendation && (
        <div className="flex items-center gap-2 mb-4">
          <span
            className={cn(
              "px-2 py-1 text-xs font-bold rounded-lg",
              recommendationColors[phoneScreen.recommendation] || "bg-slate-100 text-slate-600"
            )}
          >
            {phoneScreen.recommendation.replace("_", " ")}
          </span>
          {phoneScreen.overall_score !== null && (
            <span className="text-xs text-slate-500">
              Score: {phoneScreen.overall_score}%
            </span>
          )}
        </div>
      )}

      {/* Summary */}
      {phoneScreen.summary?.key_takeaways && phoneScreen.summary.key_takeaways.length > 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">
          {phoneScreen.summary.key_takeaways[0]}
        </p>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
        <div className="text-xs text-slate-500">
          {phoneScreen.scheduled_at
            ? new Date(phoneScreen.scheduled_at).toLocaleDateString()
            : new Date(phoneScreen.created_at).toLocaleDateString()}
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
      </div>
    </Link>
  );
}

export default function PhoneScreensPage() {
  const [phoneScreens, setPhoneScreens] = useState<PhoneScreen[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchPhoneScreens() {
      let query = supabase
        .from("phone_screens")
        .select("*, applications(*, candidates(*), jobs(*))")
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;

      if (!error && data) {
        setPhoneScreens(data as unknown as PhoneScreen[]);
      }
      setLoading(false);
    }

    fetchPhoneScreens();
  }, [filter]);

  const filterOptions = [
    "all",
    "scheduled",
    "in_progress",
    "completed",
    "analyzed",
    "failed",
    "no_answer",
  ];

  const stats = {
    total: phoneScreens.length,
    completed: phoneScreens.filter((p) => p.status === "completed" || p.status === "analyzed").length,
    pending: phoneScreens.filter((p) => p.status === "scheduled" || p.status === "calling").length,
    strongYes: phoneScreens.filter((p) => p.recommendation === "STRONG_YES").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Phone Screens</h1>
          <p className="text-sm text-slate-500">AI-powered phone screening calls</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4">
          <div className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total}</div>
          <div className="text-sm text-slate-500">Total Screens</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-slate-500">Completed</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
          <div className="text-sm text-slate-500">Pending</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-2xl font-bold text-emerald-600">{stats.strongYes}</div>
          <div className="text-sm text-slate-500">Strong Yes</div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 p-1 rounded-xl overflow-x-auto">
          {filterOptions.map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all whitespace-nowrap",
                filter === option
                  ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
              )}
            >
              {option.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex items-center bg-white/60 dark:bg-slate-800/60 px-3 py-2 rounded-xl">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-40 text-slate-800 dark:text-white placeholder-slate-400"
            />
          </div>
          <button className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-slate-600 dark:text-slate-300">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Phone Screens Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-2xl p-5 animate-pulse">
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded mb-2 w-3/4" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded mb-4 w-1/2" />
              <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : phoneScreens.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
            No phone screens yet
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            Phone screens will appear here when you schedule AI calls with candidates.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {phoneScreens.map((phoneScreen) => (
            <PhoneScreenCard key={phoneScreen.id} phoneScreen={phoneScreen as any} />
          ))}
        </div>
      )}
    </div>
  );
}
