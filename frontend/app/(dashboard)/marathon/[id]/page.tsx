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
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";

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
  const [activeTab, setActiveTab] = useState<string>("overview");

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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!marathon) {
    return (
      <Card>
        <EmptyState
          icon={<Clock className="w-8 h-8" />}
          title="Marathon not found"
          action={
            <Link href="/marathon" className="text-primary hover:underline text-sm">
              Back to Dashboard
            </Link>
          }
        />
      </Card>
    );
  }

  const stageBadgeVariant: Record<string, "info" | "purple" | "warning" | "success"> = {
    screening: "info",
    phone_screen: "purple",
    assessment: "warning",
    offer: "success",
  };

  const tabItems = [
    { id: "overview", label: "Overview" },
    { id: "decisions", label: "Decisions", count: decisions.length },
    { id: "events", label: "Events", count: events.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/marathon"
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 mb-1">
              {marathon.job_title || "Unknown Position"}
            </h1>
            <p className="text-sm text-zinc-500">{marathon.department || "No department"}</p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={stageBadgeVariant[marathon.current_stage] || "default"}>
              {marathon.current_stage.replace("_", " ")}
            </Badge>
            <ConfidenceBadge confidence={marathon.decision_confidence} />
          </div>
        </div>
      </div>

      {/* Action Buttons for Escalations */}
      {marathon.requires_human_review && (
        <Card className="bg-amber-50 border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Requires Your Review
              </p>
              <p className="text-sm text-amber-700 mt-1">{marathon.escalation_reason}</p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleReject}
                variant="danger"
                icon={<XCircle className="w-4 h-4" />}
              >
                Reject Candidate
              </Button>
              <Button
                onClick={handleApprove}
                variant="success"
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Approve & Continue
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Tabs
        tabs={tabItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Thought Signature */}
          <Card>
            <CardHeader title="Thought Signature" />

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="text-sm font-medium text-zinc-700 mb-3">Core Strengths</h4>
                {marathon.thought_signature.core_strengths.length > 0 ? (
                  <ul className="space-y-2">
                    {marathon.thought_signature.core_strengths.map((s, idx) => (
                      <li key={idx} className="text-sm text-emerald-700 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-zinc-500">None identified yet</p>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium text-zinc-700 mb-3">Concerns</h4>
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
                  <p className="text-sm text-zinc-500">None identified</p>
                )}
              </div>
            </div>

            {/* Hiring Thesis */}
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
              <h4 className="text-sm font-medium text-indigo-900 mb-2">Hiring Thesis</h4>
              <p className="text-sm text-indigo-700 italic">
                {marathon.thought_signature.hiring_thesis}
              </p>
            </div>
          </Card>

          {/* Self-Corrections */}
          {marathon.thought_signature.self_corrections &&
            marathon.thought_signature.self_corrections.length > 0 && (
              <Card>
                <CardHeader
                  title={`Self-Corrections (${marathon.thought_signature.self_corrections.length})`}
                  description="Agent adjusted beliefs based on new evidence"
                />

                <div className="space-y-4">
                  {marathon.thought_signature.self_corrections.map((correction, idx) => (
                    <div key={idx} className="p-4 bg-purple-50 border border-purple-100 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="purple">
                          {correction.stage}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium text-zinc-700 mb-1">Original Belief:</p>
                          <p className="text-zinc-600">{correction.original_belief}</p>
                        </div>
                        <div>
                          <p className="font-medium text-zinc-700 mb-1">Correction:</p>
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
              </Card>
            )}

          {/* Stage Insights */}
          {Object.keys(marathon.thought_signature.stage_insights || {}).length > 0 && (
            <Card>
              <CardHeader title="Stage Insights" />

              <div className="space-y-4">
                {Object.entries(marathon.thought_signature.stage_insights).map(([stage, insights]: [string, any]) => (
                  <div key={stage} className="p-4 bg-zinc-50 rounded-lg">
                    <h4 className="font-medium text-zinc-900 mb-2 capitalize">
                      {stage.replace("_", " ")}
                    </h4>
                    <pre className="text-xs text-zinc-600 whitespace-pre-wrap">
                      {JSON.stringify(insights, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === "decisions" && (
        <Card padding="none">
          <div className="p-6 border-b border-zinc-200">
            <h3 className="text-lg font-semibold text-zinc-900">Decision History</h3>
            <p className="text-sm text-zinc-500 mt-1">
              All decisions made by the Marathon Agent
            </p>
          </div>

          {decisions.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<FileText className="w-8 h-8" />}
                title="No decisions recorded yet"
              />
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {decisions.map((decision) => (
                <div key={decision.id} className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          decision.decision_type === "advance" ? "success" :
                          decision.decision_type === "reject" ? "error" :
                          decision.decision_type === "escalate" ? "warning" :
                          decision.decision_type === "self_correct" ? "purple" : "default"
                        }
                      >
                        {decision.decision_type}
                      </Badge>
                      <span className="text-sm text-zinc-500">{decision.stage}</span>
                    </div>
                    <div className="text-right">
                      <ConfidenceBadge confidence={decision.confidence} />
                      <p className="text-xs text-zinc-500 mt-1">
                        {new Date(decision.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-700">{decision.reasoning}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === "events" && (
        <Card padding="none">
          <div className="p-6 border-b border-zinc-200">
            <h3 className="text-lg font-semibold text-zinc-900">Event Timeline</h3>
            <p className="text-sm text-zinc-500 mt-1">
              Complete audit trail of all marathon events
            </p>
          </div>

          {events.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Calendar className="w-8 h-8" />}
                title="No events recorded yet"
              />
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {events.map((event) => (
                <div key={event.id} className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-900">
                      {event.event_type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>
                  {event.message && (
                    <p className="text-sm text-zinc-700 mb-2">{event.message}</p>
                  )}
                  {event.event_data && (
                    <details className="text-xs text-zinc-500">
                      <summary className="cursor-pointer hover:text-zinc-700">View data</summary>
                      <pre className="mt-2 p-2 bg-zinc-50 rounded-lg overflow-x-auto">
                        {JSON.stringify(event.event_data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const getVariant = (): "success" | "warning" | "error" => {
    if (confidence >= 0.8) return "success";
    if (confidence >= 0.6) return "warning";
    return "error";
  };

  return (
    <Badge variant={getVariant()} className="font-semibold">
      {(confidence * 100).toFixed(0)}%
    </Badge>
  );
}
