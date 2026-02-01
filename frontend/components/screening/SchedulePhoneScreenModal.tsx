"use client";

import { useState } from "react";
import {
  X,
  Phone,
  Globe,
  Play,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  MessageSquare,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { phoneScreenApi, phoneInterviewApi } from "@/lib/api/client";

interface SchedulePhoneScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  candidateName: string;
  candidatePhone?: string | null;
  onSuccess?: () => void;
}

type InterviewMode = "web" | "phone" | "simulate";

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
      } else {
        // Web interview or simulation
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
              Schedule Phone Screen
            </h2>
            <p className="text-sm text-slate-500">for {candidateName}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!result ? (
            <>
              {/* Interview Mode Selection */}
              <div className="space-y-3 mb-6">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Select Interview Type
                </p>

                {/* Web Interview Option */}
                <button
                  onClick={() => setSelectedMode("web")}
                  className={cn(
                    "w-full p-4 rounded-2xl border-2 text-left transition-all",
                    selectedMode === "web"
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        selectedMode === "web"
                          ? "bg-primary/20 text-primary"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                      )}
                    >
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800 dark:text-white">
                          Web Interview
                        </h3>
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                          Recommended
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Generate a link for chat-based interview. No phone call
                        needed.
                      </p>
                    </div>
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        selectedMode === "web"
                          ? "border-primary bg-primary"
                          : "border-slate-300"
                      )}
                    >
                      {selectedMode === "web" && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Phone Call Option */}
                <button
                  onClick={() => setSelectedMode("phone")}
                  className={cn(
                    "w-full p-4 rounded-2xl border-2 text-left transition-all",
                    selectedMode === "phone"
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        selectedMode === "phone"
                          ? "bg-primary/20 text-primary"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                      )}
                    >
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-800 dark:text-white">
                        Phone Call
                      </h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        AI calls candidate directly via Vapi voice integration.
                      </p>
                    </div>
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        selectedMode === "phone"
                          ? "border-primary bg-primary"
                          : "border-slate-300"
                      )}
                    >
                      {selectedMode === "phone" && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Simulate Option */}
                <button
                  onClick={() => setSelectedMode("simulate")}
                  className={cn(
                    "w-full p-4 rounded-2xl border-2 text-left transition-all",
                    selectedMode === "simulate"
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        selectedMode === "simulate"
                          ? "bg-primary/20 text-primary"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                      )}
                    >
                      <Play className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-800 dark:text-white">
                        Preview / Simulate
                      </h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Test the interview flow yourself. Results not recorded.
                      </p>
                    </div>
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        selectedMode === "simulate"
                          ? "border-primary bg-primary"
                          : "border-slate-300"
                      )}
                    >
                      {selectedMode === "simulate" && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                </button>
              </div>

              {/* Phone Number Input (only for phone mode) */}
              {selectedMode === "phone" && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : selectedMode === "web" ? (
                    "Generate Link"
                  ) : selectedMode === "phone" ? (
                    "Call Now"
                  ) : (
                    "Start Simulation"
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Result View */
            <div className="text-center">
              {result.success ? (
                <>
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                    {result.message}
                  </h3>

                  {result.interviewUrl && (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm text-slate-500">
                        Share this link with the candidate:
                      </p>
                      <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                        <input
                          type="text"
                          value={result.interviewUrl}
                          readOnly
                          className="flex-1 bg-transparent text-sm text-slate-600 dark:text-slate-300 focus:outline-none"
                        />
                        <button
                          onClick={() => copyToClipboard(result.interviewUrl!)}
                          className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                      </div>

                      {selectedMode === "simulate" && (
                        <a
                          href={result.interviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 text-primary hover:bg-primary/10 rounded-xl transition-colors text-sm font-medium"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open Simulation
                        </a>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <X className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                    Failed to Schedule
                  </h3>
                  <p className="text-sm text-slate-500">{result.error}</p>
                </>
              )}

              <button
                onClick={handleClose}
                className="mt-6 w-full px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
