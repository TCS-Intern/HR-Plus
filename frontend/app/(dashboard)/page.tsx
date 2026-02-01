"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  FileCheck,
  ClipboardCheck,
  CheckCircle,
  FileText,
  Filter,
  Brain,
  MoreHorizontal,
  TrendingUp,
  Play,
  Briefcase,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { dashboardApi } from "@/lib/api/client";
import { formatDistanceToNow } from "date-fns";

interface Metrics {
  total_jobs: number;
  active_jobs: number;
  total_candidates: number;
  candidates_in_pipeline: number;
  pending_assessments: number;
  pending_offers: number;
  hired_this_month: number;
}

interface Pipeline {
  stages: {
    new: number;
    screening: number;
    assessment: number;
    offer: number;
    hired: number;
  };
  rejected: number;
}

interface AgentStatus {
  name: string;
  status: "active" | "idle" | "error";
  last_action: string | null;
  actions_today: number;
}

interface Activity {
  type: string;
  id: string;
  title: string;
  status: string;
  timestamp: string;
}

// Agent status component
function AgentStatusCard({
  name,
  description,
  icon: Icon,
  color,
  isActive,
  actionsToday,
}: {
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  isActive: boolean;
  actionsToday?: number;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-white">{name}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {actionsToday !== undefined && actionsToday > 0 && (
          <span className="text-xs text-slate-500">{actionsToday} today</span>
        )}
        <span className={`status-dot ${isActive ? "bg-green-500 pulse-green" : "bg-slate-400"}`} />
      </div>
    </div>
  );
}

// Stat card component
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  href,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  href?: string;
}) {
  const content = (
    <div className={cn("glass-card p-5 rounded-3xl", href && "hover:scale-[1.02] transition-transform cursor-pointer")}>
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <div className="flex items-end gap-2 mt-1">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{value}</h2>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// Pipeline stage component
function PipelineStage({
  label,
  count,
  color,
  width,
}: {
  label: string;
  count: number;
  color: string;
  width: string;
}) {
  return (
    <div className="flex-1">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-slate-500 font-medium">{label}</span>
        <span className="text-sm font-bold text-slate-800 dark:text-white">{count}</span>
      </div>
      <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width }} />
      </div>
    </div>
  );
}

// Skeleton components for loading states
function SkeletonStatCard() {
  return (
    <div className="glass-card p-5 rounded-3xl animate-pulse">
      <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl mb-3" />
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20 mb-2" />
      <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-12" />
    </div>
  );
}

function SkeletonPipeline() {
  return (
    <div className="glass-card rounded-3xl p-6 animate-pulse">
      <div className="flex justify-between items-center mb-6">
        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-32" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16" />
      </div>
      <div className="flex gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex-1">
            <div className="flex justify-between items-center mb-2">
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-6" />
            </div>
            <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonAgentCard() {
  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        <div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 mb-1" />
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-28" />
        </div>
      </div>
      <div className="w-3 h-3 bg-slate-200 dark:bg-slate-700 rounded-full" />
    </div>
  );
}

function SkeletonActivityItem() {
  return (
    <div className="flex items-center gap-3 py-2 animate-pulse">
      <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg flex-shrink-0" />
      <div className="flex-1">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-1" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20" />
      </div>
    </div>
  );
}

function SkeletonQuickActions() {
  return (
    <div className="glass-card rounded-3xl p-6 animate-pulse">
      <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-28 mb-4" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2 p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-xl" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonThisMonth() {
  return (
    <div className="glass-card rounded-3xl p-6 animate-pulse">
      <div className="flex justify-between items-center mb-6">
        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16" />
      </div>
      <div className="flex items-center justify-center py-4">
        <div className="text-center">
          <div className="w-24 h-24 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-28 mx-auto" />
        </div>
      </div>
    </div>
  );
}

function SkeletonHiringHealth() {
  return (
    <div className="flex-grow glass-card rounded-3xl bg-slate-900/90 dark:bg-slate-800 p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-white/10" />
        <div>
          <div className="h-4 bg-white/20 rounded w-24 mb-1" />
          <div className="h-3 bg-white/10 rounded w-20" />
        </div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div className="flex justify-between mb-1">
              <div className="h-3 bg-white/10 rounded w-20" />
              <div className="h-3 bg-white/10 rounded w-6" />
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Left Column */}
      <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">
        <div className="glass-card rounded-3xl p-6 flex flex-col gap-5">
          <div className="flex justify-between items-center">
            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-28 animate-pulse" />
            <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonAgentCard key={i} />
            ))}
          </div>
        </div>
        <div className="glass-card rounded-3xl p-6 flex flex-col gap-4">
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-28 animate-pulse" />
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonActivityItem key={i} />
            ))}
          </div>
        </div>
      </div>

      {/* Center Column */}
      <div className="col-span-12 lg:col-span-6 flex flex-col gap-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>
        <SkeletonPipeline />
        <SkeletonQuickActions />
      </div>

      {/* Right Column */}
      <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">
        <SkeletonThisMonth />
        <SkeletonHiringHealth />
      </div>
    </div>
  );
}

// Activity item component
function ActivityItem({ activity }: { activity: Activity }) {
  const typeColors: Record<string, string> = {
    job: "bg-blue-100 text-blue-600",
    application: "bg-purple-100 text-purple-600",
    assessment: "bg-amber-100 text-amber-600",
    offer: "bg-green-100 text-green-600",
  };

  const typeIcons: Record<string, React.ElementType> = {
    job: Briefcase,
    application: Users,
    assessment: ClipboardCheck,
    offer: DollarSign,
  };

  const Icon = typeIcons[activity.type] || FileText;
  const color = typeColors[activity.type] || "bg-slate-100 text-slate-600";

  return (
    <div className="flex items-center gap-3 py-2">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{activity.title}</p>
        <p className="text-xs text-slate-500">
          {formatDistanceToNow(new Date(activity.timestamp))} ago
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch all dashboard data in parallel
        const [metricsRes, pipelineRes, agentsRes, activityRes] = await Promise.all([
          dashboardApi.getMetrics(),
          dashboardApi.getPipeline(),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/dashboard/agent-status`).then((r) => r.json()),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/dashboard/recent-activity`).then((r) => r.json()),
        ]);

        setMetrics(metricsRes.data);
        setPipeline(pipelineRes.data);
        setAgents(agentsRes.agents || []);
        setActivities(activityRes.activities || []);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
      setLoading(false);
    }

    fetchData();

    // Set up real-time subscriptions
    const channel = supabase
      .channel("dashboard-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications" },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const totalPipeline = pipeline
    ? Object.values(pipeline.stages).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Left Column - Agent Activity & Recent Activity */}
      <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">
        {/* Agent Activity */}
        <div className="glass-card rounded-3xl p-6 flex flex-col gap-5">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 dark:text-white">Agent Activity</h3>
            <MoreHorizontal className="w-5 h-5 text-slate-400 cursor-pointer" />
          </div>
          <div className="space-y-4">
            <AgentStatusCard
              name="JD Assist"
              description="Creating job descriptions"
              icon={FileText}
              color="bg-blue-100 dark:bg-blue-900/40 text-blue-600"
              isActive={agents.find((a) => a.name === "JD Assist")?.status === "active"}
              actionsToday={agents.find((a) => a.name === "JD Assist")?.actions_today}
            />
            <AgentStatusCard
              name="Talent Screener"
              description="Screening candidates"
              icon={Filter}
              color="bg-purple-100 dark:bg-purple-900/40 text-purple-600"
              isActive={agents.find((a) => a.name === "Talent Screener")?.status === "active"}
              actionsToday={agents.find((a) => a.name === "Talent Screener")?.actions_today}
            />
            <AgentStatusCard
              name="Talent Assessor"
              description="Analyzing assessments"
              icon={Brain}
              color="bg-amber-100 dark:bg-amber-900/40 text-amber-600"
              isActive={agents.find((a) => a.name === "Talent Assessor")?.status === "active"}
              actionsToday={agents.find((a) => a.name === "Talent Assessor")?.actions_today}
            />
            <AgentStatusCard
              name="Offer Generator"
              description="Creating offers"
              icon={DollarSign}
              color="bg-green-100 dark:bg-green-900/40 text-green-600"
              isActive={agents.find((a) => a.name === "Offer Generator")?.status === "active"}
              actionsToday={agents.find((a) => a.name === "Offer Generator")?.actions_today}
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-card rounded-3xl p-6 flex flex-col gap-4">
          <h3 className="font-bold text-slate-800 dark:text-white">Recent Activity</h3>
          <div className="space-y-1">
            {activities.length > 0 ? (
              activities.slice(0, 5).map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </div>
      </div>

      {/* Center Column - Stats & Pipeline */}
      <div className="col-span-12 lg:col-span-6 flex flex-col gap-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Active Jobs"
            value={metrics?.active_jobs || 0}
            icon={Briefcase}
            color="bg-primary/10 text-primary"
            href="/jobs"
          />
          <StatCard
            label="Candidates"
            value={metrics?.total_candidates || 0}
            icon={Users}
            color="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600"
          />
          <StatCard
            label="Pending Assessments"
            value={metrics?.pending_assessments || 0}
            icon={ClipboardCheck}
            color="bg-purple-100 dark:bg-purple-900/40 text-purple-600"
            href="/assessments"
          />
          <StatCard
            label="Pending Offers"
            value={metrics?.pending_offers || 0}
            icon={DollarSign}
            color="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
            href="/offers"
          />
        </div>

        {/* Pipeline */}
        <div className="glass-card rounded-3xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 dark:text-white">Hiring Pipeline</h3>
            <span className="text-sm text-slate-500">{totalPipeline} total</span>
          </div>

          <div className="flex gap-4">
            <PipelineStage
              label="New"
              count={pipeline?.stages.new || 0}
              color="bg-slate-400"
              width={`${totalPipeline ? ((pipeline?.stages.new || 0) / totalPipeline) * 100 : 0}%`}
            />
            <PipelineStage
              label="Screening"
              count={pipeline?.stages.screening || 0}
              color="bg-blue-500"
              width={`${totalPipeline ? ((pipeline?.stages.screening || 0) / totalPipeline) * 100 : 0}%`}
            />
            <PipelineStage
              label="Assessment"
              count={pipeline?.stages.assessment || 0}
              color="bg-purple-500"
              width={`${totalPipeline ? ((pipeline?.stages.assessment || 0) / totalPipeline) * 100 : 0}%`}
            />
            <PipelineStage
              label="Offer"
              count={pipeline?.stages.offer || 0}
              color="bg-amber-500"
              width={`${totalPipeline ? ((pipeline?.stages.offer || 0) / totalPipeline) * 100 : 0}%`}
            />
            <PipelineStage
              label="Hired"
              count={pipeline?.stages.hired || 0}
              color="bg-green-500"
              width={`${totalPipeline ? ((pipeline?.stages.hired || 0) / totalPipeline) * 100 : 0}%`}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="glass-card rounded-3xl p-6">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/jobs/new"
              className="flex flex-col items-center gap-2 p-4 bg-primary/5 hover:bg-primary/10 rounded-2xl transition-colors group"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">New Job</span>
            </Link>
            <Link
              href="/jobs"
              className="flex flex-col items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-2xl transition-colors group"
            >
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Upload CVs</span>
            </Link>
            <Link
              href="/assessments"
              className="flex flex-col items-center gap-2 p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-2xl transition-colors group"
            >
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/40 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <ClipboardCheck className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Assessments</span>
            </Link>
            <Link
              href="/offers"
              className="flex flex-col items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-2xl transition-colors group"
            >
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Offers</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Right Column - Stats Summary */}
      <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">
        {/* Hired This Month */}
        <div className="glass-card rounded-3xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 dark:text-white">This Month</h3>
            <span className="text-xs text-slate-400">Summary</span>
          </div>
          <div className="flex items-center justify-center py-4">
            <div className="text-center">
              <div className="w-24 h-24 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl font-bold text-green-600">{metrics?.hired_this_month || 0}</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Candidates Hired</p>
            </div>
          </div>
        </div>

        {/* Hiring Health */}
        <div className="flex-grow glass-card rounded-3xl bg-slate-900/90 dark:bg-slate-800 p-6 text-white overflow-hidden relative">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Hiring Health</h3>
                <p className="text-[10px] text-slate-400">Pipeline Overview</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Total Jobs</span>
                  <span>{metrics?.total_jobs || 0}</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(100, ((metrics?.active_jobs || 0) / Math.max(1, metrics?.total_jobs || 1)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">In Pipeline</span>
                  <span>{metrics?.candidates_in_pipeline || 0}</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full">
                  <div
                    className="h-full bg-blue-400 rounded-full"
                    style={{ width: `${Math.min(100, ((metrics?.candidates_in_pipeline || 0) / Math.max(1, metrics?.total_candidates || 1)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Pending Actions</span>
                  <span>{(metrics?.pending_assessments || 0) + (metrics?.pending_offers || 0)}</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${Math.min(100, (((metrics?.pending_assessments || 0) + (metrics?.pending_offers || 0)) / Math.max(1, metrics?.candidates_in_pipeline || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/20 blur-3xl rounded-full" />
        </div>
      </div>
    </div>
  );
}
