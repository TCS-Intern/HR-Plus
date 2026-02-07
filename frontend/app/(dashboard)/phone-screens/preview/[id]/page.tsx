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
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

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
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Phone Screens
        </Link>

        <Card>
          <EmptyState
            icon={<AlertTriangle className="w-8 h-8 text-rose-500" />}
            title="Failed to Load"
            description={error || undefined}
          />
        </Card>
      </div>
    );
  }

  // Check if this is a simulation
  if (phoneScreen.interview_mode !== "simulation" && phoneScreen.interview_mode !== "web") {
    return (
      <div className="space-y-6">
        <Link
          href="/phone-screens"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Phone Screens
        </Link>

        <Card>
          <EmptyState
            icon={<AlertTriangle className="w-8 h-8 text-amber-500" />}
            title="Not a Web Interview"
            description="This phone screen was conducted via phone call, not web chat."
          />
        </Card>
      </div>
    );
  }

  if (!phoneScreen.access_token) {
    return (
      <div className="space-y-6">
        <Link
          href="/phone-screens"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Phone Screens
        </Link>

        <Card>
          <EmptyState
            icon={<AlertTriangle className="w-8 h-8 text-amber-500" />}
            title="No Access Token"
            description="This interview doesn't have a valid access token."
          />
        </Card>
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
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Phone Screens
        </Link>

        <Card className="max-w-md mx-auto text-center">
          <div className="py-8">
            <div className="w-16 h-16 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-4">
              Preview Complete
            </h3>
            <p className="text-zinc-500 mb-6">
              This simulation has ended. The results are marked as preview data.
            </p>
            <Link href={`/phone-screens/${phoneScreenId}`}>
              <Button>View Results</Button>
            </Link>
          </div>
        </Card>
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
            className="p-2 bg-white rounded-lg border border-zinc-200 hover:border-zinc-300 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-zinc-900">
                Interview Preview
              </h1>
              <Badge variant="warning">Simulation</Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-zinc-500 mt-1">
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

        <div className="text-right text-sm text-zinc-500">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Preview Mode
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white rounded-xl overflow-hidden shadow-sm border border-zinc-200">
        <InterviewChat
          token={phoneScreen.access_token}
          candidateName={candidateName}
          onComplete={handleComplete}
        />
      </div>

      {/* Info Banner */}
      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-700 text-center">
          This is a simulation preview. Results will be marked as simulation data and not used for hiring decisions.
        </p>
      </div>
    </div>
  );
}
