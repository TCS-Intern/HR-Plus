"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Video,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Play,
  Eye,
  ThumbsUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { assessmentApi } from "@/lib/api/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { SkeletonList } from "@/components/ui/skeleton";

interface Assessment {
  id: string;
  application_id: string;
  assessment_type: string;
  status: string;
  questions: any[];
  overall_score: number | null;
  recommendation: string | null;
  video_url: string | null;
  created_at: string;
  completed_at: string | null;
  analyzed_at: string | null;
  candidate?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  job?: {
    title: string;
  };
}

type FilterStatus = "all" | "pending" | "scheduled" | "completed" | "analyzed";

const statusBadgeVariant: Record<string, { label: string; variant: "default" | "info" | "warning" | "success" | "purple" | "error"; icon: any }> = {
  pending: { label: "Pending", variant: "default", icon: Clock },
  scheduled: { label: "Scheduled", variant: "info", icon: Clock },
  in_progress: { label: "In Progress", variant: "warning", icon: Play },
  completed: { label: "Completed", variant: "success", icon: CheckCircle },
  analyzed: { label: "Analyzed", variant: "purple", icon: Eye },
  expired: { label: "Expired", variant: "error", icon: XCircle },
};

const recommendationBadgeVariant: Record<string, { label: string; variant: "success" | "info" | "warning" | "error" }> = {
  STRONG_YES: { label: "Strong Yes", variant: "success" },
  YES: { label: "Yes", variant: "info" },
  MAYBE: { label: "Maybe", variant: "warning" },
  NO: { label: "No", variant: "error" },
};

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  useEffect(() => {
    fetchAssessments();
  }, []);

  const fetchAssessments = async () => {
    try {
      const { data, error } = await supabase
        .from("assessments")
        .select(`
          *,
          applications (
            *,
            candidates (*),
            jobs (*)
          )
        `)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const transformedData = data.map((item: any) => ({
          ...item,
          candidate: item.applications?.candidates,
          job: item.applications?.jobs,
        }));
        setAssessments(transformedData);
      }
    } catch (error) {
      console.error("Error fetching assessments:", error);
    }
    setLoading(false);
  };

  const handleApprove = async (assessmentId: string) => {
    try {
      await assessmentApi.approve(assessmentId);
      toast.success("Candidate approved for offer!");
      fetchAssessments();
    } catch (error) {
      console.error("Error approving:", error);
      toast.error("Failed to approve candidate");
    }
  };

  const filteredAssessments = assessments.filter((a) => {
    if (filterStatus === "all") return true;
    return a.status === filterStatus;
  });

  const stats = {
    total: assessments.length,
    pending: assessments.filter((a) => a.status === "pending" || a.status === "scheduled").length,
    completed: assessments.filter((a) => a.status === "completed").length,
    analyzed: assessments.filter((a) => a.status === "analyzed").length,
    approved: assessments.filter((a) => a.recommendation === "STRONG_YES" || a.recommendation === "YES").length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Assessments" description="Review and manage candidate video assessments" />
        <SkeletonList rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Assessments"
        description="Review and manage candidate video assessments"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat
          label="Total"
          value={stats.total}
          icon={<Video className="w-5 h-5" />}
          bgColor="bg-zinc-100"
        />
        <Stat
          label="Pending"
          value={stats.pending}
          icon={<Clock className="w-5 h-5" />}
          bgColor="bg-amber-50"
        />
        <Stat
          label="Completed"
          value={stats.completed}
          icon={<CheckCircle className="w-5 h-5" />}
          bgColor="bg-emerald-50"
        />
        <Stat
          label="Analyzed"
          value={stats.analyzed}
          icon={<Eye className="w-5 h-5" />}
          bgColor="bg-purple-50"
        />
        <Stat
          label="Approved"
          value={stats.approved}
          icon={<ThumbsUp className="w-5 h-5" />}
          bgColor="bg-blue-50"
        />
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-zinc-900">
          All Assessments ({filteredAssessments.length})
        </h2>
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          options={[
            { value: "all", label: "All Status" },
            { value: "pending", label: "Pending" },
            { value: "scheduled", label: "Scheduled" },
            { value: "completed", label: "Completed" },
            { value: "analyzed", label: "Analyzed" },
          ]}
        />
      </div>

      {/* Assessments List */}
      {filteredAssessments.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Video className="w-6 h-6" />}
            title="No assessments yet"
            description="Assessments will appear here when candidates are invited for video interviews."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAssessments.map((assessment) => {
            const status = statusBadgeVariant[assessment.status] || statusBadgeVariant.pending;
            const recommendation = assessment.recommendation
              ? recommendationBadgeVariant[assessment.recommendation]
              : null;

            const candidateName = assessment.candidate
              ? `${assessment.candidate.first_name} ${assessment.candidate.last_name}`
              : "Unknown Candidate";

            return (
              <Card key={assessment.id} hover padding="sm" className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <Avatar
                      name={candidateName}
                      size="lg"
                    />

                    {/* Info */}
                    <div>
                      <h3 className="font-semibold text-zinc-900">
                        {candidateName}
                      </h3>
                      <p className="text-sm text-zinc-500">{assessment.job?.title || "Unknown Position"}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant={status.variant} dot>
                          {status.label}
                        </Badge>
                        {recommendation && (
                          <Badge variant={recommendation.variant} dot>
                            {recommendation.label}
                          </Badge>
                        )}
                        {assessment.overall_score !== null && (
                          <span className="text-sm font-semibold text-zinc-700">
                            Score: {assessment.overall_score}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {assessment.status === "analyzed" && (
                      <>
                        <Button
                          size="sm"
                          variant="success"
                          icon={<ThumbsUp className="w-3.5 h-3.5" />}
                          onClick={() => handleApprove(assessment.id)}
                        >
                          Approve
                        </Button>
                        <Link href={`/assessments/${assessment.id}`}>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Eye className="w-3.5 h-3.5" />}
                          >
                            View Analysis
                          </Button>
                        </Link>
                      </>
                    )}
                    {assessment.status === "completed" && (
                      <span className="text-xs text-zinc-500">Analyzing...</span>
                    )}
                    {(assessment.status === "pending" || assessment.status === "scheduled") && (
                      <span className="text-xs text-zinc-500">
                        Created {formatDistanceToNow(new Date(assessment.created_at))} ago
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
