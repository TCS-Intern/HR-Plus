"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Video,
  CheckCircle,
  AlertTriangle,
  Loader2,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Clock,
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
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";

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

const recommendationConfig: Record<string, { label: string; variant: "success" | "info" | "warning" | "error" }> = {
  STRONG_YES: { label: "Strong Yes", variant: "success" },
  YES: { label: "Yes", variant: "info" },
  MAYBE: { label: "Maybe", variant: "warning" },
  NO: { label: "No", variant: "error" },
};

const confidenceConfig: Record<string, { label: string; color: string }> = {
  high: { label: "High Confidence", color: "text-emerald-600" },
  medium: { label: "Medium Confidence", color: "text-amber-600" },
  low: { label: "Low Confidence", color: "text-rose-600" },
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
        <h2 className="text-xl font-bold text-zinc-900 mb-2">
          Assessment not found
        </h2>
        <Link href="/assessments" className="text-accent hover:underline">
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
            className="p-2 bg-white rounded-lg border border-zinc-200 text-zinc-600 hover:text-accent hover:border-zinc-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">
              Assessment Analysis
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              {candidate
                ? `${candidate.first_name} ${candidate.last_name}`
                : "Unknown Candidate"}{" "}
              -- {job?.title || "Unknown Position"}
            </p>
          </div>
        </div>

        {(assessment.status === "pending" || assessment.status === "scheduled") && (
          <Button
            variant="primary"
            icon={emailPreview.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            onClick={handlePreviewEmail}
            disabled={emailPreview.loading}
          >
            Preview Invitation Email
          </Button>
        )}

        {assessment.status === "analyzed" && (
          <div className="flex gap-3">
            <Button
              variant="danger"
              icon={<ThumbsDown className="w-4 h-4" />}
              onClick={handleReject}
              loading={rejecting}
            >
              Reject
            </Button>
            <Button
              variant="success"
              icon={<ThumbsUp className="w-4 h-4" />}
              onClick={handleApprove}
              loading={approving}
            >
              Approve for Offer
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Video Player */}
          {assessment.video_url && (
            <Card>
              <CardHeader title="Video Recording" />
              <div className="relative bg-zinc-900 rounded-lg overflow-hidden aspect-video">
                <video
                  src={assessment.video_url}
                  controls
                  className="w-full h-full"
                  poster="/video-poster.png"
                />
              </div>
              {assessment.video_duration_seconds && (
                <p className="text-sm text-zinc-500 mt-3 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Duration: {Math.floor(assessment.video_duration_seconds / 60)}:
                  {(assessment.video_duration_seconds % 60).toString().padStart(2, "0")}
                </p>
              )}
            </Card>
          )}

          {/* Response Analysis */}
          <Card>
            <CardHeader title="Response Analysis" />

            {assessment.response_scores && assessment.response_scores.length > 0 ? (
              <div className="space-y-4">
                {assessment.response_scores.map((response, i) => {
                  const question = assessment.questions.find(
                    (q) => q.question_id === response.question_id
                  );

                  return (
                    <div
                      key={response.question_id}
                      className="border border-zinc-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <span className="text-xs font-medium text-primary uppercase tracking-wide">
                            Question {i + 1}
                          </span>
                          <p className="text-sm text-zinc-700 mt-1">
                            {question?.question_text || "Question text not available"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-lg font-bold",
                              (response.score || 0) >= 7
                                ? "text-emerald-600"
                                : (response.score || 0) >= 5
                                  ? "text-amber-600"
                                  : "text-rose-600"
                            )}
                          >
                            {response.score || 0}/10
                          </span>
                        </div>
                      </div>

                      {/* Strengths */}
                      {response.strengths && response.strengths.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-emerald-600 mb-1">Strengths</p>
                          <ul className="space-y-1">
                            {response.strengths.map((s, j) => (
                              <li
                                key={j}
                                className="flex items-start gap-2 text-xs text-zinc-700"
                              >
                                <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Weaknesses */}
                      {response.weaknesses && response.weaknesses.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-rose-600 mb-1">Areas for Improvement</p>
                          <ul className="space-y-1">
                            {response.weaknesses.map((w, j) => (
                              <li
                                key={j}
                                className="flex items-start gap-2 text-xs text-zinc-700"
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
              <p className="text-sm text-zinc-500 text-center py-8">
                No detailed response analysis available
              </p>
            )}
          </Card>

          {/* Summary */}
          {assessment.summary && (
            <Card>
              <CardHeader title="Summary" />

              {assessment.summary.hiring_recommendation && (
                <div className="bg-zinc-50 rounded-lg p-4 mb-4 border border-zinc-100">
                  <p className="text-sm text-zinc-700">
                    {assessment.summary.hiring_recommendation}
                  </p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {/* Top Strengths */}
                {assessment.summary.top_strengths &&
                  assessment.summary.top_strengths.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-600 mb-2">Top Strengths</h3>
                      <ul className="space-y-2">
                        {assessment.summary.top_strengths.map((s, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-zinc-700"
                          >
                            <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
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
                      <h3 className="text-sm font-semibold text-rose-600 mb-2">Areas of Concern</h3>
                      <ul className="space-y-2">
                        {assessment.summary.areas_of_concern.map((c, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-zinc-700"
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
                  <div className="mt-4 pt-4 border-t border-zinc-200">
                    <h3 className="text-sm font-semibold text-zinc-700 mb-2">
                      Suggested Follow-up Questions
                    </h3>
                    <ul className="space-y-2">
                      {assessment.summary.suggested_follow_up_questions.map((q, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-zinc-700"
                        >
                          <MessageSquare className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Score Card */}
          <Card>
            <CardHeader title="Overall Score" />

            {/* Score Circle */}
            <div className="flex justify-center mb-6">
              <div
                className={cn(
                  "w-32 h-32 rounded-full flex items-center justify-center",
                  (assessment.overall_score || 0) >= 70
                    ? "bg-emerald-50"
                    : (assessment.overall_score || 0) >= 50
                      ? "bg-amber-50"
                      : "bg-rose-50"
                )}
              >
                <span
                  className={cn(
                    "text-4xl font-bold",
                    (assessment.overall_score || 0) >= 70
                      ? "text-emerald-600"
                      : (assessment.overall_score || 0) >= 50
                        ? "text-amber-600"
                        : "text-rose-600"
                  )}
                >
                  {assessment.overall_score || 0}
                </span>
              </div>
            </div>

            {/* Recommendation */}
            {recommendation && (
              <div className="text-center mb-4">
                <Badge variant={recommendation.variant} className="px-4 py-1.5 text-sm">
                  {recommendation.label}
                </Badge>
              </div>
            )}

            {/* Confidence */}
            {confidence && (
              <p className={cn("text-sm text-center", confidence.color)}>{confidence.label}</p>
            )}
          </Card>

          {/* Candidate Info */}
          {candidate && (
            <Card>
              <CardHeader title="Candidate" />
              <div className="flex items-center gap-4 mb-4">
                <Avatar
                  name={`${candidate.first_name} ${candidate.last_name}`}
                  size="lg"
                />
                <div>
                  <p className="font-semibold text-zinc-900">
                    {candidate.first_name} {candidate.last_name}
                  </p>
                  <p className="text-sm text-zinc-500">{candidate.email}</p>
                </div>
              </div>
              {candidate.phone && (
                <p className="text-sm text-zinc-700 mb-2">
                  Phone: {candidate.phone}
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
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader title="Timeline" />
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 mt-2 bg-primary rounded-full" />
                <div>
                  <p className="text-sm font-medium text-zinc-700">Created</p>
                  <p className="text-xs text-zinc-500">
                    {formatDistanceToNow(new Date(assessment.created_at))} ago
                  </p>
                </div>
              </div>
              {assessment.completed_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 bg-emerald-500 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-zinc-700">
                      Completed
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatDistanceToNow(new Date(assessment.completed_at))} ago
                    </p>
                  </div>
                </div>
              )}
              {assessment.analyzed_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 bg-purple-500 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-zinc-700">
                      Analyzed
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatDistanceToNow(new Date(assessment.analyzed_at))} ago
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Email Preview Modal */}
      <Modal
        isOpen={emailPreview.show}
        onClose={() => setEmailPreview({ show: false, loading: false, data: null })}
        title="Email Preview"
        description="Assessment invitation email"
        size="lg"
      >
        <div className="p-6">
          {emailPreview.loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : emailPreview.data ? (
            <div className="space-y-4">
              {/* Email Headers */}
              <div className="bg-zinc-50 rounded-lg p-4 space-y-2 border border-zinc-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-500 w-16">To:</span>
                  <span className="text-sm text-zinc-900">
                    {emailPreview.data.to_name} &lt;{emailPreview.data.to_email}&gt;
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-500 w-16">Subject:</span>
                  <span className="text-sm text-zinc-900 font-medium">
                    {emailPreview.data.subject}
                  </span>
                </div>
              </div>

              {/* Email Content */}
              <div className="border border-zinc-200 rounded-lg overflow-hidden">
                <div
                  className="bg-white p-4"
                  dangerouslySetInnerHTML={{ __html: emailPreview.data.html_content || "" }}
                />
              </div>
            </div>
          ) : (
            <p className="text-center text-zinc-500">Failed to load email preview</p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setEmailPreview({ show: false, loading: false, data: null })}
          >
            Close
          </Button>
          <Button
            variant="success"
            icon={<Send className="w-4 h-4" />}
            onClick={handleSendInvitation}
          >
            Send Invitation
          </Button>
        </div>
      </Modal>
    </div>
  );
}
