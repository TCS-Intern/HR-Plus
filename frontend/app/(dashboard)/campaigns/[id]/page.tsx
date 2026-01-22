"use client";

import { useState, useEffect, useCallback } from "react";
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
  GripVertical,
  Edit3,
  Trash2,
  Save,
  X,
  StopCircle,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Campaign, OutreachMessage, SourcedCandidate, Job } from "@/types";
import { supabase } from "@/lib/supabase/client";
import { campaignApi } from "@/lib/api/client";
import { toast } from "sonner";
import { format, subDays, eachDayOfInterval } from "date-fns";

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

interface SequenceStep {
  step_number: number;
  channel: "email" | "linkedin" | "sms";
  template_id: string | null;
  subject_line: string | null;
  message_body: string;
  delay_days: number;
  delay_hours: number;
  send_after_hour: number;
  send_before_hour: number;
  send_on_days: number[];
}

interface RecipientStatus {
  id: string;
  sourced_candidate: SourcedCandidate;
  current_step: number;
  status: string;
  last_message_status: string;
  last_sent_at: string | null;
}

interface DailyMetric {
  date: string;
  sent: number;
  opened: number;
  replied: number;
  clicked: number;
}

// Simple bar chart component
function SimpleBarChart({ data, height = 120 }: { data: DailyMetric[]; height?: number }) {
  const maxValue = Math.max(...data.map(d => Math.max(d.sent, d.opened, d.replied)), 1);

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((day, index) => (
        <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex flex-col gap-0.5 items-center">
            {/* Sent bar */}
            <div
              className="w-full max-w-[20px] bg-blue-200 rounded-t transition-all"
              style={{ height: `${(day.sent / maxValue) * (height - 30)}px` }}
              title={`Sent: ${day.sent}`}
            />
            {/* Opened overlay */}
            {day.opened > 0 && (
              <div
                className="w-full max-w-[16px] bg-purple-400 rounded-t -mt-1 transition-all"
                style={{ height: `${(day.opened / maxValue) * (height - 30) * 0.8}px` }}
                title={`Opened: ${day.opened}`}
              />
            )}
            {/* Replied overlay */}
            {day.replied > 0 && (
              <div
                className="w-full max-w-[12px] bg-green-500 rounded-t -mt-1 transition-all"
                style={{ height: `${(day.replied / maxValue) * (height - 30) * 0.6}px` }}
                title={`Replied: ${day.replied}`}
              />
            )}
          </div>
          <span className="text-[10px] text-slate-400 truncate w-full text-center">
            {format(new Date(day.date), "d")}
          </span>
        </div>
      ))}
    </div>
  );
}

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
  const [recipients, setRecipients] = useState<RecipientStatus[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "messages" | "sequence" | "recipients" | "analytics">("overview");

  // Sequence editing state
  const [editingSequence, setEditingSequence] = useState(false);
  const [editedSequence, setEditedSequence] = useState<SequenceStep[]>([]);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [draggedStep, setDraggedStep] = useState<number | null>(null);

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
        setEditedSequence((campaignData as Campaign).sequence || []);

        // Fetch job
        const { data: jobData } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", campaignData.job_id)
          .single();

        if (jobData) {
          setJob(jobData as Job);
        }

        // Fetch messages with sourced candidates
        const { data: messagesData } = await supabase
          .from("outreach_messages")
          .select("*, sourced_candidates(*)")
          .eq("campaign_id", params.id)
          .order("created_at", { ascending: false })
          .limit(100);

        if (messagesData) {
          setMessages(messagesData as OutreachMessage[]);

          // Compute recipients from messages
          const recipientMap = new Map<string, RecipientStatus>();
          messagesData.forEach((msg: any) => {
            if (msg.sourced_candidate_id && msg.sourced_candidates) {
              const existing = recipientMap.get(msg.sourced_candidate_id);
              if (!existing || new Date(msg.created_at) > new Date(existing.last_sent_at || "1970-01-01")) {
                recipientMap.set(msg.sourced_candidate_id, {
                  id: msg.sourced_candidate_id,
                  sourced_candidate: msg.sourced_candidates,
                  current_step: msg.step_number || 1,
                  status: msg.status === "replied" ? "responded" : "in_sequence",
                  last_message_status: msg.status,
                  last_sent_at: msg.sent_at || msg.scheduled_for,
                });
              }
            }
          });
          setRecipients(Array.from(recipientMap.values()));

          // Compute daily metrics from messages
          const last14Days = eachDayOfInterval({
            start: subDays(new Date(), 13),
            end: new Date(),
          });

          const metricsMap = new Map<string, DailyMetric>();
          last14Days.forEach((date) => {
            const dateStr = format(date, "yyyy-MM-dd");
            metricsMap.set(dateStr, { date: dateStr, sent: 0, opened: 0, replied: 0, clicked: 0 });
          });

          messagesData.forEach((msg: any) => {
            if (msg.sent_at) {
              const dateStr = format(new Date(msg.sent_at), "yyyy-MM-dd");
              const metric = metricsMap.get(dateStr);
              if (metric) {
                metric.sent++;
                if (msg.status === "opened" || msg.status === "clicked" || msg.status === "replied") {
                  metric.opened++;
                }
                if (msg.status === "clicked" || msg.status === "replied") {
                  metric.clicked++;
                }
                if (msg.status === "replied") {
                  metric.replied++;
                }
              }
            }
          });

          setDailyMetrics(Array.from(metricsMap.values()));
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
        toast.success(`Campaign ${newStatus === "active" ? "started" : "paused"}`);
      }
    } catch (error) {
      console.error("Failed to update campaign status:", error);
      toast.error("Failed to update campaign status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleEndCampaign = async () => {
    if (!campaign) return;
    if (!confirm("Are you sure you want to end this campaign? This action cannot be undone.")) {
      return;
    }

    setActionLoading("end");

    try {
      const { error } = await supabase
        .from("campaigns")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);

      if (error) throw error;

      // Refetch campaign
      const { data } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", params.id)
        .single();

      if (data) {
        setCampaign(data as Campaign);
        toast.success("Campaign ended successfully");
      }
    } catch (error) {
      console.error("Failed to end campaign:", error);
      toast.error("Failed to end campaign");
    } finally {
      setActionLoading(null);
    }
  };

  // Sequence editing handlers
  const handleDragStart = (index: number) => {
    setDraggedStep(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedStep === null || draggedStep === index) return;

    const newSequence = [...editedSequence];
    const [removed] = newSequence.splice(draggedStep, 1);
    newSequence.splice(index, 0, removed);

    // Update step numbers
    newSequence.forEach((step, i) => {
      step.step_number = i + 1;
    });

    setEditedSequence(newSequence);
    setDraggedStep(index);
  };

  const handleDragEnd = () => {
    setDraggedStep(null);
  };

  const handleUpdateStep = (index: number, field: keyof SequenceStep, value: any) => {
    const newSequence = [...editedSequence];
    newSequence[index] = { ...newSequence[index], [field]: value };
    setEditedSequence(newSequence);
  };

  const handleAddStep = () => {
    const newStep: SequenceStep = {
      step_number: editedSequence.length + 1,
      channel: "email",
      template_id: null,
      subject_line: "",
      message_body: "",
      delay_days: 2,
      delay_hours: 0,
      send_after_hour: 9,
      send_before_hour: 17,
      send_on_days: [1, 2, 3, 4, 5], // Mon-Fri
    };
    setEditedSequence([...editedSequence, newStep]);
    setEditingStepIndex(editedSequence.length);
  };

  const handleDeleteStep = (index: number) => {
    if (editedSequence.length <= 1) {
      toast.error("Campaign must have at least one step");
      return;
    }
    const newSequence = editedSequence.filter((_, i) => i !== index);
    // Update step numbers
    newSequence.forEach((step, i) => {
      step.step_number = i + 1;
    });
    setEditedSequence(newSequence);
    setEditingStepIndex(null);
  };

  const handleSaveSequence = async () => {
    if (!campaign) return;
    setActionLoading("saveSequence");

    try {
      const { error } = await supabase
        .from("campaigns")
        .update({ sequence: editedSequence })
        .eq("id", campaign.id);

      if (error) throw error;

      setCampaign({ ...campaign, sequence: editedSequence });
      setEditingSequence(false);
      setEditingStepIndex(null);
      toast.success("Sequence saved successfully");
    } catch (error) {
      console.error("Failed to save sequence:", error);
      toast.error("Failed to save sequence");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelSequenceEdit = () => {
    setEditedSequence(campaign?.sequence || []);
    setEditingSequence(false);
    setEditingStepIndex(null);
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
    { id: "recipients", label: "Recipients", count: recipients.length },
    { id: "messages", label: "Messages", count: messages.length },
    { id: "sequence", label: "Sequence", count: campaign.sequence?.length || 0 },
    { id: "analytics", label: "Analytics" },
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
            <>
              <button
                onClick={() => handleStatusChange("paused")}
                disabled={actionLoading !== null}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-all"
              >
                <Pause className="w-4 h-4" />
                {actionLoading === "paused" ? "Pausing..." : "Pause"}
              </button>
              <button
                onClick={handleEndCampaign}
                disabled={actionLoading !== null}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-all"
              >
                <StopCircle className="w-4 h-4" />
                {actionLoading === "end" ? "Ending..." : "End Campaign"}
              </button>
            </>
          )}
          {campaign.status === "paused" && (
            <>
              <button
                onClick={() => handleStatusChange("active")}
                disabled={actionLoading !== null}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition-all"
              >
                <Play className="w-4 h-4" />
                {actionLoading === "active" ? "Resuming..." : "Resume"}
              </button>
              <button
                onClick={handleEndCampaign}
                disabled={actionLoading !== null}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-all"
              >
                <StopCircle className="w-4 h-4" />
                {actionLoading === "end" ? "Ending..." : "End Campaign"}
              </button>
            </>
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

      {activeTab === "recipients" && (
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 dark:text-white">
              Campaign Recipients ({recipients.length})
            </h3>
            <Link
              href={`/jobs/${campaign.job_id}?tab=sourcing`}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Recipients
            </Link>
          </div>

          {recipients.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {recipients.map((recipient) => {
                const msgStatus = messageStatusConfig[recipient.last_message_status] || messageStatusConfig.pending;
                return (
                  <div
                    key={recipient.id}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                        {recipient.sourced_candidate?.first_name?.charAt(0) || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/sourcing/${recipient.sourced_candidate?.id}`}
                          className="font-medium text-slate-800 dark:text-white hover:text-primary truncate block"
                        >
                          {recipient.sourced_candidate
                            ? `${recipient.sourced_candidate.first_name} ${recipient.sourced_candidate.last_name}`
                            : "Unknown"}
                        </Link>
                        <div className="text-sm text-slate-500 truncate">
                          {recipient.sourced_candidate?.current_title || "No title"} at{" "}
                          {recipient.sourced_candidate?.current_company || "Unknown"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-xs text-slate-400">
                        Step {recipient.current_step} of {campaign.sequence?.length || 1}
                      </div>
                      <span className={cn("px-2 py-1 rounded-lg text-xs font-medium", msgStatus.color)}>
                        {msgStatus.label}
                      </span>
                      {recipient.last_sent_at && (
                        <div className="text-xs text-slate-400">
                          {format(new Date(recipient.last_sent_at), "MMM d, h:mm a")}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-2">No recipients yet</p>
              <p className="text-sm text-slate-400 mb-6">
                Add sourced candidates to this campaign to start outreach
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
          {/* Sequence Editor Header */}
          <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white">Email Sequence</h3>
              <p className="text-sm text-slate-500">
                {editingSequence
                  ? "Drag steps to reorder. Click to edit content."
                  : `${editedSequence.length} step${editedSequence.length !== 1 ? "s" : ""} in this sequence`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {editingSequence ? (
                <>
                  <button
                    onClick={handleCancelSequenceEdit}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSequence}
                    disabled={actionLoading === "saveSequence"}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    {actionLoading === "saveSequence" ? "Saving..." : "Save Sequence"}
                  </button>
                </>
              ) : (
                campaign.status !== "completed" && (
                  <button
                    onClick={() => setEditingSequence(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-all"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit Sequence
                  </button>
                )
              )}
            </div>
          </div>

          {/* Sequence Steps */}
          {editedSequence.map((step, index) => (
            <div
              key={index}
              className={cn(
                "glass-card rounded-2xl p-6 transition-all",
                editingSequence && "cursor-move",
                draggedStep === index && "opacity-50 border-2 border-primary"
              )}
              draggable={editingSequence}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <div className="flex items-center gap-4 mb-4">
                {editingSequence && (
                  <div className="text-slate-400 cursor-grab">
                    <GripVertical className="w-5 h-5" />
                  </div>
                )}
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                  {step.step_number}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-800 dark:text-white">
                    Step {step.step_number}
                  </h4>
                  {editingSequence && editingStepIndex === index ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-slate-500">Delay:</span>
                      <input
                        type="number"
                        min="0"
                        value={step.delay_days}
                        onChange={(e) => handleUpdateStep(index, "delay_days", parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                      <span className="text-sm text-slate-500">days,</span>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={step.delay_hours}
                        onChange={(e) => handleUpdateStep(index, "delay_hours", parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                      <span className="text-sm text-slate-500">hours after previous</span>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      {index === 0
                        ? "Sent immediately"
                        : `${step.delay_days} days, ${step.delay_hours} hours after previous`}
                    </p>
                  )}
                </div>
                {editingSequence && (
                  <div className="flex items-center gap-2">
                    {editingStepIndex === index ? (
                      <button
                        onClick={() => setEditingStepIndex(null)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditingStepIndex(index)}
                        className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteStep(index)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                {editingSequence && editingStepIndex === index ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Subject Line</label>
                      <input
                        type="text"
                        value={step.subject_line || ""}
                        onChange={(e) => handleUpdateStep(index, "subject_line", e.target.value)}
                        placeholder="Enter email subject..."
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Message Body</label>
                      <textarea
                        value={step.message_body}
                        onChange={(e) => handleUpdateStep(index, "message_body", e.target.value)}
                        placeholder="Enter email body... Use {{first_name}}, {{company}}, {{job_title}} for personalization."
                        rows={6}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Send Between</label>
                        <div className="flex items-center gap-2">
                          <select
                            value={step.send_after_hour}
                            onChange={(e) => handleUpdateStep(index, "send_after_hour", parseInt(e.target.value))}
                            className="px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded-lg"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i}>{i}:00</option>
                            ))}
                          </select>
                          <span className="text-sm text-slate-500">-</span>
                          <select
                            value={step.send_before_hour}
                            onChange={(e) => handleUpdateStep(index, "send_before_hour", parseInt(e.target.value))}
                            className="px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded-lg"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i}>{i}:00</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Send On Days</label>
                        <div className="flex items-center gap-1">
                          {["S", "M", "T", "W", "T", "F", "S"].map((day, dayIndex) => (
                            <button
                              key={dayIndex}
                              onClick={() => {
                                const days = step.send_on_days.includes(dayIndex)
                                  ? step.send_on_days.filter((d) => d !== dayIndex)
                                  : [...step.send_on_days, dayIndex].sort();
                                handleUpdateStep(index, "send_on_days", days);
                              }}
                              className={cn(
                                "w-7 h-7 rounded text-xs font-medium transition-colors",
                                step.send_on_days.includes(dayIndex)
                                  ? "bg-primary text-white"
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                              )}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-medium text-slate-800 dark:text-white mb-2">
                      Subject: {step.subject_line || "(No subject)"}
                    </div>
                    <pre className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans">
                      {step.message_body || "(No message content)"}
                    </pre>
                  </>
                )}
              </div>

              {!editingSequence && (
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
              )}
            </div>
          ))}

          {/* Add Step Button */}
          {editingSequence && (
            <button
              onClick={handleAddStep}
              className="w-full glass-card rounded-2xl p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-slate-500 hover:text-primary hover:border-primary transition-all"
            >
              <Plus className="w-5 h-5" />
              Add Step
            </button>
          )}
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Performance Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-slate-500">Open Rate</h4>
                <Eye className="w-5 h-5 text-purple-500" />
              </div>
              <div className="text-3xl font-bold text-slate-800 dark:text-white mb-1">
                {openRate}%
              </div>
              <div className="text-sm text-slate-400">
                {campaign.messages_opened} of {campaign.messages_sent} opened
              </div>
              <div className="mt-3 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${openRate}%` }}
                />
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-slate-500">Click Rate</h4>
                <MousePointer className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-3xl font-bold text-slate-800 dark:text-white mb-1">
                {clickRate}%
              </div>
              <div className="text-sm text-slate-400">
                {campaign.messages_clicked} of {campaign.messages_sent} clicked
              </div>
              <div className="mt-3 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${clickRate}%` }}
                />
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-slate-500">Reply Rate</h4>
                <MessageSquare className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-slate-800 dark:text-white mb-1">
                {replyRate}%
              </div>
              <div className="text-sm text-slate-400">
                {campaign.messages_replied} of {campaign.messages_sent} replied
              </div>
              <div className="mt-3 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${replyRate}%` }}
                />
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-slate-500">Bounce Rate</h4>
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-3xl font-bold text-slate-800 dark:text-white mb-1">
                {campaign.messages_sent > 0
                  ? ((campaign.messages_bounced / campaign.messages_sent) * 100).toFixed(1)
                  : "0"}%
              </div>
              <div className="text-sm text-slate-400">
                {campaign.messages_bounced} of {campaign.messages_sent} bounced
              </div>
              <div className="mt-3 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{
                    width: `${campaign.messages_sent > 0 ? (campaign.messages_bounced / campaign.messages_sent) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Daily Activity Chart */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white">Daily Activity</h3>
                <p className="text-sm text-slate-500">Last 14 days</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-blue-200" />
                  <span className="text-slate-500">Sent</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-purple-400" />
                  <span className="text-slate-500">Opened</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span className="text-slate-500">Replied</span>
                </div>
              </div>
            </div>

            {dailyMetrics.length > 0 && dailyMetrics.some((m) => m.sent > 0) ? (
              <SimpleBarChart data={dailyMetrics} height={150} />
            ) : (
              <div className="text-center py-12">
                <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No activity data yet</p>
                <p className="text-sm text-slate-400">
                  Start the campaign to see daily metrics
                </p>
              </div>
            )}
          </div>

          {/* Sequence Performance */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-bold text-slate-800 dark:text-white mb-4">Sequence Performance</h3>
            <div className="space-y-4">
              {(campaign.sequence || []).map((step, index) => {
                // Calculate metrics per step (mock data - in real app, would come from aggregation)
                const stepMessages = messages.filter((m) => m.step_number === step.step_number);
                const stepSent = stepMessages.length;
                const stepOpened = stepMessages.filter((m) =>
                  ["opened", "clicked", "replied"].includes(m.status)
                ).length;
                const stepReplied = stepMessages.filter((m) => m.status === "replied").length;

                return (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {step.step_number}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Step {step.step_number}: {step.subject_line || "(No subject)"}
                        </span>
                        <span className="text-xs text-slate-500">
                          {stepSent} sent
                        </span>
                      </div>
                      <div className="flex gap-1 h-2">
                        <div
                          className="bg-purple-400 rounded-l"
                          style={{ width: `${stepSent > 0 ? (stepOpened / stepSent) * 100 : 0}%` }}
                          title={`${stepOpened} opened`}
                        />
                        <div
                          className="bg-green-500 rounded-r"
                          style={{ width: `${stepSent > 0 ? (stepReplied / stepSent) * 100 : 0}%` }}
                          title={`${stepReplied} replied`}
                        />
                        <div className="bg-slate-100 dark:bg-slate-700 flex-1 rounded" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
