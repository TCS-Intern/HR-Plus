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
  FileText,
  Briefcase,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import SchedulePhoneScreenModal from "@/components/screening/SchedulePhoneScreenModal";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { SkeletonList } from "@/components/ui/skeleton";

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

const statusBadgeVariant: Record<string, { label: string; variant: "default" | "info" | "success" | "purple" | "warning" | "error"; icon: any }> = {
  new: { label: "New", variant: "default", icon: Clock },
  screening: { label: "Screening", variant: "info", icon: FileText },
  shortlisted: { label: "Shortlisted", variant: "success", icon: CheckCircle },
  assessment: { label: "Assessment", variant: "purple", icon: Users },
  offer: { label: "Offer", variant: "warning", icon: CheckCircle },
  hired: { label: "Hired", variant: "success", icon: CheckCircle },
  rejected: { label: "Rejected", variant: "error", icon: XCircle },
  withdrawn: { label: "Withdrawn", variant: "default", icon: XCircle },
};

const recommendationBadgeVariant: Record<string, { label: string; variant: "success" | "warning" | "error"; icon: any }> = {
  strong_match: { label: "Strong Match", variant: "success", icon: Star },
  potential_match: { label: "Potential", variant: "warning", icon: AlertTriangle },
  weak_match: { label: "Weak Match", variant: "error", icon: XCircle },
};

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<CandidateWithApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterRecommendation, setFilterRecommendation] = useState<FilterRecommendation>("all");
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateWithApplication | null>(null);

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
      <div className="space-y-6">
        <PageHeader title="Candidates" description="View and manage all candidates across jobs" />
        <SkeletonList rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Candidates"
        description="View and manage all candidates across jobs"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat
          label="Total"
          value={stats.total}
          icon={<Users className="w-5 h-5" />}
          bgColor="bg-zinc-100"
        />
        <Stat
          label="Strong Match"
          value={stats.strongMatch}
          icon={<Star className="w-5 h-5" />}
          bgColor="bg-emerald-50"
        />
        <Stat
          label="Potential"
          value={stats.potentialMatch}
          icon={<AlertTriangle className="w-5 h-5" />}
          bgColor="bg-amber-50"
        />
        <Stat
          label="Shortlisted"
          value={stats.shortlisted}
          icon={<CheckCircle className="w-5 h-5" />}
          bgColor="bg-blue-50"
        />
        <Stat
          label="In Assessment"
          value={stats.inAssessment}
          icon={<Users className="w-5 h-5" />}
          bgColor="bg-purple-50"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-semibold text-zinc-900">
          All Candidates ({sortedCandidates.length})
        </h2>
        <div className="flex gap-3">
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            options={[
              { value: "all", label: "All Status" },
              { value: "new", label: "New" },
              { value: "screening", label: "Screening" },
              { value: "shortlisted", label: "Shortlisted" },
              { value: "assessment", label: "Assessment" },
              { value: "offer", label: "Offer" },
              { value: "hired", label: "Hired" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
          <Select
            value={filterRecommendation}
            onChange={(e) => setFilterRecommendation(e.target.value as FilterRecommendation)}
            options={[
              { value: "all", label: "All Matches" },
              { value: "strong_match", label: "Strong Match" },
              { value: "potential_match", label: "Potential Match" },
              { value: "weak_match", label: "Weak Match" },
            ]}
          />
        </div>
      </div>

      {/* Candidates List */}
      {sortedCandidates.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title="No candidates found"
            description="Candidates will appear here when CVs are uploaded for job positions."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedCandidates.map((candidate) => {
            const status = statusBadgeVariant[candidate.status] || statusBadgeVariant.new;
            const StatusIcon = status.icon;
            const recommendation = candidate.screening_recommendation
              ? recommendationBadgeVariant[candidate.screening_recommendation]
              : null;
            const RecommendationIcon = recommendation?.icon;

            const candidateName =
              candidate.first_name && candidate.last_name
                ? `${candidate.first_name} ${candidate.last_name}`
                : candidate.email;

            return (
              <Card key={candidate.application_id} hover padding="sm" className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <Avatar
                      name={candidateName}
                      size="lg"
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-zinc-900 truncate">
                          {candidateName}
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
                        <Briefcase className="w-3.5 h-3.5 text-zinc-400" />
                        <Link
                          href={`/jobs/${candidate.job_id}/candidates`}
                          className="text-sm text-accent hover:underline truncate"
                        >
                          {candidate.job_title}
                        </Link>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant={status.variant} dot>
                          {status.label}
                        </Badge>
                        {recommendation && (
                          <Badge variant={recommendation.variant} dot>
                            {recommendation.label}
                          </Badge>
                        )}
                        {candidate.screening_score !== null && (
                          <Badge variant="default">
                            Score: {candidate.screening_score}%
                          </Badge>
                        )}
                      </div>

                      {candidate.strengths.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {candidate.strengths.slice(0, 3).map((strength, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded-md"
                            >
                              {strength}
                            </span>
                          ))}
                          {candidate.strengths.length > 3 && (
                            <span className="px-2 py-0.5 text-xs text-zinc-500">
                              +{candidate.strengths.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side - Actions & Meta */}
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-zinc-500">
                      Applied {formatDistanceToNow(new Date(candidate.applied_at))} ago
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<MessageSquare className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setSelectedCandidate(candidate);
                          setShowInterviewModal(true);
                        }}
                      >
                        Interview
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {}}
                        className="text-accent"
                      >
                        <Link href={`/jobs/${candidate.job_id}/candidates`}>
                          View Details
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Phone Screen Modal */}
      {selectedCandidate && (
        <SchedulePhoneScreenModal
          isOpen={showInterviewModal}
          onClose={() => {
            setShowInterviewModal(false);
            setSelectedCandidate(null);
          }}
          applicationId={selectedCandidate.application_id}
          candidateName={
            selectedCandidate.first_name && selectedCandidate.last_name
              ? `${selectedCandidate.first_name} ${selectedCandidate.last_name}`
              : selectedCandidate.email
          }
          candidatePhone={selectedCandidate.phone}
          onSuccess={() => {
            fetchCandidates();
          }}
        />
      )}
    </div>
  );
}
