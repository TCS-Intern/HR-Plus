"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function MessageInput({
  onSendMessage,
  disabled,
  placeholder,
}: MessageInputProps) {
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
    <div className="p-4 border-t border-zinc-200 bg-white">
      <div className="flex items-end gap-3 max-w-3xl mx-auto">
        <textarea
          ref={inputRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? "Waiting for response..."
              : placeholder || "Type your response..."
          }
          disabled={disabled}
          rows={1}
          className={cn(
            "flex-1 px-4 py-3 bg-zinc-100 rounded-xl",
            "border border-zinc-200 text-sm text-zinc-800",
            "placeholder-zinc-400 resize-none",
            "focus:ring-2 focus:ring-zinc-300 focus:outline-none focus:border-primary",
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
            "p-3 rounded-xl transition-all flex-shrink-0",
            disabled || !message.trim()
              ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
              : "bg-primary text-white hover:bg-primary/90"
          )}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      <p className="text-xs text-zinc-400 mt-2 text-center">
        Press Enter to send
      </p>
    </div>
  );
}
