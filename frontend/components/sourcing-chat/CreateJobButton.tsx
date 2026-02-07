"use client";

import { useState } from "react";
import { Briefcase } from "lucide-react";
import { sourcingChatApi } from "@/lib/api/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
    <Button
      onClick={handleCreateJob}
      disabled={disabled || isCreating}
      loading={isCreating}
      variant="success"
      icon={!isCreating ? <Briefcase className="w-4 h-4" /> : undefined}
    >
      {isCreating ? "Creating..." : "Create Job from this Search"}
    </Button>
  );
}
