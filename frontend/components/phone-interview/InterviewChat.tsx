"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, User, AlertCircle, RefreshCw, WifiOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import MessageInput from "./MessageInput";
import { phoneInterviewApi } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: string;
}

interface ErrorState {
  message: string;
  type: "connection" | "server" | "unknown";
  retryAction?: () => void;
}

interface InterviewChatProps {
  token: string;
  candidateName: string;
  onComplete: () => void;
}

// Progress Indicator Component
function InterviewProgress({ messageCount }: { messageCount: number }) {
  const expectedMessages = 12;
  const progress = Math.min(100, Math.round((messageCount / expectedMessages) * 100));

  const getStageLabel = () => {
    if (messageCount <= 2) return "Getting started";
    if (messageCount <= 4) return "Background";
    if (messageCount <= 8) return "Skills & experience";
    if (messageCount <= 10) return "Wrapping up";
    return "Almost done";
  };

  return (
    <div className="px-4 py-3 bg-white border-b border-zinc-200">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-zinc-600">
            {getStageLabel()}
          </span>
          <span className="text-xs text-zinc-500">{progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Error Toast Component
function ErrorToast({
  error,
  onDismiss,
  onRetry,
}: {
  error: ErrorState;
  onDismiss: () => void;
  onRetry?: () => void;
}) {
  const icons = {
    connection: WifiOff,
    server: AlertCircle,
    unknown: AlertCircle,
  };
  const Icon = icons[error.type];

  return (
    <div className="fixed bottom-24 left-1/2 -tranzinc-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 shadow-lg max-w-md">
        <Icon className="w-5 h-5 text-rose-500 flex-shrink-0" />
        <p className="text-sm text-rose-700 flex-1">
          {error.message}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="p-1.5 hover:bg-rose-100 rounded-lg transition-colors"
            title="Retry"
          >
            <RefreshCw className="w-4 h-4 text-rose-600" />
          </button>
        )}
        <button
          onClick={onDismiss}
          className="p-1.5 hover:bg-rose-100 rounded-lg transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4 text-rose-600" />
        </button>
      </div>
    </div>
  );
}

export default function InterviewChat({
  token,
  candidateName,
  onComplete,
}: InterviewChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<string>("");

  // Track online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setError({
        message: "You appear to be offline. Please check your internet connection.",
        type: "connection",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Auto-dismiss errors after 10 seconds
  useEffect(() => {
    if (error && !error.retryAction) {
      const timer = setTimeout(() => setError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const showError = useCallback((message: string, type: ErrorState["type"], retryAction?: () => void) => {
    setError({ message, type, retryAction });
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load existing transcript on mount
  useEffect(() => {
    const loadTranscript = async () => {
      try {
        const data = await phoneInterviewApi.getTranscript(token);
        if (data.transcript && data.transcript.length > 0) {
          const formattedMessages = data.transcript.map(
            (msg: any, idx: number) => ({
              id: `existing-${idx}`,
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp,
            })
          );
          setMessages(formattedMessages);
          setIsStarted(true);
        }

        if (
          data.status === "completed" ||
          data.status === "analyzed" ||
          data.conversation_state?.is_complete
        ) {
          setIsComplete(true);
        }
      } catch (err: any) {
        console.error("Failed to load transcript:", err);
      }
    };

    loadTranscript();
  }, [token]);

  const startInterview = async () => {
    if (!isOnline) {
      showError("Cannot start interview while offline. Please check your connection.", "connection");
      return;
    }

    setIsThinking(true);
    dismissError();

    try {
      const eventSource = new EventSource(
        phoneInterviewApi.getStartUrl(token)
      );

      let currentMessage = "";
      const messageId = `assistant-${Date.now()}`;
      let hasReceivedData = false;

      const connectionTimeout = setTimeout(() => {
        if (!hasReceivedData) {
          eventSource.close();
          setIsThinking(false);
          showError(
            "Taking longer than expected to connect. Please try again.",
            "connection",
            startInterview
          );
        }
      }, 30000);

      eventSource.addEventListener("thinking", () => {
        hasReceivedData = true;
        setIsThinking(true);
      });

      eventSource.addEventListener("message_chunk", (e) => {
        hasReceivedData = true;
        clearTimeout(connectionTimeout);
        const data = JSON.parse(e.data);
        currentMessage += data.text;

        setMessages((prev) => {
          const existingIndex = prev.findIndex((m) => m.id === messageId);
          const assistantMsg: Message = {
            id: messageId,
            role: "assistant",
            content: currentMessage,
            timestamp: new Date().toISOString(),
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

      eventSource.addEventListener("complete", () => {
        clearTimeout(connectionTimeout);
        setIsThinking(false);
        setIsStarted(true);
        eventSource.close();
      });

      eventSource.addEventListener("error", (e: any) => {
        clearTimeout(connectionTimeout);
        setIsThinking(false);
        eventSource.close();

        let errorMessage = "Failed to start interview. Please try again.";
        try {
          if (e.data) {
            const data = JSON.parse(e.data);
            errorMessage = data.message || errorMessage;
          }
        } catch {
          // Use default error message
        }

        showError(errorMessage, "server", startInterview);
      });

      eventSource.onerror = () => {
        clearTimeout(connectionTimeout);
        if (!hasReceivedData) {
          setIsThinking(false);
          eventSource.close();
          showError(
            "Connection lost. Please check your internet and try again.",
            "connection",
            startInterview
          );
        }
      };
    } catch (err) {
      console.error("Error starting interview:", err);
      setIsThinking(false);
      showError(
        "Unable to start interview. Please refresh the page and try again.",
        "unknown",
        startInterview
      );
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isThinking) return;

    if (!isOnline) {
      showError("Cannot send message while offline. Please check your connection.", "connection");
      return;
    }

    lastMessageRef.current = message;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsThinking(true);
    dismissError();

    try {
      const eventSource = new EventSource(
        phoneInterviewApi.getMessageUrl(token, message)
      );

      let currentAssistantMessage = "";
      const assistantMessageId = `assistant-${Date.now()}`;
      let hasReceivedData = false;

      const responseTimeout = setTimeout(() => {
        if (!hasReceivedData) {
          eventSource.close();
          setIsThinking(false);
          showError(
            "Response is taking longer than expected. Please try again.",
            "connection",
            () => handleSendMessage(lastMessageRef.current)
          );
        }
      }, 60000);

      eventSource.addEventListener("thinking", () => {
        hasReceivedData = true;
        setIsThinking(true);
      });

      eventSource.addEventListener("message_chunk", (e) => {
        hasReceivedData = true;
        clearTimeout(responseTimeout);
        const data = JSON.parse(e.data);
        currentAssistantMessage += data.text;

        setMessages((prev) => {
          const existingIndex = prev.findIndex(
            (m) => m.id === assistantMessageId
          );
          const assistantMsg: Message = {
            id: assistantMessageId,
            role: "assistant",
            content: currentAssistantMessage,
            timestamp: new Date().toISOString(),
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

      eventSource.addEventListener("complete", (e) => {
        clearTimeout(responseTimeout);
        const data = JSON.parse(e.data);
        setIsThinking(false);
        eventSource.close();

        if (data.should_end) {
          setIsComplete(true);
          setTimeout(() => {
            handleComplete();
          }, 2000);
        }
      });

      eventSource.addEventListener("error", (e: any) => {
        clearTimeout(responseTimeout);
        setIsThinking(false);
        eventSource.close();

        let errorMessage = "Failed to get response. Please try again.";
        try {
          if (e.data) {
            const data = JSON.parse(e.data);
            errorMessage = data.message || errorMessage;
          }
        } catch {
          // Use default error message
        }

        showError(errorMessage, "server", () => handleSendMessage(lastMessageRef.current));
      });

      eventSource.onerror = () => {
        clearTimeout(responseTimeout);
        if (!hasReceivedData) {
          setIsThinking(false);
          eventSource.close();
          showError(
            "Connection interrupted. Your message may not have been sent.",
            "connection",
            () => handleSendMessage(lastMessageRef.current)
          );
        }
      };
    } catch (err) {
      console.error("Error sending message:", err);
      setIsThinking(false);
      showError(
        "Failed to send message. Please try again.",
        "unknown",
        () => handleSendMessage(lastMessageRef.current)
      );
    }
  };

  const handleComplete = async () => {
    try {
      await phoneInterviewApi.complete(token);
      onComplete();
    } catch (error) {
      console.error("Error completing interview:", error);
      onComplete();
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      {/* Error Toast */}
      {error && (
        <ErrorToast
          error={error}
          onDismiss={dismissError}
          onRetry={error.retryAction}
        />
      )}

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-amber-700">
            You&apos;re offline. Reconnecting...
          </span>
        </div>
      )}

      {/* Progress Indicator */}
      {isStarted && !isComplete && messages.length > 0 && (
        <InterviewProgress messageCount={messages.length} />
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {!isStarted && messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-accent-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                Ready to begin?
              </h3>
              <p className="text-zinc-600 mb-6 max-w-md mx-auto">
                Click the button below to start your interview. The AI
                interviewer will guide you through a series of questions about
                your background and experience.
              </p>
              <Button
                onClick={startInterview}
                loading={isThinking}
                size="lg"
              >
                {isThinking ? "Starting..." : "Start Interview"}
              </Button>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex items-start gap-3",
                message.role === "user" && "flex-row-reverse"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                  message.role === "assistant"
                    ? "bg-primary/10"
                    : "bg-zinc-200"
                )}
              >
                {message.role === "assistant" ? (
                  <Bot className="w-4 h-4 text-primary" />
                ) : (
                  <User className="w-4 h-4 text-zinc-600" />
                )}
              </div>

              <div
                className={cn(
                  "flex-1 max-w-[80%] px-4 py-3 rounded-xl",
                  message.role === "assistant"
                    ? "bg-white rounded-tl-none shadow-sm border border-zinc-200"
                    : "bg-primary text-white rounded-tr-none"
                )}
              >
                <p
                  className={cn(
                    "text-sm whitespace-pre-wrap",
                    message.role === "assistant"
                      ? "text-zinc-800"
                      : "text-white"
                  )}
                >
                  {message.content}
                </p>
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 bg-white rounded-xl rounded-tl-none px-4 py-3 shadow-sm border border-zinc-200">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}

          {isComplete && (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-zinc-600">
                Interview complete! Redirecting...
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      {isStarted && !isComplete && (
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={isThinking}
          placeholder={`Type your response, ${candidateName.split(" ")[0]}...`}
        />
      )}
    </div>
  );
}
