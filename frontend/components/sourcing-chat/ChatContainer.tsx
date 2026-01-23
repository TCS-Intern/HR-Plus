"use client";

import { useState, useEffect, useRef } from "react";
import ChatMessage from "./ChatMessage";
import MessageInput from "./MessageInput";
import { sourcingChatApi } from "@/lib/api/client";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  message_type: "text" | "question" | "candidate_cards" | "thinking" | "error";
  content?: string;
  candidate_ids?: string[];
  metadata?: Record<string, any>;
  created_at: string;
}

interface ChatContainerProps {
  conversationId: string;
}

export default function ChatContainer({ conversationId }: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load conversation messages on mount
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setIsLoading(true);
        const response = await sourcingChatApi.getConversation(conversationId);
        setMessages(response.messages || []);
      } catch (error) {
        console.error("Failed to load messages:", error);
        toast.error("Failed to load conversation history");
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [conversationId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    // Add user message to UI immediately
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      message_type: "text",
      content: message,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsThinking(true);

    try {
      // Open SSE connection
      const eventSource = new EventSource(
        `${API_URL}/api/v1/sourcing-chat/message?conversation_id=${conversationId}&message=${encodeURIComponent(message)}&user_id=00000000-0000-0000-0000-000000000001`
      );

      let currentAssistantMessage = "";
      let assistantMessageId = `temp-assistant-${Date.now()}`;

      eventSource.addEventListener("thinking", () => {
        setIsThinking(true);
      });

      eventSource.addEventListener("message_chunk", (e) => {
        const data = JSON.parse(e.data);
        currentAssistantMessage += data.text;

        // Update or add assistant message
        setMessages((prev) => {
          const existingIndex = prev.findIndex((m) => m.id === assistantMessageId);
          const assistantMsg: Message = {
            id: assistantMessageId,
            role: "assistant",
            message_type: "text",
            content: currentAssistantMessage,
            created_at: new Date().toISOString(),
          };

          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = assistantMsg;
            return updated;
          } else {
            return [...prev, assistantMsg];
          }
        });
      });

      eventSource.addEventListener("candidates", (e) => {
        const data = JSON.parse(e.data);

        // Add candidate cards message
        const candidatesMessage: Message = {
          id: `candidates-${Date.now()}`,
          role: "assistant",
          message_type: "candidate_cards",
          candidate_ids: data.candidates.map((c: any) => c.id),
          metadata: {
            total_found: data.total_found,
            showing_count: data.showing_count,
            platforms: data.platforms,
            candidates: data.candidates, // Store full candidate data
          },
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, candidatesMessage]);
      });

      eventSource.addEventListener("complete", (e) => {
        const data = JSON.parse(e.data);
        setIsThinking(false);
        eventSource.close();

        // Update assistant message ID with real ID from backend
        if (data.message_id) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, id: data.message_id } : m
            )
          );
        }
      });

      eventSource.addEventListener("error", (e: any) => {
        setIsThinking(false);
        eventSource.close();

        // Parse data only if it exists
        let data: any = {};
        try {
          if (e.data) {
            data = JSON.parse(e.data);
          }
        } catch (err) {
          console.error("Failed to parse error data:", err);
        }

        // Add error message
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: "assistant",
          message_type: "error",
          content: data.message || "An error occurred",
          metadata: { error: data.error, retry_allowed: data.retry_allowed },
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, errorMessage]);
        toast.error(data.message || "Failed to process message");
      });

      eventSource.onerror = () => {
        setIsThinking(false);
        eventSource.close();
        toast.error("Connection error. Please try again.");
      };
    } catch (error) {
      console.error("Error sending message:", error);
      setIsThinking(false);
      toast.error("Failed to send message");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500">Loading conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-6 space-y-4"
        style={{ scrollBehavior: "smooth" }}
      >
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            conversationId={conversationId}
          />
        ))}

        {isThinking && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl rounded-tl-none px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-200 dark:border-slate-700">
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={isThinking}
        />
      </div>
    </div>
  );
}
