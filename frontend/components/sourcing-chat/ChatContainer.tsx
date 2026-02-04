"use client";

import { useState, useEffect, useRef } from "react";
import ChatMessage from "./ChatMessage";
import MessageInput, { MessageMetadata } from "./MessageInput";
import { sourcingChatApi, api } from "@/lib/api/client";
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

  const handleSendMessage = async (message: string, metadata?: MessageMetadata) => {
    if (!message.trim()) return;

    // Add user message to UI immediately
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      message_type: "text",
      content: message,
      metadata: metadata ? { inputType: metadata.type } : undefined,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsThinking(true);

    try {
      // Handle file upload
      if (metadata?.type === "file" && metadata.file) {
        await handleFileUpload(metadata.file, message);
        return;
      }

      // Handle URL extraction
      if (metadata?.type === "url" && metadata.url) {
        await handleUrlExtraction(metadata.url);
        return;
      }

      // Regular text message - use SSE
      await handleTextMessage(message);
    } catch (error) {
      console.error("Error sending message:", error);
      setIsThinking(false);
      toast.error("Failed to send message");
    }
  };

  const handleTextMessage = async (message: string) => {
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

      const candidatesMessage: Message = {
        id: `candidates-${Date.now()}`,
        role: "assistant",
        message_type: "candidate_cards",
        candidate_ids: data.candidates.map((c: any) => c.id),
        metadata: {
          total_found: data.total_found,
          showing_count: data.showing_count,
          platforms: data.platforms,
          candidates: data.candidates,
        },
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, candidatesMessage]);
    });

    eventSource.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data);
      setIsThinking(false);
      eventSource.close();

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

      let data: any = {};
      try {
        if (e.data) {
          data = JSON.parse(e.data);
        }
      } catch (err) {
        console.error("Failed to parse error data:", err);
      }

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
  };

  const handleFileUpload = async (file: File, message: string) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("conversation_id", conversationId);

      const response = await api.post("/sourcing-chat/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const data = response.data;

      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        message_type: "text",
        content: data.message || `I've analyzed ${file.name}. Here's what I found:\n\n${data.extracted_text || ""}`,
        metadata: {
          extracted_criteria: data.extracted_criteria,
          file_type: data.file_type,
        },
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsThinking(false);

      if (data.extracted_criteria) {
        toast.success("Requirements extracted from document!");
      }
    } catch (error: any) {
      console.error("File upload error:", error);
      setIsThinking(false);

      // If endpoint doesn't exist yet, simulate response
      if (error.response?.status === 404) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          message_type: "text",
          content: `I've received your file "${file.name}". Let me analyze it and extract the key requirements...\n\nBased on the document, it looks like you're looking for candidates with specific skills. Could you tell me more about the role you're trying to fill?`,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        toast.error("Failed to process file");
      }
    }
  };

  const handleUrlExtraction = async (url: string) => {
    try {
      const response = await api.post("/sourcing-chat/extract-url", {
        url,
        conversation_id: conversationId,
      });

      const data = response.data;

      // Add assistant response with extracted skills
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        message_type: "text",
        content: data.message || formatUrlExtractionResponse(data),
        metadata: {
          extracted_skills: data.skills,
          job_title: data.title,
          source_url: url,
        },
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsThinking(false);

      if (data.skills?.length > 0) {
        toast.success(`Extracted ${data.skills.length} skills from job posting!`);
      }
    } catch (error: any) {
      console.error("URL extraction error:", error);
      setIsThinking(false);

      // If endpoint doesn't exist yet, simulate response
      if (error.response?.status === 404) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          message_type: "text",
          content: `I'm analyzing the job posting at:\n${url}\n\nLet me extract the key skills and requirements from this posting. Could you also tell me what specific aspects of this role you're most interested in?`,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        toast.error("Failed to extract from URL");
      }
    }
  };

  const formatUrlExtractionResponse = (data: any) => {
    let response = `I've analyzed the job posting`;
    if (data.title) response += ` for **${data.title}**`;
    response += `.\n\n`;

    if (data.skills?.length > 0) {
      response += `**Key Skills Required:**\n`;
      data.skills.forEach((skill: string) => {
        response += `• ${skill}\n`;
      });
      response += `\n`;
    }

    if (data.experience_years) {
      response += `**Experience:** ${data.experience_years}+ years\n\n`;
    }

    if (data.location) {
      response += `**Location:** ${data.location}\n\n`;
    }

    response += `Would you like me to search for candidates with these skills?`;
    return response;
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
