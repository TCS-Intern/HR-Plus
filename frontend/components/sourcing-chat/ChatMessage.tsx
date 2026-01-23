"use client";

import { AlertCircle, User, Sparkles } from "lucide-react";
import AnonymizedCandidateCard from "./AnonymizedCandidateCard";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  message_type: "text" | "question" | "candidate_cards" | "thinking" | "error";
  content?: string;
  candidate_ids?: string[];
  metadata?: Record<string, any>;
  created_at: string;
}

interface ChatMessageProps {
  message: Message;
  conversationId: string;
}

export default function ChatMessage({ message, conversationId }: ChatMessageProps) {
  const isUser = message.role === "user";

  // Render different message types
  if (message.message_type === "candidate_cards") {
    return (
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>

        <div className="flex-1 space-y-3">
          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl rounded-tl-none px-4 py-3">
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
              Found <span className="font-semibold text-primary">{message.metadata?.total_found || 0}</span> candidates!
              Here are the top {message.metadata?.showing_count || 0}:
            </p>
            <p className="text-xs text-slate-500">
              {message.metadata?.platforms?.join(", ") || "Multiple platforms"}
            </p>
          </div>

          {/* Candidate Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {message.metadata?.candidates?.map((candidate: any, index: number) => (
              <AnonymizedCandidateCard
                key={candidate.id}
                candidate={candidate}
                conversationId={conversationId}
                index={index + 1}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (message.message_type === "error") {
    return (
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-red-500" />
        </div>

        <div className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-2xl rounded-tl-none px-4 py-3 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">
            {message.content || "An error occurred"}
          </p>
          {message.metadata?.retry_allowed && (
            <p className="text-xs text-red-500 mt-1">
              Please try again or rephrase your request
            </p>
          )}
        </div>
      </div>
    );
  }

  if (message.message_type === "question") {
    // Highlight questions from assistant
    return (
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>

        <div className="flex-1 bg-primary/5 dark:bg-primary/10 rounded-2xl rounded-tl-none px-4 py-3 border border-primary/20">
          <p className="text-sm text-slate-800 dark:text-white whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  // Default: text message
  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
          isUser
            ? "bg-primary text-white"
            : "bg-slate-100 dark:bg-slate-800"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <Sparkles className="w-4 h-4 text-primary" />
        )}
      </div>

      <div
        className={cn(
          "flex-1 rounded-2xl px-4 py-3 max-w-[80%]",
          isUser
            ? "bg-primary text-white rounded-tr-none"
            : "bg-slate-100 dark:bg-slate-800/50 text-slate-800 dark:text-white rounded-tl-none"
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
