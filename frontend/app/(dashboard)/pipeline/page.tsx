"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  User,
  Phone,
  Mail,
  Star,
  Clock,
  CheckCircle,
  ChevronRight,
  Filter,
  Briefcase,
  MapPin,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Linkedin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SourcedCandidate, PhoneScreen, Application, Job } from "@/types";
import { supabase } from "@/lib/supabase/client";

interface PipelineCandidate {
  id: string;
  type: "sourced" | "application";
  name: string;
  title: string | null;
  company: string | null;
  location: string | null;
  email: string | null;
  linkedinUrl: string | null;
  fitScore: number | null;
  stage: string;
  jobId: string;
  jobTitle: string;
  phoneScreenId?: string;
  phoneScreenStatus?: string;
  recommendation?: string;
  updatedAt: string;
}

const stages = [
  { id: "sourced", label: "Sourced", color: "bg-blue-500" },
  { id: "contacted", label: "Contacted", color: "bg-purple-500" },
  { id: "replied", label: "Replied", color: "bg-amber-500" },
  { id: "phone_screen", label: "Phone Screen", color: "bg-indigo-500" },
  { id: "ready", label: "Ready for Offer", color: "bg-green-500" },
];

const recommendationColors: Record<string, string> = {
  STRONG_YES: "bg-emerald-100 text-emerald-700",
  YES: "bg-green-100 text-green-700",
  MAYBE: "bg-amber-100 text-amber-700",
  NO: "bg-red-100 text-red-700",
};

function CandidateCard({ candidate }: { candidate: PipelineCandidate }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {candidate.name.charAt(0)}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-slate-800 dark:text-white group-hover:text-primary transition-colors">
              {candidate.name}
            </h4>
            {candidate.title && (
              <p className="text-xs text-slate-500 truncate max-w-[140px]">
                {candidate.title}
              </p>
            )}
          </div>
        </div>
        {candidate.fitScore !== null && (
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold",
              candidate.fitScore >= 80
                ? "bg-green-100 text-green-700"
                : candidate.fitScore >= 60
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-600"
            )}
          >
            <Star className="w-3 h-3" />
            {candidate.fitScore}%
          </div>
        )}
      </div>

      {/* Job Badge */}
      <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
        <Briefcase className="w-3 h-3" />
        <span className="truncate max-w-[160px]">{candidate.jobTitle}</span>
      </div>

      {/* Company & Location */}
      <div className="flex flex-wrap gap-2 mb-3">
        {candidate.company && (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            {candidate.company}
          </span>
        )}
        {candidate.location && (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {candidate.location}
          </span>
        )}
      </div>

      {/* Phone Screen Result */}
      {candidate.recommendation && (
        <div
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold mb-3",
            recommendationColors[candidate.recommendation] || "bg-slate-100 text-slate-600"
          )}
        >
          {candidate.recommendation === "STRONG_YES" || candidate.recommendation === "YES" ? (
            <ThumbsUp className="w-3 h-3" />
          ) : candidate.recommendation === "NO" ? (
            <ThumbsDown className="w-3 h-3" />
          ) : (
            <MessageSquare className="w-3 h-3" />
          )}
          {candidate.recommendation.replace("_", " ")}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-1">
          {candidate.linkedinUrl && (
            <a
              href={candidate.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"
            >
              <Linkedin className="w-3 h-3" />
            </a>
          )}
          {candidate.email && (
            <a
              href={`mailto:${candidate.email}`}
              onClick={(e) => e.stopPropagation()}
              className="p-1 text-green-500 hover:bg-green-50 rounded transition-colors"
            >
              <Mail className="w-3 h-3" />
            </a>
          )}
        </div>
        <Link
          href={
            candidate.type === "sourced"
              ? `/sourcing/${candidate.id}`
              : candidate.phoneScreenId
              ? `/phone-screens/${candidate.phoneScreenId}`
              : `/jobs/${candidate.jobId}/candidates`
          }
          className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          View
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

function KanbanColumn({
  stage,
  candidates,
  count,
}: {
  stage: typeof stages[0];
  candidates: PipelineCandidate[];
  count: number;
}) {
  return (
    <div className="flex-1 min-w-[280px] max-w-[320px]">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", stage.color)} />
          <h3 className="font-semibold text-slate-800 dark:text-white">
            {stage.label}
          </h3>
          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300">
            {count}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-2">
        {candidates.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
            <p className="text-sm text-slate-400">No candidates</p>
          </div>
        ) : (
          candidates.map((candidate) => (
            <CandidateCard key={`${candidate.type}-${candidate.id}`} candidate={candidate} />
          ))
        )}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const [candidates, setCandidates] = useState<PipelineCandidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string>("all");

  useEffect(() => {
    async function fetchData() {
      // Fetch jobs
      const { data: jobsData } = await supabase
        .from("jobs")
        .select("*")
        .in("status", ["active", "paused"])
        .order("created_at", { ascending: false });

      if (jobsData) {
        setJobs(jobsData as Job[]);
      }

      // Fetch sourced candidates
      let sourcedQuery = supabase
        .from("sourced_candidates")
        .select("*, jobs(title)")
        .not("status", "eq", "rejected")
        .order("fit_score", { ascending: false, nullsFirst: false });

      if (selectedJob !== "all") {
        sourcedQuery = sourcedQuery.eq("job_id", selectedJob);
      }

      const { data: sourcedData } = await sourcedQuery;

      // Fetch phone screens with application and candidate data
      let phoneScreenQuery = supabase
        .from("phone_screens")
        .select("*, applications(*, candidates(*), jobs(title))")
        .order("created_at", { ascending: false });

      const { data: phoneScreenData } = await phoneScreenQuery;

      // Transform data into pipeline candidates
      const pipelineCandidates: PipelineCandidate[] = [];

      // Add sourced candidates
      if (sourcedData) {
        for (const sc of sourcedData) {
          // Determine stage based on status
          let stage = "sourced";
          if (sc.status === "contacted") stage = "contacted";
          else if (sc.status === "replied" || sc.status === "interested") stage = "replied";
          else if (sc.status === "converted") continue; // Skip converted, they're now applications

          pipelineCandidates.push({
            id: sc.id,
            type: "sourced",
            name: `${sc.first_name} ${sc.last_name}`,
            title: sc.current_title,
            company: sc.current_company,
            location: sc.location,
            email: sc.email,
            linkedinUrl: sc.linkedin_url,
            fitScore: sc.fit_score,
            stage,
            jobId: sc.job_id,
            jobTitle: (sc.jobs as any)?.title || "Unknown",
            updatedAt: sc.updated_at,
          });
        }
      }

      // Add phone screen candidates
      if (phoneScreenData) {
        for (const ps of phoneScreenData) {
          if (!ps.applications) continue;

          const app = ps.applications as any;
          const candidate = app.candidates;
          const job = app.jobs;

          if (selectedJob !== "all" && app.job_id !== selectedJob) continue;

          // Determine stage
          let stage = "phone_screen";
          if (ps.status === "analyzed" && (ps.recommendation === "STRONG_YES" || ps.recommendation === "YES")) {
            stage = "ready";
          }

          // Check if already added (avoid duplicates)
          const exists = pipelineCandidates.find(
            (c) => c.type === "application" && c.id === app.id
          );
          if (exists) continue;

          pipelineCandidates.push({
            id: app.id,
            type: "application",
            name: candidate ? `${candidate.first_name} ${candidate.last_name}` : "Unknown",
            title: null,
            company: null,
            location: candidate?.location,
            email: candidate?.email,
            linkedinUrl: candidate?.linkedin_url,
            fitScore: app.screening_score,
            stage,
            jobId: app.job_id,
            jobTitle: job?.title || "Unknown",
            phoneScreenId: ps.id,
            phoneScreenStatus: ps.status,
            recommendation: ps.recommendation,
            updatedAt: ps.updated_at,
          });
        }
      }

      setCandidates(pipelineCandidates);
      setLoading(false);
    }

    fetchData();
  }, [selectedJob]);

  // Group candidates by stage
  const candidatesByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = candidates.filter((c) => c.stage === stage.id);
    return acc;
  }, {} as Record<string, PipelineCandidate[]>);

  const totalCandidates = candidates.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Pipeline</h1>
          <p className="text-sm text-slate-500">
            {totalCandidates} candidates across {stages.length} stages
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Job Filter */}
          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className="bg-white/60 dark:bg-slate-800/60 border-none rounded-xl px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Jobs</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>

          <button className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white transition-colors">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center gap-6 overflow-x-auto">
          {stages.map((stage) => (
            <div key={stage.id} className="flex items-center gap-2 whitespace-nowrap">
              <div className={cn("w-2 h-2 rounded-full", stage.color)} />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {stage.label}
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-white">
                {candidatesByStage[stage.id]?.length || 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <div key={stage.id} className="flex-1 min-w-[280px] max-w-[320px]">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded mb-4 w-1/2 animate-pulse" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 h-32 animate-pulse"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              candidates={candidatesByStage[stage.id] || []}
              count={candidatesByStage[stage.id]?.length || 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
