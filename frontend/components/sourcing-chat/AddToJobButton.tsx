"use client";

import { useState, useEffect } from "react";
import { UserPlus, Check } from "lucide-react";
import { sourcingChatApi, jdApi } from "@/lib/api/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
      <Button
        onClick={() => setIsOpen(true)}
        disabled={disabled || selectedCandidateIds.length === 0}
        icon={<UserPlus className="w-4 h-4" />}
      >
        Add to Job ({selectedCandidateIds.length})
      </Button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900">
          Add {selectedCandidateIds.length} candidate{selectedCandidateIds.length > 1 ? "s" : ""} to job
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          <span className="sr-only">Close</span>
          &times;
        </button>
      </div>

      {/* Job Selection */}
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-2">
          Select Job
        </label>

        {isLoading ? (
          <div className="py-8 text-center">
            <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-zinc-500 mt-2">Loading jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-zinc-500 mb-2">No active jobs found</p>
            <button
              onClick={() => {
                setIsOpen(false);
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
            className="w-full px-3 py-2 bg-white rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-primary"
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
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => setIsOpen(false)}
        >
          Cancel
        </Button>
        <Button
          className="flex-1"
          onClick={handleAddToJob}
          disabled={!selectedJobId || isAdding}
          loading={isAdding}
          icon={!isAdding ? <Check className="w-4 h-4" /> : undefined}
        >
          {isAdding ? "Adding..." : "Add to Job"}
        </Button>
      </div>
    </div>
  );
}
