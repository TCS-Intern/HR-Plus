"use client";

import { useState } from "react";
import {
  Mail,
  Phone,
  Linkedin,
  CheckCircle,
  XCircle,
  Star,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileQuestion,
  Loader2,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScreenedCandidate } from "@/types";
import MatchScoreDisplay from "./MatchScoreDisplay";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CandidateCardProps {
  candidate: ScreenedCandidate;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onReject: (reason?: string) => void;
  onCreateAssessment?: () => Promise<void>;
  creatingAssessment?: boolean;
  jobId?: string;
}

const recommendationConfig = {
  strong_match: {
    label: "Strong Match",
    variant: "success" as const,
    icon: Star,
  },
  potential_match: {
    label: "Potential Match",
    variant: "warning" as const,
    icon: AlertTriangle,
  },
  weak_match: {
    label: "Weak Match",
    variant: "error" as const,
    icon: XCircle,
  },
};

export default function CandidateCard({
  candidate,
  selected,
  onSelect,
  onReject,
  onCreateAssessment,
  creatingAssessment,
  jobId,
}: CandidateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  const copyApplyLink = () => {
    if (!jobId) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${origin}/apply/${jobId}?ref=${candidate.candidate_id}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const config = recommendationConfig[candidate.screening_recommendation || "weak_match"];
  const Icon = config.icon;

  const candidateInfo = candidate.candidate || {};
  const fullName = [candidateInfo.first_name, candidateInfo.last_name].filter(Boolean).join(" ") || "Unknown";

  const handleReject = () => {
    onReject(rejectReason || undefined);
    setShowRejectModal(false);
    setRejectReason("");
  };

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden transition-all",
        selected && "ring-2 ring-primary",
        candidate.status === "shortlisted" && "ring-2 ring-blue-500",
        candidate.status === "rejected" && "opacity-60"
      )}
    >
      {/* Main Content */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          {candidate.status !== "rejected" && candidate.status !== "shortlisted" && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-zinc-300 text-primary focus:ring-zinc-300"
            />
          )}

          {/* Avatar */}
          <Avatar name={fullName} size="lg" />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-zinc-900">{fullName}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                  {candidateInfo.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {candidateInfo.email}
                    </span>
                  )}
                  {candidateInfo.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {candidateInfo.phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Score Badge */}
              <div className="flex items-center gap-2">
                {candidate.status === "shortlisted" && (
                  <Badge variant="info">Shortlisted</Badge>
                )}
                {candidate.status === "rejected" && (
                  <Badge variant="error">Rejected</Badge>
                )}
                <Badge variant={config.variant}>{candidate.screening_score || 0}%</Badge>
              </div>
            </div>

            {/* Recommendation */}
            <div className="flex items-center gap-2 mt-3">
              <Icon className="w-4 h-4 text-zinc-500" />
              <span className="text-sm font-medium text-zinc-700">{config.label}</span>
            </div>

            {/* Strengths Preview */}
            {candidate.strengths && candidate.strengths.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {candidate.strengths.slice(0, 3).map((strength, i) => (
                  <span key={i} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-md">
                    {strength}
                  </span>
                ))}
                {candidate.strengths.length > 3 && (
                  <span className="text-xs text-zinc-500">+{candidate.strengths.length - 3} more</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 flex items-center gap-1 text-sm text-primary hover:text-primary-600 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              View Details
            </>
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-zinc-100 p-4 bg-zinc-50">
          {/* Match Breakdown */}
          {candidate.match_breakdown && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-zinc-700 mb-3">Match Breakdown</h4>
              <MatchScoreDisplay breakdown={candidate.match_breakdown} />
            </div>
          )}

          {/* Strengths */}
          {candidate.strengths && candidate.strengths.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-zinc-700 mb-2">Strengths</h4>
              <ul className="space-y-1">
                {candidate.strengths.map((strength, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gaps */}
          {candidate.gaps && candidate.gaps.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-zinc-700 mb-2">Gaps</h4>
              <ul className="space-y-1">
                {candidate.gaps.map((gap, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Red Flags */}
          {candidate.red_flags && candidate.red_flags.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-zinc-700 mb-2">Red Flags</h4>
              <ul className="space-y-1">
                {candidate.red_flags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-rose-600">
                    <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions for screening candidates */}
          {candidate.status !== "rejected" && candidate.status !== "shortlisted" && (
            <div className="flex items-center gap-3 pt-3 border-t border-zinc-200">
              {candidateInfo.resume_url && (
                <a href={candidateInfo.resume_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                  <ExternalLink className="w-4 h-4" /> View Resume
                </a>
              )}
              {candidateInfo.linkedin_url && (
                <a href={candidateInfo.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  <Linkedin className="w-4 h-4" /> LinkedIn
                </a>
              )}
              {jobId && (
                <button
                  onClick={copyApplyLink}
                  className="flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
                >
                  <LinkIcon className="w-4 h-4" />
                  {linkCopied ? "Copied!" : "Copy Apply Link"}
                </button>
              )}
              <div className="flex-1" />
              <Button variant="danger" size="sm" onClick={() => setShowRejectModal(true)}>Reject</Button>
            </div>
          )}

          {/* Actions for shortlisted candidates */}
          {candidate.status === "shortlisted" && onCreateAssessment && (
            <div className="flex items-center gap-3 pt-3 border-t border-zinc-200">
              {candidateInfo.resume_url && (
                <a href={candidateInfo.resume_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                  <ExternalLink className="w-4 h-4" /> View Resume
                </a>
              )}
              {candidateInfo.linkedin_url && (
                <a href={candidateInfo.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  <Linkedin className="w-4 h-4" /> LinkedIn
                </a>
              )}
              <div className="flex-1" />
              <Button
                onClick={onCreateAssessment}
                loading={creatingAssessment}
                icon={!creatingAssessment ? <FileQuestion className="w-4 h-4" /> : undefined}
                size="sm"
              >
                {creatingAssessment ? "Generating..." : "Create Interview Questions"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-lg border border-zinc-200">
            <h3 className="font-semibold text-zinc-900 mb-4">Reject Candidate</h3>
            <p className="text-sm text-zinc-600 mb-4">
              Are you sure you want to reject {fullName}? You can optionally provide a reason.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason (optional)"
              className="w-full p-3 border border-zinc-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-zinc-300"
              rows={3}
            />
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={() => setShowRejectModal(false)}>Cancel</Button>
              <Button variant="danger" onClick={handleReject}>Reject</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
