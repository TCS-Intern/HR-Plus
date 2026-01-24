"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  UserSearch,
  Search,
  Filter,
  Plus,
  Star,
  MapPin,
  Briefcase,
  ChevronRight,
  ExternalLink,
  CheckCircle,
  Mail,
  Linkedin,
  Github,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SourcedCandidate, Job } from "@/types";
import { supabase } from "@/lib/supabase/client";

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-600",
  contacted: "bg-purple-100 text-purple-600",
  replied: "bg-amber-100 text-amber-600",
  interested: "bg-green-100 text-green-600",
  not_interested: "bg-slate-100 text-slate-600",
  converted: "bg-emerald-100 text-emerald-600",
  rejected: "bg-red-100 text-red-600",
};

const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  linkedin: Linkedin,
  github: Github,
  manual: UserSearch,
};

function SourcedCandidateCard({
  candidate,
  job,
}: {
  candidate: SourcedCandidate;
  job?: Job;
}) {
  const PlatformIcon = platformIcons[candidate.source] || UserSearch;

  return (
    <div className="glass-card rounded-2xl p-5 hover:shadow-lg transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <PlatformIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white">
              {candidate.first_name} {candidate.last_name}
            </h3>
            <p className="text-sm text-slate-500">{candidate.current_title}</p>
          </div>
        </div>
        <span
          className={cn(
            "px-3 py-1 rounded-full text-xs font-semibold capitalize",
            statusColors[candidate.status] || statusColors.new
          )}
        >
          {candidate.status.replace("_", " ")}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-wrap gap-3 mb-4">
        {candidate.current_company && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Briefcase className="w-3 h-3" />
            {candidate.current_company}
          </div>
        )}
        {candidate.location && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="w-3 h-3" />
            {candidate.location}
          </div>
        )}
        {candidate.experience_years && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            {candidate.experience_years} years exp
          </div>
        )}
      </div>

      {/* Fit Score */}
      {candidate.fit_score !== null && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-amber-500" />
            <span
              className={cn(
                "text-sm font-bold",
                candidate.fit_score >= 80
                  ? "text-green-600"
                  : candidate.fit_score >= 60
                  ? "text-amber-600"
                  : "text-slate-600"
              )}
            >
              {candidate.fit_score}% fit
            </span>
          </div>
        </div>
      )}

      {/* Skills */}
      {candidate.skills && candidate.skills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {candidate.skills.slice(0, 4).map((skill) => (
            <span
              key={skill}
              className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-medium rounded-lg"
            >
              {skill}
            </span>
          ))}
          {candidate.skills.length > 4 && (
            <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-medium rounded-lg">
              +{candidate.skills.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Links & Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          {candidate.source === "linkedin" && candidate.source_url && (
            <a
              href={candidate.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <Linkedin className="w-3 h-3" />
            </a>
          )}
          {candidate.source === "github" && candidate.source_url && (
            <a
              href={candidate.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <Github className="w-3 h-3" />
            </a>
          )}
          {candidate.email && (
            <a
              href={`mailto:${candidate.email}`}
              className="p-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
            >
              <Mail className="w-3 h-3" />
            </a>
          )}
        </div>
        <Link
          href={`/sourcing/${candidate.id}`}
          className="text-primary text-xs font-medium hover:underline flex items-center gap-1"
        >
          Details
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

export default function SourcingPage() {
  const [candidates, setCandidates] = useState<SourcedCandidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string>("all");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchData() {
      // Fetch jobs
      const { data: jobsData } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (jobsData) {
        setJobs(jobsData as Job[]);
      }

      // Fetch sourced candidates
      let query = supabase
        .from("sourced_candidates")
        .select("*")
        .order("fit_score", { ascending: false, nullsFirst: false });

      if (selectedJob !== "all") {
        query = query.eq("job_id", selectedJob);
      }

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data: candidatesData, error } = await query;

      if (!error && candidatesData) {
        setCandidates(candidatesData as SourcedCandidate[]);
      }
      setLoading(false);
    }

    fetchData();
  }, [selectedJob, filter]);

  const filterOptions = [
    "all",
    "new",
    "contacted",
    "replied",
    "interested",
    "converted",
    "rejected",
  ];

  const stats = {
    total: candidates.length,
    new: candidates.filter((c) => c.status === "new").length,
    contacted: candidates.filter((c) => c.status === "contacted").length,
    interested: candidates.filter((c) => c.status === "interested").length,
    highFit: candidates.filter((c) => (c.fit_score || 0) >= 80).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Sourcing</h1>
          <p className="text-sm text-slate-500">Find and manage sourced candidates</p>
        </div>
        <Link
          href="/sourcing/new"
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Candidate
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card rounded-2xl p-4">
          <div className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total}</div>
          <div className="text-sm text-slate-500">Total Sourced</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
          <div className="text-sm text-slate-500">New</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-2xl font-bold text-purple-600">{stats.contacted}</div>
          <div className="text-sm text-slate-500">Contacted</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-2xl font-bold text-green-600">{stats.interested}</div>
          <div className="text-sm text-slate-500">Interested</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-2xl font-bold text-amber-600">{stats.highFit}</div>
          <div className="text-sm text-slate-500">High Fit (80%+)</div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col md:flex-row gap-4 items-center">
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

          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 p-1 rounded-xl overflow-x-auto">
            {filterOptions.map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all whitespace-nowrap",
                  filter === option
                    ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                )}
              >
                {option.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex items-center bg-white/60 dark:bg-slate-800/60 px-3 py-2 rounded-xl">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="text"
              placeholder="Search candidates..."
              className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-40 text-slate-800 dark:text-white placeholder-slate-400"
            />
          </div>
          <button className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-slate-600 dark:text-slate-300">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Candidates Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-2xl p-5 animate-pulse">
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded mb-2 w-3/4" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded mb-4 w-1/2" />
              <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserSearch className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
            No sourced candidates yet
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            Start sourcing candidates by searching or manually adding them.
          </p>
          <Link
            href="/sourcing/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Your First Candidate
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {candidates.map((candidate) => (
            <SourcedCandidateCard
              key={candidate.id}
              candidate={candidate}
              job={jobs.find((j) => j.id === candidate.job_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
