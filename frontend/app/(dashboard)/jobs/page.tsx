"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  MapPin,
  Clock,
  Users,
  ChevronRight,
  Trash2,
  AlertTriangle,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job } from "@/types";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

// Delete Confirmation Modal
function DeleteJobModal({
  job,
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}: {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  if (!isOpen || !job) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
            Delete Job?
          </h3>
          <p className="text-sm text-slate-500 mb-2">
            Are you sure you want to delete <strong>{job.title}</strong>?
          </p>
          <p className="text-xs text-red-500 mb-6">
            This will also delete all associated applications and cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-green-100 text-green-600",
  paused: "bg-amber-100 text-amber-600",
  closed: "bg-red-100 text-red-600",
  filled: "bg-blue-100 text-blue-600",
};

function JobCard({ job, onDelete }: { job: Job; onDelete: (job: Job) => void }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="glass-card rounded-2xl p-5 hover:shadow-lg transition-all group relative">
      {/* More Options Menu */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-20 min-w-[120px]">
              <Link
                href={`/jobs/${job.id}`}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                View Details
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMenu(false);
                  onDelete(job);
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      <Link href={`/jobs/${job.id}`} className="block">
        <div className="flex justify-between items-start mb-4 pr-8">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors">
              {job.title}
            </h3>
            <p className="text-sm text-slate-500">{job.department}</p>
          </div>
          <span
            className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold capitalize",
              statusColors[job.status] || statusColors.draft
            )}
          >
            {job.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          {job.location && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="w-3 h-3" />
              {job.location}
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            {job.job_type}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            {job.remote_policy}
          </div>
        </div>

        {job.skills_matrix?.required && job.skills_matrix.required.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {job.skills_matrix.required.slice(0, 3).map((skill) => (
              <span
                key={skill.skill}
                className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-medium rounded-lg"
              >
                {skill.skill}
              </span>
            ))}
            {job.skills_matrix.required.length > 3 && (
              <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-medium rounded-lg">
                +{job.skills_matrix.required.length - 3} more
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Users className="w-3 h-3" />
            <span>0 applicants</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
        </div>
      </Link>
    </div>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchJobs = async () => {
    const query = supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query.eq("status", filter);
    }

    const { data, error } = await query;

    if (!error && data) {
      setJobs(data as Job[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [filter]);

  const handleDeleteJob = async () => {
    if (!jobToDelete) return;

    setIsDeleting(true);
    try {
      // First delete associated applications
      await supabase
        .from("applications")
        .delete()
        .eq("job_id", jobToDelete.id);

      // Then delete the job
      const { error } = await supabase
        .from("jobs")
        .delete()
        .eq("id", jobToDelete.id);

      if (error) throw error;

      toast.success(`"${jobToDelete.title}" has been deleted`);
      setJobToDelete(null);
      fetchJobs();
    } catch (error) {
      console.error("Error deleting job:", error);
      toast.error("Failed to delete job. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filterOptions = ["all", "draft", "active", "paused", "closed", "filled"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Jobs</h1>
          <p className="text-sm text-slate-500">Manage job requisitions and descriptions</p>
        </div>
        <Link
          href="/jobs/new"
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Job
        </Link>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 p-1 rounded-xl">
          {filterOptions.map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all",
                filter === option
                  ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex items-center bg-white/60 dark:bg-slate-800/60 px-3 py-2 rounded-xl">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="text"
              placeholder="Search jobs..."
              className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-40 text-slate-800 dark:text-white placeholder-slate-400"
            />
          </div>
          <button className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-slate-600 dark:text-slate-300">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Jobs Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="glass-card rounded-2xl p-5 animate-pulse"
            >
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded mb-2 w-3/4" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded mb-4 w-1/2" />
              <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
            No jobs yet
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            Create your first job description using our AI-powered JD Assist agent.
          </p>
          <Link
            href="/jobs/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Your First Job
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onDelete={setJobToDelete} />
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteJobModal
        job={jobToDelete}
        isOpen={!!jobToDelete}
        onClose={() => setJobToDelete(null)}
        onConfirm={handleDeleteJob}
        isDeleting={isDeleting}
      />
    </div>
  );
}
