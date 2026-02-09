"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Users,
  ClipboardCheck,
  FileText,
  TrendingUp,
  Briefcase,
  DollarSign,
  ArrowRight,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { dashboardApi } from "@/lib/api/client";
import { formatDistanceToNow } from "date-fns";
import { Stat } from "@/components/ui/stat";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

interface Activity {
  type: string;
  id: string;
  title: string;
  status: string;
  timestamp: string;
}

interface JobWithCount {
  id: string;
  title: string;
  status: string;
  applicant_count: number;
}

interface HiringGoal {
  name: string;
  current: number;
  target: number;
}

function DonutChart({ stages }: { stages: Pipeline["stages"] }) {
  const total = Object.values(stages).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const colors = [
    { name: "New", color: "#A1A1AA", value: stages.new },
    { name: "Screening", color: "#3B82F6", value: stages.screening },
    { name: "Assessment", color: "#8B5CF6", value: stages.assessment },
    { name: "Offer", color: "#F59E0B", value: stages.offer },
    { name: "Hired", color: "#10B981", value: stages.hired },
  ];

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-8">
      <div className="relative">
        <svg width="160" height="160" viewBox="0 0 160 160">
          {colors.map((segment) => {
            const pct = segment.value / total;
            const dashLength = pct * circumference;
            const currentOffset = offset;
            offset += dashLength;

            return (
              <circle
                key={segment.name}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="20"
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={-currentOffset}
                transform="rotate(-90 80 80)"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-zinc-900">{total}</span>
          <span className="text-xs text-zinc-500">Total</span>
        </div>
      </div>
      <div className="space-y-2">
        {colors.map((segment) => (
          <div key={segment.name} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: segment.color }} />
            <span className="text-sm text-zinc-600">{segment.name}</span>
            <span className="text-sm font-semibold text-zinc-900 ml-auto">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityItem({ activity }: { activity: Activity }) {
  const typeIcons: Record<string, React.ElementType> = {
    job: Briefcase,
    application: Users,
    assessment: ClipboardCheck,
    offer: DollarSign,
  };

  const typeColors: Record<string, string> = {
    job: "bg-blue-50 text-blue-600",
    application: "bg-purple-50 text-purple-600",
    assessment: "bg-amber-50 text-amber-600",
    offer: "bg-emerald-50 text-emerald-600",
  };

  const Icon = typeIcons[activity.type] || FileText;
  const color = typeColors[activity.type] || "bg-zinc-50 text-zinc-600";

  return (
    <div className="flex items-center gap-3 py-3 border-b border-zinc-50 last:border-0">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-700 font-medium truncate">{activity.title}</p>
        <p className="text-xs text-zinc-400">{formatDistanceToNow(new Date(activity.timestamp))} ago</p>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm p-8 animate-pulse">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeJobs, setActiveJobs] = useState<JobWithCount[]>([]);
  const [hiringGoals, setHiringGoals] = useState<HiringGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [metricsRes, pipelineRes, activityRes, jobsRes] = await Promise.all([
          dashboardApi.getMetrics(),
          dashboardApi.getPipeline(),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/dashboard/recent-activity`).then((r) => r.json()),
          supabase
            .from("jobs")
            .select("id, title, status, applications(count)")
            .in("status", ["active", "approved"])
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        setMetrics(metricsRes.data);
        setPipeline(pipelineRes.data);
        setActivities(activityRes.activities || []);

        if (jobsRes.data) {
          const jobs = jobsRes.data.map((j: any) => ({
            id: j.id,
            title: j.title,
            status: j.status,
            applicant_count: j.applications?.[0]?.count || 0,
          }));
          setActiveJobs(jobs);

          // Compute hiring goals from active jobs (group by department or show top jobs)
          const goals: HiringGoal[] = jobs.slice(0, 3).map((job: JobWithCount) => ({
            name: job.title,
            current: job.applicant_count,
            target: Math.max(job.applicant_count + 5, 10),
          }));
          setHiringGoals(goals);
        }

        // Fetch real hiring goals from offers (accepted = hired)
        const { data: offersData } = await supabase
          .from("offers")
          .select("status, applications(jobs(title, department))")
          .in("status", ["accepted", "sent", "approved", "draft"]);

        if (offersData && offersData.length > 0) {
          const deptMap: Record<string, { current: number; target: number }> = {};
          for (const offer of offersData) {
            const dept = (offer as any).applications?.jobs?.department || (offer as any).applications?.jobs?.title || "General";
            if (!deptMap[dept]) deptMap[dept] = { current: 0, target: 0 };
            deptMap[dept].target++;
            if (offer.status === "accepted") deptMap[dept].current++;
          }
          const realGoals = Object.entries(deptMap).slice(0, 3).map(([name, data]) => ({
            name,
            current: data.current,
            target: data.target,
          }));
          if (realGoals.length > 0) setHiringGoals(realGoals);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
      setLoading(false);
    }

    fetchData();

    const channel = supabase
      .channel("dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const scrollJobs = (direction: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: direction === "left" ? -280 : 280, behavior: "smooth" });
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  const totalPipeline = pipeline ? Object.values(pipeline.stages).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Left Column - Main Content */}
      <div className="col-span-12 lg:col-span-8 space-y-6">
        {/* Hero Metric */}
        <Card className="relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-zinc-500 font-medium">Active Pipeline</p>
              <p className="text-4xl font-bold text-zinc-900 mt-1">{totalPipeline}</p>
              <p className="text-sm text-zinc-400 mt-1">candidates in progress</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/jobs/new"
                className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-white transition-colors"
              >
                <Plus className="w-5 h-5" />
              </Link>
              <Link
                href="/pipeline"
                className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 transition-colors"
              >
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </Card>

        {/* Stat Cards Row - Colored backgrounds */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat
            label="Active Jobs"
            value={metrics?.active_jobs || 0}
            icon={<Briefcase className="w-5 h-5" />}
            bgColor="bg-amber-50"
            href="/jobs"
          />
          <Stat
            label="In Screening"
            value={pipeline?.stages.screening || 0}
            icon={<Users className="w-5 h-5" />}
            bgColor="bg-blue-50"
          />
          <Stat
            label="Hired This Month"
            value={metrics?.hired_this_month || 0}
            icon={<TrendingUp className="w-5 h-5" />}
            bgColor="bg-emerald-50"
          />
        </div>

        {/* Active Jobs Horizontal Scroller */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-900">Active Jobs</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => scrollJobs("left")}
                className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-zinc-500" />
              </button>
              <button
                onClick={() => scrollJobs("right")}
                className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
          </div>
          <div ref={scrollRef} className="flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-1">
            {activeJobs.length > 0 ? (
              activeJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex-shrink-0 w-56 bg-zinc-50 rounded-2xl p-4 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mb-3">
                    <Briefcase className="w-5 h-5 text-zinc-500" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-900 truncate">{job.title}</p>
                  <p className="text-xs text-zinc-500 mt-1">{job.applicant_count} candidate{job.applicant_count !== 1 ? "s" : ""}</p>
                  <Badge
                    variant={job.status === "active" ? "success" : job.status === "approved" ? "info" : "default"}
                    className="mt-2"
                  >
                    {job.status}
                  </Badge>
                </Link>
              ))
            ) : (
              <div className="flex-shrink-0 w-full text-center py-6">
                <p className="text-sm text-zinc-400">No active jobs yet</p>
                <Link href="/jobs/new" className="text-sm text-accent hover:underline mt-1 inline-block">
                  Create your first job
                </Link>
              </div>
            )}
          </div>
        </Card>

        {/* Bottom Row: Donut + AI Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pipeline Donut Chart */}
          <Card>
            <CardHeader title="Pipeline Overview" />
            {pipeline ? (
              <DonutChart stages={pipeline.stages} />
            ) : (
              <p className="text-sm text-zinc-400 text-center py-8">No pipeline data</p>
            )}
          </Card>

          {/* AI Insights Card */}
          <Card className="bg-zinc-900 text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI Insights</h3>
              <p className="text-sm text-zinc-300 mb-6">
                Let your AI agents handle screening, assessments, and candidate matching automatically.
              </p>
              <Link href="/jobs/new">
                <Button variant="secondary" className="bg-white text-zinc-900 hover:bg-zinc-100 border-0">
                  Get Started
                </Button>
              </Link>
            </div>
            <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/5 rounded-full" />
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full" />
          </Card>
        </div>
      </div>

      {/* Right Column - Sidebar */}
      <div className="col-span-12 lg:col-span-4 space-y-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader
            title="Recent Activity"
            action={
              <Link href="/pipeline" className="text-sm text-accent hover:text-accent-600 font-medium">
                View all
              </Link>
            }
          />
          {activities.length > 0 ? (
            <div>
              {activities.slice(0, 6).map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400 text-center py-6">No recent activity</p>
          )}
        </Card>

        {/* Hiring Goals */}
        <Card>
          <CardHeader title="Hiring Goals" />
          <div className="space-y-4">
            {hiringGoals.map((goal) => {
              const pct = Math.round((goal.current / goal.target) * 100);
              return (
                <div key={goal.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center">
                        <Target className="w-4 h-4 text-zinc-500" />
                      </div>
                      <span className="text-sm font-medium text-zinc-700">{goal.name}</span>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {goal.current} / {goal.target}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-900 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <Button className="w-full mt-5" icon={<Plus className="w-4 h-4" />}>
            New Goal
          </Button>
        </Card>
      </div>
    </div>
  );
}
