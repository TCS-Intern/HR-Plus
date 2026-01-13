"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  MapPin,
  Clock,
  Users,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job } from "@/types";
import { supabase } from "@/lib/supabase/client";

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-green-100 text-green-600",
  paused: "bg-amber-100 text-amber-600",
  closed: "bg-red-100 text-red-600",
  filled: "bg-blue-100 text-blue-600",
};

function JobCard({ job }: { job: Job }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="glass-card rounded-2xl p-5 hover:shadow-lg transition-all group"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors">
            {job.title}
          </h3>
          <p className="text-sm text-slate-500">{job.department}</p>
        </div>
        <span
          className={cn(
            "px-3 py-1 rounded-full text-xs font-semibold capitalize",
            statusColors[job.status] || statusColors.draft
          )}
        >
          {job.status}
        </span>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        {job.location && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="w-3 h-3" />
            {job.location}
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Clock className="w-3 h-3" />
          {job.job_type}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          {job.remote_policy}
        </div>
      </div>

      {job.skills_matrix?.required && job.skills_matrix.required.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {job.skills_matrix.required.slice(0, 3).map((skill) => (
            <span
              key={skill.skill}
              className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-medium rounded-lg"
            >
              {skill.skill}
            </span>
          ))}
          {job.skills_matrix.required.length > 3 && (
            <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-medium rounded-lg">
              +{job.skills_matrix.required.length - 3} more
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Users className="w-3 h-3" />
          <span>0 applicants</span>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
      </div>
    </Link>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchJobs() {
      const query = supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query.eq("status", filter);
      }

      const { data, error } = await query;

      if (!error && data) {
        setJobs(data as Job[]);
      }
      setLoading(false);
    }

    fetchJobs();
  }, [filter]);

  const filterOptions = ["all", "draft", "active", "paused", "closed", "filled"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Jobs</h1>
          <p className="text-sm text-slate-500">Manage job requisitions and descriptions</p>
        </div>
        <Link
          href="/jobs/new"
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Job
        </Link>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 p-1 rounded-xl">
          {filterOptions.map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all",
                filter === option
                  ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex items-center bg-white/60 dark:bg-slate-800/60 px-3 py-2 rounded-xl">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="text"
              placeholder="Search jobs..."
              className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-40 text-slate-800 dark:text-white placeholder-slate-400"
            />
          </div>
          <button className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-slate-600 dark:text-slate-300">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Jobs Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="glass-card rounded-2xl p-5 animate-pulse"
            >
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded mb-2 w-3/4" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded mb-4 w-1/2" />
              <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
            No jobs yet
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            Create your first job description using our AI-powered JD Assist agent.
          </p>
          <Link
            href="/jobs/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Your First Job
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
