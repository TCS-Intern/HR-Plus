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
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
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

const messageStatusConfig: Record<string, { variant: "default" | "info" | "purple" | "success" | "error"; label: string }> = {
  pending: { variant: "default", label: "Pending" },
  sent: { variant: "info", label: "Sent" },
  delivered: { variant: "info", label: "Delivered" },
  opened: { variant: "purple", label: "Opened" },
  clicked: { variant: "success", label: "Clicked" },
  replied: { variant: "success", label: "Replied" },
  bounced: { variant: "error", label: "Bounced" },
  failed: { variant: "error", label: "Failed" },
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
                className="w-full max-w-[12px] bg-emerald-500 rounded-t -mt-1 transition-all"
                style={{ height: `${(day.replied / maxValue) * (height - 30) * 0.6}px` }}
                title={`Replied: ${day.replied}`}
              />
            )}
          </div>
          <span className="text-[10px] text-zinc-400 truncate w-full text-center">
            {format(new Date(day.date), "d")}
          </span>
        </div>
      ))}
    </div>
  );
}

function MessageRow({ message }: { message: OutreachMessage }) {
  const status = messageStatusConfig[message.status] || messageStatusConfig.pending;

  return (
    <div className="flex items-center justify-between p-4 hover:bg-zinc-50 rounded-lg transition-colors">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <Avatar
          name={
            message.sourced_candidate
              ? `${message.sourced_candidate.first_name} ${message.sourced_candidate.last_name}`
              : "?"
          }
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-zinc-900 truncate">
            {message.sourced_candidate
              ? `${message.sourced_candidate.first_name} ${message.sourced_candidate.last_name}`
              : "Unknown"}
          </div>
          <div className="text-sm text-zinc-500 truncate">
            {message.subject_line || "No subject"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-xs text-zinc-500">
          Step {message.step_number}
        </div>
        <Badge variant={status.variant}>
          {status.label}
        </Badge>
        <div className="text-xs text-zinc-500">
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
  const [activeTab, setActiveTab] = useState<string>("overview");

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
        <SkeletonCard />
      </div>
    );
  }

  if (!campaign) {
    return (
      <Card>
        <EmptyState
          icon={<Mail className="w-8 h-8" />}
          title="Campaign not found"
          action={
            <Link href="/jobs" className="text-primary hover:underline text-sm">
              Back to jobs
            </Link>
          }
        />
      </Card>
    );
  }

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

  const tabItems = [
    { id: "overview", label: "Overview" },
    { id: "recipients", label: "Recipients", count: recipients.length },
    { id: "messages", label: "Messages", count: messages.length },
    { id: "sequence", label: "Sequence", count: campaign.sequence?.length || 0 },
    { id: "analytics", label: "Analytics" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 bg-white border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-zinc-900">
            {campaign.name}
          </h1>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Briefcase className="w-4 h-4" />
            {job?.title || "Unknown Job"}
          </div>
        </div>
        <Badge variant={statusBadgeVariant[campaign.status] || "default"} dot>
          {statusLabels[campaign.status] || campaign.status}
        </Badge>
      </div>

      {/* Tabs & Actions */}
      <Card padding="none">
        <div className="flex items-center justify-between px-6 pt-4">
          <Tabs
            tabs={tabItems}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          <div className="flex items-center gap-2 pb-2">
            {campaign.status === "draft" && (
              <Button
                onClick={() => handleStatusChange("active")}
                disabled={campaign.total_recipients === 0 || actionLoading !== null}
                variant="success"
                icon={<Play className="w-4 h-4" />}
                loading={actionLoading === "active"}
              >
                {actionLoading === "active" ? "Starting..." : "Start Campaign"}
              </Button>
            )}
            {campaign.status === "active" && (
              <>
                <Button
                  onClick={() => handleStatusChange("paused")}
                  disabled={actionLoading !== null}
                  variant="secondary"
                  icon={<Pause className="w-4 h-4" />}
                  loading={actionLoading === "paused"}
                  className="text-amber-600 border-amber-200 hover:bg-amber-50"
                >
                  {actionLoading === "paused" ? "Pausing..." : "Pause"}
                </Button>
                <Button
                  onClick={handleEndCampaign}
                  disabled={actionLoading !== null}
                  variant="danger"
                  icon={<StopCircle className="w-4 h-4" />}
                  loading={actionLoading === "end"}
                >
                  {actionLoading === "end" ? "Ending..." : "End Campaign"}
                </Button>
              </>
            )}
            {campaign.status === "paused" && (
              <>
                <Button
                  onClick={() => handleStatusChange("active")}
                  disabled={actionLoading !== null}
                  variant="success"
                  icon={<Play className="w-4 h-4" />}
                  loading={actionLoading === "active"}
                >
                  {actionLoading === "active" ? "Resuming..." : "Resume"}
                </Button>
                <Button
                  onClick={handleEndCampaign}
                  disabled={actionLoading !== null}
                  variant="danger"
                  icon={<StopCircle className="w-4 h-4" />}
                  loading={actionLoading === "end"}
                >
                  {actionLoading === "end" ? "Ending..." : "End Campaign"}
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Stat label="Recipients" value={campaign.total_recipients} icon={<Users className="w-5 h-5" />} accentColor="border-zinc-400" />
            <Stat label="Sent" value={campaign.messages_sent} icon={<Send className="w-5 h-5" />} accentColor="border-blue-500" />
            <Stat label="Open Rate" value={`${openRate}%`} icon={<Eye className="w-5 h-5" />} accentColor="border-purple-500" />
            <Stat label="Click Rate" value={`${clickRate}%`} icon={<MousePointer className="w-5 h-5" />} accentColor="border-indigo-500" />
            <Stat label="Reply Rate" value={`${replyRate}%`} icon={<MessageSquare className="w-5 h-5" />} accentColor="border-emerald-500" />
            <Stat label="Sequence Steps" value={campaign.sequence?.length || 0} icon={<TrendingUp className="w-5 h-5" />} accentColor="border-amber-500" />
          </div>

          {/* Campaign Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Campaign Details" />
              <div className="space-y-3 text-sm">
                {campaign.description && (
                  <p className="text-zinc-700">
                    {campaign.description}
                  </p>
                )}
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-500">Sender</span>
                  <span className="text-zinc-900">
                    {campaign.sender_name || "Not set"} ({campaign.sender_email || "Not set"})
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-500">Created</span>
                  <span className="text-zinc-900">
                    {new Date(campaign.created_at).toLocaleDateString()}
                  </span>
                </div>
                {campaign.started_at && (
                  <div className="flex justify-between py-2 border-b border-zinc-100">
                    <span className="text-zinc-500">Started</span>
                    <span className="text-zinc-900">
                      {new Date(campaign.started_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Target Job" />
              {job ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900">
                        {job.title}
                      </h4>
                      <p className="text-sm text-zinc-500">{job.department}</p>
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
                <p className="text-zinc-500">Job not found</p>
              )}
            </Card>
          </div>

          {/* Recent Messages */}
          <Card>
            <CardHeader
              title="Recent Activity"
              action={
                <button
                  onClick={() => setActiveTab("messages")}
                  className="text-primary text-sm hover:underline flex items-center gap-1"
                >
                  View All
                  <ChevronRight className="w-4 h-4" />
                </button>
              }
            />

            {messages.length > 0 ? (
              <div className="divide-y divide-zinc-100">
                {messages.slice(0, 5).map((message) => (
                  <MessageRow key={message.id} message={message} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Mail className="w-8 h-8" />}
                title="No messages sent yet"
                description="Add recipients to start sending messages"
              />
            )}
          </Card>
        </div>
      )}

      {activeTab === "messages" && (
        <Card>
          <CardHeader title={`All Messages (${messages.length})`} />

          {messages.length > 0 ? (
            <div className="divide-y divide-zinc-100">
              {messages.map((message) => (
                <MessageRow key={message.id} message={message} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Mail className="w-8 h-8" />}
              title="No messages yet"
              description="Add sourced candidates to this campaign to start sending messages"
              action={
                <Link href={`/jobs/${campaign.job_id}?tab=sourcing`}>
                  <Button icon={<Plus className="w-4 h-4" />}>
                    Add Recipients from Sourced Candidates
                  </Button>
                </Link>
              }
            />
          )}
        </Card>
      )}

      {activeTab === "recipients" && (
        <Card>
          <CardHeader
            title={`Campaign Recipients (${recipients.length})`}
            action={
              <Link href={`/jobs/${campaign.job_id}?tab=sourcing`}>
                <Button icon={<Plus className="w-4 h-4" />} size="sm">
                  Add Recipients
                </Button>
              </Link>
            }
          />

          {recipients.length > 0 ? (
            <div className="divide-y divide-zinc-100">
              {recipients.map((recipient) => {
                const msgStatus = messageStatusConfig[recipient.last_message_status] || messageStatusConfig.pending;
                return (
                  <div
                    key={recipient.id}
                    className="flex items-center justify-between p-4 hover:bg-zinc-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Avatar
                        name={
                          recipient.sourced_candidate
                            ? `${recipient.sourced_candidate.first_name} ${recipient.sourced_candidate.last_name}`
                            : "?"
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/sourcing/${recipient.sourced_candidate?.id}`}
                          className="font-medium text-zinc-900 hover:text-primary truncate block"
                        >
                          {recipient.sourced_candidate
                            ? `${recipient.sourced_candidate.first_name} ${recipient.sourced_candidate.last_name}`
                            : "Unknown"}
                        </Link>
                        <div className="text-sm text-zinc-500 truncate">
                          {recipient.sourced_candidate?.current_title || "No title"} at{" "}
                          {recipient.sourced_candidate?.current_company || "Unknown"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-xs text-zinc-500">
                        Step {recipient.current_step} of {campaign.sequence?.length || 1}
                      </div>
                      <Badge variant={msgStatus.variant}>
                        {msgStatus.label}
                      </Badge>
                      {recipient.last_sent_at && (
                        <div className="text-xs text-zinc-500">
                          {format(new Date(recipient.last_sent_at), "MMM d, h:mm a")}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Users className="w-8 h-8" />}
              title="No recipients yet"
              description="Add sourced candidates to this campaign to start outreach"
              action={
                <Link href={`/jobs/${campaign.job_id}?tab=sourcing`}>
                  <Button icon={<Plus className="w-4 h-4" />}>
                    Add Recipients from Sourced Candidates
                  </Button>
                </Link>
              }
            />
          )}
        </Card>
      )}

      {activeTab === "sequence" && (
        <div className="space-y-4">
          {/* Sequence Editor Header */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-zinc-900">Email Sequence</h3>
                <p className="text-sm text-zinc-500">
                  {editingSequence
                    ? "Drag steps to reorder. Click to edit content."
                    : `${editedSequence.length} step${editedSequence.length !== 1 ? "s" : ""} in this sequence`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {editingSequence ? (
                  <>
                    <Button
                      onClick={handleCancelSequenceEdit}
                      variant="secondary"
                      icon={<X className="w-4 h-4" />}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveSequence}
                      loading={actionLoading === "saveSequence"}
                      icon={<Save className="w-4 h-4" />}
                    >
                      {actionLoading === "saveSequence" ? "Saving..." : "Save Sequence"}
                    </Button>
                  </>
                ) : (
                  campaign.status !== "completed" && (
                    <Button
                      onClick={() => setEditingSequence(true)}
                      icon={<Edit3 className="w-4 h-4" />}
                    >
                      Edit Sequence
                    </Button>
                  )
                )}
              </div>
            </div>
          </Card>

          {/* Sequence Steps */}
          {editedSequence.map((step, index) => (
            <Card
              key={index}
              className={cn(
                editingSequence && "cursor-move",
                draggedStep === index && "opacity-50 border-2 border-primary"
              )}
            >
              <div
                draggable={editingSequence}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
              >
                <div className="flex items-center gap-4 mb-4">
                  {editingSequence && (
                    <div className="text-zinc-400 cursor-grab">
                      <GripVertical className="w-5 h-5" />
                    </div>
                  )}
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                    {step.step_number}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-zinc-900">
                      Step {step.step_number}
                    </h4>
                    {editingSequence && editingStepIndex === index ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-zinc-500">Delay:</span>
                        <input
                          type="number"
                          min="0"
                          value={step.delay_days}
                          onChange={(e) => handleUpdateStep(index, "delay_days", parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none"
                        />
                        <span className="text-sm text-zinc-500">days,</span>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={step.delay_hours}
                          onChange={(e) => handleUpdateStep(index, "delay_hours", parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none"
                        />
                        <span className="text-sm text-zinc-500">hours after previous</span>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">
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
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingStepIndex(index)}
                          className="p-2 text-zinc-400 hover:text-primary hover:bg-zinc-50 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteStep(index)}
                        className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-zinc-50 rounded-lg p-4">
                  {editingSequence && editingStepIndex === index ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Subject Line</label>
                        <input
                          type="text"
                          value={step.subject_line || ""}
                          onChange={(e) => handleUpdateStep(index, "subject_line", e.target.value)}
                          placeholder="Enter email subject..."
                          className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Message Body</label>
                        <textarea
                          value={step.message_body}
                          onChange={(e) => handleUpdateStep(index, "message_body", e.target.value)}
                          placeholder="Enter email body... Use {{first_name}}, {{company}}, {{job_title}} for personalization."
                          rows={6}
                          className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <label className="block text-xs font-medium text-zinc-500 mb-1">Send Between</label>
                          <div className="flex items-center gap-2">
                            <select
                              value={step.send_after_hour}
                              onChange={(e) => handleUpdateStep(index, "send_after_hour", parseInt(e.target.value))}
                              className="px-2 py-1 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none"
                            >
                              {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i}>{i}:00</option>
                              ))}
                            </select>
                            <span className="text-sm text-zinc-500">-</span>
                            <select
                              value={step.send_before_hour}
                              onChange={(e) => handleUpdateStep(index, "send_before_hour", parseInt(e.target.value))}
                              className="px-2 py-1 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none"
                            >
                              {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i}>{i}:00</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-500 mb-1">Send On Days</label>
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
                                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
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
                      <div className="text-sm font-medium text-zinc-900 mb-2">
                        Subject: {step.subject_line || "(No subject)"}
                      </div>
                      <pre className="text-sm text-zinc-700 whitespace-pre-wrap font-sans">
                        {step.message_body || "(No message content)"}
                      </pre>
                    </>
                  )}
                </div>

                {!editingSequence && (
                  <div className="flex items-center gap-4 mt-4 text-xs text-zinc-500">
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
            </Card>
          ))}

          {/* Add Step Button */}
          {editingSequence && (
            <button
              onClick={handleAddStep}
              className="w-full bg-white rounded-xl border-2 border-dashed border-zinc-200 p-4 flex items-center justify-center gap-2 text-zinc-500 hover:text-primary hover:border-primary transition-all"
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
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-zinc-500">Open Rate</h4>
                <Eye className="w-5 h-5 text-purple-500" />
              </div>
              <div className="text-3xl font-bold text-zinc-900 mb-1">
                {openRate}%
              </div>
              <div className="text-sm text-zinc-500">
                {campaign.messages_opened} of {campaign.messages_sent} opened
              </div>
              <div className="mt-3 h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${openRate}%` }}
                />
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-zinc-500">Click Rate</h4>
                <MousePointer className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-3xl font-bold text-zinc-900 mb-1">
                {clickRate}%
              </div>
              <div className="text-sm text-zinc-500">
                {campaign.messages_clicked} of {campaign.messages_sent} clicked
              </div>
              <div className="mt-3 h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${clickRate}%` }}
                />
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-zinc-500">Reply Rate</h4>
                <MessageSquare className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-3xl font-bold text-zinc-900 mb-1">
                {replyRate}%
              </div>
              <div className="text-sm text-zinc-500">
                {campaign.messages_replied} of {campaign.messages_sent} replied
              </div>
              <div className="mt-3 h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${replyRate}%` }}
                />
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-zinc-500">Bounce Rate</h4>
                <XCircle className="w-5 h-5 text-rose-500" />
              </div>
              <div className="text-3xl font-bold text-zinc-900 mb-1">
                {campaign.messages_sent > 0
                  ? ((campaign.messages_bounced / campaign.messages_sent) * 100).toFixed(1)
                  : "0"}%
              </div>
              <div className="text-sm text-zinc-500">
                {campaign.messages_bounced} of {campaign.messages_sent} bounced
              </div>
              <div className="mt-3 h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all"
                  style={{
                    width: `${campaign.messages_sent > 0 ? (campaign.messages_bounced / campaign.messages_sent) * 100 : 0}%`,
                  }}
                />
              </div>
            </Card>
          </div>

          {/* Daily Activity Chart */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-zinc-900">Daily Activity</h3>
                <p className="text-sm text-zinc-500">Last 14 days</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-blue-200" />
                  <span className="text-zinc-500">Sent</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-purple-400" />
                  <span className="text-zinc-500">Opened</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-emerald-500" />
                  <span className="text-zinc-500">Replied</span>
                </div>
              </div>
            </div>

            {dailyMetrics.length > 0 && dailyMetrics.some((m) => m.sent > 0) ? (
              <SimpleBarChart data={dailyMetrics} height={150} />
            ) : (
              <EmptyState
                icon={<BarChart3 className="w-8 h-8" />}
                title="No activity data yet"
                description="Start the campaign to see daily metrics"
              />
            )}
          </Card>

          {/* Sequence Performance */}
          <Card>
            <CardHeader title="Sequence Performance" />
            <div className="space-y-4">
              {(campaign.sequence || []).map((step, index) => {
                // Calculate metrics per step
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
                        <span className="text-sm font-medium text-zinc-700">
                          Step {step.step_number}: {step.subject_line || "(No subject)"}
                        </span>
                        <span className="text-xs text-zinc-500">
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
                          className="bg-emerald-500 rounded-r"
                          style={{ width: `${stepSent > 0 ? (stepReplied / stepSent) * 100 : 0}%` }}
                          title={`${stepReplied} replied`}
                        />
                        <div className="bg-zinc-100 flex-1 rounded" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
