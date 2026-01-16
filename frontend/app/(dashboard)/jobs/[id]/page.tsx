"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Edit2,
  CheckCircle,
  XCircle,
  MapPin,
  Clock,
  DollarSign,
  Users,
  Upload,
  Loader2,
  UserSearch,
  Mail,
  Phone,
  Star,
  Plus,
  Briefcase,
  Play,
  Pause,
  ChevronRight,
  Linkedin,
  Github,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { Job, SourcedCandidate, Campaign, Application } from "@/types";
import { supabase } from "@/lib/supabase/client";
import { jdApi, phoneScreenApi } from "@/lib/api/client";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-green-100 text-green-600",
  paused: "bg-amber-100 text-amber-600",
  closed: "bg-red-100 text-red-600",
  filled: "bg-blue-100 text-blue-600",
};

const candidateStatusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-600",
  contacted: "bg-purple-100 text-purple-600",
  replied: "bg-amber-100 text-amber-600",
  interested: "bg-green-100 text-green-600",
  converted: "bg-emerald-100 text-emerald-600",
  rejected: "bg-red-100 text-red-600",
};

const campaignStatusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-green-100 text-green-600",
  paused: "bg-amber-100 text-amber-600",
  completed: "bg-blue-100 text-blue-600",
};

type TabType = "overview" | "sourcing" | "campaigns" | "candidates";

const tabs: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: Briefcase },
  { id: "sourcing", label: "Sourcing", icon: UserSearch },
  { id: "campaigns", label: "Campaigns", icon: Mail },
  { id: "candidates", label: "Candidates", icon: Users },
];

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = params.id as string;
  const initialTab = (searchParams.get("tab") as TabType) || "overview";

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Tab-specific data
  const [sourcedCandidates, setSourcedCandidates] = useState<SourcedCandidate[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Counts for badges
  const [counts, setCounts] = useState({ sourced: 0, campaigns: 0, candidates: 0 });

  useEffect(() => {
    async function fetchJob() {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (!error && data) {
        setJob(data as Job);
      }

      // Fetch counts
      const [sourcedCount, campaignsCount, applicationsCount] = await Promise.all([
        supabase.from("sourced_candidates").select("id", { count: "exact" }).eq("job_id", jobId),
        supabase.from("campaigns").select("id", { count: "exact" }).eq("job_id", jobId),
        supabase.from("applications").select("id", { count: "exact" }).eq("job_id", jobId),
      ]);

      setCounts({
        sourced: sourcedCount.count || 0,
        campaigns: campaignsCount.count || 0,
        candidates: applicationsCount.count || 0,
      });

      setLoading(false);
    }

    if (jobId) {
      fetchJob();
    }
  }, [jobId]);

  useEffect(() => {
    async function fetchTabData() {
      if (!jobId || activeTab === "overview") return;

      setTabLoading(true);

      if (activeTab === "sourcing") {
        const { data } = await supabase
          .from("sourced_candidates")
          .select("*")
          .eq("job_id", jobId)
          .order("fit_score", { ascending: false, nullsFirst: false });
        setSourcedCandidates((data as SourcedCandidate[]) || []);
      } else if (activeTab === "campaigns") {
        const { data } = await supabase
          .from("campaigns")
          .select("*")
          .eq("job_id", jobId)
          .order("created_at", { ascending: false });
        setCampaigns((data as Campaign[]) || []);
      } else if (activeTab === "candidates") {
        const { data } = await supabase
          .from("applications")
          .select("*, candidates(*)")
          .eq("job_id", jobId)
          .order("screening_score", { ascending: false, nullsFirst: false });
        setApplications((data as Application[]) || []);
      }

      setTabLoading(false);
    }

    fetchTabData();
  }, [jobId, activeTab]);

  const handleApprove = async () => {
    if (!job) return;

    setApproving(true);
    try {
      await jdApi.approve(job.id);
      setJob({ ...job, status: "active" });
      toast.success("Job approved and now active!");
    } catch (error) {
      console.error("Error approving job:", error);
      toast.error("Failed to approve job");
    } finally {
      setApproving(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push(`/jobs/${jobId}?tab=${tab}`, { scroll: false });
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
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
          Job not found
        </h2>
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
            href="/jobs"
            className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-slate-600 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                {job.title}
              </h1>
              <span
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold capitalize",
                  statusColors[job.status] || statusColors.draft
                )}
              >
                {job.status}
              </span>
            </div>
            <p className="text-sm text-slate-500">{job.department}</p>
          </div>
        </div>

        <div className="flex gap-3">
          {job.status === "draft" && (
            <>
              <Link
                href={`/jobs/${job.id}/edit`}
                className="flex items-center gap-2 px-4 py-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white transition-all"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </Link>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex items-center gap-2 px-5 py-2 bg-green-500 text-white rounded-xl font-medium shadow-lg shadow-green-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {approving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Approve & Publish
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="glass-card rounded-2xl p-1.5 flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count =
            tab.id === "sourcing"
              ? counts.sourced
              : tab.id === "campaigns"
              ? counts.campaigns
              : tab.id === "candidates"
              ? counts.candidates
              : null;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-white/50"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {count !== null && count > 0 && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab job={job} />}
      {activeTab === "sourcing" && (
        <SourcingTab
          jobId={jobId}
          candidates={sourcedCandidates}
          loading={tabLoading}
        />
      )}
      {activeTab === "campaigns" && (
        <CampaignsTab
          jobId={jobId}
          campaigns={campaigns}
          loading={tabLoading}
        />
      )}
      {activeTab === "candidates" && (
        <CandidatesTab
          jobId={jobId}
          job={job}
          applications={applications}
          loading={tabLoading}
        />
      )}
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ job }: { job: Job }) {
  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Main Content */}
      <div className="col-span-12 lg:col-span-8 space-y-6">
        {/* Quick Info */}
        <div className="glass-card rounded-3xl p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {job.location && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Location</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">
                    {job.location}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Type</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-white capitalize">
                  {job.job_type} · {job.remote_policy}
                </p>
              </div>
            </div>
            {(job.salary_range?.min || job.salary_range?.max) && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Salary Range</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">
                    {job.salary_range.min && formatCurrency(job.salary_range.min)} -{" "}
                    {job.salary_range.max && formatCurrency(job.salary_range.max)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="glass-card rounded-3xl p-6">
          <h2 className="font-bold text-slate-800 dark:text-white mb-4">
            Job Description
          </h2>
          {job.summary && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 p-4 bg-primary/5 rounded-2xl">
              {job.summary}
            </p>
          )}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line">
              {job.description}
            </p>
          </div>
        </div>

        {/* Responsibilities */}
        {job.responsibilities && job.responsibilities.length > 0 && (
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-bold text-slate-800 dark:text-white mb-4">
              Key Responsibilities
            </h2>
            <ul className="space-y-3">
              {job.responsibilities.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">{i + 1}</span>
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="col-span-12 lg:col-span-4 space-y-6">
        {/* Skills Matrix */}
        {(job.skills_matrix?.required?.length > 0 ||
          job.skills_matrix?.nice_to_have?.length > 0) && (
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-bold text-slate-800 dark:text-white mb-4">
              Skills Matrix
            </h2>
            {job.skills_matrix?.required?.length > 0 && (
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
            {job.skills_matrix?.nice_to_have?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Nice to Have</p>
                <div className="flex flex-wrap gap-2">
                  {job.skills_matrix.nice_to_have.map((skill, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg"
                    >
                      {skill.skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Evaluation Criteria */}
        {job.evaluation_criteria && job.evaluation_criteria.length > 0 && (
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-bold text-slate-800 dark:text-white mb-4">
              Evaluation Criteria
            </h2>
            <div className="space-y-4">
              {job.evaluation_criteria.map((criterion, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {criterion.criterion}
                    </span>
                    <span className="text-xs text-slate-500">{criterion.weight}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${criterion.weight}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Sourcing Tab Component
function SourcingTab({
  jobId,
  candidates,
  loading,
}: {
  jobId: string;
  candidates: SourcedCandidate[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{candidates.length} sourced candidates</p>
        <Link
          href={`/sourcing?job=${jobId}`}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Candidate
        </Link>
      </div>

      {candidates.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <UserSearch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-800 dark:text-white mb-1">
            No sourced candidates yet
          </h3>
          <p className="text-sm text-slate-500">Start sourcing candidates for this job</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {candidates.map((candidate) => (
            <div
              key={candidate.id}
              className="glass-card rounded-2xl p-4 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-white">
                    {candidate.first_name} {candidate.last_name}
                  </h4>
                  <p className="text-sm text-slate-500">{candidate.current_title}</p>
                </div>
                <span
                  className={cn(
                    "px-2 py-1 rounded-full text-xs font-semibold capitalize",
                    candidateStatusColors[candidate.status] || candidateStatusColors.new
                  )}
                >
                  {candidate.status.replace("_", " ")}
                </span>
              </div>

              {candidate.fit_score !== null && (
                <div className="flex items-center gap-1 mb-3">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {candidate.fit_score}% fit
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                <div className="flex gap-2">
                  {candidate.linkedin_url && (
                    <a
                      href={candidate.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                    >
                      <Linkedin className="w-3 h-3" />
                    </a>
                  )}
                  {candidate.github_url && (
                    <a
                      href={candidate.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                    >
                      <Github className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <Link
                  href={`/sourcing/${candidate.id}`}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  View Details →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Campaigns Tab Component
function CampaignsTab({
  jobId,
  campaigns,
  loading,
}: {
  jobId: string;
  campaigns: Campaign[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{campaigns.length} campaigns</p>
        <Link
          href={`/campaigns/new?job=${jobId}`}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-800 dark:text-white mb-1">
            No campaigns yet
          </h3>
          <p className="text-sm text-slate-500">Create an outreach campaign for this job</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/campaigns/${campaign.id}`}
              className="glass-card rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-all"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-slate-800 dark:text-white">
                    {campaign.name}
                  </h4>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-semibold capitalize flex items-center gap-1",
                      campaignStatusColors[campaign.status] || campaignStatusColors.draft
                    )}
                  >
                    {campaign.status === "active" ? (
                      <Play className="w-3 h-3" />
                    ) : campaign.status === "paused" ? (
                      <Pause className="w-3 h-3" />
                    ) : null}
                    {campaign.status}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {campaign.sequence?.length || 0} steps · {campaign.total_recipients} recipients
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-lg font-bold text-slate-800 dark:text-white">
                    {campaign.messages_sent}
                  </div>
                  <div className="text-xs text-slate-500">Sent</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {campaign.messages_sent > 0
                      ? ((campaign.messages_opened / campaign.messages_sent) * 100).toFixed(0)
                      : 0}
                    %
                  </div>
                  <div className="text-xs text-slate-500">Opened</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">
                    {campaign.messages_replied}
                  </div>
                  <div className="text-xs text-slate-500">Replied</div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Candidates Tab Component
function CandidatesTab({
  jobId,
  job,
  applications,
  loading,
}: {
  jobId: string;
  job: Job;
  applications: Application[];
  loading: boolean;
}) {
  const [scheduling, setScheduling] = useState<string | null>(null);

  const handleScheduleCall = async (applicationId: string, phone: string) => {
    setScheduling(applicationId);
    try {
      await phoneScreenApi.schedule({
        application_id: applicationId,
        phone_number: phone,
      });
      toast.success("Phone screen scheduled!");
    } catch (error) {
      console.error("Error scheduling call:", error);
      toast.error("Failed to schedule call");
    } finally {
      setScheduling(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{applications.length} candidates</p>
        <Link
          href={`/jobs/${jobId}/candidates`}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:scale-105 active:scale-95 transition-all"
        >
          <Upload className="w-4 h-4" />
          Upload CVs
        </Link>
      </div>

      {applications.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-800 dark:text-white mb-1">
            No candidates yet
          </h3>
          <p className="text-sm text-slate-500">Upload CVs to screen candidates</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const candidate = app.candidate;
            return (
              <div
                key={app.id}
                className="glass-card rounded-2xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {candidate?.first_name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-white">
                      {candidate
                        ? `${candidate.first_name} ${candidate.last_name}`
                        : "Unknown"}
                    </h4>
                    <p className="text-sm text-slate-500">{candidate?.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {app.screening_score !== null && (
                    <div className="text-center">
                      <div className="text-lg font-bold text-slate-800 dark:text-white">
                        {app.screening_score}%
                      </div>
                      <div className="text-xs text-slate-500">Score</div>
                    </div>
                  )}

                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold capitalize",
                      app.status === "offer"
                        ? "bg-green-100 text-green-600"
                        : app.status === "rejected"
                        ? "bg-red-100 text-red-600"
                        : "bg-blue-100 text-blue-600"
                    )}
                  >
                    {app.status}
                  </span>

                  {candidate?.phone && app.status !== "rejected" && (
                    <button
                      onClick={() => handleScheduleCall(app.id, candidate.phone!)}
                      disabled={scheduling === app.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-200 transition-colors disabled:opacity-50"
                    >
                      {scheduling === app.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Phone className="w-3 h-3" />
                      )}
                      Call
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
