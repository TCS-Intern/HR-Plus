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
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">🏃‍♂️ Marathon Agent Dashboard</h1>
        <p className="text-slate-600">
          Autonomous multi-day hiring orchestrator with self-correction
        </p>
      </div>

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <MetricCard
            title="Active Marathons"
            value={metrics.active_marathons}
            icon={<Clock className="w-5 h-5" />}
            color="blue"
          />
          <MetricCard
            title="Needs Review"
            value={metrics.escalations_pending}
            icon={<AlertTriangle className="w-5 h-5" />}
            color="amber"
          />
          <MetricCard
            title="Self-Corrections"
            value={metrics.self_corrections_today}
            subtitle="today"
            icon={<TrendingDown className="w-5 h-5" />}
            color="purple"
          />
          <MetricCard
            title="Avg Confidence"
            value={`${(metrics.avg_confidence * 100).toFixed(0)}%`}
            icon={<CheckCircle2 className="w-5 h-5" />}
            color="green"
          />
          <MetricCard
            title="Autonomy Rate"
            value={`${metrics.autonomy_rate.toFixed(0)}%`}
            subtitle="autonomous decisions"
            icon={<Zap className="w-5 h-5" />}
            color="indigo"
          />
        </div>
      )}

      {/* Escalations Section (Priority) */}
      {escalations.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-xl font-semibold text-slate-900">Requires Your Review</h2>
            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
              {escalations.length}
            </span>
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
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Active Marathons</h2>

        {activeMarathons.length === 0 ? (
          <div className="bg-white border rounded-lg p-8 text-center">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">No active marathons</p>
            <p className="text-sm text-slate-500 mt-1">
              Marathons will appear here when candidates enter the pipeline
            </p>
          </div>
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

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color: "blue" | "amber" | "purple" | "green" | "indigo";
}) {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    purple: "bg-purple-100 text-purple-700",
    green: "bg-green-100 text-green-700",
    indigo: "bg-indigo-100 text-indigo-700",
  };

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-600">{title}</span>
        <div className={cn("p-2 rounded-lg", colorClasses[color])}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
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
  const stageColors: Record<string, string> = {
    screening: "bg-blue-100 text-blue-700",
    phone_screen: "bg-purple-100 text-purple-700",
    assessment: "bg-amber-100 text-amber-700",
    offer: "bg-green-100 text-green-700",
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-100 text-green-700";
    if (confidence >= 0.6) return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
  };

  return (
    <div
      className={cn(
        "bg-white border rounded-lg p-6 transition-all",
        marathon.requires_human_review && "border-amber-300 bg-amber-50"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <Link
            href={`/marathon/${marathon.id}`}
            className="text-lg font-semibold text-slate-900 hover:text-indigo-600 flex items-center gap-2"
          >
            {marathon.job_title || "Unknown Position"}
            <ChevronRight className="w-4 h-4" />
          </Link>
          <p className="text-sm text-slate-600 mt-1">{marathon.department || "No department"}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className={cn("px-3 py-1 rounded-full text-sm font-medium", stageColors[marathon.current_stage])}>
            {marathon.current_stage.replace("_", " ")}
          </span>

          <span className={cn("px-3 py-1 rounded-full text-sm font-semibold", getConfidenceColor(marathon.decision_confidence))}>
            {(marathon.decision_confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Thought Signature Summary */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">✅ Strengths</h4>
          {marathon.thought_signature.core_strengths.length > 0 ? (
            <ul className="text-sm space-y-1">
              {marathon.thought_signature.core_strengths.slice(0, 3).map((s, idx) => (
                <li key={idx} className="text-green-700">
                  • {s}
                </li>
              ))}
              {marathon.thought_signature.core_strengths.length > 3 && (
                <li className="text-slate-500 text-xs">
                  +{marathon.thought_signature.core_strengths.length - 3} more
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">None identified yet</p>
          )}
        </div>

        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">⚠️ Concerns</h4>
          {marathon.thought_signature.concerns.length > 0 ? (
            <ul className="text-sm space-y-1">
              {marathon.thought_signature.concerns.slice(0, 3).map((c, idx) => (
                <li key={idx} className="text-amber-700">
                  • {c}
                </li>
              ))}
              {marathon.thought_signature.concerns.length > 3 && (
                <li className="text-slate-500 text-xs">
                  +{marathon.thought_signature.concerns.length - 3} more
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">None identified</p>
          )}
        </div>
      </div>

      {/* Hiring Thesis */}
      {marathon.thought_signature.hiring_thesis && (
        <div className="mb-4 p-3 bg-slate-50 rounded-lg">
          <p className="text-sm font-medium text-slate-700 mb-1">💭 Hiring Thesis</p>
          <p className="text-sm text-slate-600 italic">{marathon.thought_signature.hiring_thesis}</p>
        </div>
      )}

      {/* Self-Corrections */}
      {marathon.correction_count > 0 && (
        <div className="mb-4 p-3 bg-purple-50 rounded-lg">
          <p className="text-sm font-medium text-purple-900 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            {marathon.correction_count} Self-Correction{marathon.correction_count > 1 ? "s" : ""} Made
          </p>
          <p className="text-xs text-purple-700 mt-1">Agent adjusted beliefs based on new evidence</p>
        </div>
      )}

      {/* Escalation Reason */}
      {marathon.escalation_reason && (
        <div className="mb-4 p-3 bg-amber-100 rounded-lg">
          <p className="text-sm font-medium text-amber-900 mb-1">🚨 Escalation Reason</p>
          <p className="text-sm text-amber-700">{marathon.escalation_reason}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <p className="text-xs text-slate-600">
          Next: <span className="font-medium">{new Date(marathon.next_scheduled_action).toLocaleString()}</span>
        </p>

        <div className="flex gap-2">
          {showActions && onApprove && onReject ? (
            <>
              <button
                onClick={() => onReject(marathon.id)}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
              >
                <XCircle className="w-4 h-4 inline mr-1" />
                Reject
              </button>
              <button
                onClick={() => onApprove(marathon.id)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                Approve & Continue
              </button>
            </>
          ) : (
            <button
              onClick={() => onProcessNow(marathon.id)}
              disabled={processing === marathon.id}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {processing === marathon.id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4" />
                  Process Now
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
