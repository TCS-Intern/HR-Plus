"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MessageSquare,
  Loader2,
  AlertTriangle,
  Briefcase,
  User,
  Clock,
} from "lucide-react";
import InterviewChat from "@/components/phone-interview/InterviewChat";
import { phoneInterviewApi } from "@/lib/api/client";

interface PhoneScreenDetails {
  id: string;
  access_token: string;
  interview_mode: string;
  status: string;
  candidate?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
  job?: {
    title: string;
    department: string;
  };
}

export default function PhoneScreenPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const phoneScreenId = params.id as string;

  const [phoneScreen, setPhoneScreen] = useState<PhoneScreenDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const fetchPhoneScreen = async () => {
      try {
        const data = await phoneInterviewApi.get(phoneScreenId);
        setPhoneScreen(data);

        if (data.status === "completed" || data.status === "analyzed") {
          setIsComplete(true);
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || "Failed to load phone screen");
      } finally {
        setLoading(false);
      }
    };

    fetchPhoneScreen();
  }, [phoneScreenId]);

  const handleComplete = () => {
    setIsComplete(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !phoneScreen) {
    return (
      <div className="space-y-6">
        <Link
          href="/phone-screens"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Phone Screens
        </Link>

        <div className="glass-card rounded-3xl p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-800 dark:text-white mb-2">
            Failed to Load
          </h3>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  // Check if this is a simulation
  if (phoneScreen.interview_mode !== "simulation" && phoneScreen.interview_mode !== "web") {
    return (
      <div className="space-y-6">
        <Link
          href="/phone-screens"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Phone Screens
        </Link>

        <div className="glass-card rounded-3xl p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-800 dark:text-white mb-2">
            Not a Web Interview
          </h3>
          <p className="text-sm text-slate-500">
            This phone screen was conducted via phone call, not web chat.
          </p>
        </div>
      </div>
    );
  }

  if (!phoneScreen.access_token) {
    return (
      <div className="space-y-6">
        <Link
          href="/phone-screens"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Phone Screens
        </Link>

        <div className="glass-card rounded-3xl p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-800 dark:text-white mb-2">
            No Access Token
          </h3>
          <p className="text-sm text-slate-500">
            This interview doesn&apos;t have a valid access token.
          </p>
        </div>
      </div>
    );
  }

  const candidateName = phoneScreen.candidate
    ? `${phoneScreen.candidate.first_name || ""} ${phoneScreen.candidate.last_name || ""}`.trim() || phoneScreen.candidate.email
    : "Candidate";

  // Complete state
  if (isComplete) {
    return (
      <div className="space-y-6">
        <Link
          href="/phone-screens"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Phone Screens
        </Link>

        <div className="glass-card rounded-3xl p-12 text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <MessageSquare className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
            Preview Complete
          </h3>
          <p className="text-slate-500 mb-6">
            This simulation has ended. The results are marked as preview data.
          </p>
          <Link
            href={`/phone-screens/${phoneScreenId}`}
            className="inline-block px-6 py-3 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-[1.02] transition-all"
          >
            View Results
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Link
            href="/phone-screens"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">
                Interview Preview
              </h1>
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                Simulation
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {candidateName}
              </span>
              {phoneScreen.job && (
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  {phoneScreen.job.title}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right text-sm text-slate-500">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Preview Mode
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <InterviewChat
          token={phoneScreen.access_token}
          candidateName={candidateName}
          onComplete={handleComplete}
        />
      </div>

      {/* Info Banner */}
      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
        <p className="text-xs text-amber-700 dark:text-amber-400 text-center">
          This is a simulation preview. Results will be marked as simulation data and not used for hiring decisions.
        </p>
      </div>
    </div>
  );
}
