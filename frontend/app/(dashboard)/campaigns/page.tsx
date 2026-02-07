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
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton";

const statusBadgeVariant: Record<string, "default" | "success" | "warning" | "info"> = {
  draft: "default",
  active: "success",
  paused: "warning",
  completed: "info",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};

function CampaignCard({ campaign, job }: { campaign: Campaign; job?: Job }) {
  const openRate =
    campaign.messages_sent > 0
      ? ((campaign.messages_opened / campaign.messages_sent) * 100).toFixed(1)
      : "0";
  const replyRate =
    campaign.messages_sent > 0
      ? ((campaign.messages_replied / campaign.messages_sent) * 100).toFixed(1)
      : "0";

  return (
    <Link href={`/campaigns/${campaign.id}`}>
      <Card hover className="group">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-semibold text-zinc-900 group-hover:text-primary transition-colors">
              {campaign.name}
            </h3>
            <p className="text-sm text-zinc-500">{job?.title || "Unknown Job"}</p>
          </div>
          <Badge variant={statusBadgeVariant[campaign.status] || "default"} dot>
            {statusLabels[campaign.status] || campaign.status}
          </Badge>
        </div>

        {/* Sequence Info */}
        <div className="mb-4">
          <div className="text-xs text-zinc-500 mb-1">
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
            <div className="flex items-center justify-center gap-1 text-zinc-700">
              <Users className="w-3 h-3" />
              <span className="text-sm font-bold">{campaign.total_recipients}</span>
            </div>
            <div className="text-[10px] text-zinc-500">Recipients</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-emerald-600">
              <Mail className="w-3 h-3" />
              <span className="text-sm font-bold">{campaign.messages_sent}</span>
            </div>
            <div className="text-[10px] text-zinc-500">Sent</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-blue-600">
              <MousePointer className="w-3 h-3" />
              <span className="text-sm font-bold">{openRate}%</span>
            </div>
            <div className="text-[10px] text-zinc-500">Open Rate</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-purple-600">
              <MessageSquare className="w-3 h-3" />
              <span className="text-sm font-bold">{replyRate}%</span>
            </div>
            <div className="text-[10px] text-zinc-500">Reply Rate</div>
          </div>
        </div>

        {/* Description */}
        {campaign.description && (
          <p className="text-sm text-zinc-700 line-clamp-2 mb-4">
            {campaign.description}
          </p>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
          <div className="text-xs text-zinc-500">
            {campaign.started_at
              ? `Started ${new Date(campaign.started_at).toLocaleDateString()}`
              : `Created ${new Date(campaign.created_at).toLocaleDateString()}`}
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
        </div>
      </Card>
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
      <PageHeader
        title="Campaigns"
        description="Manage outreach campaigns and sequences"
        actions={
          <Link href="/campaigns/new">
            <Button icon={<Plus className="w-4 h-4" />} size="lg">
              New Campaign
            </Button>
          </Link>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat
          label="Total Campaigns"
          value={stats.total}
          icon={<Mail className="w-5 h-5" />}
          accentColor="border-zinc-400"
        />
        <Stat
          label="Active"
          value={stats.active}
          icon={<Play className="w-5 h-5" />}
          accentColor="border-emerald-500"
        />
        <Stat
          label="Emails Sent"
          value={stats.totalSent}
          icon={<BarChart className="w-5 h-5" />}
          accentColor="border-blue-500"
        />
        <Stat
          label="Total Replies"
          value={stats.totalReplies}
          icon={<MessageSquare className="w-5 h-5" />}
          accentColor="border-purple-500"
        />
        <Stat
          label="Avg Open Rate"
          value={`${stats.avgOpenRate}%`}
          icon={<MousePointer className="w-5 h-5" />}
          accentColor="border-amber-500"
        />
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-lg">
            {filterOptions.map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors",
                  filter === option
                    ? "bg-white shadow-sm text-zinc-900 border border-zinc-200"
                    : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex items-center bg-white border border-zinc-200 px-3 py-2 rounded-lg">
              <Search className="w-4 h-4 text-zinc-400 mr-2" />
              <input
                type="text"
                placeholder="Search campaigns..."
                className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-40 text-zinc-700 placeholder-zinc-400"
              />
            </div>
            <button className="p-2 bg-white border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Campaigns Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Mail className="w-8 h-8" />}
            title="No campaigns yet"
            description="Create your first outreach campaign to start engaging with sourced candidates."
            action={
              <Link href="/campaigns/new">
                <Button icon={<Plus className="w-4 h-4" />}>
                  Create Your First Campaign
                </Button>
              </Link>
            }
          />
        </Card>
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
