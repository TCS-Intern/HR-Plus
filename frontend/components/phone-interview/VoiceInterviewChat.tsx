"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import {
  Bot,
  User,
  Mic,
  MicOff,
  PhoneOff,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { voiceInterviewApi } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

interface TranscriptEntry {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: string;
}

interface VoiceInterviewChatProps {
  token: string;
  candidateName: string;
  onComplete: () => void;
}

export default function VoiceInterviewChat({
  token,
  candidateName,
  onComplete,
}: VoiceInterviewChatProps) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(
    null
  );
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const conversationIdRef = useRef<string | null>(null);
  const hasEndedRef = useRef(false);

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const conversation = useConversation({
    micMuted: isMuted,
    onConnect: ({ conversationId }) => {
      console.log("ElevenLabs connected, conversationId:", conversationId);
      conversationIdRef.current = conversationId;
      setIsStarting(false);
      setError(null);
    },
    onDisconnect: () => {
      console.log("ElevenLabs disconnected");
      if (!hasEndedRef.current) {
        hasEndedRef.current = true;
        handleInterviewEnd();
      }
    },
    onMessage: ({ message, role }) => {
      const entry: TranscriptEntry = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: role === "agent" ? "assistant" : "user",
        content: message,
        timestamp: new Date().toISOString(),
      };
      setTranscript((prev) => [...prev, entry]);
    },
    onError: (message) => {
      console.error("ElevenLabs error:", message);
      setError(message || "Voice connection error. Please try again.");
    },
  });

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Check mic permissions on mount
  useEffect(() => {
    const checkMicPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((track) => track.stop());
        setHasMicPermission(true);
      } catch {
        setHasMicPermission(false);
      }
    };
    checkMicPermission();
  }, []);

  const startSession = useCallback(async () => {
    setIsStarting(true);
    setError(null);

    try {
      // Request mic permission if not already granted
      if (!hasMicPermission) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          stream.getTracks().forEach((track) => track.stop());
          setHasMicPermission(true);
        } catch {
          setHasMicPermission(false);
          setIsStarting(false);
          setError(
            "Microphone access is required for voice interviews. Please allow microphone access and try again."
          );
          return;
        }
      }

      // Create session via our backend
      const sessionData = await voiceInterviewApi.createSession(token);

      // Connect to ElevenLabs via signed URL
      await conversation.startSession({
        signedUrl: sessionData.signed_url,
      });
    } catch (err: any) {
      console.error("Failed to start voice session:", err);
      setIsStarting(false);
      setError(
        err.response?.data?.detail ||
          "Failed to start voice session. Please try again."
      );
    }
  }, [token, hasMicPermission, conversation]);

  const handleInterviewEnd = useCallback(async () => {
    setIsEnding(true);
    try {
      await voiceInterviewApi.complete(token, {
        elevenlabs_conversation_id: conversationIdRef.current,
        client_transcript: transcriptRef.current.map((entry) => ({
          role: entry.role,
          content: entry.content,
          timestamp: entry.timestamp,
        })),
      });
    } catch (err) {
      console.error("Failed to complete voice interview:", err);
    }

    setTimeout(() => {
      onComplete();
    }, 1500);
  }, [token, onComplete]);

  const endInterview = useCallback(async () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    try {
      await conversation.endSession();
    } catch {
      // Session may already be ended
    }
    handleInterviewEnd();
  }, [conversation, handleInterviewEnd]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // Use the SDK's status instead of our own connectionState
  const status = conversation.status;

  // Mic permission denied screen
  if (hasMicPermission === false && status === "disconnected" && !isStarting) {
    return (
      <div className="flex flex-col h-full bg-zinc-50 items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <MicOff className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 mb-2">
            Microphone Access Required
          </h3>
          <p className="text-zinc-600 text-sm mb-6">
            This voice interview requires microphone access. Please allow
            microphone permissions in your browser settings and reload the page.
          </p>
          <Button onClick={() => window.location.reload()} variant="secondary">
            Reload Page
          </Button>
        </div>
      </div>
    );
  }

  // Idle / disconnected state - start button
  if (status === "disconnected" && !isStarting && !isEnding) {
    return (
      <div className="flex flex-col h-full bg-zinc-50 items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-accent-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Mic className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 mb-2">
            Ready to begin?
          </h3>
          <p className="text-zinc-600 text-sm mb-6">
            Click the button below to start your voice interview. You&apos;ll
            speak naturally with an AI interviewer through your microphone.
          </p>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <Button onClick={startSession} size="lg">
            Start Voice Interview
          </Button>
        </div>
      </div>
    );
  }

  // Connecting state
  if (status === "connecting" || isStarting) {
    return (
      <div className="flex flex-col h-full bg-zinc-50 items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-zinc-900 mx-auto mb-4" />
          <p className="text-zinc-600">Connecting to voice interview...</p>
          <p className="text-sm text-zinc-400 mt-2">
            Please allow microphone access if prompted
          </p>
        </div>
      </div>
    );
  }

  // Ending / disconnecting state
  if (isEnding || status === "disconnecting") {
    return (
      <div className="flex flex-col h-full bg-zinc-50 items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500 mx-auto mb-4" />
          <p className="text-zinc-600">Saving your interview...</p>
        </div>
      </div>
    );
  }

  // Connected state - active interview
  return (
    <div className="flex flex-col h-full bg-zinc-50">
      {/* Status Bar */}
      <div className="px-4 py-3 bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-zinc-700">
              Voice Interview Active
            </span>
          </div>
          <div className="flex items-center gap-2">
            {conversation.isSpeaking && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-0.5">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-0.5 bg-primary rounded-full animate-pulse"
                      style={{
                        height: `${8 + Math.random() * 12}px`,
                        animationDelay: `${i * 100}ms`,
                        animationDuration: "0.6s",
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs text-zinc-500">AI speaking</span>
              </div>
            )}
            {isMuted && (
              <span className="text-xs text-red-500 font-medium">
                Mic muted
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Transcript Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {transcript.length === 0 && (
            <div className="text-center py-8">
              <div className="flex items-center justify-center gap-1 mb-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-1 bg-primary/40 rounded-full animate-pulse"
                    style={{
                      height: `${12 + Math.random() * 16}px`,
                      animationDelay: `${i * 150}ms`,
                    }}
                  />
                ))}
              </div>
              <p className="text-sm text-zinc-500">
                Listening... the interviewer will begin shortly.
              </p>
            </div>
          )}

          {transcript.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "flex items-start gap-3",
                entry.role === "user" && "flex-row-reverse"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                  entry.role === "assistant" ? "bg-primary/10" : "bg-zinc-200"
                )}
              >
                {entry.role === "assistant" ? (
                  <Bot className="w-4 h-4 text-primary" />
                ) : (
                  <User className="w-4 h-4 text-zinc-600" />
                )}
              </div>

              <div
                className={cn(
                  "flex-1 max-w-[80%] px-4 py-3 rounded-xl",
                  entry.role === "assistant"
                    ? "bg-white rounded-tl-none shadow-sm border border-zinc-200"
                    : "bg-primary text-white rounded-tr-none"
                )}
              >
                <p
                  className={cn(
                    "text-sm whitespace-pre-wrap",
                    entry.role === "assistant" ? "text-zinc-800" : "text-white"
                  )}
                >
                  {entry.content}
                </p>
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Voice Controls */}
      <div className="bg-white border-t border-zinc-200 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-4">
          <button
            onClick={toggleMute}
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
              isMuted
                ? "bg-red-100 text-red-600 hover:bg-red-200"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            )}
            title={isMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>

          <button
            onClick={endInterview}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
            title="End interview"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
        <p className="text-center text-xs text-zinc-400 mt-2">
          Speak naturally. The AI interviewer can hear you.
        </p>
      </div>
    </div>
  );
}
