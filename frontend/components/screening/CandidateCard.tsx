"use client";

import { useState } from "react";
import {
  User,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScreenedCandidate } from "@/types";
import MatchScoreDisplay from "./MatchScoreDisplay";

interface CandidateCardProps {
  candidate: ScreenedCandidate;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onReject: (reason?: string) => void;
  onCreateAssessment?: () => Promise<void>;
  creatingAssessment?: boolean;
}

const recommendationConfig = {
  strong_match: {
    label: "Strong Match",
    color: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400",
    icon: Star,
    iconColor: "text-green-500",
  },
  potential_match: {
    label: "Potential Match",
    color: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
  },
  weak_match: {
    label: "Weak Match",
    color: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
    icon: XCircle,
    iconColor: "text-red-500",
  },
};

export default function CandidateCard({
  candidate,
  selected,
  onSelect,
  onReject,
  onCreateAssessment,
  creatingAssessment,
}: CandidateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

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
        "glass-card rounded-2xl overflow-hidden transition-all",
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
              className="mt-1 w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
            />
          )}

          {/* Avatar */}
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">
              {fullName.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">{fullName}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
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
                  <span className="px-3 py-1 bg-blue-100 text-blue-600 text-xs font-semibold rounded-full">
                    Shortlisted
                  </span>
                )}
                {candidate.status === "rejected" && (
                  <span className="px-3 py-1 bg-red-100 text-red-600 text-xs font-semibold rounded-full">
                    Rejected
                  </span>
                )}
                <span className={cn("px-3 py-1 text-xs font-semibold rounded-full", config.color)}>
                  {candidate.screening_score || 0}%
                </span>
              </div>
            </div>

            {/* Recommendation */}
            <div className="flex items-center gap-2 mt-3">
              <Icon className={cn("w-4 h-4", config.iconColor)} />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {config.label}
              </span>
            </div>

            {/* Strengths Preview */}
            {candidate.strengths && candidate.strengths.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {candidate.strengths.slice(0, 3).map((strength, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs rounded-lg"
                  >
                    {strength}
                  </span>
                ))}
                {candidate.strengths.length > 3 && (
                  <span className="text-xs text-slate-500">+{candidate.strengths.length - 3} more</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
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
        <div className="border-t border-slate-200/50 dark:border-slate-700/50 p-4 bg-slate-50/50 dark:bg-slate-800/30">
          {/* Match Breakdown */}
          {candidate.match_breakdown && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Match Breakdown
              </h4>
              <MatchScoreDisplay breakdown={candidate.match_breakdown} />
            </div>
          )}

          {/* Strengths */}
          {candidate.strengths && candidate.strengths.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Strengths
              </h4>
              <ul className="space-y-1">
                {candidate.strengths.map((strength, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gaps */}
          {candidate.gaps && candidate.gaps.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Gaps
              </h4>
              <ul className="space-y-1">
                {candidate.gaps.map((gap, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
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
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Red Flags
              </h4>
              <ul className="space-y-1">
                {candidate.red_flags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions for screening candidates */}
          {candidate.status !== "rejected" && candidate.status !== "shortlisted" && (
            <div className="flex items-center gap-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
              {candidateInfo.resume_url && (
                <a
                  href={candidateInfo.resume_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Resume
                </a>
              )}
              {candidateInfo.linkedin_url && (
                <a
                  href={candidateInfo.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <Linkedin className="w-4 h-4" />
                  LinkedIn
                </a>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setShowRejectModal(true)}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Reject
              </button>
            </div>
          )}

          {/* Actions for shortlisted candidates */}
          {candidate.status === "shortlisted" && onCreateAssessment && (
            <div className="flex items-center gap-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
              {candidateInfo.resume_url && (
                <a
                  href={candidateInfo.resume_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Resume
                </a>
              )}
              {candidateInfo.linkedin_url && (
                <a
                  href={candidateInfo.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <Linkedin className="w-4 h-4" />
                  LinkedIn
                </a>
              )}
              <div className="flex-1" />
              <button
                onClick={onCreateAssessment}
                disabled={creatingAssessment}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 rounded-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
              >
                {creatingAssessment ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileQuestion className="w-4 h-4" />
                    Create Interview Questions
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="font-bold text-slate-800 dark:text-white mb-4">Reject Candidate</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Are you sure you want to reject {fullName}? You can optionally provide a reason.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason (optional)"
              className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={3}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
