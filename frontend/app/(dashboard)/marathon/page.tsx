"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Zap,
  ArrowRight,
  Loader2,
  PlayCircle,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  next_scheduled_action: string;
  thought_signature: {
    core_strengths: string[];
    concerns: string[];
    hiring_thesis: string;
    decision_confidence: number;
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

interface MarathonMetrics {
  active_marathons: number;
  escalations_pending: number;
  self_corrections_today: number;
  avg_confidence: number;
  autonomy_rate: number;
}

export default function MarathonDashboard() {
  const [activeMarathons, setActiveMarathons] = useState<MarathonState[]>([]);
  const [escalations, setEscalations] = useState<MarathonState[]>([]);
  const [metrics, setMetrics] = useState<MarathonMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [marathonsRes, escalationsRes, metricsRes] = await Promise.all([
        api.get("/marathon/active?limit=50"),
        api.get("/marathon/review"),
        api.get("/marathon/metrics"),
      ]);

      setActiveMarathons(marathonsRes.data || []);
      setEscalations(escalationsRes.data || []);
      setMetrics(metricsRes.data);
    } catch (error) {
      console.error("Error fetching marathon data:", error);
      toast.error("Failed to load marathon data");
    } finally {
      setLoading(false);
    }
  };

  const handleProcessNow = async (marathonId: string) => {
    setProcessing(marathonId);
    try {
      const response = await api.post(`/marathon/${marathonId}/process`);
      toast.success(`Processed: ${response.data.decision} (confidence: ${(response.data.confidence * 100).toFixed(0)}%)`);
      await fetchData();
    } catch (error) {
      console.error("Error processing marathon:", error);
      toast.error("Failed to process marathon");
    } finally {
      setProcessing(null);
    }
  };

  const handleApprove = async (marathonId: string) => {
    try {
      await api.post(`/marathon/${marathonId}/approve`);
      toast.success("Marathon approved and will continue");
      await fetchData();
    } catch (error) {
      console.error("Error approving marathon:", error);
      toast.error("Failed to approve marathon");
    }
  };

  const handleReject = async (marathonId: string) => {
    try {
      await api.post(`/marathon/${marathonId}/reject`);
      toast.success("Candidate rejected");
      await fetchData();
    } catch (error) {
      console.error("Error rejecting marathon:", error);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Marathon Agent Dashboard"
        description="Autonomous multi-day hiring orchestrator with self-correction"
      />

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Stat
            label="Active Marathons"
            value={metrics.active_marathons}
            icon={<Clock className="w-5 h-5" />}
            accentColor="border-blue-500"
          />
          <Stat
            label="Needs Review"
            value={metrics.escalations_pending}
            icon={<AlertTriangle className="w-5 h-5" />}
            accentColor="border-amber-500"
          />
          <Stat
            label="Self-Corrections"
            value={metrics.self_corrections_today}
            icon={<TrendingDown className="w-5 h-5" />}
            accentColor="border-purple-500"
          />
          <Stat
            label="Avg Confidence"
            value={`${(metrics.avg_confidence * 100).toFixed(0)}%`}
            icon={<CheckCircle2 className="w-5 h-5" />}
            accentColor="border-emerald-500"
          />
          <Stat
            label="Autonomy Rate"
            value={`${metrics.autonomy_rate.toFixed(0)}%`}
            icon={<Zap className="w-5 h-5" />}
            accentColor="border-indigo-500"
          />
        </div>
      )}

      {/* Escalations Section (Priority) */}
      {escalations.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-zinc-900">Requires Your Review</h2>
            <Badge variant="warning">{escalations.length}</Badge>
          </div>

          <div className="space-y-4">
            {escalations.map((marathon) => (
              <MarathonCard
                key={marathon.id}
                marathon={marathon}
                onProcessNow={handleProcessNow}
                onApprove={handleApprove}
                onReject={handleReject}
                processing={processing}
                showActions
              />
            ))}
          </div>
        </div>
      )}

      {/* Active Marathons Section */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">Active Marathons</h2>

        {activeMarathons.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Clock className="w-8 h-8" />}
              title="No active marathons"
              description="Marathons will appear here when candidates enter the pipeline"
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {activeMarathons.map((marathon) => (
              <MarathonCard
                key={marathon.id}
                marathon={marathon}
                onProcessNow={handleProcessNow}
                processing={processing}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MarathonCard({
  marathon,
  onProcessNow,
  onApprove,
  onReject,
  processing,
  showActions = false,
}: {
  marathon: MarathonState;
  onProcessNow: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  processing: string | null;
  showActions?: boolean;
}) {
  const stageBadgeVariant: Record<string, "info" | "purple" | "warning" | "success"> = {
    screening: "info",
    phone_screen: "purple",
    assessment: "warning",
    offer: "success",
  };

  const getConfidenceBadgeVariant = (confidence: number): "success" | "warning" | "error" => {
    if (confidence >= 0.8) return "success";
    if (confidence >= 0.6) return "warning";
    return "error";
  };

  return (
    <Card className={cn(marathon.requires_human_review && "border-amber-300 bg-amber-50")}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <Link
            href={`/marathon/${marathon.id}`}
            className="text-lg font-semibold text-zinc-900 hover:text-primary flex items-center gap-2"
          >
            {marathon.job_title || "Unknown Position"}
            <ChevronRight className="w-4 h-4" />
          </Link>
          <p className="text-sm text-zinc-500 mt-1">{marathon.department || "No department"}</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={stageBadgeVariant[marathon.current_stage] || "default"}>
            {marathon.current_stage.replace("_", " ")}
          </Badge>
          <Badge variant={getConfidenceBadgeVariant(marathon.decision_confidence)}>
            {(marathon.decision_confidence * 100).toFixed(0)}%
          </Badge>
        </div>
      </div>

      {/* Thought Signature Summary */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h4 className="text-sm font-medium text-zinc-700 mb-2">Strengths</h4>
          {marathon.thought_signature.core_strengths.length > 0 ? (
            <ul className="text-sm space-y-1">
              {marathon.thought_signature.core_strengths.slice(0, 3).map((s, idx) => (
                <li key={idx} className="text-emerald-700 flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
              {marathon.thought_signature.core_strengths.length > 3 && (
                <li className="text-zinc-500 text-xs">
                  +{marathon.thought_signature.core_strengths.length - 3} more
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">None identified yet</p>
          )}
        </div>

        <div>
          <h4 className="text-sm font-medium text-zinc-700 mb-2">Concerns</h4>
          {marathon.thought_signature.concerns.length > 0 ? (
            <ul className="text-sm space-y-1">
              {marathon.thought_signature.concerns.slice(0, 3).map((c, idx) => (
                <li key={idx} className="text-amber-700 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{c}</span>
                </li>
              ))}
              {marathon.thought_signature.concerns.length > 3 && (
                <li className="text-zinc-500 text-xs">
                  +{marathon.thought_signature.concerns.length - 3} more
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">None identified</p>
          )}
        </div>
      </div>

      {/* Hiring Thesis */}
      {marathon.thought_signature.hiring_thesis && (
        <div className="mb-4 p-3 bg-zinc-50 rounded-lg">
          <p className="text-sm font-medium text-zinc-700 mb-1">Hiring Thesis</p>
          <p className="text-sm text-zinc-600 italic">{marathon.thought_signature.hiring_thesis}</p>
        </div>
      )}

      {/* Self-Corrections */}
      {marathon.correction_count > 0 && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-100 rounded-lg">
          <p className="text-sm font-medium text-purple-900 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            {marathon.correction_count} Self-Correction{marathon.correction_count > 1 ? "s" : ""} Made
          </p>
          <p className="text-xs text-purple-700 mt-1">Agent adjusted beliefs based on new evidence</p>
        </div>
      )}

      {/* Escalation Reason */}
      {marathon.escalation_reason && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-lg">
          <p className="text-sm font-medium text-amber-900 mb-1">Escalation Reason</p>
          <p className="text-sm text-amber-700">{marathon.escalation_reason}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
        <p className="text-xs text-zinc-500">
          Next: <span className="font-medium">{new Date(marathon.next_scheduled_action).toLocaleString()}</span>
        </p>

        <div className="flex gap-2">
          {showActions && onApprove && onReject ? (
            <>
              <Button
                onClick={() => onReject(marathon.id)}
                variant="danger"
                size="sm"
                icon={<XCircle className="w-4 h-4" />}
              >
                Reject
              </Button>
              <Button
                onClick={() => onApprove(marathon.id)}
                variant="success"
                size="sm"
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Approve & Continue
              </Button>
            </>
          ) : (
            <Button
              onClick={() => onProcessNow(marathon.id)}
              disabled={processing === marathon.id}
              loading={processing === marathon.id}
              size="sm"
              icon={<PlayCircle className="w-4 h-4" />}
            >
              {processing === marathon.id ? "Processing..." : "Process Now"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
