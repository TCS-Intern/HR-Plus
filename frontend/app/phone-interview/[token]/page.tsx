"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  MessageSquare,
  Mic,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Briefcase,
  Timer,
} from "lucide-react";
import InterviewChat from "@/components/phone-interview/InterviewChat";
import VoiceInterviewChat from "@/components/phone-interview/VoiceInterviewChat";
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
    if (elapsed < 600) return "text-zinc-500"; // 5-10 min - normal
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
  interview_mode: string;
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
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-zinc-900 mx-auto mb-4" />
          <p className="text-zinc-500">
            Loading interview...
          </p>
        </div>
      </div>
    );
  }

  // Error State
  if (stage === "error") {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-zinc-900 mb-2">
            Interview Not Available
          </h1>
          <p className="text-zinc-500">{error}</p>
        </div>
      </div>
    );
  }

  // Complete State
  if (stage === "complete") {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-md mx-4">
          <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-4">
            Interview Complete!
          </h2>
          <p className="text-zinc-700 max-w-sm mx-auto mb-2">
            Thank you for completing your phone screen interview
            {interviewInfo?.job_title && (
              <span> for the {interviewInfo.job_title} position</span>
            )}
            .
          </p>
          <p className="text-zinc-500 text-sm">
            Our team will review your responses and get back to you soon.
          </p>

          {interviewInfo?.is_simulation && (
            <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs text-amber-700">
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
      <div className="min-h-screen bg-[#FAFAF8]">
        {/* Header */}
        <header className="bg-white border-b border-zinc-100">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <h1 className="font-bold text-zinc-900">
                Phone Screen Interview
              </h1>
              <p className="text-sm text-zinc-500">
                {interviewInfo.company_name}
              </p>
            </div>
            {interviewInfo.is_simulation && (
              <span className="px-3 py-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                Simulation Mode
              </span>
            )}
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="w-20 h-20 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              {interviewInfo.interview_mode === "voice" ? (
                <Mic className="w-10 h-10 text-zinc-500" />
              ) : (
                <MessageSquare className="w-10 h-10 text-zinc-500" />
              )}
            </div>

            <h2 className="text-2xl font-bold text-zinc-900 mb-2">
              Welcome, {interviewInfo.candidate_name}!
            </h2>

            <div className="flex items-center justify-center gap-2 text-zinc-500 mb-6">
              <Briefcase className="w-4 h-4" />
              <span>{interviewInfo.job_title}</span>
            </div>

            {interviewInfo.interview_mode === "voice" ? (
              <p className="text-zinc-700 mb-8 max-w-lg mx-auto">
                You&apos;re about to begin a voice-based phone screen interview.
                Our AI interviewer will speak with you through your browser&apos;s
                microphone. Just speak naturally as you would in a phone call.
              </p>
            ) : (
              <p className="text-zinc-700 mb-8 max-w-lg mx-auto">
                You&apos;re about to begin a chat-based phone screen interview.
                Our AI interviewer will ask you questions about your background,
                skills, and experience. Just type your responses naturally.
              </p>
            )}

            <div className="bg-zinc-50 rounded-xl p-6 mb-8 text-left max-w-md mx-auto">
              <h3 className="font-semibold text-zinc-900 mb-4">
                Before you begin:
              </h3>
              <ul className="space-y-3 text-sm text-zinc-700">
                <li className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                  <span>The interview takes about 10-15 minutes</span>
                </li>
                {interviewInfo.interview_mode === "voice" ? (
                  <>
                    <li className="flex items-start gap-3">
                      <Mic className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                      <span>You&apos;ll need to allow microphone access</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                      <span>Find a quiet place with a stable internet connection</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start gap-3">
                      <MessageSquare className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                      <span>Respond naturally as you would in a phone call</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                      <span>You can take your time to think before responding</span>
                    </li>
                  </>
                )}
              </ul>
            </div>

            <button
              onClick={handleStartInterview}
              className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-xl px-6 py-2.5 text-sm font-medium transition-colors shadow-sm"
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
    <div className="min-h-screen flex flex-col bg-[#FAFAF8]">
      {/* Header */}
      <header className="bg-white border-b border-zinc-100 flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-zinc-900">
              Phone Screen Interview
            </h1>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Briefcase className="w-3.5 h-3.5" />
              <span>{interviewInfo.job_title}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {interviewStartTime && (
              <InterviewTimer startTime={interviewStartTime} />
            )}
            {interviewInfo.is_simulation && (
              <span className="px-3 py-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                Simulation
              </span>
            )}
            <span className="text-sm text-zinc-700">
              {interviewInfo.candidate_name}
            </span>
          </div>
        </div>
      </header>

      {/* Chat / Voice Area */}
      <div className="flex-1 min-h-0">
        {interviewInfo.interview_mode === "voice" ? (
          <VoiceInterviewChat
            token={token}
            candidateName={interviewInfo.candidate_name}
            onComplete={handleInterviewComplete}
          />
        ) : (
          <InterviewChat
            token={token}
            candidateName={interviewInfo.candidate_name}
            onComplete={handleInterviewComplete}
          />
        )}
      </div>
    </div>
  );
}
