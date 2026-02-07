"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Users,
  CheckCircle,
  XCircle,
  Star,
  AlertTriangle,
  Loader2,
  FileText,
  Filter,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job, ScreenedCandidate } from "@/types";
import { supabase } from "@/lib/supabase/client";
import { screeningApi, assessmentApi } from "@/lib/api/client";
import { toast } from "sonner";
import CVUploader from "@/components/screening/CVUploader";
import CandidateCard from "@/components/screening/CandidateCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";

type FilterStatus = "all" | "strong_match" | "potential_match" | "weak_match";

export default function CandidatesPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<ScreenedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [shortlisting, setShortlisting] = useState(false);
  const [creatingAssessment, setCreatingAssessment] = useState<string | null>(null);

  const fetchCandidates = useCallback(async () => {
    try {
      const response = await screeningApi.getCandidates(jobId);
      setCandidates(response.candidates || []);
    } catch (error) {
      console.error("Error fetching candidates:", error);
    }
  }, [jobId]);

  useEffect(() => {
    async function fetchData() {
      // Fetch job details
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (!jobError && jobData) {
        setJob(jobData as Job);
      }

      // Fetch candidates
      await fetchCandidates();
      setLoading(false);
    }

    if (jobId) {
      fetchData();
    }
  }, [jobId, fetchCandidates]);

  const handleUpload = async (files: File[]) => {
    setUploading(true);
    let successCount = 0;

    for (const file of files) {
      try {
        await screeningApi.uploadCV(jobId, file);
        successCount++;
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} CV(s)`);
      await fetchCandidates();
    }

    setUploading(false);
  };

  const handleSelectCandidate = (applicationId: string, selected: boolean) => {
    setSelectedCandidates((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(applicationId);
      } else {
        next.delete(applicationId);
      }
      return next;
    });
  };

  const handleShortlist = async () => {
    if (selectedCandidates.size === 0) {
      toast.error("Please select candidates to shortlist");
      return;
    }

    setShortlisting(true);
    try {
      await screeningApi.shortlist(Array.from(selectedCandidates));
      toast.success(`Shortlisted ${selectedCandidates.size} candidate(s)`);
      setSelectedCandidates(new Set());
      await fetchCandidates();
    } catch (error) {
      console.error("Error shortlisting:", error);
      toast.error("Failed to shortlist candidates");
    }
    setShortlisting(false);
  };

  const handleReject = async (applicationId: string, reason?: string) => {
    try {
      await screeningApi.reject(applicationId, reason);
      toast.success("Candidate rejected");
      await fetchCandidates();
    } catch (error) {
      console.error("Error rejecting:", error);
      toast.error("Failed to reject candidate");
    }
  };

  const handleCreateAssessment = async (applicationId: string) => {
    setCreatingAssessment(applicationId);
    try {
      const response = await assessmentApi.generateQuestions(applicationId);
      const assessmentId = response.data?.assessment_id || response.data?.id;
      toast.success("Interview questions generated successfully!");

      if (assessmentId) {
        router.push(`/assessments/${assessmentId}`);
      } else {
        await fetchCandidates();
      }
    } catch (error: unknown) {
      console.error("Error creating assessment:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate interview questions";
      toast.error(errorMessage);
    } finally {
      setCreatingAssessment(null);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    if (filterStatus === "all") return true;
    return c.screening_recommendation === filterStatus;
  });

  const sortedCandidates = [...filteredCandidates].sort(
    (a, b) => (b.screening_score || 0) - (a.screening_score || 0)
  );

  const stats = {
    total: candidates.length,
    strongMatch: candidates.filter((c) => c.screening_recommendation === "strong_match").length,
    potentialMatch: candidates.filter((c) => c.screening_recommendation === "potential_match").length,
    weakMatch: candidates.filter((c) => c.screening_recommendation === "weak_match").length,
    shortlisted: candidates.filter((c) => c.status === "shortlisted").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">Job not found</h2>
        <Link href="/jobs" className="text-accent hover:underline text-sm">
          Back to jobs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex items-start gap-4">
          <Link
            href={`/jobs/${jobId}`}
            className="p-2 bg-white border border-zinc-200 rounded-lg text-zinc-500 hover:text-accent hover:border-zinc-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{job.title}</h1>
            <p className="text-sm text-zinc-500">Candidate Screening</p>
          </div>
        </div>

        {selectedCandidates.size > 0 && (
          <Button
            size="lg"
            onClick={handleShortlist}
            loading={shortlisting}
            icon={!shortlisting ? <CheckCircle className="w-4 h-4" /> : undefined}
          >
            Shortlist Selected ({selectedCandidates.size})
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat
          label="Total"
          value={stats.total}
          icon={<Users className="w-5 h-5" />}
          bgColor="bg-zinc-100"
        />
        <Stat
          label="Strong"
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
          label="Weak"
          value={stats.weakMatch}
          icon={<XCircle className="w-5 h-5" />}
          bgColor="bg-rose-50"
        />
        <Stat
          label="Shortlisted"
          value={stats.shortlisted}
          icon={<CheckCircle className="w-5 h-5" />}
          bgColor="bg-blue-50"
        />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* CV Uploader */}
          <CVUploader onUpload={handleUpload} uploading={uploading} />

          {/* Filter */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900">
              Candidates ({sortedCandidates.length})
            </h2>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              options={[
                { value: "all", label: "All Candidates" },
                { value: "strong_match", label: "Strong Match" },
                { value: "potential_match", label: "Potential Match" },
                { value: "weak_match", label: "Weak Match" },
              ]}
              className="w-44"
            />
          </div>

          {/* Candidates List */}
          {sortedCandidates.length === 0 ? (
            <Card>
              <EmptyState
                icon={<FileText className="w-8 h-8" />}
                title="No candidates yet"
                description="Upload CVs above to start screening candidates for this position."
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {sortedCandidates.map((candidate) => (
                <CandidateCard
                  key={candidate.application_id}
                  candidate={candidate}
                  selected={selectedCandidates.has(candidate.application_id)}
                  onSelect={(selected) => handleSelectCandidate(candidate.application_id, selected)}
                  onReject={(reason) => handleReject(candidate.application_id, reason)}
                  onCreateAssessment={() => handleCreateAssessment(candidate.application_id)}
                  creatingAssessment={creatingAssessment === candidate.application_id}
                  jobId={jobId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar - Job Requirements Summary */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Card className="sticky top-6">
            <h2 className="font-semibold text-zinc-900 mb-4">Job Requirements</h2>

            {job.skills_matrix?.required && job.skills_matrix.required.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-zinc-500 mb-2">Required Skills</p>
                <div className="flex flex-wrap gap-2">
                  {job.skills_matrix.required.map((skill, i) => (
                    <Badge key={i} variant="primary">
                      {skill.skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {job.qualifications?.required && job.qualifications.required.length > 0 && (
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-2">Key Qualifications</p>
                <ul className="space-y-2">
                  {job.qualifications.required.slice(0, 5).map((qual, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-zinc-700">
                      <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                      {qual}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
