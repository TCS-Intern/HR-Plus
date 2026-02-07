"use client";

import { useState, useRef, KeyboardEvent, useEffect } from "react";
import { Send, Mic, MicOff, Paperclip, Link, X, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface MessageInputProps {
  onSendMessage: (message: string, metadata?: MessageMetadata) => void;
  disabled?: boolean;
}

export interface MessageMetadata {
  type: "text" | "voice" | "file" | "url";
  file?: File;
  url?: string;
  voiceTranscript?: string;
}

export default function MessageInput({ onSendMessage, disabled }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = "en-US";

        recognitionRef.current.onresult = (event) => {
          let finalTranscript = "";
          let interimTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          if (finalTranscript) {
            setMessage((prev) => prev + finalTranscript);
          }
        };

        recognitionRef.current.onerror = (event) => {
          console.error("Speech recognition error:", event.error);
          setIsRecording(false);
          if (event.error === "not-allowed") {
            toast.error("Microphone access denied. Please enable microphone permissions.");
          }
        };

        recognitionRef.current.onend = () => {
          setIsRecording(false);
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleSend = () => {
    if (disabled || isProcessing) return;

    // Handle URL submission
    if (showUrlInput && urlInput.trim()) {
      setIsProcessing(true);
      onSendMessage(`Analyze this job posting: ${urlInput}`, {
        type: "url",
        url: urlInput,
      });
      setUrlInput("");
      setShowUrlInput(false);
      setIsProcessing(false);
      return;
    }

    // Handle file submission
    if (selectedFile) {
      setIsProcessing(true);
      const fileType = selectedFile.name.toLowerCase();
      let messageText = "";

      if (fileType.endsWith(".pdf") || fileType.endsWith(".docx") || fileType.endsWith(".doc")) {
        messageText = `Analyze this document and extract job requirements: ${selectedFile.name}`;
      } else if (fileType.endsWith(".csv")) {
        messageText = `Find similar candidates to those in this list: ${selectedFile.name}`;
      } else {
        messageText = `Uploaded file: ${selectedFile.name}`;
      }

      onSendMessage(messageText, {
        type: "file",
        file: selectedFile,
      });
      setSelectedFile(null);
      setIsProcessing(false);
      return;
    }

    // Handle text message
    if (!message.trim()) return;

    onSendMessage(message, { type: "text" });
    setMessage("");

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Auto-resize textarea
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition is not supported in your browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
      toast.info("Listening... Speak now.");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/csv",
      ];

      if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|csv)$/i)) {
        toast.error("Please upload a PDF, Word document, or CSV file.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB.");
        return;
      }

      setSelectedFile(file);
      setShowUrlInput(false);
      toast.success(`File selected: ${file.name}`);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const toggleUrlInput = () => {
    setShowUrlInput(!showUrlInput);
    setSelectedFile(null);
    setUrlInput("");
  };

  return (
    <div className="p-4 space-y-3">
      {/* Selected File Preview */}
      {selectedFile && (
        <div className="flex items-center gap-2 p-2 bg-accent-50 rounded-lg">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm text-zinc-700 flex-1 truncate">
            {selectedFile.name}
          </span>
          <button
            onClick={clearFile}
            className="p-1 hover:bg-zinc-200 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      )}

      {/* URL Input */}
      {showUrlInput && (
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Link className="absolute left-3 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste job posting URL to extract skills..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 rounded-lg border border-zinc-200 text-sm focus:ring-2 focus:ring-zinc-300 focus:outline-none focus:border-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>
          <button
            onClick={toggleUrlInput}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      )}

      {/* Main Input Area */}
      <div className="flex items-end gap-2">
        {/* Action Buttons */}
        <div className="flex items-center gap-1 pb-1">
          {/* Voice Recording Button */}
          <button
            onClick={toggleRecording}
            disabled={disabled}
            className={cn(
              "p-2.5 rounded-lg transition-all",
              isRecording
                ? "bg-rose-500 text-white animate-pulse"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            title={isRecording ? "Stop recording" : "Start voice input"}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* File Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className={cn(
              "p-2.5 rounded-lg transition-all",
              selectedFile
                ? "bg-primary text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            title="Upload JD or resume (PDF, DOCX, CSV)"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* URL Input Button */}
          <button
            onClick={toggleUrlInput}
            disabled={disabled}
            className={cn(
              "p-2.5 rounded-lg transition-all",
              showUrlInput
                ? "bg-primary text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            title="Extract skills from job posting URL"
          >
            <Link className="w-4 h-4" />
          </button>
        </div>

        {/* Text Input */}
        <textarea
          ref={inputRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? "AI is thinking..."
              : isRecording
              ? "Listening... speak now"
              : selectedFile
              ? "Add a note about this file..."
              : "Describe the role you're hiring for..."
          }
          disabled={disabled || showUrlInput}
          rows={1}
          className={cn(
            "flex-1 px-4 py-3 bg-zinc-100 rounded-xl",
            "border border-zinc-200 text-sm text-zinc-800",
            "placeholder-zinc-400 resize-none",
            "focus:ring-2 focus:ring-zinc-300 focus:outline-none focus:border-primary",
            "transition-all",
            (disabled || showUrlInput) && "opacity-50 cursor-not-allowed"
          )}
          style={{
            minHeight: "48px",
            maxHeight: "120px",
          }}
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={disabled || isProcessing || (!message.trim() && !selectedFile && !urlInput.trim())}
          className={cn(
            "p-3 rounded-xl transition-all flex-shrink-0",
            disabled || isProcessing || (!message.trim() && !selectedFile && !urlInput.trim())
              ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
              : "bg-primary text-white hover:bg-primary/90"
          )}
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Helper Text */}
      <div className="flex items-center justify-center gap-4 text-xs text-zinc-400">
        <span>Enter to send</span>
        <span>·</span>
        <span>Shift+Enter for new line</span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <Mic className="w-3 h-3" /> Voice
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <Paperclip className="w-3 h-3" /> Upload JD/Resume
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <Link className="w-3 h-3" /> Paste URL
        </span>
      </div>
    </div>
  );
}

// Add type declaration for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}
