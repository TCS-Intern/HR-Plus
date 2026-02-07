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
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton";

const statusBadgeVariant: Record<string, "info" | "purple" | "warning" | "success" | "default" | "error"> = {
  new: "info",
  contacted: "purple",
  replied: "warning",
  interested: "success",
  not_interested: "default",
  converted: "success",
  rejected: "error",
};

const statusLabels: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  interested: "Interested",
  not_interested: "Not Interested",
  converted: "Converted",
  rejected: "Rejected",
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
    <Card hover>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <PlatformIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-900">
              {candidate.first_name} {candidate.last_name}
            </h3>
            <p className="text-sm text-zinc-500">{candidate.current_title}</p>
          </div>
        </div>
        <Badge variant={statusBadgeVariant[candidate.status] || "default"}>
          {statusLabels[candidate.status] || candidate.status.replace("_", " ")}
        </Badge>
      </div>

      {/* Info */}
      <div className="flex flex-wrap gap-3 mb-4">
        {candidate.current_company && (
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Briefcase className="w-3 h-3" />
            {candidate.current_company}
          </div>
        )}
        {candidate.location && (
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <MapPin className="w-3 h-3" />
            {candidate.location}
          </div>
        )}
        {candidate.experience_years && (
          <div className="flex items-center gap-1 text-xs text-zinc-500">
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
                  ? "text-emerald-600"
                  : candidate.fit_score >= 60
                  ? "text-amber-600"
                  : "text-zinc-600"
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
            <Badge key={skill} variant="primary">
              {skill}
            </Badge>
          ))}
          {candidate.skills.length > 4 && (
            <Badge variant="default">
              +{candidate.skills.length - 4} more
            </Badge>
          )}
        </div>
      )}

      {/* Links & Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
        <div className="flex items-center gap-2">
          {candidate.source === "linkedin" && candidate.source_url && (
            <a
              href={candidate.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Linkedin className="w-3 h-3" />
            </a>
          )}
          {candidate.source === "github" && candidate.source_url && (
            <a
              href={candidate.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-zinc-100 text-zinc-600 rounded-lg hover:bg-zinc-200 transition-colors"
            >
              <Github className="w-3 h-3" />
            </a>
          )}
          {candidate.email && (
            <a
              href={`mailto:${candidate.email}`}
              className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
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
    </Card>
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
      <PageHeader
        title="Sourcing"
        description="Find and manage sourced candidates"
        actions={
          <Link href="/sourcing/new">
            <Button icon={<Plus className="w-4 h-4" />} size="lg">
              Add Candidate
            </Button>
          </Link>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat
          label="Total Sourced"
          value={stats.total}
          icon={<UserSearch className="w-5 h-5" />}
          accentColor="border-zinc-400"
        />
        <Stat
          label="New"
          value={stats.new}
          icon={<Star className="w-5 h-5" />}
          accentColor="border-blue-500"
        />
        <Stat
          label="Contacted"
          value={stats.contacted}
          icon={<Mail className="w-5 h-5" />}
          accentColor="border-purple-500"
        />
        <Stat
          label="Interested"
          value={stats.interested}
          icon={<CheckCircle className="w-5 h-5" />}
          accentColor="border-emerald-500"
        />
        <Stat
          label="High Fit (80%+)"
          value={stats.highFit}
          icon={<Star className="w-5 h-5" />}
          accentColor="border-amber-500"
        />
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            {/* Job Filter */}
            <select
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              className="bg-white border border-zinc-200 rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none hover:border-zinc-300 transition-colors"
            >
              <option value="all">All Jobs</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-lg overflow-x-auto">
              {filterOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setFilter(option)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors whitespace-nowrap",
                    filter === option
                      ? "bg-white shadow-sm text-zinc-900 border border-zinc-200"
                      : "text-zinc-500 hover:text-zinc-700"
                  )}
                >
                  {option.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex items-center bg-white border border-zinc-200 px-3 py-2 rounded-lg">
              <Search className="w-4 h-4 text-zinc-400 mr-2" />
              <input
                type="text"
                placeholder="Search candidates..."
                className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-40 text-zinc-700 placeholder-zinc-400"
              />
            </div>
            <button className="p-2 bg-white border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Candidates Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserSearch className="w-8 h-8" />}
            title="No sourced candidates yet"
            description="Start sourcing candidates by searching or manually adding them."
            action={
              <Link href="/sourcing/new">
                <Button icon={<Plus className="w-4 h-4" />}>
                  Add Your First Candidate
                </Button>
              </Link>
            }
          />
        </Card>
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
