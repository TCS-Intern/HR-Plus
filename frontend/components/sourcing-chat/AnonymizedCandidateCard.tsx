"use client";

import { useState } from "react";
import { Eye, EyeOff, MapPin, Briefcase, Star, ExternalLink } from "lucide-react";
import { sourcingChatApi } from "@/lib/api/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Candidate {
  id: string;
  role: string;
  company?: string;
  location?: string;
  experience_years?: number;
  skills: string[];
  summary?: string;
  fit_score?: number;
  source?: string;
  is_anonymized: boolean;
  name: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  already_revealed?: boolean;
}

interface AnonymizedCandidateCardProps {
  candidate: Candidate;
  conversationId: string;
  index?: number;
}

export default function AnonymizedCandidateCard({
  candidate: initialCandidate,
  conversationId,
  index,
}: AnonymizedCandidateCardProps) {
  const [candidate, setCandidate] = useState<Candidate>(initialCandidate);
  const [isRevealing, setIsRevealing] = useState(false);

  const handleReveal = async () => {
    try {
      setIsRevealing(true);

      const response = await sourcingChatApi.revealCandidate({
        candidate_id: candidate.id,
        conversation_id: conversationId,
        reveal_reason: "interested",
      });

      if (response.success && response.candidate) {
        setCandidate({
          ...candidate,
          ...response.candidate,
          is_anonymized: false,
        });
        toast.success(
          `Candidate revealed! ${response.credits_charged} credit${response.credits_charged > 1 ? "s" : ""} used. New balance: ${response.new_balance}`
        );
      } else {
        toast.error(response.error || "Failed to reveal candidate");
      }
    } catch (error: any) {
      console.error("Error revealing candidate:", error);
      if (error.response?.data?.error === "insufficient_credits") {
        toast.error("Insufficient credits. Please purchase more credits to reveal candidates.");
      } else {
        toast.error("Failed to reveal candidate. Please try again.");
      }
    } finally {
      setIsRevealing(false);
    }
  };

  // Get fit score color
  const getFitScoreColor = (score?: number) => {
    if (!score) return "text-slate-400";
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-orange-500";
  };

  return (
    <div className="glass-card rounded-2xl p-4 hover:shadow-lg transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {index && (
              <span className="text-xs font-semibold text-slate-400">#{index}</span>
            )}
            <h3 className="font-semibold text-slate-800 dark:text-white">
              {candidate.is_anonymized ? candidate.name : candidate.name}
            </h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">{candidate.role}</p>
        </div>

        {/* Fit Score */}
        {candidate.fit_score !== undefined && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
            <Star className={cn("w-3 h-3", getFitScoreColor(candidate.fit_score))} />
            <span className={cn("text-xs font-semibold", getFitScoreColor(candidate.fit_score))}>
              {Math.round(candidate.fit_score)}%
            </span>
          </div>
        )}
      </div>

      {/* Company & Location */}
      <div className="space-y-1.5 mb-3 text-sm">
        {candidate.company && (
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{candidate.company}</span>
          </div>
        )}

        {candidate.location && (
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{candidate.location}</span>
          </div>
        )}

        {candidate.experience_years && (
          <p className="text-xs text-slate-500">
            {candidate.experience_years} years of experience
          </p>
        )}
      </div>

      {/* Skills */}
      {candidate.skills && candidate.skills.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-1.5">
            {candidate.skills.slice(0, 5).map((skill, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-md"
              >
                {skill}
              </span>
            ))}
            {candidate.skills.length > 5 && (
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs rounded-md">
                +{candidate.skills.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {candidate.summary && (
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
          {candidate.summary}
        </p>
      )}

      {/* Divider */}
      <div className="border-t border-slate-200 dark:border-slate-700 mb-3" />

      {/* Reveal Section */}
      {candidate.is_anonymized ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <EyeOff className="w-3.5 h-3.5" />
            <span>Contact info hidden</span>
          </div>

          <button
            onClick={handleReveal}
            disabled={isRevealing}
            className={cn(
              "w-full py-2 px-3 rounded-xl text-sm font-medium transition-all",
              isRevealing
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-primary text-white hover:bg-primary/90 hover:scale-105 active:scale-95"
            )}
          >
            {isRevealing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Revealing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Eye className="w-4 h-4" />
                Reveal Identity & Contact (1 credit)
              </span>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Revealed Contact Info */}
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-green-700 dark:text-green-300 mb-2">
              <Eye className="w-3.5 h-3.5" />
              <span>Contact Info Revealed</span>
            </div>

            {candidate.email && (
              <a
                href={`mailto:${candidate.email}`}
                className="block text-xs text-slate-700 dark:text-slate-300 hover:text-primary"
              >
                <span className="font-medium">Email:</span> {candidate.email}
              </a>
            )}

            {candidate.phone && (
              <a
                href={`tel:${candidate.phone}`}
                className="block text-xs text-slate-700 dark:text-slate-300 hover:text-primary"
              >
                <span className="font-medium">Phone:</span> {candidate.phone}
              </a>
            )}

            {candidate.linkedin_url && (
              <a
                href={candidate.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <span>View LinkedIn Profile</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Source Badge */}
          {candidate.source && (
            <div className="text-xs text-slate-500 text-center">
              Source: <span className="font-medium capitalize">{candidate.source}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
