"use client";

import { useState, useEffect } from "react";
import { UserPlus, Check } from "lucide-react";
import { sourcingChatApi, jdApi } from "@/lib/api/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AddToJobButtonProps {
  conversationId: string;
  selectedCandidateIds: string[];
  disabled?: boolean;
}

interface Job {
  id: string;
  title: string;
  status: string;
}

export default function AddToJobButton({
  conversationId,
  selectedCandidateIds,
  disabled,
}: AddToJobButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Load active jobs when opening dropdown
  useEffect(() => {
    if (isOpen && jobs.length === 0) {
      loadJobs();
    }
  }, [isOpen]);

  const loadJobs = async () => {
    try {
      setIsLoading(true);
      const response = await jdApi.list();
      // Filter for active jobs only
      const activeJobs = (response.data || []).filter(
        (job: Job) => job.status === "active" || job.status === "approved"
      );
      setJobs(activeJobs);
    } catch (error) {
      console.error("Error loading jobs:", error);
      toast.error("Failed to load jobs");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToJob = async () => {
    if (!selectedJobId) {
      toast.error("Please select a job");
      return;
    }

    if (selectedCandidateIds.length === 0) {
      toast.error("No candidates selected");
      return;
    }

    try {
      setIsAdding(true);

      const result = await sourcingChatApi.addToJob({
        conversation_id: conversationId,
        candidate_ids: selectedCandidateIds,
        job_id: selectedJobId,
      });

      toast.success(
        `${result.applications_created} candidate${result.applications_created > 1 ? "s" : ""} added to job!`
      );

      setIsOpen(false);
      setSelectedJobId("");
    } catch (error) {
      console.error("Error adding candidates to job:", error);
      toast.error("Failed to add candidates to job");
    } finally {
      setIsAdding(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        disabled={disabled || selectedCandidateIds.length === 0}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
          disabled || selectedCandidateIds.length === 0
            ? "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
            : "bg-primary text-white hover:bg-primary/90 hover:scale-105 active:scale-95 shadow-lg shadow-primary/30"
        )}
      >
        <UserPlus className="w-4 h-4" />
        Add to Job ({selectedCandidateIds.length})
      </button>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 dark:text-white">
          Add {selectedCandidateIds.length} candidate{selectedCandidateIds.length > 1 ? "s" : ""} to job
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          ✕
        </button>
      </div>

      {/* Job Selection */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-2">
          Select Job
        </label>

        {isLoading ? (
          <div className="py-8 text-center">
            <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 mt-2">Loading jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-500 mb-2">No active jobs found</p>
            <button
              onClick={() => {
                setIsOpen(false);
                // TODO: Navigate to create job
              }}
              className="text-xs text-primary hover:underline"
            >
              Create a job first
            </button>
          </div>
        ) : (
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
          >
            <option value="">Select a job...</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setIsOpen(false)}
          className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-600"
        >
          Cancel
        </button>
        <button
          onClick={handleAddToJob}
          disabled={!selectedJobId || isAdding}
          className={cn(
            "flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all",
            !selectedJobId || isAdding
              ? "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
              : "bg-primary text-white hover:bg-primary/90"
          )}
        >
          {isAdding ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Adding...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              Add to Job
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
