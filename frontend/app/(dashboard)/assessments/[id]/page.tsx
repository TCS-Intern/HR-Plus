"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Video,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Play,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Clock,
  User,
  Briefcase,
  Mail,
  Eye,
  Send,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { assessmentApi, emailApi } from "@/lib/api/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface ResponseScore {
  question_id: string;
  score: number;
  feedback?: string;
  strengths?: string[];
  weaknesses?: string[];
  key_points_mentioned?: string[];
  missed_topics?: string[];
}

interface Assessment {
  id: string;
  application_id: string;
  assessment_type: string;
  status: string;
  questions: any[];
  video_url: string | null;
  video_duration_seconds: number | null;
  overall_score: number | null;
  recommendation: string | null;
  confidence_level: string | null;
  response_scores: ResponseScore[];
  video_analysis: any;
  summary: {
    top_strengths?: string[];
    areas_of_concern?: string[];
    hiring_recommendation?: string;
    suggested_follow_up_questions?: string[];
  } | null;
  created_at: string;
  completed_at: string | null;
  analyzed_at: string | null;
}

interface Application {
  id: string;
  job_id: string;
  candidate_id: string;
  status: string;
  candidates: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    linkedin_url: string | null;
  };
  jobs: {
    title: string;
    department: string | null;
  };
}

const recommendationConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  STRONG_YES: { label: "Strong Yes", color: "text-green-600", bgColor: "bg-green-100" },
  YES: { label: "Yes", color: "text-green-600", bgColor: "bg-green-50" },
  MAYBE: { label: "Maybe", color: "text-amber-600", bgColor: "bg-amber-100" },
  NO: { label: "No", color: "text-red-600", bgColor: "bg-red-100" },
};

const confidenceConfig: Record<string, { label: string; color: string }> = {
  high: { label: "High Confidence", color: "text-green-600" },
  medium: { label: "Medium Confidence", color: "text-amber-600" },
  low: { label: "Low Confidence", color: "text-red-600" },
};

export default function AssessmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [emailPreview, setEmailPreview] = useState<{
    show: boolean;
    loading: boolean;
    data: {
      subject?: string;
      to_email?: string;
      to_name?: string;
      html_content?: string;
    } | null;
  }>({ show: false, loading: false, data: null });

  useEffect(() => {
    async function fetchData() {
      // Fetch assessment
      const { data: assessmentData, error: assessmentError } = await supabase
        .from("assessments")
        .select("*")
        .eq("id", assessmentId)
        .single();

      if (assessmentError) {
        console.error("Error fetching assessment:", assessmentError);
        setLoading(false);
        return;
      }

      setAssessment(assessmentData);

      // Fetch application with candidate and job data
      if (assessmentData?.application_id) {
        const { data: appData, error: appError } = await supabase
          .from("applications")
          .select("*, candidates(*), jobs(*)")
          .eq("id", assessmentData.application_id)
          .single();

        if (!appError && appData) {
          setApplication(appData);
        }
      }

      setLoading(false);
    }

    fetchData();
  }, [assessmentId]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      await assessmentApi.approve(assessmentId);
      toast.success("Candidate approved for offer!");
      router.push("/assessments");
    } catch (error) {
      console.error("Error approving:", error);
      toast.error("Failed to approve candidate");
    }
    setApproving(false);
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      // Using a simple reject endpoint
      const response = await fetch(`/api/v1/assess/${assessmentId}/reject`, {
        method: "POST",
      });
      if (response.ok) {
        toast.success("Candidate rejected");
        router.push("/assessments");
      }
    } catch (error) {
      console.error("Error rejecting:", error);
      toast.error("Failed to reject candidate");
    }
    setRejecting(false);
  };

  const handlePreviewEmail = async () => {
    setEmailPreview({ show: true, loading: true, data: null });
    try {
      const response = await emailApi.previewAssessment(assessmentId);
      setEmailPreview({
        show: true,
        loading: false,
        data: response.data,
      });
    } catch (error) {
      console.error("Error previewing email:", error);
      toast.error("Failed to load email preview");
      setEmailPreview({ show: false, loading: false, data: null });
    }
  };

  const handleSendInvitation = async () => {
    try {
      await assessmentApi.approve(assessmentId); // This sends the invitation
      toast.success("Assessment invitation sent!");
      setEmailPreview({ show: false, loading: false, data: null });
      // Refresh data
      const { data: assessmentData } = await supabase
        .from("assessments")
        .select("*")
        .eq("id", assessmentId)
        .single();
      if (assessmentData) {
        setAssessment(assessmentData);
      }
    } catch (error) {
      console.error("Error sending invitation:", error);
      toast.error("Failed to send invitation");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
          Assessment not found
        </h2>
        <Link href="/assessments" className="text-primary hover:underline">
          Back to assessments
        </Link>
      </div>
    );
  }

  const candidate = application?.candidates;
  const job = application?.jobs;
  const recommendation = assessment.recommendation
    ? recommendationConfig[assessment.recommendation]
    : null;
  const confidence = assessment.confidence_level
    ? confidenceConfig[assessment.confidence_level]
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/assessments"
            className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-slate-600 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              Assessment Analysis
            </h1>
            <p className="text-sm text-slate-500">
              {candidate
                ? `${candidate.first_name} ${candidate.last_name}`
                : "Unknown Candidate"}{" "}
              • {job?.title || "Unknown Position"}
            </p>
          </div>
        </div>

        {(assessment.status === "pending" || assessment.status === "scheduled") && (
          <button
            onClick={handlePreviewEmail}
            disabled={emailPreview.loading}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-purple-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {emailPreview.loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            Preview Invitation Email
          </button>
        )}

        {assessment.status === "analyzed" && (
          <div className="flex gap-3">
            <button
              onClick={handleReject}
              disabled={rejecting}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {rejecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ThumbsDown className="w-4 h-4" />
              )}
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={approving}
              className="flex items-center gap-2 px-5 py-2 bg-green-500 text-white rounded-xl font-medium shadow-lg shadow-green-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              {approving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ThumbsUp className="w-4 h-4" />
              )}
              Approve for Offer
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Video Player */}
          {assessment.video_url && (
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">Video Recording</h2>
              <div className="relative bg-black rounded-2xl overflow-hidden aspect-video">
                <video
                  src={assessment.video_url}
                  controls
                  className="w-full h-full"
                  poster="/video-poster.png"
                />
              </div>
              {assessment.video_duration_seconds && (
                <p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Duration: {Math.floor(assessment.video_duration_seconds / 60)}:
                  {(assessment.video_duration_seconds % 60).toString().padStart(2, "0")}
                </p>
              )}
            </div>
          )}

          {/* Response Analysis */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-bold text-slate-800 dark:text-white mb-4">Response Analysis</h2>

            {assessment.response_scores && assessment.response_scores.length > 0 ? (
              <div className="space-y-4">
                {assessment.response_scores.map((response, i) => {
                  const question = assessment.questions.find(
                    (q) => q.question_id === response.question_id
                  );

                  return (
                    <div
                      key={response.question_id}
                      className="border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-4"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <span className="text-xs font-medium text-primary uppercase tracking-wide">
                            Question {i + 1}
                          </span>
                          <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                            {question?.question_text || "Question text not available"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-lg font-bold",
                              (response.score || 0) >= 7
                                ? "text-green-600"
                                : (response.score || 0) >= 5
                                  ? "text-amber-600"
                                  : "text-red-600"
                            )}
                          >
                            {response.score || 0}/10
                          </span>
                        </div>
                      </div>

                      {/* Strengths */}
                      {response.strengths && response.strengths.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-green-600 mb-1">Strengths</p>
                          <ul className="space-y-1">
                            {response.strengths.map((s, j) => (
                              <li
                                key={j}
                                className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400"
                              >
                                <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Weaknesses */}
                      {response.weaknesses && response.weaknesses.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-red-600 mb-1">Areas for Improvement</p>
                          <ul className="space-y-1">
                            {response.weaknesses.map((w, j) => (
                              <li
                                key={j}
                                className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">
                No detailed response analysis available
              </p>
            )}
          </div>

          {/* Summary */}
          {assessment.summary && (
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">Summary</h2>

              {assessment.summary.hiring_recommendation && (
                <div className="bg-primary/5 rounded-2xl p-4 mb-4">
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {assessment.summary.hiring_recommendation}
                  </p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {/* Top Strengths */}
                {assessment.summary.top_strengths &&
                  assessment.summary.top_strengths.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-green-600 mb-2">Top Strengths</h3>
                      <ul className="space-y-2">
                        {assessment.summary.top_strengths.map((s, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                          >
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Areas of Concern */}
                {assessment.summary.areas_of_concern &&
                  assessment.summary.areas_of_concern.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-red-600 mb-2">Areas of Concern</h3>
                      <ul className="space-y-2">
                        {assessment.summary.areas_of_concern.map((c, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                          >
                            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>

              {/* Follow-up Questions */}
              {assessment.summary.suggested_follow_up_questions &&
                assessment.summary.suggested_follow_up_questions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Suggested Follow-up Questions
                    </h3>
                    <ul className="space-y-2">
                      {assessment.summary.suggested_follow_up_questions.map((q, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                        >
                          <MessageSquare className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Score Card */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-bold text-slate-800 dark:text-white mb-4">Overall Score</h2>

            {/* Score Circle */}
            <div className="flex justify-center mb-6">
              <div
                className={cn(
                  "w-32 h-32 rounded-full flex items-center justify-center",
                  (assessment.overall_score || 0) >= 70
                    ? "bg-green-100 dark:bg-green-900/40"
                    : (assessment.overall_score || 0) >= 50
                      ? "bg-amber-100 dark:bg-amber-900/40"
                      : "bg-red-100 dark:bg-red-900/40"
                )}
              >
                <span
                  className={cn(
                    "text-4xl font-bold",
                    (assessment.overall_score || 0) >= 70
                      ? "text-green-600"
                      : (assessment.overall_score || 0) >= 50
                        ? "text-amber-600"
                        : "text-red-600"
                  )}
                >
                  {assessment.overall_score || 0}
                </span>
              </div>
            </div>

            {/* Recommendation */}
            {recommendation && (
              <div className="text-center mb-4">
                <span
                  className={cn(
                    "px-4 py-2 text-sm font-semibold rounded-full",
                    recommendation.bgColor,
                    recommendation.color
                  )}
                >
                  {recommendation.label}
                </span>
              </div>
            )}

            {/* Confidence */}
            {confidence && (
              <p className={cn("text-sm text-center", confidence.color)}>{confidence.label}</p>
            )}
          </div>

          {/* Candidate Info */}
          {candidate && (
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">Candidate</h2>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-violet-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {candidate.first_name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white">
                    {candidate.first_name} {candidate.last_name}
                  </p>
                  <p className="text-sm text-slate-500">{candidate.email}</p>
                </div>
              </div>
              {candidate.phone && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  📞 {candidate.phone}
                </p>
              )}
              {candidate.linkedin_url && (
                <a
                  href={candidate.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  View LinkedIn Profile
                </a>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-bold text-slate-800 dark:text-white mb-4">Timeline</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 mt-2 bg-primary rounded-full" />
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Created</p>
                  <p className="text-xs text-slate-500">
                    {formatDistanceToNow(new Date(assessment.created_at))} ago
                  </p>
                </div>
              </div>
              {assessment.completed_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 bg-green-500 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Completed
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(assessment.completed_at))} ago
                    </p>
                  </div>
                </div>
              )}
              {assessment.analyzed_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 bg-purple-500 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Analyzed
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(assessment.analyzed_at))} ago
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Email Preview Modal */}
      {emailPreview.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                  <Mail className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">Email Preview</h3>
                  <p className="text-sm text-slate-500">Assessment invitation email</p>
                </div>
              </div>
              <button
                onClick={() => setEmailPreview({ show: false, loading: false, data: null })}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {emailPreview.loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : emailPreview.data ? (
                <div className="space-y-4">
                  {/* Email Headers */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-500 w-16">To:</span>
                      <span className="text-sm text-slate-800 dark:text-white">
                        {emailPreview.data.to_name} &lt;{emailPreview.data.to_email}&gt;
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-500 w-16">Subject:</span>
                      <span className="text-sm text-slate-800 dark:text-white font-medium">
                        {emailPreview.data.subject}
                      </span>
                    </div>
                  </div>

                  {/* Email Content */}
                  <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                    <div
                      className="bg-white p-4"
                      dangerouslySetInnerHTML={{ __html: emailPreview.data.html_content || "" }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-center text-slate-500">Failed to load email preview</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setEmailPreview({ show: false, loading: false, data: null })}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleSendInvitation}
                className="flex items-center gap-2 px-5 py-2 bg-green-500 text-white rounded-xl font-medium shadow-lg shadow-green-500/30 hover:scale-105 active:scale-95 transition-all"
              >
                <Send className="w-4 h-4" />
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
