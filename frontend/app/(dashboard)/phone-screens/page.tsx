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
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";

const statusBadgeConfig: Record<
  string,
  { variant: "default" | "primary" | "success" | "warning" | "error" | "info" | "purple"; icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  scheduled: { variant: "info", icon: Clock, label: "Scheduled" },
  calling: { variant: "warning", icon: Phone, label: "Calling" },
  in_progress: { variant: "purple", icon: PlayCircle, label: "In Progress" },
  completed: { variant: "success", icon: CheckCircle, label: "Completed" },
  analyzed: { variant: "success", icon: CheckCircle, label: "Analyzed" },
  failed: { variant: "error", icon: XCircle, label: "Failed" },
  no_answer: { variant: "warning", icon: AlertCircle, label: "No Answer" },
  cancelled: { variant: "default", icon: XCircle, label: "Cancelled" },
};

const recommendationBadgeVariant: Record<string, "success" | "info" | "warning" | "error"> = {
  STRONG_YES: "success",
  YES: "info",
  MAYBE: "warning",
  NO: "error",
};

function PhoneScreenCard({ phoneScreen }: { phoneScreen: PhoneScreen & { applications?: { candidates?: { first_name: string; last_name: string }; jobs?: { title: string } }; interview_mode?: string; access_token?: string } }) {
  const statusCfg = statusBadgeConfig[phoneScreen.status] || statusBadgeConfig.scheduled;
  const StatusIcon = statusCfg.icon;

  const candidateName = phoneScreen.applications?.candidates
    ? `${phoneScreen.applications.candidates.first_name} ${phoneScreen.applications.candidates.last_name}`
    : "Unknown Candidate";
  const jobTitle = phoneScreen.applications?.jobs?.title || "Unknown Position";

  const isWebInterview = phoneScreen.interview_mode === "web" || phoneScreen.interview_mode === "simulation";
  const canPreview = isWebInterview && phoneScreen.access_token && phoneScreen.status !== "completed" && phoneScreen.status !== "analyzed";

  return (
    <Link
      href={`/phone-screens/${phoneScreen.id}`}
      className="block group"
    >
      <Card hover padding="sm" className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <Avatar name={candidateName} />
            <div>
              <h3 className="font-semibold text-zinc-900 group-hover:text-primary transition-colors">
                {candidateName}
              </h3>
              <p className="text-sm text-zinc-500">{jobTitle}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={statusCfg.variant}>
              <StatusIcon className="w-3 h-3" />
              {statusCfg.label}
            </Badge>
            {phoneScreen.interview_mode && phoneScreen.interview_mode !== "phone" && (
              <Badge variant={phoneScreen.interview_mode === "simulation" ? "warning" : "info"}>
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
              </Badge>
            )}
          </div>
        </div>

        {/* Call/Interview Info */}
        <div className="flex flex-wrap gap-3 mb-4">
          {phoneScreen.phone_number && !isWebInterview && (
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <Phone className="w-3 h-3" />
              {phoneScreen.phone_number}
            </div>
          )}
          {phoneScreen.duration_seconds && (
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <Clock className="w-3 h-3" />
              {Math.floor(phoneScreen.duration_seconds / 60)}m {phoneScreen.duration_seconds % 60}s
            </div>
          )}
          {phoneScreen.attempt_number > 1 && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
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
            <Badge variant={recommendationBadgeVariant[phoneScreen.recommendation] || "default"}>
              {phoneScreen.recommendation.replace("_", " ")}
            </Badge>
            {phoneScreen.overall_score !== null && (
              <span className="text-xs text-zinc-500">
                Score: {phoneScreen.overall_score}%
              </span>
            )}
          </div>
        )}

        {/* Summary */}
        {phoneScreen.summary?.key_takeaways && phoneScreen.summary.key_takeaways.length > 0 && (
          <p className="text-sm text-zinc-700 line-clamp-2 mb-4">
            {phoneScreen.summary.key_takeaways[0]}
          </p>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
          <div className="text-xs text-zinc-500">
            {phoneScreen.scheduled_at
              ? new Date(phoneScreen.scheduled_at).toLocaleDateString()
              : new Date(phoneScreen.created_at).toLocaleDateString()}
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
        </div>
      </Card>
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

  const filterTabs = [
    { id: "all", label: "All" },
    { id: "scheduled", label: "Scheduled" },
    { id: "in_progress", label: "In Progress" },
    { id: "completed", label: "Completed" },
    { id: "analyzed", label: "Analyzed" },
    { id: "failed", label: "Failed" },
    { id: "no_answer", label: "No Answer" },
  ];

  const stats = {
    total: phoneScreens.length,
    completed: phoneScreens.filter((p) => p.status === "completed" || p.status === "analyzed").length,
    pending: phoneScreens.filter((p) => p.status === "scheduled" || p.status === "calling").length,
    strongYes: phoneScreens.filter((p) => p.recommendation === "STRONG_YES").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Phone Screens" description="AI-powered phone screening calls" />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          label="Total Screens"
          value={stats.total}
          icon={<Phone className="w-5 h-5" />}
          accentColor="border-primary"
        />
        <Stat
          label="Completed"
          value={stats.completed}
          icon={<CheckCircle className="w-5 h-5" />}
          accentColor="border-emerald-500"
        />
        <Stat
          label="Pending"
          value={stats.pending}
          icon={<Clock className="w-5 h-5" />}
          accentColor="border-amber-500"
        />
        <Stat
          label="Strong Yes"
          value={stats.strongYes}
          icon={<CheckCircle className="w-5 h-5" />}
          accentColor="border-emerald-500"
        />
      </div>

      {/* Filters */}
      <Card padding="sm" className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <Tabs
            tabs={filterTabs}
            activeTab={filter}
            onTabChange={setFilter}
          />

          <div className="flex items-center gap-3">
            <div className="relative flex items-center bg-white border border-zinc-200 px-3 py-2 rounded-lg">
              <Search className="w-4 h-4 text-zinc-400 mr-2" />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-40 text-zinc-700 placeholder-zinc-400"
              />
            </div>
            <button className="p-2 bg-white border border-zinc-200 rounded-lg text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 transition-all">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Phone Screens Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} className="h-48" />
          ))}
        </div>
      ) : phoneScreens.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Phone className="w-8 h-8" />}
            title="No phone screens yet"
            description="Phone screens will appear here when you schedule AI calls with candidates."
          />
        </Card>
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
