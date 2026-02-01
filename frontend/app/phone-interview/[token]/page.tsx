"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  MessageSquare,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Briefcase,
  Timer,
} from "lucide-react";
import InterviewChat from "@/components/phone-interview/InterviewChat";
import { phoneInterviewApi } from "@/lib/api/client";

// Interview Timer Component
function InterviewTimer({ startTime }: { startTime: Date }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setElapsed(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Color coding based on time
  const getTimeColor = () => {
    if (elapsed < 300) return "text-green-600"; // Under 5 min - green
    if (elapsed < 600) return "text-slate-600 dark:text-slate-400"; // 5-10 min - normal
    if (elapsed < 900) return "text-amber-600"; // 10-15 min - amber (expected end)
    return "text-red-500"; // Over 15 min - red
  };

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Timer className={`w-4 h-4 ${getTimeColor()}`} />
      <span className={`font-mono ${getTimeColor()}`}>{formatTime(elapsed)}</span>
    </div>
  );
}

interface InterviewInfo {
  interview_id: string;
  candidate_name: string;
  job_title: string;
  company_name: string;
  status: string;
  is_simulation: boolean;
}

type Stage = "loading" | "intro" | "interview" | "complete" | "error";

export default function PhoneInterviewPage() {
  const params = useParams();
  const token = params.token as string;

  const [stage, setStage] = useState<Stage>("loading");
  const [interviewInfo, setInterviewInfo] = useState<InterviewInfo | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [interviewStartTime, setInterviewStartTime] = useState<Date | null>(null);

  // Fetch interview info on mount
  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const data = await phoneInterviewApi.getByToken(token);
        setInterviewInfo(data);

        if (data.status === "completed" || data.status === "analyzed") {
          setStage("complete");
        } else {
          setStage("intro");
        }
      } catch (err: any) {
        setError(
          err.response?.data?.detail || "Interview not found or expired"
        );
        setStage("error");
      }
    };

    fetchInterview();
  }, [token]);

  const handleStartInterview = () => {
    setInterviewStartTime(new Date());
    setStage("interview");
  };

  const handleInterviewComplete = () => {
    setStage("complete");
  };

  // Loading State
  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">
            Loading interview...
          </p>
        </div>
      </div>
    );
  }

  // Error State
  if (stage === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
            Interview Not Available
          </h1>
          <p className="text-slate-600 dark:text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  // Complete State
  if (stage === "complete") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="glass-card rounded-3xl p-8 text-center max-w-md mx-4">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">
            Interview Complete!
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-sm mx-auto mb-2">
            Thank you for completing your phone screen interview
            {interviewInfo?.job_title && (
              <span> for the {interviewInfo.job_title} position</span>
            )}
            .
          </p>
          <p className="text-slate-500 dark:text-slate-500 text-sm">
            Our team will review your responses and get back to you soon.
          </p>

          {interviewInfo?.is_simulation && (
            <div className="mt-6 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                This was a simulation preview. Results will not be used for
                hiring decisions.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!interviewInfo) return null;

  // Intro State
  if (stage === "intro") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        {/* Header */}
        <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <h1 className="font-bold text-slate-800 dark:text-white">
                Phone Screen Interview
              </h1>
              <p className="text-sm text-slate-500">
                {interviewInfo.company_name}
              </p>
            </div>
            {interviewInfo.is_simulation && (
              <span className="px-3 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                Simulation Mode
              </span>
            )}
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-12">
          <div className="glass-card rounded-3xl p-8 text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-10 h-10 text-primary" />
            </div>

            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
              Welcome, {interviewInfo.candidate_name}!
            </h2>

            <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 mb-6">
              <Briefcase className="w-4 h-4" />
              <span>{interviewInfo.job_title}</span>
            </div>

            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-lg mx-auto">
              You&apos;re about to begin a chat-based phone screen interview.
              Our AI interviewer will ask you questions about your background,
              skills, and experience. Just type your responses naturally.
            </p>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 mb-8 text-left max-w-md mx-auto">
              <h3 className="font-semibold text-slate-800 dark:text-white mb-4">
                Before you begin:
              </h3>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>The interview takes about 10-15 minutes</span>
                </li>
                <li className="flex items-start gap-3">
                  <MessageSquare className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Respond naturally as you would in a phone call</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>You can take your time to think before responding</span>
                </li>
              </ul>
            </div>

            <button
              onClick={handleStartInterview}
              className="px-8 py-3 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
            >
              Begin Interview
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Interview State
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-slate-800 dark:text-white">
              Phone Screen Interview
            </h1>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Briefcase className="w-3.5 h-3.5" />
              <span>{interviewInfo.job_title}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {interviewStartTime && (
              <InterviewTimer startTime={interviewStartTime} />
            )}
            {interviewInfo.is_simulation && (
              <span className="px-3 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                Simulation
              </span>
            )}
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {interviewInfo.candidate_name}
            </span>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 min-h-0">
        <InterviewChat
          token={token}
          candidateName={interviewInfo.candidate_name}
          onComplete={handleInterviewComplete}
        />
      </div>
    </div>
  );
}
