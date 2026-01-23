"use client";

import { useState } from "react";
import { Briefcase, Check } from "lucide-react";
import { sourcingChatApi } from "@/lib/api/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface CreateJobButtonProps {
  conversationId: string;
  disabled?: boolean;
}

export default function CreateJobButton({ conversationId, disabled }: CreateJobButtonProps) {
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleCreateJob = async () => {
    try {
      setIsCreating(true);

      const job = await sourcingChatApi.createJob({
        conversation_id: conversationId,
      });

      toast.success("Job created successfully!");

      // Redirect to job detail page
      router.push(`/jobs/${job.id}`);
    } catch (error) {
      console.error("Error creating job:", error);
      toast.error("Failed to create job. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <button
      onClick={handleCreateJob}
      disabled={disabled || isCreating}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
        disabled || isCreating
          ? "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
          : "bg-green-500 text-white hover:bg-green-600 hover:scale-105 active:scale-95 shadow-lg shadow-green-500/30"
      )}
    >
      {isCreating ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Creating...
        </>
      ) : (
        <>
          <Briefcase className="w-4 h-4" />
          Create Job from this Search
        </>
      )}
    </button>
  );
}
