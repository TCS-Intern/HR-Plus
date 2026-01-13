"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Edit2,
  CheckCircle,
  XCircle,
  MapPin,
  Clock,
  DollarSign,
  Users,
  Upload,
  Loader2,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { Job } from "@/types";
import { supabase } from "@/lib/supabase/client";
import { jdApi } from "@/lib/api/client";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-green-100 text-green-600",
  paused: "bg-amber-100 text-amber-600",
  closed: "bg-red-100 text-red-600",
  filled: "bg-blue-100 text-blue-600",
};

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    async function fetchJob() {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (!error && data) {
        setJob(data as Job);
      }
      setLoading(false);
    }

    if (jobId) {
      fetchJob();
    }
  }, [jobId]);

  const handleApprove = async () => {
    if (!job) return;

    setApproving(true);
    try {
      await jdApi.approve(job.id);
      setJob({ ...job, status: "active" });
      toast.success("Job approved and now active!");
    } catch (error) {
      console.error("Error approving job:", error);
      toast.error("Failed to approve job");
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
          Job not found
        </h2>
        <Link
          href="/jobs"
          className="text-primary hover:underline"
        >
          Back to jobs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/jobs"
            className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-slate-600 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                {job.title}
              </h1>
              <span
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold capitalize",
                  statusColors[job.status] || statusColors.draft
                )}
              >
                {job.status}
              </span>
            </div>
            <p className="text-sm text-slate-500">{job.department}</p>
          </div>
        </div>

        <div className="flex gap-3">
          {job.status === "draft" && (
            <>
              <Link
                href={`/jobs/${job.id}/edit`}
                className="flex items-center gap-2 px-4 py-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white transition-all"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </Link>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex items-center gap-2 px-5 py-2 bg-green-500 text-white rounded-xl font-medium shadow-lg shadow-green-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {approving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Approve & Publish
              </button>
            </>
          )}
          {job.status === "active" && (
            <Link
              href={`/jobs/${job.id}/candidates`}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
            >
              <Upload className="w-4 h-4" />
              Upload CVs & Screen
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Quick Info */}
          <div className="glass-card rounded-3xl p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {job.location && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                      {job.location}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Type</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white capitalize">
                    {job.job_type} · {job.remote_policy}
                  </p>
                </div>
              </div>
              {(job.salary_range?.min || job.salary_range?.max) && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Salary Range</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                      {job.salary_range.min && formatCurrency(job.salary_range.min)} -{" "}
                      {job.salary_range.max && formatCurrency(job.salary_range.max)}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Applicants</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">
                    0
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-bold text-slate-800 dark:text-white mb-4">
              Job Description
            </h2>
            {job.summary && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 p-4 bg-primary/5 rounded-2xl">
                {job.summary}
              </p>
            )}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line">
                {job.description}
              </p>
            </div>
          </div>

          {/* Responsibilities */}
          {job.responsibilities && job.responsibilities.length > 0 && (
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">
                Key Responsibilities
              </h2>
              <ul className="space-y-3">
                {job.responsibilities.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">{i + 1}</span>
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Qualifications */}
          {(job.qualifications?.required?.length > 0 ||
            job.qualifications?.preferred?.length > 0) && (
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">
                Qualifications
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {job.qualifications?.required?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                      Required
                    </h3>
                    <ul className="space-y-2">
                      {job.qualifications.required.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {job.qualifications?.preferred?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                      Nice to Have
                    </h3>
                    <ul className="space-y-2">
                      {job.qualifications.preferred.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <span className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0">+</span>
                          {item}
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
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Skills Matrix */}
          {(job.skills_matrix?.required?.length > 0 ||
            job.skills_matrix?.nice_to_have?.length > 0) && (
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">
                Skills Matrix
              </h2>
              {job.skills_matrix?.required?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-slate-500 mb-2">Required Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {job.skills_matrix.required.map((skill, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-lg"
                      >
                        {skill.skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {job.skills_matrix?.nice_to_have?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Nice to Have</p>
                  <div className="flex flex-wrap gap-2">
                    {job.skills_matrix.nice_to_have.map((skill, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg"
                      >
                        {skill.skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Evaluation Criteria */}
          {job.evaluation_criteria && job.evaluation_criteria.length > 0 && (
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">
                Evaluation Criteria
              </h2>
              <div className="space-y-4">
                {job.evaluation_criteria.map((criterion, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {criterion.criterion}
                      </span>
                      <span className="text-xs text-slate-500">{criterion.weight}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${criterion.weight}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Questions */}
          {(job.suggested_questions?.technical?.length > 0 ||
            job.suggested_questions?.behavioral?.length > 0) && (
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">
                Interview Questions
              </h2>
              <div className="space-y-4">
                {job.suggested_questions?.technical?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-blue-600 mb-2">Technical</p>
                    <ul className="space-y-2">
                      {job.suggested_questions.technical.slice(0, 3).map((q, i) => (
                        <li
                          key={i}
                          className="text-xs text-slate-600 dark:text-slate-400 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                        >
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {job.suggested_questions?.behavioral?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-purple-600 mb-2">Behavioral</p>
                    <ul className="space-y-2">
                      {job.suggested_questions.behavioral.slice(0, 3).map((q, i) => (
                        <li
                          key={i}
                          className="text-xs text-slate-600 dark:text-slate-400 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                        >
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
