"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowLeft } from "lucide-react";
import ChatContainer from "@/components/sourcing-chat/ChatContainer";
import { sourcingChatApi } from "@/lib/api/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function NewJobPage() {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize conversation on mount
  useEffect(() => {
    const initConversation = async () => {
      try {
        setIsLoading(true);
        const response = await sourcingChatApi.start({});
        setConversationId(response.id);
      } catch (error) {
        console.error("Failed to initialize conversation:", error);
        toast.error("Failed to start conversation. Please refresh the page.");
      } finally {
        setIsLoading(false);
      }
    };

    initConversation();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 bg-zinc-100 rounded-xl flex items-center justify-center mx-auto animate-pulse">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <p className="text-sm text-zinc-500">Starting conversation...</p>
        </div>
      </div>
    );
  }

  if (!conversationId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <p className="text-sm text-zinc-500">
            Failed to start conversation. Please refresh the page.
          </p>
          <Button
            variant="primary"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/jobs")}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">
              Find Candidates with AI
            </h1>
            <p className="text-sm text-zinc-500">
              Chat with our AI assistant to source and review candidates
            </p>
          </div>
        </div>

        {/* Optional: Add link to classic form */}
        <button
          onClick={() => {
            // TODO: Implement classic form route if needed
            toast.info("Classic form coming soon. For now, enjoy the AI-powered chat!");
          }}
          className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
        >
          Use classic form
        </button>
      </div>

      {/* Chat Interface */}
      <Card padding="none" className="overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
        <ChatContainer conversationId={conversationId} />
      </Card>
    </div>
  );
}
