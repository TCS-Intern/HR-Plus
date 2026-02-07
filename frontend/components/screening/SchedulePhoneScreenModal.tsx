"use client";

import { useState } from "react";
import {
  X,
  Phone,
  Play,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  MessageSquare,
  Smartphone,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { phoneScreenApi, phoneInterviewApi, voiceInterviewApi } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

interface SchedulePhoneScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  candidateName: string;
  candidatePhone?: string | null;
  onSuccess?: () => void;
}

type InterviewMode = "web" | "voice" | "phone" | "simulate";

export default function SchedulePhoneScreenModal({
  isOpen,
  onClose,
  applicationId,
  candidateName,
  candidatePhone,
  onSuccess,
}: SchedulePhoneScreenModalProps) {
  const [selectedMode, setSelectedMode] = useState<InterviewMode>("web");
  const [phoneNumber, setPhoneNumber] = useState(candidatePhone || "");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    interviewUrl?: string;
    phoneScreenId?: string;
    message?: string;
    error?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSchedule = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      if (selectedMode === "phone") {
        if (!phoneNumber.trim()) {
          setResult({ success: false, error: "Phone number is required" });
          setIsLoading(false);
          return;
        }

        const response = await phoneScreenApi.schedule({
          application_id: applicationId,
          phone_number: phoneNumber,
        });

        setResult({
          success: true,
          phoneScreenId: response.data.phone_screen_id,
          message: response.data.message || "Call initiated",
        });
      } else if (selectedMode === "voice") {
        const response = await voiceInterviewApi.schedule({
          application_id: applicationId,
        });

        const baseUrl = window.location.origin;
        const interviewUrl = `${baseUrl}${response.interview_url}`;

        setResult({
          success: true,
          interviewUrl,
          phoneScreenId: response.phone_screen_id,
          message: "Voice interview link generated",
        });
      } else {
        const response = await phoneInterviewApi.scheduleWeb({
          application_id: applicationId,
          is_simulation: selectedMode === "simulate",
        });

        const baseUrl = window.location.origin;
        const interviewUrl = `${baseUrl}${response.interview_url}`;

        setResult({
          success: true,
          interviewUrl,
          phoneScreenId: response.phone_screen_id,
          message:
            selectedMode === "simulate"
              ? "Simulation ready"
              : "Interview link generated",
        });
      }

      onSuccess?.();
    } catch (err: any) {
      setResult({
        success: false,
        error:
          err.response?.data?.detail || err.message || "Failed to schedule",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleClose = () => {
    setResult(null);
    setSelectedMode("web");
    setCopied(false);
    onClose();
  };

  const modeOptions = [
    {
      mode: "web" as const,
      icon: MessageSquare,
      title: "Web Interview",
      description: "Generate a link for chat-based interview. No phone call needed.",
      recommended: true,
    },
    {
      mode: "voice" as const,
      icon: Mic,
      title: "Voice Interview",
      description: "AI voice conversation in the browser. No phone needed.",
    },
    {
      mode: "phone" as const,
      icon: Smartphone,
      title: "Phone Call",
      description: "AI calls candidate directly via Vapi voice integration.",
    },
    {
      mode: "simulate" as const,
      icon: Play,
      title: "Preview / Simulate",
      description: "Test the interview flow yourself. Results not recorded.",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-lg border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Schedule Phone Screen</h2>
            <p className="text-sm text-zinc-500">for {candidateName}</p>
          </div>
          <button onClick={handleClose} className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!result ? (
            <>
              <div className="space-y-3 mb-6">
                <p className="text-sm font-medium text-zinc-700">Select Interview Type</p>

                {modeOptions.map((opt) => (
                  <button
                    key={opt.mode}
                    onClick={() => setSelectedMode(opt.mode)}
                    className={cn(
                      "w-full p-4 rounded-lg border-2 text-left transition-all",
                      selectedMode === opt.mode
                        ? "border-primary bg-accent-50"
                        : "border-zinc-200 hover:border-zinc-300"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        selectedMode === opt.mode ? "bg-primary-100 text-primary" : "bg-zinc-100 text-zinc-500"
                      )}>
                        <opt.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-zinc-900">{opt.title}</h3>
                          {opt.recommended && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-500 mt-0.5">{opt.description}</p>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        selectedMode === opt.mode ? "border-primary bg-primary" : "border-zinc-300"
                      )}>
                        {selectedMode === opt.mode && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {selectedMode === "phone" && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -tranzinc-y-1/2 w-5 h-5 text-zinc-400" />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-primary"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
                <Button className="flex-1" onClick={handleSchedule} loading={isLoading}>
                  {selectedMode === "web" ? "Generate Link" : selectedMode === "voice" ? "Generate Voice Link" : selectedMode === "phone" ? "Call Now" : "Start Simulation"}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center">
              {result.success ? (
                <>
                  <div className="w-16 h-16 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 mb-2">{result.message}</h3>

                  {result.interviewUrl && (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm text-zinc-500">Share this link with the candidate:</p>
                      <div className="flex items-center gap-2 p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                        <input type="text" value={result.interviewUrl} readOnly className="flex-1 bg-transparent text-sm text-zinc-600 focus:outline-none" />
                        <button onClick={() => copyToClipboard(result.interviewUrl!)} className="p-2 hover:bg-zinc-200 rounded-lg transition-colors">
                          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-zinc-500" />}
                        </button>
                      </div>
                      {selectedMode === "simulate" && (
                        <a href={result.interviewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 text-primary hover:bg-accent-50 rounded-lg transition-colors text-sm font-medium">
                          <ExternalLink className="w-4 h-4" /> Open Simulation
                        </a>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-rose-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <X className="w-8 h-8 text-rose-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 mb-2">Failed to Schedule</h3>
                  <p className="text-sm text-zinc-500">{result.error}</p>
                </>
              )}
              <Button variant="secondary" className="w-full mt-6" onClick={handleClose}>Close</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
