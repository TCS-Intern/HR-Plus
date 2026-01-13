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
import { screeningApi } from "@/lib/api/client";
import { toast } from "sonner";
import CVUploader from "@/components/screening/CVUploader";
import CandidateCard from "@/components/screening/CandidateCard";

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
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Job not found</h2>
        <Link href="/jobs" className="text-primary hover:underline">
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
            className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-slate-600 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{job.title}</h1>
            <p className="text-sm text-slate-500">Candidate Screening</p>
          </div>
        </div>

        {selectedCandidates.size > 0 && (
          <button
            onClick={handleShortlist}
            disabled={shortlisting}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {shortlisting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Shortlist Selected ({selectedCandidates.size})
          </button>
        )}
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
              <p className="text-xs text-slate-500">Strong</p>
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
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-xl flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.weakMatch}</p>
              <p className="text-xs text-slate-500">Weak</p>
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
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* CV Uploader */}
          <CVUploader onUpload={handleUpload} uploading={uploading} />

          {/* Filter */}
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800 dark:text-white">
              Candidates ({sortedCandidates.length})
            </h2>
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="appearance-none pl-10 pr-10 py-2 bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">All Candidates</option>
                <option value="strong_match">Strong Match</option>
                <option value="potential_match">Potential Match</option>
                <option value="weak_match">Weak Match</option>
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* Candidates List */}
          {sortedCandidates.length === 0 ? (
            <div className="glass-card rounded-3xl p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-800 dark:text-white mb-2">No candidates yet</h3>
              <p className="text-sm text-slate-500">
                Upload CVs above to start screening candidates for this position.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedCandidates.map((candidate) => (
                <CandidateCard
                  key={candidate.application_id}
                  candidate={candidate}
                  selected={selectedCandidates.has(candidate.application_id)}
                  onSelect={(selected) => handleSelectCandidate(candidate.application_id, selected)}
                  onReject={(reason) => handleReject(candidate.application_id, reason)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar - Job Requirements Summary */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="glass-card rounded-3xl p-6 sticky top-6">
            <h2 className="font-bold text-slate-800 dark:text-white mb-4">Job Requirements</h2>

            {job.skills_matrix?.required && job.skills_matrix.required.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-500 mb-2">Required Skills</p>
                <div className="flex flex-wrap gap-2">
                  {job.skills_matrix.required.map((skill, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-lg"
                    >
                      {skill.skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {job.qualifications?.required && job.qualifications.required.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Key Qualifications</p>
                <ul className="space-y-2">
                  {job.qualifications.required.slice(0, 5).map((qual, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      {qual}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
