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
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { PhoneScreen, Candidate, Job, TranscriptMessage } from "@/types";
import { supabase } from "@/lib/supabase/client";
import { phoneScreenApi } from "@/lib/api/client";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

const statusConfig: Record<
  string,
  { color: string; bgColor: string; icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  scheduled: { color: "text-blue-600", bgColor: "bg-blue-100", icon: Clock, label: "Scheduled" },
  calling: { color: "text-amber-600", bgColor: "bg-amber-100", icon: Phone, label: "Calling" },
  in_progress: { color: "text-purple-600", bgColor: "bg-purple-100", icon: PlayCircle, label: "In Progress" },
  completed: { color: "text-green-600", bgColor: "bg-green-100", icon: CheckCircle, label: "Completed" },
  analyzed: { color: "text-emerald-600", bgColor: "bg-emerald-100", icon: CheckCircle, label: "Analyzed" },
  failed: { color: "text-red-600", bgColor: "bg-red-100", icon: XCircle, label: "Failed" },
  no_answer: { color: "text-orange-600", bgColor: "bg-orange-100", icon: AlertCircle, label: "No Answer" },
  cancelled: { color: "text-slate-600", bgColor: "bg-slate-100", icon: XCircle, label: "Cancelled" },
};

const recommendationConfig: Record<string, { color: string; bgColor: string; label: string; description: string }> = {
  STRONG_YES: { color: "text-emerald-700", bgColor: "bg-emerald-100", label: "Strong Yes", description: "Highly recommended to proceed" },
  YES: { color: "text-green-700", bgColor: "bg-green-100", label: "Yes", description: "Recommended to proceed" },
  MAYBE: { color: "text-amber-700", bgColor: "bg-amber-100", label: "Maybe", description: "Consider further evaluation" },
  NO: { color: "text-red-700", bgColor: "bg-red-100", label: "No", description: "Not recommended to proceed" },
};

const proficiencyColors: Record<string, string> = {
  none: "bg-slate-100 text-slate-600",
  basic: "bg-blue-100 text-blue-600",
  intermediate: "bg-indigo-100 text-indigo-600",
  advanced: "bg-purple-100 text-purple-600",
  expert: "bg-emerald-100 text-emerald-600",
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const handleAction = async (action: "approve" | "reject" | "retry" | "analyze") => {
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
      <div className="glass-card rounded-3xl p-12 text-center">
        <Phone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
          Phone screen not found
        </h3>
        <Link href="/phone-screens" className="text-primary hover:underline">
          Back to phone screens
        </Link>
      </div>
    );
  }

  const status = statusConfig[phoneScreen.status] || statusConfig.scheduled;
  const StatusIcon = status.icon;
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
            className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                Phone Screen: {candidateName}
              </h1>
              <span
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5",
                  status.bgColor,
                  status.color
                )}
              >
                <StatusIcon className="w-3.5 h-3.5" />
                {status.label}
              </span>
            </div>
            <p className="text-sm text-slate-500">{job?.title || "Unknown Position"} {job?.department ? `- ${job.department}` : ""}</p>
          </div>
        </div>

        {/* Recommendation Badge */}
        {recommendation && (
          <div className={cn("px-4 py-2 rounded-xl flex items-center gap-2", recommendation.bgColor)}>
            <Award className="w-5 h-5" />
            <div>
              <p className={cn("font-bold text-sm", recommendation.color)}>{recommendation.label}</p>
              <p className="text-xs opacity-70">{recommendation.description}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Call Summary Stats */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-bold text-slate-800 dark:text-white mb-4">Call Summary</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center">
                <Clock className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-slate-800 dark:text-white">
                  {callDurationFormatted}
                </div>
                <div className="text-xs text-slate-500">Duration</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center">
                <TrendingUp className="w-5 h-5 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold text-primary">
                  {phoneScreen.overall_score !== null ? `${phoneScreen.overall_score}%` : "N/A"}
                </div>
                <div className="text-xs text-slate-500">Overall Score</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center">
                <Phone className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-slate-800 dark:text-white">
                  {phoneScreen.attempt_number}
                </div>
                <div className="text-xs text-slate-500">Attempt #</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center">
                <span className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-full",
                  phoneScreen.confidence_level === "high" ? "bg-green-100 text-green-600" :
                  phoneScreen.confidence_level === "medium" ? "bg-amber-100 text-amber-600" :
                  "bg-red-100 text-red-600"
                )}>
                  {phoneScreen.confidence_level || "N/A"}
                </span>
                <div className="text-xs text-slate-500 mt-2">Confidence</div>
              </div>
            </div>

            {/* Key Takeaways */}
            {phoneScreen.summary?.key_takeaways && phoneScreen.summary.key_takeaways.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  Key Takeaways
                </h3>
                <ul className="space-y-2">
                  {phoneScreen.summary.key_takeaways.map((takeaway, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400 bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-xl"
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
              <div className="p-4 bg-primary/5 rounded-2xl">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Recommendation Summary</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{phoneScreen.summary.recommendation_reason}</p>
              </div>
            )}
          </div>

          {/* Extracted Data: Compensation & Availability */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-bold text-slate-800 dark:text-white mb-4">Extracted Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Compensation */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-slate-800 dark:text-white">Salary Expectations</span>
                </div>
                {phoneScreen.analysis?.compensation_expectations ? (
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-green-600">
                      {phoneScreen.analysis.compensation_expectations.min_salary && phoneScreen.analysis.compensation_expectations.max_salary
                        ? `${formatCurrency(phoneScreen.analysis.compensation_expectations.min_salary)} - ${formatCurrency(phoneScreen.analysis.compensation_expectations.max_salary)}`
                        : phoneScreen.summary?.compensation_range || "Not discussed"}
                    </p>
                    {phoneScreen.analysis.compensation_expectations.notes && (
                      <p className="text-xs text-slate-500">{phoneScreen.analysis.compensation_expectations.notes}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{phoneScreen.summary?.compensation_range || "Not discussed"}</p>
                )}
              </div>

              {/* Availability */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-slate-800 dark:text-white">Availability</span>
                </div>
                {phoneScreen.analysis?.availability ? (
                  <div className="space-y-1">
                    {phoneScreen.analysis.availability.start_date && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        <span className="font-medium">Start Date:</span> {phoneScreen.analysis.availability.start_date}
                      </p>
                    )}
                    {phoneScreen.analysis.availability.notice_period && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        <span className="font-medium">Notice Period:</span> {phoneScreen.analysis.availability.notice_period}
                      </p>
                    )}
                    {phoneScreen.analysis.availability.notes && (
                      <p className="text-xs text-slate-500 mt-1">{phoneScreen.analysis.availability.notes}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{phoneScreen.summary?.availability || "Not discussed"}</p>
                )}
              </div>
            </div>
          </div>

          {/* Transcript Viewer */}
          {phoneScreen.transcript && phoneScreen.transcript.length > 0 && (
            <div className="glass-card rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Full Transcript
                  <span className="text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                    {phoneScreen.transcript.length} messages
                  </span>
                </h2>
                <div className="flex gap-2">
                  {phoneScreen.recording_url && (
                    <>
                      <button
                        onClick={toggleAudio}
                        className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {isPlaying ? "Pause" : "Play"}
                      </button>
                      <a
                        href={phoneScreen.recording_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download
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
                        "max-w-[80%] rounded-2xl px-4 py-3",
                        message.role === "assistant"
                          ? "bg-slate-100 dark:bg-slate-800"
                          : "bg-primary/10"
                      )}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <span className={cn(
                          "text-xs font-semibold",
                          message.role === "assistant" ? "text-slate-500" : "text-primary"
                        )}>
                          {message.role === "assistant" ? "AI Interviewer" : "Candidate"}
                        </span>
                        {message.timestamp && (
                          <span className="text-xs text-slate-400">{formatTimestamp(message.timestamp)}</span>
                        )}
                      </div>
                      <p className={cn(
                        "text-sm",
                        message.role === "assistant" ? "text-slate-700 dark:text-slate-300" : "text-primary-dark"
                      )}>
                        {message.content}
                      </p>
                      {message.duration_ms && (
                        <span className="text-xs text-slate-400 mt-1 block">
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
            </div>
          )}

          {/* AI Analysis Results */}
          {phoneScreen.analysis && (
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">AI Analysis Results</h2>

              {/* Analysis Scores */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                  <div className="text-3xl font-bold text-blue-600">{phoneScreen.analysis.communication_score}%</div>
                  <div className="text-xs text-slate-500 mt-1">Communication</div>
                  <div className="w-full h-2 bg-blue-200 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${phoneScreen.analysis.communication_score}%` }} />
                  </div>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl">
                  <div className="text-3xl font-bold text-purple-600">{phoneScreen.analysis.enthusiasm_score}%</div>
                  <div className="text-xs text-slate-500 mt-1">Enthusiasm</div>
                  <div className="w-full h-2 bg-purple-200 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-purple-600 rounded-full" style={{ width: `${phoneScreen.analysis.enthusiasm_score}%` }} />
                  </div>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl">
                  <div className="text-3xl font-bold text-green-600">{phoneScreen.analysis.technical_depth_score}%</div>
                  <div className="text-xs text-slate-500 mt-1">Technical Depth</div>
                  <div className="w-full h-2 bg-green-200 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-green-600 rounded-full" style={{ width: `${phoneScreen.analysis.technical_depth_score}%` }} />
                  </div>
                </div>
              </div>

              {/* Skills Discussed */}
              {phoneScreen.analysis.skills_discussed && phoneScreen.analysis.skills_discussed.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Skills Discussed</h3>
                  <div className="flex flex-wrap gap-2">
                    {phoneScreen.analysis.skills_discussed.map((skill, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium",
                          proficiencyColors[skill.proficiency] || "bg-slate-100 text-slate-600"
                        )}
                        title={skill.evidence || ""}
                      >
                        {skill.skill}
                        <span className="ml-1.5 opacity-70 capitalize">({skill.proficiency})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Experience Highlights */}
              {phoneScreen.analysis.experience_highlights && phoneScreen.analysis.experience_highlights.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Experience Highlights</h3>
                  <ul className="space-y-2">
                    {phoneScreen.analysis.experience_highlights.map((highlight, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
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
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl">
                    <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                      <ThumbsUp className="w-4 h-4" />
                      Strengths
                    </h3>
                    <ul className="space-y-2">
                      {phoneScreen.analysis.strengths.map((strength, idx) => (
                        <li key={idx} className="text-sm text-green-700 dark:text-green-300 flex items-start gap-2">
                          <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {phoneScreen.analysis.red_flags && phoneScreen.analysis.red_flags.length > 0 && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl">
                    <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Concerns
                    </h3>
                    <ul className="space-y-2">
                      {phoneScreen.analysis.red_flags.map((flag, idx) => (
                        <li key={idx} className="text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
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
                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">AI Summary</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{phoneScreen.analysis.summary}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-bold text-slate-800 dark:text-white mb-4">Actions</h2>

            <div className="space-y-3">
              {(phoneScreen.status === "completed" || phoneScreen.status === "analyzed") && (
                <>
                  <button
                    onClick={() => handleAction("approve")}
                    disabled={actionLoading !== null}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === "approve" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ThumbsUp className="w-4 h-4" />
                    )}
                    Approve for Next Stage
                  </button>
                  <button
                    onClick={() => handleAction("reject")}
                    disabled={actionLoading !== null}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === "reject" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ThumbsDown className="w-4 h-4" />
                    )}
                    Reject
                  </button>
                </>
              )}

              {(phoneScreen.status === "failed" || phoneScreen.status === "no_answer") && (
                <button
                  onClick={() => handleAction("retry")}
                  disabled={actionLoading !== null}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  {actionLoading === "retry" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  Retry Call
                </button>
              )}

              {phoneScreen.status === "completed" && (
                <button
                  onClick={() => handleAction("analyze")}
                  disabled={actionLoading !== null}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {actionLoading === "analyze" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <TrendingUp className="w-4 h-4" />
                  )}
                  Re-analyze
                </button>
              )}
            </div>
          </div>

          {/* Candidate Info */}
          {candidate && (
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Candidate
              </h2>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-indigo-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{candidate.first_name.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white">{candidateName}</p>
                  <p className="text-xs text-slate-500">{candidate.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                {phoneScreen.phone_number && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Phone className="w-4 h-4 text-slate-400" />
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
            </div>
          )}

          {/* Job Info */}
          {job && (
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Position
              </h2>

              <div className="space-y-2">
                <p className="font-semibold text-slate-800 dark:text-white">{job.title}</p>
                {job.department && <p className="text-sm text-slate-500">{job.department}</p>}
                {job.location && <p className="text-sm text-slate-500">{job.location}</p>}
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex items-center gap-2 text-sm text-primary hover:underline mt-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Job Details
                </Link>
              </div>
            </div>
          )}

          {/* Call Details */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-bold text-slate-800 dark:text-white mb-4">Call Details</h2>

            <div className="space-y-3 text-sm">
              {phoneScreen.scheduled_at && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Scheduled</span>
                  <span className="text-slate-800 dark:text-white text-right">
                    {format(new Date(phoneScreen.scheduled_at), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
              )}
              {phoneScreen.started_at && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Started</span>
                  <span className="text-slate-800 dark:text-white text-right">
                    {format(new Date(phoneScreen.started_at), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
              )}
              {phoneScreen.ended_at && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Ended</span>
                  <span className="text-slate-800 dark:text-white text-right">
                    {format(new Date(phoneScreen.ended_at), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
              )}
              {phoneScreen.analyzed_at && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Analyzed</span>
                  <span className="text-slate-800 dark:text-white text-right">
                    {formatDistanceToNow(new Date(phoneScreen.analyzed_at))} ago
                  </span>
                </div>
              )}
              {phoneScreen.ended_reason && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">End Reason</span>
                  <span className="text-slate-800 dark:text-white capitalize text-right">
                    {phoneScreen.ended_reason.replace(/-/g, " ")}
                  </span>
                </div>
              )}
              {phoneScreen.vapi_call_id && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Call ID</span>
                  <span className="text-xs text-slate-400 font-mono truncate max-w-[150px]" title={phoneScreen.vapi_call_id}>
                    {phoneScreen.vapi_call_id}
                  </span>
                </div>
              )}
            </div>

            {phoneScreen.error_message && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Error</p>
                <p className="text-xs text-red-600 dark:text-red-400">{phoneScreen.error_message}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
