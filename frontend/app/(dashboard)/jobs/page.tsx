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
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";

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
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="p-6 text-center">
        <div className="w-14 h-14 bg-rose-50 rounded-xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-rose-600" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-900 mb-2">
          Delete Job?
        </h3>
        <p className="text-sm text-zinc-500 mb-2">
          Are you sure you want to delete <strong>{job.title}</strong>?
        </p>
        <p className="text-xs text-rose-500 mb-6">
          This will also delete all associated applications and cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={onConfirm}
            loading={isDeleting}
            icon={!isDeleting ? <Trash2 className="w-4 h-4" /> : undefined}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const statusBadgeVariant: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  draft: "default",
  active: "success",
  paused: "warning",
  closed: "error",
  filled: "info",
};

function JobCard({ job, applicantCount, onDelete }: { job: Job; applicantCount: number; onDelete: (job: Job) => void }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <Card hover className="relative group">
      {/* More Options Menu */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-zinc-200 py-1 z-20 min-w-[120px]">
              <Link
                href={`/jobs/${job.id}`}
                className="w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
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
                className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"
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
            <h3 className="font-semibold text-zinc-900 group-hover:text-accent transition-colors">
              {job.title}
            </h3>
            <p className="text-sm text-zinc-500">{job.department}</p>
          </div>
          <Badge variant={statusBadgeVariant[job.status] || "default"} dot>
            {job.status}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          {job.location && (
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <MapPin className="w-3 h-3" />
              {job.location}
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Clock className="w-3 h-3" />
            {job.job_type}
          </div>
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            {job.remote_policy}
          </div>
        </div>

        {job.skills_matrix?.required && job.skills_matrix.required.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {job.skills_matrix.required.slice(0, 3).map((skill) => (
              <Badge key={skill.skill} variant="primary">
                {skill.skill}
              </Badge>
            ))}
            {job.skills_matrix.required.length > 3 && (
              <Badge variant="default">
                +{job.skills_matrix.required.length - 3} more
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Users className="w-3 h-3" />
            <span>{applicantCount} applicant{applicantCount !== 1 ? "s" : ""}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-accent transition-colors" />
        </div>
      </Link>
    </Card>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applicantCounts, setApplicantCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchJobs = async () => {
    const query = supabase
      .from("jobs")
      .select("*, applications(count)")
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query.eq("status", filter);
    }

    const { data, error } = await query;

    if (!error && data) {
      const counts: Record<string, number> = {};
      const jobsData = data.map((item: any) => {
        counts[item.id] = item.applications?.[0]?.count || 0;
        const { applications, ...job } = item;
        return job;
      });
      setJobs(jobsData as Job[]);
      setApplicantCounts(counts);
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
      <PageHeader
        title="Jobs"
        description="Manage job requisitions and descriptions"
        actions={
          <Link href="/jobs/new">
            <Button icon={<Plus className="w-4 h-4" />} size="lg">
              Create Job
            </Button>
          </Link>
        }
      />

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-lg">
            {filterOptions.map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium capitalize transition-all",
                  filter === option
                    ? "bg-white shadow-sm text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex items-center bg-white border border-zinc-200 px-3 py-2 rounded-lg hover:border-zinc-300 transition-colors">
              <Search className="w-4 h-4 text-zinc-400 mr-2" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-40 text-zinc-700 placeholder-zinc-400"
              />
            </div>
            <button className="p-2 bg-white border border-zinc-200 rounded-lg text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Jobs Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Plus className="w-8 h-8" />}
            title="No jobs yet"
            description="Create your first job description using our AI-powered JD Assist agent."
            action={
              <Link href="/jobs/new">
                <Button icon={<Plus className="w-4 h-4" />} size="lg">
                  Create Your First Job
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs
            .filter((job) => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              return (
                job.title?.toLowerCase().includes(q) ||
                job.department?.toLowerCase().includes(q) ||
                job.location?.toLowerCase().includes(q)
              );
            })
            .map((job) => (
              <JobCard key={job.id} job={job} applicantCount={applicantCounts[job.id] || 0} onDelete={setJobToDelete} />
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
