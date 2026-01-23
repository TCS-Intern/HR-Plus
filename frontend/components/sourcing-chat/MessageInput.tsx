"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSendMessage, disabled }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!message.trim() || disabled) return;

    onSendMessage(message);
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

  return (
    <div className="p-4">
      <div className="flex items-end gap-3">
        <textarea
          ref={inputRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "AI is thinking..." : "Type your message... (Press Enter to send, Shift+Enter for new line)"}
          disabled={disabled}
          rows={1}
          className={cn(
            "flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800/50 rounded-2xl",
            "border-0 text-sm text-slate-800 dark:text-white",
            "placeholder-slate-400 resize-none",
            "focus:ring-2 focus:ring-primary/50 focus:outline-none",
            "transition-all",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          style={{
            minHeight: "48px",
            maxHeight: "120px",
          }}
        />

        <button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className={cn(
            "p-3 rounded-2xl transition-all flex-shrink-0",
            disabled || !message.trim()
              ? "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
              : "bg-primary text-white hover:bg-primary/90 hover:scale-105 active:scale-95 shadow-lg shadow-primary/30"
          )}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      <p className="text-xs text-slate-400 mt-2 text-center">
        Press Enter to send • Shift+Enter for new line
      </p>
    </div>
  );
}
