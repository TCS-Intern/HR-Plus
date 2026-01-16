"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PhoneScreen, Candidate, Job } from "@/types";
import { supabase } from "@/lib/supabase/client";
import { phoneScreenApi } from "@/lib/api/client";

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

const recommendationConfig: Record<string, { color: string; label: string }> = {
  STRONG_YES: { color: "text-emerald-600 bg-emerald-100", label: "Strong Yes" },
  YES: { color: "text-green-600 bg-green-100", label: "Yes" },
  MAYBE: { color: "text-amber-600 bg-amber-100", label: "Maybe" },
  NO: { color: "text-red-600 bg-red-100", label: "No" },
};

export default function PhoneScreenDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [phoneScreen, setPhoneScreen] = useState<PhoneScreen | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const handleAction = async (action: "approve" | "reject" | "retry" | "analyze") => {
    if (!phoneScreen) return;
    setActionLoading(action);

    try {
      if (action === "approve") {
        await phoneScreenApi.approve(phoneScreen.id);
      } else if (action === "reject") {
        await phoneScreenApi.reject(phoneScreen.id);
      } else if (action === "retry") {
        await phoneScreenApi.retry(phoneScreen.id);
      } else if (action === "analyze") {
        await phoneScreenApi.analyze(phoneScreen.id, true);
      }

      // Refetch data
      const { data } = await supabase
        .from("phone_screens")
        .select("*, applications(*, candidates(*), jobs(*))")
        .eq("id", params.id)
        .single();

      if (data) {
        setPhoneScreen(data as unknown as PhoneScreen);
      }
    } catch (error) {
      console.error("Action failed:", error);
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

  if (!phoneScreen) {
    return (
      <div className="glass-card rounded-3xl p-12 text-center">
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
            Phone Screen: {candidateName}
          </h1>
          <p className="text-sm text-slate-500">{job?.title || "Unknown Position"}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Call Summary */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
              Call Summary
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-800 dark:text-white">
                  {phoneScreen.duration_seconds
                    ? `${Math.floor(phoneScreen.duration_seconds / 60)}:${(
                        phoneScreen.duration_seconds % 60
                      )
                        .toString()
                        .padStart(2, "0")}`
                    : "--:--"}
                </div>
                <div className="text-xs text-slate-500">Duration</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-800 dark:text-white">
                  {phoneScreen.overall_score !== null ? `${phoneScreen.overall_score}%` : "N/A"}
                </div>
                <div className="text-xs text-slate-500">Overall Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-800 dark:text-white">
                  {phoneScreen.attempt_number}
                </div>
                <div className="text-xs text-slate-500">Attempt</div>
              </div>
              <div className="text-center">
                {recommendation ? (
                  <span
                    className={cn(
                      "inline-block px-3 py-1 rounded-lg text-sm font-bold",
                      recommendation.color
                    )}
                  >
                    {recommendation.label}
                  </span>
                ) : (
                  <span className="text-slate-400">--</span>
                )}
                <div className="text-xs text-slate-500 mt-1">Recommendation</div>
              </div>
            </div>

            {/* Key Takeaways */}
            {phoneScreen.summary?.key_takeaways &&
              phoneScreen.summary.key_takeaways.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Key Takeaways
                  </h3>
                  <ul className="space-y-2">
                    {phoneScreen.summary.key_takeaways.map((takeaway, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                      >
                        <Star className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        {takeaway}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Compensation & Availability */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {phoneScreen.summary?.compensation_range && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Compensation
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {phoneScreen.summary.compensation_range}
                  </p>
                </div>
              )}
              {phoneScreen.summary?.availability && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Availability
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {phoneScreen.summary.availability}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Transcript */}
          {phoneScreen.transcript && phoneScreen.transcript.length > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Transcript
                </h2>
                {phoneScreen.recording_url && (
                  <a
                    href={phoneScreen.recording_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                    Listen
                  </a>
                )}
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
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
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      <div className="text-xs font-semibold mb-1 opacity-70">
                        {message.role === "assistant" ? "AI Interviewer" : "Candidate"}
                      </div>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analysis Details */}
          {phoneScreen.analysis && (
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
                Detailed Analysis
              </h2>

              {/* Scores */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">
                    {phoneScreen.analysis.communication_score}%
                  </div>
                  <div className="text-xs text-slate-500">Communication</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-600">
                    {phoneScreen.analysis.enthusiasm_score}%
                  </div>
                  <div className="text-xs text-slate-500">Enthusiasm</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">
                    {phoneScreen.analysis.technical_depth_score}%
                  </div>
                  <div className="text-xs text-slate-500">Technical Depth</div>
                </div>
              </div>

              {/* Skills Discussed */}
              {phoneScreen.analysis.skills_discussed &&
                phoneScreen.analysis.skills_discussed.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Skills Discussed
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {phoneScreen.analysis.skills_discussed.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-lg"
                        >
                          {skill.skill} ({skill.proficiency})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* Strengths & Red Flags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {phoneScreen.analysis.strengths && phoneScreen.analysis.strengths.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                      <ThumbsUp className="w-4 h-4" />
                      Strengths
                    </h3>
                    <ul className="space-y-1">
                      {phoneScreen.analysis.strengths.map((strength, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"
                        >
                          <CheckCircle className="w-3 h-3 text-green-500 mt-1 flex-shrink-0" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {phoneScreen.analysis.red_flags && phoneScreen.analysis.red_flags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Concerns
                    </h3>
                    <ul className="space-y-1">
                      {phoneScreen.analysis.red_flags.map((flag, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"
                        >
                          <XCircle className="w-3 h-3 text-red-500 mt-1 flex-shrink-0" />
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Actions</h2>

            <div className="space-y-3">
              {(phoneScreen.status === "completed" || phoneScreen.status === "analyzed") && (
                <>
                  <button
                    onClick={() => handleAction("approve")}
                    disabled={actionLoading !== null}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    {actionLoading === "approve" ? "Processing..." : "Approve for Offer"}
                  </button>
                  <button
                    onClick={() => handleAction("reject")}
                    disabled={actionLoading !== null}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    {actionLoading === "reject" ? "Processing..." : "Reject"}
                  </button>
                </>
              )}

              {(phoneScreen.status === "failed" || phoneScreen.status === "no_answer") && (
                <button
                  onClick={() => handleAction("retry")}
                  disabled={actionLoading !== null}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  {actionLoading === "retry" ? "Processing..." : "Retry Call"}
                </button>
              )}

              {phoneScreen.status === "completed" && (
                <button
                  onClick={() => handleAction("analyze")}
                  disabled={actionLoading !== null}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {actionLoading === "analyze" ? "Analyzing..." : "Re-analyze"}
                </button>
              )}
            </div>
          </div>

          {/* Candidate Info */}
          {candidate && (
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Candidate
              </h2>

              <div className="space-y-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-white">
                    {candidateName}
                  </div>
                  <div className="text-xs text-slate-500">{candidate.email}</div>
                </div>

                {phoneScreen.phone_number && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Phone className="w-4 h-4" />
                    {phoneScreen.phone_number}
                  </div>
                )}

                {candidate.linkedin_url && (
                  <a
                    href={candidate.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm hover:underline"
                  >
                    View LinkedIn Profile
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Job Info */}
          {job && (
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Position
              </h2>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-800 dark:text-white">
                  {job.title}
                </div>
                <div className="text-xs text-slate-500">{job.department}</div>
                {job.location && (
                  <div className="text-xs text-slate-500">{job.location}</div>
                )}
                <Link
                  href={`/jobs/${job.id}`}
                  className="text-primary text-sm hover:underline inline-block mt-2"
                >
                  View Job Details
                </Link>
              </div>
            </div>
          )}

          {/* Call Details */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
              Call Details
            </h2>

            <div className="space-y-3 text-sm">
              {phoneScreen.scheduled_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Scheduled</span>
                  <span className="text-slate-800 dark:text-white">
                    {new Date(phoneScreen.scheduled_at).toLocaleString()}
                  </span>
                </div>
              )}
              {phoneScreen.started_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Started</span>
                  <span className="text-slate-800 dark:text-white">
                    {new Date(phoneScreen.started_at).toLocaleString()}
                  </span>
                </div>
              )}
              {phoneScreen.ended_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Ended</span>
                  <span className="text-slate-800 dark:text-white">
                    {new Date(phoneScreen.ended_at).toLocaleString()}
                  </span>
                </div>
              )}
              {phoneScreen.ended_reason && (
                <div className="flex justify-between">
                  <span className="text-slate-500">End Reason</span>
                  <span className="text-slate-800 dark:text-white capitalize">
                    {phoneScreen.ended_reason.replace(/-/g, " ")}
                  </span>
                </div>
              )}
              {phoneScreen.error_message && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <span className="text-xs text-red-600 dark:text-red-400">
                    {phoneScreen.error_message}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
