"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Pause,
  Mail,
  Users,
  MousePointer,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  Eye,
  ChevronRight,
  Briefcase,
  User,
  Calendar,
  TrendingUp,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Campaign, OutreachMessage, SourcedCandidate, Job } from "@/types";
import { supabase } from "@/lib/supabase/client";
import { campaignApi } from "@/lib/api/client";

const statusConfig: Record<
  string,
  { color: string; bgColor: string; icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  draft: { color: "text-slate-600", bgColor: "bg-slate-100", icon: Clock, label: "Draft" },
  active: { color: "text-green-600", bgColor: "bg-green-100", icon: Play, label: "Active" },
  paused: { color: "text-amber-600", bgColor: "bg-amber-100", icon: Pause, label: "Paused" },
  completed: { color: "text-blue-600", bgColor: "bg-blue-100", icon: CheckCircle, label: "Completed" },
};

const messageStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "text-slate-500 bg-slate-100", label: "Pending" },
  sent: { color: "text-blue-600 bg-blue-100", label: "Sent" },
  delivered: { color: "text-indigo-600 bg-indigo-100", label: "Delivered" },
  opened: { color: "text-purple-600 bg-purple-100", label: "Opened" },
  clicked: { color: "text-green-600 bg-green-100", label: "Clicked" },
  replied: { color: "text-emerald-600 bg-emerald-100", label: "Replied" },
  bounced: { color: "text-red-600 bg-red-100", label: "Bounced" },
  failed: { color: "text-red-600 bg-red-100", label: "Failed" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  subValue,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
  subValue?: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={cn("p-2 rounded-xl", color.replace("text-", "bg-").replace("600", "100"))}>
          <Icon className={cn("w-4 h-4", color)} />
        </div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-800 dark:text-white">{value}</div>
      {subValue && <div className="text-xs text-slate-400 mt-1">{subValue}</div>}
    </div>
  );
}

function MessageRow({ message }: { message: OutreachMessage }) {
  const status = messageStatusConfig[message.status] || messageStatusConfig.pending;

  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
          {message.sourced_candidate?.first_name?.charAt(0) || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-800 dark:text-white truncate">
            {message.sourced_candidate
              ? `${message.sourced_candidate.first_name} ${message.sourced_candidate.last_name}`
              : "Unknown"}
          </div>
          <div className="text-sm text-slate-500 truncate">
            {message.subject_line || "No subject"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-xs text-slate-400">
          Step {message.step_number}
        </div>
        <span className={cn("px-2 py-1 rounded-lg text-xs font-medium", status.color)}>
          {status.label}
        </span>
        <div className="text-xs text-slate-400">
          {message.sent_at
            ? new Date(message.sent_at).toLocaleDateString()
            : message.scheduled_for
            ? `Scheduled: ${new Date(message.scheduled_for).toLocaleDateString()}`
            : "Queued"}
        </div>
      </div>
    </div>
  );
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "messages" | "sequence">("overview");

  useEffect(() => {
    async function fetchData() {
      // Fetch campaign
      const { data: campaignData, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", params.id)
        .single();

      if (!error && campaignData) {
        setCampaign(campaignData as Campaign);

        // Fetch job
        const { data: jobData } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", campaignData.job_id)
          .single();

        if (jobData) {
          setJob(jobData as Job);
        }

        // Fetch messages
        const { data: messagesData } = await supabase
          .from("outreach_messages")
          .select("*, sourced_candidates(*)")
          .eq("campaign_id", params.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (messagesData) {
          setMessages(messagesData as OutreachMessage[]);
        }
      }
      setLoading(false);
    }

    fetchData();
  }, [params.id]);

  const handleStatusChange = async (newStatus: "active" | "paused") => {
    if (!campaign) return;
    setActionLoading(newStatus);

    try {
      await campaignApi.updateStatus(campaign.id, newStatus);

      // Refetch campaign
      const { data } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", params.id)
        .single();

      if (data) {
        setCampaign(data as Campaign);
      }
    } catch (error) {
      console.error("Failed to update campaign status:", error);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass-card rounded-2xl p-6 animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="glass-card rounded-3xl p-12 text-center">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
          Campaign not found
        </h3>
        <Link href="/jobs" className="text-primary hover:underline">
          Back to jobs
        </Link>
      </div>
    );
  }

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
  const clickRate =
    campaign.messages_sent > 0
      ? ((campaign.messages_clicked / campaign.messages_sent) * 100).toFixed(1)
      : "0";

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "messages", label: "Messages", count: messages.length },
    { id: "sequence", label: "Sequence", count: campaign.sequence?.length || 0 },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            {campaign.name}
          </h1>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Briefcase className="w-4 h-4" />
            {job?.title || "Unknown Job"}
          </div>
        </div>
        <span
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2",
            status.bgColor,
            status.color
          )}
        >
          <StatusIcon className="w-4 h-4" />
          {status.label}
        </span>
      </div>

      {/* Actions Bar */}
      <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
                activeTab === tab.id
                  ? "bg-primary text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              )}
            >
              {tab.label}
              {"count" in tab && tab.count !== undefined && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-xs",
                    activeTab === tab.id
                      ? "bg-white/20"
                      : "bg-slate-200 dark:bg-slate-600"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {campaign.status === "draft" && (
            <button
              onClick={() => handleStatusChange("active")}
              disabled={campaign.total_recipients === 0 || actionLoading !== null}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                campaign.total_recipients > 0 && actionLoading === null
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              )}
            >
              <Play className="w-4 h-4" />
              {actionLoading === "active" ? "Starting..." : "Start Campaign"}
            </button>
          )}
          {campaign.status === "active" && (
            <button
              onClick={() => handleStatusChange("paused")}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-all"
            >
              <Pause className="w-4 h-4" />
              {actionLoading === "paused" ? "Pausing..." : "Pause"}
            </button>
          )}
          {campaign.status === "paused" && (
            <button
              onClick={() => handleStatusChange("active")}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition-all"
            >
              <Play className="w-4 h-4" />
              {actionLoading === "active" ? "Resuming..." : "Resume"}
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard
              icon={Users}
              label="Recipients"
              value={campaign.total_recipients}
              color="text-slate-600"
            />
            <StatCard
              icon={Send}
              label="Sent"
              value={campaign.messages_sent}
              color="text-blue-600"
            />
            <StatCard
              icon={Eye}
              label="Open Rate"
              value={`${openRate}%`}
              color="text-purple-600"
              subValue={`${campaign.messages_opened} opened`}
            />
            <StatCard
              icon={MousePointer}
              label="Click Rate"
              value={`${clickRate}%`}
              color="text-indigo-600"
              subValue={`${campaign.messages_clicked} clicked`}
            />
            <StatCard
              icon={MessageSquare}
              label="Reply Rate"
              value={`${replyRate}%`}
              color="text-green-600"
              subValue={`${campaign.messages_replied} replied`}
            />
            <StatCard
              icon={TrendingUp}
              label="Sequence Steps"
              value={campaign.sequence?.length || 0}
              color="text-amber-600"
            />
          </div>

          {/* Campaign Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4">
                Campaign Details
              </h3>
              <div className="space-y-3 text-sm">
                {campaign.description && (
                  <p className="text-slate-600 dark:text-slate-400">
                    {campaign.description}
                  </p>
                )}
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-500">Sender</span>
                  <span className="text-slate-800 dark:text-white">
                    {campaign.sender_name || "Not set"} ({campaign.sender_email || "Not set"})
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-500">Created</span>
                  <span className="text-slate-800 dark:text-white">
                    {new Date(campaign.created_at).toLocaleDateString()}
                  </span>
                </div>
                {campaign.started_at && (
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-500">Started</span>
                    <span className="text-slate-800 dark:text-white">
                      {new Date(campaign.started_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4">
                Target Job
              </h3>
              {job ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800 dark:text-white">
                        {job.title}
                      </h4>
                      <p className="text-sm text-slate-500">{job.department}</p>
                    </div>
                  </div>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center gap-1 text-primary text-sm hover:underline"
                  >
                    View Job Details
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <p className="text-slate-500">Job not found</p>
              )}
            </div>
          </div>

          {/* Recent Messages */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 dark:text-white">
                Recent Activity
              </h3>
              <button
                onClick={() => setActiveTab("messages")}
                className="text-primary text-sm hover:underline flex items-center gap-1"
              >
                View All
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {messages.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {messages.slice(0, 5).map((message) => (
                  <MessageRow key={message.id} message={message} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No messages sent yet</p>
                <p className="text-sm text-slate-400">
                  Add recipients to start sending messages
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "messages" && (
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 dark:text-white">
              All Messages ({messages.length})
            </h3>
          </div>

          {messages.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {messages.map((message) => (
                <MessageRow key={message.id} message={message} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Mail className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-2">No messages yet</p>
              <p className="text-sm text-slate-400 mb-6">
                Add sourced candidates to this campaign to start sending messages
              </p>
              <Link
                href={`/jobs/${campaign.job_id}?tab=sourcing`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:scale-105 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Recipients from Sourced Candidates
              </Link>
            </div>
          )}
        </div>
      )}

      {activeTab === "sequence" && (
        <div className="space-y-4">
          {(campaign.sequence || []).map((step, index) => (
            <div key={index} className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                  {step.step_number}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-white">
                    Step {step.step_number}
                  </h4>
                  <p className="text-sm text-slate-500">
                    {index === 0
                      ? "Sent immediately"
                      : `${step.delay_days} days, ${step.delay_hours} hours after previous`}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                <div className="text-sm font-medium text-slate-800 dark:text-white mb-2">
                  Subject: {step.subject_line || "(No subject)"}
                </div>
                <pre className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans">
                  {step.message_body}
                </pre>
              </div>

              <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {step.send_after_hour}:00 - {step.send_before_hour}:00
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {step.send_on_days.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
