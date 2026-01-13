"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Star,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Clock,
  Loader2,
  Filter,
  ChevronDown,
  FileText,
  Mail,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface CandidateWithApplication {
  id: string;
  application_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  linkedin_url: string | null;
  resume_url: string | null;
  source: string;
  status: string;
  screening_score: number | null;
  screening_recommendation: string | null;
  strengths: string[];
  gaps: string[];
  applied_at: string;
  job_id: string;
  job_title: string;
}

type FilterStatus = "all" | "new" | "screening" | "shortlisted" | "assessment" | "offer" | "hired" | "rejected";
type FilterRecommendation = "all" | "strong_match" | "potential_match" | "weak_match";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  new: { label: "New", color: "bg-slate-100 text-slate-600", icon: Clock },
  screening: { label: "Screening", color: "bg-blue-100 text-blue-600", icon: FileText },
  shortlisted: { label: "Shortlisted", color: "bg-green-100 text-green-600", icon: CheckCircle },
  assessment: { label: "Assessment", color: "bg-purple-100 text-purple-600", icon: Users },
  offer: { label: "Offer", color: "bg-amber-100 text-amber-600", icon: Mail },
  hired: { label: "Hired", color: "bg-emerald-100 text-emerald-600", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-600", icon: XCircle },
  withdrawn: { label: "Withdrawn", color: "bg-gray-100 text-gray-600", icon: XCircle },
};

const recommendationConfig: Record<string, { label: string; color: string; icon: any }> = {
  strong_match: { label: "Strong Match", color: "bg-green-100 text-green-700", icon: Star },
  potential_match: { label: "Potential", color: "bg-amber-100 text-amber-700", icon: AlertTriangle },
  weak_match: { label: "Weak Match", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<CandidateWithApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterRecommendation, setFilterRecommendation] = useState<FilterRecommendation>("all");

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          id,
          status,
          screening_score,
          screening_recommendation,
          strengths,
          gaps,
          applied_at,
          job_id,
          candidates (*),
          jobs (id, title)
        `)
        .order("applied_at", { ascending: false });

      if (!error && data) {
        const transformedData = data.map((item: any) => ({
          id: item.candidates?.id || "",
          application_id: item.id,
          email: item.candidates?.email || "",
          first_name: item.candidates?.first_name,
          last_name: item.candidates?.last_name,
          phone: item.candidates?.phone,
          linkedin_url: item.candidates?.linkedin_url,
          resume_url: item.candidates?.resume_url,
          source: item.candidates?.source || "direct",
          status: item.status,
          screening_score: item.screening_score,
          screening_recommendation: item.screening_recommendation,
          strengths: item.strengths || [],
          gaps: item.gaps || [],
          applied_at: item.applied_at,
          job_id: item.jobs?.id || item.job_id,
          job_title: item.jobs?.title || "Unknown Position",
        }));
        setCandidates(transformedData);
      }
    } catch (error) {
      console.error("Error fetching candidates:", error);
    }
    setLoading(false);
  };

  const filteredCandidates = candidates.filter((c) => {
    const statusMatch = filterStatus === "all" || c.status === filterStatus;
    const recommendationMatch =
      filterRecommendation === "all" || c.screening_recommendation === filterRecommendation;
    return statusMatch && recommendationMatch;
  });

  const sortedCandidates = [...filteredCandidates].sort(
    (a, b) => (b.screening_score || 0) - (a.screening_score || 0)
  );

  const stats = {
    total: candidates.length,
    strongMatch: candidates.filter((c) => c.screening_recommendation === "strong_match").length,
    potentialMatch: candidates.filter((c) => c.screening_recommendation === "potential_match").length,
    shortlisted: candidates.filter((c) => c.status === "shortlisted").length,
    inAssessment: candidates.filter((c) => c.status === "assessment").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Candidates</h1>
          <p className="text-sm text-slate-500">View and manage all candidates across jobs</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-xl flex items-center justify-center">
              <Star className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.strongMatch}</p>
              <p className="text-xs text-slate-500">Strong Match</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.potentialMatch}</p>
              <p className="text-xs text-slate-500">Potential</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.shortlisted}</p>
              <p className="text-xs text-slate-500">Shortlisted</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.inAssessment}</p>
              <p className="text-xs text-slate-500">In Assessment</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-bold text-slate-800 dark:text-white">
          All Candidates ({sortedCandidates.length})
        </h2>
        <div className="flex gap-3">
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="appearance-none pl-10 pr-10 py-2 bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="screening">Screening</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="assessment">Assessment</option>
              <option value="offer">Offer</option>
              <option value="hired">Hired</option>
              <option value="rejected">Rejected</option>
            </select>
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
          <div className="relative">
            <select
              value={filterRecommendation}
              onChange={(e) => setFilterRecommendation(e.target.value as FilterRecommendation)}
              className="appearance-none pl-10 pr-10 py-2 bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Matches</option>
              <option value="strong_match">Strong Match</option>
              <option value="potential_match">Potential Match</option>
              <option value="weak_match">Weak Match</option>
            </select>
            <Star className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Candidates List */}
      {sortedCandidates.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-800 dark:text-white mb-2">No candidates found</h3>
          <p className="text-sm text-slate-500">
            Candidates will appear here when CVs are uploaded for job positions.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedCandidates.map((candidate) => {
            const status = statusConfig[candidate.status] || statusConfig.new;
            const StatusIcon = status.icon;
            const recommendation = candidate.screening_recommendation
              ? recommendationConfig[candidate.screening_recommendation]
              : null;
            const RecommendationIcon = recommendation?.icon;

            return (
              <div key={candidate.application_id} className="glass-card rounded-2xl p-4 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">
                        {candidate.first_name?.charAt(0) || candidate.email.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800 dark:text-white truncate">
                          {candidate.first_name && candidate.last_name
                            ? `${candidate.first_name} ${candidate.last_name}`
                            : candidate.email}
                        </h3>
                        {candidate.linkedin_url && (
                          <a
                            href={candidate.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                        <Link
                          href={`/jobs/${candidate.job_id}/candidates`}
                          className="text-sm text-primary hover:underline truncate"
                        >
                          {candidate.job_title}
                        </Link>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={cn("px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1", status.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                        {recommendation && RecommendationIcon && (
                          <span className={cn("px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1", recommendation.color)}>
                            <RecommendationIcon className="w-3 h-3" />
                            {recommendation.label}
                          </span>
                        )}
                        {candidate.screening_score !== null && (
                          <span className="px-2 py-1 text-xs font-semibold text-slate-600 bg-slate-100 rounded-full">
                            Score: {candidate.screening_score}%
                          </span>
                        )}
                      </div>

                      {candidate.strengths.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {candidate.strengths.slice(0, 3).map((strength, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 text-xs bg-green-50 text-green-700 rounded-md"
                            >
                              {strength}
                            </span>
                          ))}
                          {candidate.strengths.length > 3 && (
                            <span className="px-2 py-0.5 text-xs text-slate-500">
                              +{candidate.strengths.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side - Actions & Meta */}
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-slate-500">
                      Applied {formatDistanceToNow(new Date(candidate.applied_at))} ago
                    </span>
                    <Link
                      href={`/jobs/${candidate.job_id}/candidates`}
                      className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
