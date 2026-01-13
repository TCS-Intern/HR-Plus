"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Video,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Play,
  Eye,
  Send,
  ThumbsUp,
  ThumbsDown,
  Filter,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { assessmentApi } from "@/lib/api/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

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

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-slate-100 text-slate-600", icon: Clock },
  scheduled: { label: "Scheduled", color: "bg-blue-100 text-blue-600", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-600", icon: Play },
  completed: { label: "Completed", color: "bg-green-100 text-green-600", icon: CheckCircle },
  analyzed: { label: "Analyzed", color: "bg-purple-100 text-purple-600", icon: Eye },
  expired: { label: "Expired", color: "bg-red-100 text-red-600", icon: XCircle },
};

const recommendationConfig: Record<string, { label: string; color: string }> = {
  STRONG_YES: { label: "Strong Yes", color: "text-green-600 bg-green-100" },
  YES: { label: "Yes", color: "text-green-600 bg-green-50" },
  MAYBE: { label: "Maybe", color: "text-amber-600 bg-amber-100" },
  NO: { label: "No", color: "text-red-600 bg-red-100" },
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Assessments</h1>
          <p className="text-sm text-slate-500">Review and manage candidate video assessments</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Video className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.pending}</p>
              <p className="text-xs text-slate-500">Pending</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.completed}</p>
              <p className="text-xs text-slate-500">Completed</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-xl flex items-center justify-center">
              <Eye className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.analyzed}</p>
              <p className="text-xs text-slate-500">Analyzed</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
              <ThumbsUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.approved}</p>
              <p className="text-xs text-slate-500">Approved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-800 dark:text-white">
          All Assessments ({filteredAssessments.length})
        </h2>
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="appearance-none pl-10 pr-10 py-2 bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="analyzed">Analyzed</option>
          </select>
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* Assessments List */}
      {filteredAssessments.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center">
          <Video className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-800 dark:text-white mb-2">No assessments yet</h3>
          <p className="text-sm text-slate-500">
            Assessments will appear here when candidates are invited for video interviews.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAssessments.map((assessment) => {
            const status = statusConfig[assessment.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            const recommendation = assessment.recommendation
              ? recommendationConfig[assessment.recommendation]
              : null;

            return (
              <div key={assessment.id} className="glass-card rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">
                        {assessment.candidate?.first_name?.charAt(0) || "?"}
                      </span>
                    </div>

                    {/* Info */}
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-white">
                        {assessment.candidate
                          ? `${assessment.candidate.first_name} ${assessment.candidate.last_name}`
                          : "Unknown Candidate"}
                      </h3>
                      <p className="text-sm text-slate-500">{assessment.job?.title || "Unknown Position"}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={cn("px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1", status.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                        {recommendation && (
                          <span className={cn("px-2 py-1 text-xs font-medium rounded-full", recommendation.color)}>
                            {recommendation.label}
                          </span>
                        )}
                        {assessment.overall_score !== null && (
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
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
                        <button
                          onClick={() => handleApprove(assessment.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        >
                          <ThumbsUp className="w-4 h-4" />
                          Approve
                        </button>
                        <Link
                          href={`/assessments/${assessment.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View Analysis
                        </Link>
                      </>
                    )}
                    {assessment.status === "completed" && (
                      <span className="text-xs text-slate-500">Analyzing...</span>
                    )}
                    {(assessment.status === "pending" || assessment.status === "scheduled") && (
                      <span className="text-xs text-slate-500">
                        Created {formatDistanceToNow(new Date(assessment.created_at))} ago
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
