"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowLeft } from "lucide-react";
import ChatContainer from "@/components/sourcing-chat/ChatContainer";
import { sourcingChatApi } from "@/lib/api/client";
import { toast } from "sonner";

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
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <p className="text-sm text-slate-500">Starting conversation...</p>
        </div>
      </div>
    );
  }

  if (!conversationId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <p className="text-sm text-slate-500">
            Failed to start conversation. Please refresh the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary/90"
          >
            Refresh Page
          </button>
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
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              Find Candidates with AI
            </h1>
            <p className="text-sm text-slate-500">
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
          className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          Use classic form
        </button>
      </div>

      {/* Chat Interface */}
      <div className="glass-card rounded-3xl overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
        <ChatContainer conversationId={conversationId} />
      </div>
    </div>
  );
}
