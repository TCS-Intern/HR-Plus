"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingDown,
  Loader2,
  Calendar,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

interface MarathonState {
  id: string;
  job_id: string;
  application_id: string;
  job_title: string;
  department: string;
  current_stage: string;
  stage_status: string;
  decision_confidence: number;
  correction_count: number;
  requires_human_review: boolean;
  escalation_reason: string | null;
  blocked_reason: string | null;
  next_scheduled_action: string;
  thought_signature: {
    core_strengths: string[];
    concerns: string[];
    hiring_thesis: string;
    decision_confidence: number;
    stage_insights: Record<string, any>;
    self_corrections: Array<{
      stage: string;
      original_belief: string;
      correction: string;
      impact: string;
    }>;
  };
  created_at: string;
  updated_at: string;
}

interface Decision {
  id: string;
  stage: string;
  decision_type: string;
  reasoning: string;
  confidence: number;
  created_at: string;
}

interface Event {
  id: string;
  event_type: string;
  event_data: any;
  message: string;
  created_at: string;
}

export default function MarathonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const marathonId = params.id as string;

  const [marathon, setMarathon] = useState<MarathonState | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "decisions" | "events">("overview");

  useEffect(() => {
    fetchMarathonData();
  }, [marathonId]);

  const fetchMarathonData = async () => {
    try {
      const [marathonRes, decisionsRes, eventsRes] = await Promise.all([
        api.get(`/marathon/${marathonId}`),
        api.get(`/marathon/${marathonId}/decisions`),
        api.get(`/marathon/${marathonId}/events`),
      ]);

      setMarathon(marathonRes.data);
      setDecisions(decisionsRes.data || []);
      setEvents(eventsRes.data || []);
    } catch (error) {
      console.error("Error fetching marathon:", error);
      toast.error("Failed to load marathon details");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      await api.post(`/marathon/${marathonId}/approve`);
      toast.success("Marathon approved and will continue");
      await fetchMarathonData();
    } catch (error) {
      toast.error("Failed to approve marathon");
    }
  };

  const handleReject = async () => {
    try {
      await api.post(`/marathon/${marathonId}/reject`);
      toast.success("Candidate rejected");
      router.push("/marathon");
    } catch (error) {
      toast.error("Failed to reject marathon");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!marathon) {
    return (
      <div className="p-6">
        <p className="text-red-600">Marathon not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/marathon"
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              {marathon.job_title || "Unknown Position"}
            </h1>
            <p className="text-slate-600">{marathon.department || "No department"}</p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium",
                marathon.current_stage === "screening" && "bg-blue-100 text-blue-700",
                marathon.current_stage === "phone_screen" && "bg-purple-100 text-purple-700",
                marathon.current_stage === "assessment" && "bg-amber-100 text-amber-700",
                marathon.current_stage === "offer" && "bg-green-100 text-green-700"
              )}
            >
              {marathon.current_stage.replace("_", " ")}
            </span>

            <ConfidenceBadge confidence={marathon.decision_confidence} />
          </div>
        </div>
      </div>

      {/* Action Buttons for Escalations */}
      {marathon.requires_human_review && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Requires Your Review
              </p>
              <p className="text-sm text-amber-700 mt-1">{marathon.escalation_reason}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                <XCircle className="w-4 h-4 inline mr-1" />
                Reject Candidate
              </button>
              <button
                onClick={handleApprove}
                className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                Approve & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex gap-6">
          {["overview", "decisions", "events"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                "pb-3 px-1 border-b-2 font-medium text-sm transition-colors",
                activeTab === tab
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Thought Signature */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">💭 Thought Signature</h3>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-3">✅ Core Strengths</h4>
                {marathon.thought_signature.core_strengths.length > 0 ? (
                  <ul className="space-y-2">
                    {marathon.thought_signature.core_strengths.map((s, idx) => (
                      <li key={idx} className="text-sm text-green-700 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">None identified yet</p>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-3">⚠️ Concerns</h4>
                {marathon.thought_signature.concerns.length > 0 ? (
                  <ul className="space-y-2">
                    {marathon.thought_signature.concerns.map((c, idx) => (
                      <li key={idx} className="text-sm text-amber-700 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">None identified</p>
                )}
              </div>
            </div>

            {/* Hiring Thesis */}
            <div className="p-4 bg-indigo-50 rounded-lg">
              <h4 className="text-sm font-medium text-indigo-900 mb-2">Hiring Thesis</h4>
              <p className="text-sm text-indigo-700 italic">
                {marathon.thought_signature.hiring_thesis}
              </p>
            </div>
          </div>

          {/* Self-Corrections */}
          {marathon.thought_signature.self_corrections &&
            marathon.thought_signature.self_corrections.length > 0 && (
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5" />
                  Self-Corrections ({marathon.thought_signature.self_corrections.length})
                </h3>

                <div className="space-y-4">
                  {marathon.thought_signature.self_corrections.map((correction, idx) => (
                    <div key={idx} className="p-4 bg-purple-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-purple-700 uppercase">
                          {correction.stage}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium text-slate-700 mb-1">Original Belief:</p>
                          <p className="text-slate-600">{correction.original_belief}</p>
                        </div>
                        <div>
                          <p className="font-medium text-slate-700 mb-1">Correction:</p>
                          <p className="text-purple-700">{correction.correction}</p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-purple-200">
                        <p className="text-xs text-purple-600">
                          <span className="font-medium">Impact:</span> {correction.impact}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Stage Insights */}
          {Object.keys(marathon.thought_signature.stage_insights || {}).length > 0 && (
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">📊 Stage Insights</h3>

              <div className="space-y-4">
                {Object.entries(marathon.thought_signature.stage_insights).map(([stage, insights]: [string, any]) => (
                  <div key={stage} className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-medium text-slate-900 mb-2 capitalize">
                      {stage.replace("_", " ")}
                    </h4>
                    <pre className="text-xs text-slate-600 whitespace-pre-wrap">
                      {JSON.stringify(insights, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "decisions" && (
        <div className="bg-white border rounded-lg">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Decision History</h3>
            <p className="text-sm text-slate-600 mt-1">
              All decisions made by the Marathon Agent
            </p>
          </div>

          {decisions.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No decisions recorded yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {decisions.map((decision) => (
                <div key={decision.id} className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium",
                          decision.decision_type === "advance" && "bg-green-100 text-green-700",
                          decision.decision_type === "reject" && "bg-red-100 text-red-700",
                          decision.decision_type === "escalate" && "bg-amber-100 text-amber-700",
                          decision.decision_type === "self_correct" && "bg-purple-100 text-purple-700"
                        )}
                      >
                        {decision.decision_type}
                      </span>
                      <span className="ml-2 text-sm text-slate-600">{decision.stage}</span>
                    </div>
                    <div className="text-right">
                      <ConfidenceBadge confidence={decision.confidence} />
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(decision.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700">{decision.reasoning}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "events" && (
        <div className="bg-white border rounded-lg">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Event Timeline</h3>
            <p className="text-sm text-slate-600 mt-1">
              Complete audit trail of all marathon events
            </p>
          </div>

          {events.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No events recorded yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {events.map((event) => (
                <div key={event.id} className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-medium text-slate-900">
                      {event.event_type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>
                  {event.message && (
                    <p className="text-sm text-slate-600 mb-2">{event.message}</p>
                  )}
                  {event.event_data && (
                    <details className="text-xs text-slate-500">
                      <summary className="cursor-pointer">View data</summary>
                      <pre className="mt-2 p-2 bg-slate-50 rounded overflow-x-auto">
                        {JSON.stringify(event.event_data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const getColor = () => {
    if (confidence >= 0.8) return "bg-green-100 text-green-700";
    if (confidence >= 0.6) return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
  };

  return (
    <span className={cn("px-3 py-1 rounded-full text-sm font-semibold", getColor())}>
      {(confidence * 100).toFixed(0)}%
    </span>
  );
}
