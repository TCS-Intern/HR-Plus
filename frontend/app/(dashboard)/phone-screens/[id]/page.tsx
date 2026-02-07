"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  PlayCircle,
  User,
  Briefcase,
  DollarSign,
  Calendar,
  Star,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Volume2,
  MessageSquare,
  Loader2,
  Pause,
  Play,
  Download,
  ExternalLink,
  Award,
  TrendingUp,
  AlertTriangle,
  FileText,
  Copy,
  Check,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { PhoneScreen, Candidate, Job, TranscriptMessage } from "@/types";
import { supabase } from "@/lib/supabase/client";
import { phoneScreenApi } from "@/lib/api/client";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";

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

const recommendationConfig: Record<string, { variant: "success" | "info" | "warning" | "error"; label: string; description: string }> = {
  STRONG_YES: { variant: "success", label: "Strong Yes", description: "Highly recommended to proceed" },
  YES: { variant: "info", label: "Yes", description: "Recommended to proceed" },
  MAYBE: { variant: "warning", label: "Maybe", description: "Consider further evaluation" },
  NO: { variant: "error", label: "No", description: "Not recommended to proceed" },
};

const proficiencyBadgeVariant: Record<string, "default" | "info" | "purple" | "success"> = {
  none: "default",
  basic: "info",
  intermediate: "info",
  advanced: "purple",
  expert: "success",
};

function formatDuration(ms: number | null): string {
  if (!ms) return "0:00";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return "";
  try {
    return format(new Date(timestamp), "h:mm:ss a");
  } catch {
    return "";
  }
}

export default function PhoneScreenDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [phoneScreen, setPhoneScreen] = useState<PhoneScreen | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expandedTranscript, setExpandedTranscript] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Export transcript functions
  const formatTranscriptForExport = (exportFormat: "text" | "markdown" | "json") => {
    if (!phoneScreen?.transcript) return "";

    const dateStr = phoneScreen.started_at ? new Date(phoneScreen.started_at).toLocaleString() : "N/A";
    const header = `Phone Screen Interview Transcript
Candidate: ${candidateName}
Position: ${job?.title || "Unknown"}
Date: ${exportFormat === "markdown" ? `**${dateStr}**` : dateStr}
Duration: ${callDurationFormatted}
Status: ${phoneScreen.status}
${phoneScreen.overall_score !== null ? `Overall Score: ${phoneScreen.overall_score}%` : ""}
${phoneScreen.recommendation ? `Recommendation: ${phoneScreen.recommendation}` : ""}
${"─".repeat(50)}

`;

    if (exportFormat === "json") {
      return JSON.stringify({
        candidate: candidateName,
        position: job?.title,
        date: phoneScreen.started_at,
        duration: callDurationFormatted,
        status: phoneScreen.status,
        overallScore: phoneScreen.overall_score,
        recommendation: phoneScreen.recommendation,
        transcript: phoneScreen.transcript.map((msg: TranscriptMessage) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        })),
        analysis: phoneScreen.analysis,
        summary: phoneScreen.summary,
      }, null, 2);
    }

    const messages = phoneScreen.transcript.map((msg: TranscriptMessage) => {
      const role = msg.role === "assistant" ? "AI Interviewer" : "Candidate";
      const timestamp = msg.timestamp ? `[${formatTimestamp(msg.timestamp)}]` : "";

      if (exportFormat === "markdown") {
        return `### ${role} ${timestamp}\n${msg.content}\n`;
      }
      return `[${role}] ${timestamp}\n${msg.content}\n`;
    }).join("\n");

    return header + messages;
  };

  const exportTranscript = (exportFormat: "text" | "markdown" | "json") => {
    const content = formatTranscriptForExport(exportFormat);
    const extension = exportFormat === "json" ? "json" : exportFormat === "markdown" ? "md" : "txt";
    const mimeType = exportFormat === "json" ? "application/json" : "text/plain";

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${candidateName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    toast.success(`Transcript exported as ${extension.toUpperCase()}`);
  };

  const copyTranscript = async () => {
    const content = formatTranscriptForExport("text");
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Transcript copied to clipboard");
    } catch (err) {
      toast.error("Failed to copy transcript");
    }
  };

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from("phone_screens")
        .select("*, applications(*, candidates(*), jobs(*))")
        .eq("id", params.id)
        .single();

      if (!error && data) {
        setPhoneScreen(data as unknown as PhoneScreen);
        if (data.applications) {
          setCandidate(data.applications.candidates as unknown as Candidate);
          setJob(data.applications.jobs as unknown as Job);
        }
      }
      setLoading(false);
    }

    fetchData();
  }, [params.id]);

  const refreshData = async () => {
    const { data } = await supabase
      .from("phone_screens")
      .select("*, applications(*, candidates(*), jobs(*))")
      .eq("id", params.id)
      .single();

    if (data) {
      setPhoneScreen(data as unknown as PhoneScreen);
    }
  };

  const handleAction = async (action: "approve" | "reject" | "retry" | "analyze" | "simulate") => {
    if (!phoneScreen) return;
    setActionLoading(action);

    try {
      if (action === "approve") {
        await phoneScreenApi.approve(phoneScreen.id);
        toast.success("Candidate approved for next stage!");
      } else if (action === "reject") {
        await phoneScreenApi.reject(phoneScreen.id);
        toast.success("Candidate rejected");
      } else if (action === "retry") {
        await phoneScreenApi.retry(phoneScreen.id);
        toast.success("Call retry scheduled");
      } else if (action === "analyze") {
        await phoneScreenApi.analyze(phoneScreen.id, true);
        toast.success("Analysis started");
      } else if (action === "simulate") {
        await phoneScreenApi.simulate(phoneScreen.id);
        toast.success("Phone screen simulated! Analysis running...");
      }

      await refreshData();
    } catch (error) {
      console.error("Action failed:", error);
      toast.error("Action failed. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!phoneScreen) {
    return (
      <Card>
        <EmptyState
          icon={<Phone className="w-8 h-8" />}
          title="Phone screen not found"
          action={
            <Link href="/phone-screens" className="text-primary hover:underline text-sm">
              Back to phone screens
            </Link>
          }
        />
      </Card>
    );
  }

  const statusCfg = statusBadgeConfig[phoneScreen.status] || statusBadgeConfig.scheduled;
  const StatusIcon = statusCfg.icon;
  const recommendation = phoneScreen.recommendation
    ? recommendationConfig[phoneScreen.recommendation]
    : null;

  const candidateName = candidate
    ? `${candidate.first_name} ${candidate.last_name}`
    : "Unknown Candidate";

  const callDurationFormatted = phoneScreen.duration_seconds
    ? `${Math.floor(phoneScreen.duration_seconds / 60)}:${(phoneScreen.duration_seconds % 60).toString().padStart(2, "0")}`
    : "--:--";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 bg-white rounded-lg border border-zinc-200 text-zinc-600 hover:text-primary hover:border-zinc-300 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-zinc-900">
                Phone Screen: {candidateName}
              </h1>
              <Badge variant={statusCfg.variant}>
                <StatusIcon className="w-3.5 h-3.5" />
                {statusCfg.label}
              </Badge>
            </div>
            <p className="text-sm text-zinc-500">{job?.title || "Unknown Position"} {job?.department ? `- ${job.department}` : ""}</p>
          </div>
        </div>

        {/* Recommendation Badge */}
        {recommendation && (
          <Card padding="sm" className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-zinc-700" />
              <div>
                <Badge variant={recommendation.variant}>{recommendation.label}</Badge>
                <p className="text-xs text-zinc-500 mt-0.5">{recommendation.description}</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Call Summary Stats */}
          <Card>
            <CardHeader title="Call Summary" />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-zinc-50 rounded-lg p-4 text-center">
                <Clock className="w-5 h-5 text-zinc-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-zinc-900">
                  {callDurationFormatted}
                </div>
                <div className="text-xs text-zinc-500">Duration</div>
              </div>
              <div className="bg-zinc-50 rounded-lg p-4 text-center">
                <TrendingUp className="w-5 h-5 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold text-primary">
                  {phoneScreen.overall_score !== null ? `${phoneScreen.overall_score}%` : "N/A"}
                </div>
                <div className="text-xs text-zinc-500">Overall Score</div>
              </div>
              <div className="bg-zinc-50 rounded-lg p-4 text-center">
                <Phone className="w-5 h-5 text-zinc-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-zinc-900">
                  {phoneScreen.attempt_number}
                </div>
                <div className="text-xs text-zinc-500">Attempt #</div>
              </div>
              <div className="bg-zinc-50 rounded-lg p-4 text-center">
                <Badge
                  variant={
                    phoneScreen.confidence_level === "high" ? "success" :
                    phoneScreen.confidence_level === "medium" ? "warning" :
                    "error"
                  }
                >
                  {phoneScreen.confidence_level || "N/A"}
                </Badge>
                <div className="text-xs text-zinc-500 mt-2">Confidence</div>
              </div>
            </div>

            {/* Key Takeaways */}
            {phoneScreen.summary?.key_takeaways && phoneScreen.summary.key_takeaways.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  Key Takeaways
                </h3>
                <ul className="space-y-2">
                  {phoneScreen.summary.key_takeaways.map((takeaway, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-zinc-700 bg-amber-50 p-3 rounded-lg"
                    >
                      <CheckCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      {takeaway}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendation Reason */}
            {phoneScreen.summary?.recommendation_reason && (
              <div className="p-4 bg-primary/5 rounded-lg">
                <p className="text-sm font-medium text-zinc-700 mb-1">Recommendation Summary</p>
                <p className="text-sm text-zinc-700">{phoneScreen.summary.recommendation_reason}</p>
              </div>
            )}
          </Card>

          {/* Extracted Data: Compensation & Availability */}
          <Card>
            <CardHeader title="Extracted Information" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Compensation */}
              <div className="bg-emerald-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <span className="font-semibold text-zinc-900">Salary Expectations</span>
                </div>
                {phoneScreen.analysis?.compensation_expectations ? (
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-emerald-600">
                      {phoneScreen.analysis.compensation_expectations.min_salary && phoneScreen.analysis.compensation_expectations.max_salary
                        ? `${formatCurrency(phoneScreen.analysis.compensation_expectations.min_salary)} - ${formatCurrency(phoneScreen.analysis.compensation_expectations.max_salary)}`
                        : phoneScreen.summary?.compensation_range || "Not discussed"}
                    </p>
                    {phoneScreen.analysis.compensation_expectations.notes && (
                      <p className="text-xs text-zinc-500">{phoneScreen.analysis.compensation_expectations.notes}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">{phoneScreen.summary?.compensation_range || "Not discussed"}</p>
                )}
              </div>

              {/* Availability */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-zinc-900">Availability</span>
                </div>
                {phoneScreen.analysis?.availability ? (
                  <div className="space-y-1">
                    {phoneScreen.analysis.availability.start_date && (
                      <p className="text-sm text-zinc-700">
                        <span className="font-medium">Start Date:</span> {phoneScreen.analysis.availability.start_date}
                      </p>
                    )}
                    {phoneScreen.analysis.availability.notice_period && (
                      <p className="text-sm text-zinc-700">
                        <span className="font-medium">Notice Period:</span> {phoneScreen.analysis.availability.notice_period}
                      </p>
                    )}
                    {phoneScreen.analysis.availability.notes && (
                      <p className="text-xs text-zinc-500 mt-1">{phoneScreen.analysis.availability.notes}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">{phoneScreen.summary?.availability || "Not discussed"}</p>
                )}
              </div>
            </div>
          </Card>

          {/* Transcript Viewer */}
          {phoneScreen.transcript && phoneScreen.transcript.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-zinc-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Full Transcript
                  <Badge variant="default">
                    {phoneScreen.transcript.length} messages
                  </Badge>
                </h2>
                <div className="flex gap-2">
                  {/* Copy Button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    onClick={copyTranscript}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </Button>

                  {/* Export Dropdown */}
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<FileText className="w-4 h-4" />}
                      onClick={() => setShowExportMenu(!showExportMenu)}
                    >
                      Export
                    </Button>
                    {showExportMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-zinc-200 py-1 z-20 min-w-[140px]">
                          <button
                            onClick={() => exportTranscript("text")}
                            className="w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                          >
                            <FileText className="w-4 h-4" />
                            Plain Text (.txt)
                          </button>
                          <button
                            onClick={() => exportTranscript("markdown")}
                            className="w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                          >
                            <FileText className="w-4 h-4" />
                            Markdown (.md)
                          </button>
                          <button
                            onClick={() => exportTranscript("json")}
                            className="w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                          >
                            <FileText className="w-4 h-4" />
                            JSON (.json)
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {phoneScreen.recording_url && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        onClick={toggleAudio}
                      >
                        {isPlaying ? "Pause" : "Play"}
                      </Button>
                      <a
                        href={phoneScreen.recording_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />}>
                          Audio
                        </Button>
                      </a>
                      <audio ref={audioRef} src={phoneScreen.recording_url} onEnded={() => setIsPlaying(false)} className="hidden" />
                    </>
                  )}
                </div>
              </div>

              <div className={cn(
                "space-y-3 overflow-y-auto transition-all",
                expandedTranscript ? "max-h-[600px]" : "max-h-80"
              )}>
                {phoneScreen.transcript.map((message, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex gap-3",
                      message.role === "assistant" ? "justify-start" : "justify-end"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-3",
                        message.role === "assistant"
                          ? "bg-zinc-50"
                          : "bg-primary/5"
                      )}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <span className={cn(
                          "text-xs font-semibold",
                          message.role === "assistant" ? "text-zinc-500" : "text-primary"
                        )}>
                          {message.role === "assistant" ? "AI Interviewer" : "Candidate"}
                        </span>
                        {message.timestamp && (
                          <span className="text-xs text-zinc-400">{formatTimestamp(message.timestamp)}</span>
                        )}
                      </div>
                      <p className={cn(
                        "text-sm",
                        message.role === "assistant" ? "text-zinc-700" : "text-zinc-900"
                      )}>
                        {message.content}
                      </p>
                      {message.duration_ms && (
                        <span className="text-xs text-zinc-400 mt-1 block">
                          Duration: {formatDuration(message.duration_ms)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {phoneScreen.transcript.length > 5 && (
                <button
                  onClick={() => setExpandedTranscript(!expandedTranscript)}
                  className="w-full mt-4 py-2 text-sm font-medium text-primary hover:underline"
                >
                  {expandedTranscript ? "Show Less" : "Show Full Transcript"}
                </button>
              )}
            </Card>
          )}

          {/* AI Analysis Results */}
          {phoneScreen.analysis && (
            <Card>
              <CardHeader title="AI Analysis Results" />

              {/* Analysis Scores */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{phoneScreen.analysis.communication_score}%</div>
                  <div className="text-xs text-zinc-500 mt-1">Communication</div>
                  <div className="w-full h-2 bg-blue-200 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${phoneScreen.analysis.communication_score}%` }} />
                  </div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">{phoneScreen.analysis.enthusiasm_score}%</div>
                  <div className="text-xs text-zinc-500 mt-1">Enthusiasm</div>
                  <div className="w-full h-2 bg-purple-200 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-purple-600 rounded-full" style={{ width: `${phoneScreen.analysis.enthusiasm_score}%` }} />
                  </div>
                </div>
                <div className="text-center p-4 bg-emerald-50 rounded-lg">
                  <div className="text-3xl font-bold text-emerald-600">{phoneScreen.analysis.technical_depth_score}%</div>
                  <div className="text-xs text-zinc-500 mt-1">Technical Depth</div>
                  <div className="w-full h-2 bg-emerald-200 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${phoneScreen.analysis.technical_depth_score}%` }} />
                  </div>
                </div>
              </div>

              {/* Skills Discussed */}
              {phoneScreen.analysis.skills_discussed && phoneScreen.analysis.skills_discussed.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-zinc-700 mb-3">Skills Discussed</h3>
                  <div className="flex flex-wrap gap-2">
                    {phoneScreen.analysis.skills_discussed.map((skill, idx) => (
                      <Badge
                        key={idx}
                        variant={proficiencyBadgeVariant[skill.proficiency] || "default"}
                        className="cursor-help"
                      >
                        {skill.skill}
                        <span className="opacity-70 capitalize">({skill.proficiency})</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Experience Highlights */}
              {phoneScreen.analysis.experience_highlights && phoneScreen.analysis.experience_highlights.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-zinc-700 mb-3">Experience Highlights</h3>
                  <ul className="space-y-2">
                    {phoneScreen.analysis.experience_highlights.map((highlight, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-zinc-700">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Strengths & Red Flags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {phoneScreen.analysis.strengths && phoneScreen.analysis.strengths.length > 0 && (
                  <div className="p-4 bg-emerald-50 rounded-lg">
                    <h3 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2">
                      <ThumbsUp className="w-4 h-4" />
                      Strengths
                    </h3>
                    <ul className="space-y-2">
                      {phoneScreen.analysis.strengths.map((strength, idx) => (
                        <li key={idx} className="text-sm text-emerald-700 flex items-start gap-2">
                          <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {phoneScreen.analysis.red_flags && phoneScreen.analysis.red_flags.length > 0 && (
                  <div className="p-4 bg-rose-50 rounded-lg">
                    <h3 className="text-sm font-semibold text-rose-700 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Concerns
                    </h3>
                    <ul className="space-y-2">
                      {phoneScreen.analysis.red_flags.map((flag, idx) => (
                        <li key={idx} className="text-sm text-rose-700 flex items-start gap-2">
                          <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Analysis Summary */}
              {phoneScreen.analysis.summary && (
                <div className="mt-4 p-4 bg-zinc-50 rounded-lg">
                  <h3 className="text-sm font-semibold text-zinc-700 mb-2">AI Summary</h3>
                  <p className="text-sm text-zinc-700">{phoneScreen.analysis.summary}</p>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader title="Actions" />

            <div className="space-y-3">
              {(phoneScreen.status === "completed" || phoneScreen.status === "analyzed") && (
                <>
                  <Button
                    variant="success"
                    className="w-full"
                    onClick={() => handleAction("approve")}
                    loading={actionLoading === "approve"}
                    disabled={actionLoading !== null}
                    icon={<ThumbsUp className="w-4 h-4" />}
                  >
                    Approve for Next Stage
                  </Button>
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={() => handleAction("reject")}
                    loading={actionLoading === "reject"}
                    disabled={actionLoading !== null}
                    icon={<ThumbsDown className="w-4 h-4" />}
                  >
                    Reject
                  </Button>
                </>
              )}

              {phoneScreen.status === "scheduled" && (
                <Button
                  className="w-full"
                  onClick={() => handleAction("simulate")}
                  loading={actionLoading === "simulate"}
                  disabled={actionLoading !== null}
                  icon={<PlayCircle className="w-4 h-4" />}
                >
                  Simulate Call
                </Button>
              )}

              {(phoneScreen.status === "failed" || phoneScreen.status === "no_answer") && (
                <>
                  <Button
                    className="w-full"
                    onClick={() => handleAction("simulate")}
                    loading={actionLoading === "simulate"}
                    disabled={actionLoading !== null}
                    icon={<PlayCircle className="w-4 h-4" />}
                  >
                    Simulate Call
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => handleAction("retry")}
                    loading={actionLoading === "retry"}
                    disabled={actionLoading !== null}
                    icon={<RotateCcw className="w-4 h-4" />}
                  >
                    Retry Call
                  </Button>
                </>
              )}

              {phoneScreen.status === "completed" && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => handleAction("analyze")}
                  loading={actionLoading === "analyze"}
                  disabled={actionLoading !== null}
                  icon={<TrendingUp className="w-4 h-4" />}
                >
                  Re-analyze
                </Button>
              )}
            </div>
          </Card>

          {/* Candidate Info */}
          {candidate && (
            <Card>
              <CardHeader title="Candidate" />

              <div className="flex items-center gap-3 mb-4">
                <Avatar name={candidateName} size="lg" />
                <div>
                  <p className="font-semibold text-zinc-900">{candidateName}</p>
                  <p className="text-xs text-zinc-500">{candidate.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                {phoneScreen.phone_number && (
                  <div className="flex items-center gap-2 text-sm text-zinc-700">
                    <Phone className="w-4 h-4 text-zinc-400" />
                    {phoneScreen.phone_number}
                  </div>
                )}

                {candidate.linkedin_url && (
                  <a
                    href={candidate.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View LinkedIn Profile
                  </a>
                )}
              </div>
            </Card>
          )}

          {/* Job Info */}
          {job && (
            <Card>
              <CardHeader title="Position" />

              <div className="space-y-2">
                <p className="font-semibold text-zinc-900">{job.title}</p>
                {job.department && <p className="text-sm text-zinc-500">{job.department}</p>}
                {job.location && <p className="text-sm text-zinc-500">{job.location}</p>}
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex items-center gap-2 text-sm text-primary hover:underline mt-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Job Details
                </Link>
              </div>
            </Card>
          )}

          {/* Call Details */}
          <Card>
            <CardHeader title="Call Details" />

            <div className="space-y-3 text-sm">
              {phoneScreen.scheduled_at && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Scheduled</span>
                  <span className="text-zinc-900 text-right">
                    {format(new Date(phoneScreen.scheduled_at), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
              )}
              {phoneScreen.started_at && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Started</span>
                  <span className="text-zinc-900 text-right">
                    {format(new Date(phoneScreen.started_at), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
              )}
              {phoneScreen.ended_at && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Ended</span>
                  <span className="text-zinc-900 text-right">
                    {format(new Date(phoneScreen.ended_at), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
              )}
              {phoneScreen.analyzed_at && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Analyzed</span>
                  <span className="text-zinc-900 text-right">
                    {formatDistanceToNow(new Date(phoneScreen.analyzed_at))} ago
                  </span>
                </div>
              )}
              {phoneScreen.ended_reason && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">End Reason</span>
                  <span className="text-zinc-900 capitalize text-right">
                    {phoneScreen.ended_reason.replace(/-/g, " ")}
                  </span>
                </div>
              )}
              {phoneScreen.vapi_call_id && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Call ID</span>
                  <span className="text-xs text-zinc-400 font-mono truncate max-w-[150px]" title={phoneScreen.vapi_call_id}>
                    {phoneScreen.vapi_call_id}
                  </span>
                </div>
              )}
            </div>

            {phoneScreen.error_message && (
              <div className="mt-4 p-3 bg-rose-50 rounded-lg">
                <p className="text-xs font-medium text-rose-600 mb-1">Error</p>
                <p className="text-xs text-rose-600">{phoneScreen.error_message}</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
