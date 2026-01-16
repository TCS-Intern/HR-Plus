"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Mail,
  Search,
  Filter,
  Plus,
  Play,
  Pause,
  CheckCircle,
  Clock,
  Users,
  MousePointer,
  MessageSquare,
  ChevronRight,
  BarChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Campaign, Job } from "@/types";
import { supabase } from "@/lib/supabase/client";

const statusConfig: Record<
  string,
  { color: string; icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  draft: { color: "bg-slate-100 text-slate-600", icon: Clock, label: "Draft" },
  active: { color: "bg-green-100 text-green-600", icon: Play, label: "Active" },
  paused: { color: "bg-amber-100 text-amber-600", icon: Pause, label: "Paused" },
  completed: { color: "bg-blue-100 text-blue-600", icon: CheckCircle, label: "Completed" },
};

function CampaignCard({ campaign, job }: { campaign: Campaign; job?: Job }) {
  const status = statusConfig[campaign.status] || statusConfig.draft;
  const StatusIcon = status.icon;

  const openRate =
    campaign.messages_sent > 0
      ? ((campaign.messages_opened / campaign.messages_sent) * 100).toFixed(1)
      : "0";
  const replyRate =
    campaign.messages_sent > 0
      ? ((campaign.messages_replied / campaign.messages_sent) * 100).toFixed(1)
      : "0";

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="glass-card rounded-2xl p-5 hover:shadow-lg transition-all group"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors">
            {campaign.name}
          </h3>
          <p className="text-sm text-slate-500">{job?.title || "Unknown Job"}</p>
        </div>
        <span
          className={cn(
            "px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1",
            status.color
          )}
        >
          <StatusIcon className="w-3 h-3" />
          {status.label}
        </span>
      </div>

      {/* Sequence Info */}
      <div className="mb-4">
        <div className="text-xs text-slate-500 mb-1">
          {campaign.sequence?.length || 0} step sequence
        </div>
        <div className="flex gap-1">
          {(campaign.sequence || []).slice(0, 5).map((step, idx) => (
            <div
              key={idx}
              className={cn(
                "w-8 h-1 rounded-full",
                step.channel === "email" ? "bg-primary" : "bg-blue-500"
              )}
            />
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-slate-600 dark:text-slate-400">
            <Users className="w-3 h-3" />
            <span className="text-sm font-bold">{campaign.total_recipients}</span>
          </div>
          <div className="text-[10px] text-slate-500">Recipients</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-green-600">
            <Mail className="w-3 h-3" />
            <span className="text-sm font-bold">{campaign.messages_sent}</span>
          </div>
          <div className="text-[10px] text-slate-500">Sent</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-blue-600">
            <MousePointer className="w-3 h-3" />
            <span className="text-sm font-bold">{openRate}%</span>
          </div>
          <div className="text-[10px] text-slate-500">Open Rate</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-purple-600">
            <MessageSquare className="w-3 h-3" />
            <span className="text-sm font-bold">{replyRate}%</span>
          </div>
          <div className="text-[10px] text-slate-500">Reply Rate</div>
        </div>
      </div>

      {/* Description */}
      {campaign.description && (
        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">
          {campaign.description}
        </p>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
        <div className="text-xs text-slate-500">
          {campaign.started_at
            ? `Started ${new Date(campaign.started_at).toLocaleDateString()}`
            : `Created ${new Date(campaign.created_at).toLocaleDateString()}`}
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
      </div>
    </Link>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchData() {
      // Fetch jobs for reference
      const { data: jobsData } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false });

      if (jobsData) {
        setJobs(jobsData as Job[]);
      }

      // Fetch campaigns
      let query = supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;

      if (!error && data) {
        setCampaigns(data as Campaign[]);
      }
      setLoading(false);
    }

    fetchData();
  }, [filter]);

  const filterOptions = ["all", "draft", "active", "paused", "completed"];

  // Calculate aggregate stats
  const stats = {
    total: campaigns.length,
    active: campaigns.filter((c) => c.status === "active").length,
    totalSent: campaigns.reduce((acc, c) => acc + (c.messages_sent || 0), 0),
    totalReplies: campaigns.reduce((acc, c) => acc + (c.messages_replied || 0), 0),
    avgOpenRate: campaigns.length > 0
      ? (
          campaigns.reduce((acc, c) => {
            const rate = c.messages_sent > 0 ? (c.messages_opened / c.messages_sent) * 100 : 0;
            return acc + rate;
          }, 0) / campaigns.length
        ).toFixed(1)
      : "0",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Campaigns</h1>
          <p className="text-sm text-slate-500">Manage outreach campaigns and sequences</p>
        </div>
        <Link
          href="/campaigns/new"
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card rounded-2xl p-4">
          <div className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total}</div>
          <div className="text-sm text-slate-500">Total Campaigns</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          <div className="text-sm text-slate-500">Active</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.totalSent}</div>
          <div className="text-sm text-slate-500">Emails Sent</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-2xl font-bold text-purple-600">{stats.totalReplies}</div>
          <div className="text-sm text-slate-500">Total Replies</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-2xl font-bold text-amber-600">{stats.avgOpenRate}%</div>
          <div className="text-sm text-slate-500">Avg Open Rate</div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 p-1 rounded-xl">
          {filterOptions.map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all",
                filter === option
                  ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex items-center bg-white/60 dark:bg-slate-800/60 px-3 py-2 rounded-xl">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="text"
              placeholder="Search campaigns..."
              className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-40 text-slate-800 dark:text-white placeholder-slate-400"
            />
          </div>
          <button className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-slate-600 dark:text-slate-300">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Campaigns Grid */}
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
      ) : campaigns.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
            No campaigns yet
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            Create your first outreach campaign to start engaging with sourced candidates.
          </p>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Your First Campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              job={jobs.find((j) => j.id === campaign.job_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
