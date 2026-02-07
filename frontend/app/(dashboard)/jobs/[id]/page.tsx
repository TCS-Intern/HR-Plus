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
  X,
  Save,
  Trash2,
  StopCircle,
  RotateCcw,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { Job, SourcedCandidate, Campaign, Application, Skill } from "@/types";
import { supabase } from "@/lib/supabase/client";
import { jdApi, phoneScreenApi, sourcingApi } from "@/lib/api/client";
import { toast } from "sonner";
import CandidateApprovalModal from "@/components/jd/CandidateApprovalModal";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";

const statusBadgeVariant: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  draft: "default",
  active: "success",
  paused: "warning",
  closed: "error",
  filled: "info",
};

const candidateStatusBadgeVariant: Record<string, "info" | "purple" | "warning" | "success" | "error"> = {
  new: "info",
  contacted: "purple",
  replied: "warning",
  interested: "success",
  converted: "success",
  rejected: "error",
};

const campaignStatusBadgeVariant: Record<string, "default" | "success" | "warning" | "info"> = {
  draft: "default",
  active: "success",
  paused: "warning",
  completed: "info",
};

type TabType = "overview" | "sourcing" | "campaigns" | "candidates";

const tabDefinitions: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: Briefcase },
  { id: "sourcing", label: "Sourcing", icon: UserSearch },
  { id: "campaigns", label: "Campaigns", icon: Mail },
  { id: "candidates", label: "Candidates", icon: Users },
];

const proficiencyLevels: Skill["proficiency"][] = ["beginner", "intermediate", "advanced", "expert"];

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = params.id as string;
  const initialTab = (searchParams.get("tab") as TabType) || "overview";

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [editMode, setEditMode] = useState(false);

  // Tab-specific data
  const [sourcedCandidates, setSourcedCandidates] = useState<SourcedCandidate[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Counts for badges
  const [counts, setCounts] = useState({ sourced: 0, campaigns: 0, candidates: 0 });

  // Edit form state
  const [editedJob, setEditedJob] = useState<Partial<Job>>({});

  // Candidate approval modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    async function fetchJob() {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (!error && data) {
        setJob(data as Job);
        setEditedJob(data as Job);
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
      // Call the new endpoint that approves and searches for candidates
      const response = await jdApi.approveWithSourcing(job.id, {
        platforms: ["linkedin", "indeed", "github"],
        limit: 20,
      });

      const { job: updatedJob, sourced_candidates } = response.data;

      // Update job status
      setJob({ ...job, ...updatedJob, status: "active" });

      // Show modal with sourced candidates if any were found
      if (sourced_candidates.results && sourced_candidates.results.length > 0) {
        setSearchResults(sourced_candidates.results);
        setShowApprovalModal(true);
        toast.success(`Job approved! Found ${sourced_candidates.total_found} potential candidates`);
      } else {
        toast.success("Job approved and now active!");
      }
    } catch (error) {
      console.error("Error approving job:", error);
      toast.error("Failed to approve job");
    } finally {
      setApproving(false);
    }
  };

  const handleApproveCandidates = async (selectedIds: string[]) => {
    if (!job) return;

    try {
      // Filter selected candidates from search results by index
      // (since we're using temporary IDs like "search-0", "search-1", etc.)
      const selectedCandidates = searchResults.filter((result, idx) => {
        const tempId = `search-${idx}`;
        return selectedIds.includes(tempId);
      });

      // Import selected candidates
      await sourcingApi.import({
        job_id: job.id,
        results: selectedCandidates,
        auto_score: true, // Automatically score imported candidates
      });

      toast.success(`${selectedIds.length} candidates added to pipeline!`);

      // Refresh sourced candidates tab if user navigates to it
      setCounts((prev) => ({ ...prev, sourced: prev.sourced + selectedIds.length }));

      // Close modal
      setShowApprovalModal(false);
      setSearchResults([]);
    } catch (error) {
      console.error("Error importing candidates:", error);
      toast.error("Failed to import candidates");
      throw error; // Re-throw so modal can handle it
    }
  };

  const handleStatusChange = async (newStatus: Job["status"]) => {
    if (!job) return;

    setStatusUpdating(true);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", job.id);

      if (error) throw error;

      setJob({ ...job, status: newStatus });
      toast.success(`Job status updated to ${newStatus}`);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update job status");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!job || !editedJob) return;

    setStatusUpdating(true);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({
          title: editedJob.title,
          department: editedJob.department,
          location: editedJob.location,
          job_type: editedJob.job_type,
          remote_policy: editedJob.remote_policy,
          summary: editedJob.summary,
          description: editedJob.description,
          responsibilities: editedJob.responsibilities,
          skills_matrix: editedJob.skills_matrix,
          salary_range: editedJob.salary_range,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (error) throw error;

      setJob({ ...job, ...editedJob } as Job);
      setEditMode(false);
      toast.success("Job updated successfully!");
    } catch (error) {
      console.error("Error updating job:", error);
      toast.error("Failed to update job");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedJob(job || {});
    setEditMode(false);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
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
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">
          Job not found
        </h2>
        <Link href="/jobs" className="text-accent hover:underline text-sm">
          Back to jobs
        </Link>
      </div>
    );
  }

  const tabItems = tabDefinitions.map((tab) => ({
    id: tab.id,
    label: tab.label,
    count:
      tab.id === "sourcing"
        ? counts.sourced
        : tab.id === "campaigns"
        ? counts.campaigns
        : tab.id === "candidates"
        ? counts.candidates
        : undefined,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/jobs"
            className="p-2 bg-white border border-zinc-200 rounded-lg text-zinc-500 hover:text-accent hover:border-zinc-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-zinc-900">
                {job.title}
              </h1>
              <Badge variant={statusBadgeVariant[job.status] || "default"} dot>
                {job.status}
              </Badge>
            </div>
            <p className="text-sm text-zinc-500">{job.department}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Edit Mode Toggle */}
          {!editMode && (job.status === "draft" || job.status === "active" || job.status === "paused") && (
            <Button
              variant="secondary"
              onClick={() => setEditMode(true)}
              icon={<Edit2 className="w-4 h-4" />}
            >
              Edit
            </Button>
          )}

          {/* Save/Cancel when editing */}
          {editMode && (
            <>
              <Button
                variant="ghost"
                onClick={handleCancelEdit}
                icon={<X className="w-4 h-4" />}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveEdit}
                loading={statusUpdating}
                icon={!statusUpdating ? <Save className="w-4 h-4" /> : undefined}
              >
                Save Changes
              </Button>
            </>
          )}

          {/* Status Action Buttons */}
          {!editMode && (
            <>
              {job.status === "draft" && (
                <Button
                  variant="success"
                  size="lg"
                  onClick={handleApprove}
                  loading={approving}
                  icon={!approving ? <CheckCircle className="w-4 h-4" /> : undefined}
                >
                  Approve & Publish
                </Button>
              )}

              {job.status === "active" && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => handleStatusChange("paused")}
                    loading={statusUpdating}
                    icon={!statusUpdating ? <Pause className="w-4 h-4" /> : undefined}
                    className="text-amber-600 border-amber-200 hover:bg-amber-50"
                  >
                    Pause
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handleStatusChange("closed")}
                    disabled={statusUpdating}
                    icon={<StopCircle className="w-4 h-4" />}
                  >
                    Close
                  </Button>
                </>
              )}

              {job.status === "paused" && (
                <>
                  <Button
                    variant="success"
                    onClick={() => handleStatusChange("active")}
                    loading={statusUpdating}
                    icon={!statusUpdating ? <Play className="w-4 h-4" /> : undefined}
                  >
                    Resume
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handleStatusChange("closed")}
                    disabled={statusUpdating}
                    icon={<StopCircle className="w-4 h-4" />}
                  >
                    Close
                  </Button>
                </>
              )}

              {job.status === "closed" && (
                <Button
                  variant="primary"
                  onClick={() => handleStatusChange("active")}
                  loading={statusUpdating}
                  icon={!statusUpdating ? <RotateCcw className="w-4 h-4" /> : undefined}
                >
                  Reopen
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabItems}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab
          job={job}
          editMode={editMode}
          editedJob={editedJob}
          setEditedJob={setEditedJob}
        />
      )}
      {activeTab === "sourcing" && (
        <SourcingTab
          jobId={jobId}
          job={job}
          candidates={sourcedCandidates}
          loading={tabLoading}
          onCandidatesUpdated={async () => {
            // Refresh sourced candidates
            const { data } = await supabase
              .from("sourced_candidates")
              .select("*")
              .eq("job_id", jobId)
              .order("fit_score", { ascending: false, nullsFirst: false });
            if (data) {
              setSourcedCandidates(data as SourcedCandidate[]);
              setCounts((prev) => ({ ...prev, sourced: data.length }));
            }
          }}
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

// Overview Tab Component with Edit Mode
function OverviewTab({
  job,
  editMode,
  editedJob,
  setEditedJob
}: {
  job: Job;
  editMode: boolean;
  editedJob: Partial<Job>;
  setEditedJob: React.Dispatch<React.SetStateAction<Partial<Job>>>;
}) {
  const handleAddSkill = (type: "required" | "nice_to_have") => {
    const currentMatrix = editedJob.skills_matrix || { required: [], nice_to_have: [] };
    const newSkill: Skill = { skill: "", proficiency: "intermediate", weight: 1 };

    setEditedJob({
      ...editedJob,
      skills_matrix: {
        ...currentMatrix,
        [type]: [...(currentMatrix[type] || []), newSkill],
      },
    });
  };

  const handleUpdateSkill = (type: "required" | "nice_to_have", index: number, updates: Partial<Skill>) => {
    const currentMatrix = editedJob.skills_matrix || { required: [], nice_to_have: [] };
    const skills = [...(currentMatrix[type] || [])];
    skills[index] = { ...skills[index], ...updates };

    setEditedJob({
      ...editedJob,
      skills_matrix: {
        ...currentMatrix,
        [type]: skills,
      },
    });
  };

  const handleRemoveSkill = (type: "required" | "nice_to_have", index: number) => {
    const currentMatrix = editedJob.skills_matrix || { required: [], nice_to_have: [] };
    const skills = [...(currentMatrix[type] || [])];
    skills.splice(index, 1);

    setEditedJob({
      ...editedJob,
      skills_matrix: {
        ...currentMatrix,
        [type]: skills,
      },
    });
  };

  const handleAddResponsibility = () => {
    setEditedJob({
      ...editedJob,
      responsibilities: [...(editedJob.responsibilities || []), ""],
    });
  };

  const handleUpdateResponsibility = (index: number, value: string) => {
    const responsibilities = [...(editedJob.responsibilities || [])];
    responsibilities[index] = value;
    setEditedJob({ ...editedJob, responsibilities });
  };

  const handleRemoveResponsibility = (index: number) => {
    const responsibilities = [...(editedJob.responsibilities || [])];
    responsibilities.splice(index, 1);
    setEditedJob({ ...editedJob, responsibilities });
  };

  const inputClass = "w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-zinc-300 focus:border-zinc-400 transition-colors";

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Main Content */}
      <div className="col-span-12 lg:col-span-8 space-y-6">
        {/* Quick Info */}
        <Card>
          {editMode ? (
            <div className="space-y-4">
              <CardHeader title="Job Details" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Title</label>
                  <input
                    type="text"
                    value={editedJob.title || ""}
                    onChange={(e) => setEditedJob({ ...editedJob, title: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Department</label>
                  <input
                    type="text"
                    value={editedJob.department || ""}
                    onChange={(e) => setEditedJob({ ...editedJob, department: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Location</label>
                  <input
                    type="text"
                    value={editedJob.location || ""}
                    onChange={(e) => setEditedJob({ ...editedJob, location: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Job Type</label>
                  <select
                    value={editedJob.job_type || "full-time"}
                    onChange={(e) => setEditedJob({ ...editedJob, job_type: e.target.value as Job["job_type"] })}
                    className={inputClass}
                  >
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Remote Policy</label>
                  <select
                    value={editedJob.remote_policy || "hybrid"}
                    onChange={(e) => setEditedJob({ ...editedJob, remote_policy: e.target.value as Job["remote_policy"] })}
                    className={inputClass}
                  >
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">Onsite</option>
                  </select>
                </div>
              </div>

              {/* Salary Range Editor */}
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Salary Range</label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <input
                      type="number"
                      placeholder="Min"
                      value={editedJob.salary_range?.min || ""}
                      onChange={(e) => setEditedJob({
                        ...editedJob,
                        salary_range: {
                          ...editedJob.salary_range,
                          min: e.target.value ? parseInt(e.target.value) : null,
                          max: editedJob.salary_range?.max || null,
                          currency: editedJob.salary_range?.currency || "USD",
                        },
                      })}
                      className={inputClass}
                    />
                  </div>
                  <span className="text-zinc-400">-</span>
                  <div className="flex-1">
                    <input
                      type="number"
                      placeholder="Max"
                      value={editedJob.salary_range?.max || ""}
                      onChange={(e) => setEditedJob({
                        ...editedJob,
                        salary_range: {
                          ...editedJob.salary_range,
                          min: editedJob.salary_range?.min || null,
                          max: e.target.value ? parseInt(e.target.value) : null,
                          currency: editedJob.salary_range?.currency || "USD",
                        },
                      })}
                      className={inputClass}
                    />
                  </div>
                  <select
                    value={editedJob.salary_range?.currency || "USD"}
                    onChange={(e) => setEditedJob({
                      ...editedJob,
                      salary_range: {
                        ...editedJob.salary_range,
                        min: editedJob.salary_range?.min || null,
                        max: editedJob.salary_range?.max || null,
                        currency: e.target.value,
                      },
                    })}
                    className="px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-zinc-300 focus:border-zinc-400 transition-colors"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {job.location && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent-50 rounded-lg flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Location</p>
                    <p className="text-sm font-semibold text-zinc-900">
                      {job.location}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Type</p>
                  <p className="text-sm font-semibold text-zinc-900 capitalize">
                    {job.job_type} - {job.remote_policy}
                  </p>
                </div>
              </div>
              {(job.salary_range?.min || job.salary_range?.max) && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Salary Range</p>
                    <p className="text-sm font-semibold text-zinc-900">
                      {job.salary_range.min && formatCurrency(job.salary_range.min)} -{" "}
                      {job.salary_range.max && formatCurrency(job.salary_range.max)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Description */}
        <Card>
          <CardHeader title="Job Description" />
          {editMode ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Summary</label>
                <textarea
                  value={editedJob.summary || ""}
                  onChange={(e) => setEditedJob({ ...editedJob, summary: e.target.value })}
                  rows={2}
                  className={cn(inputClass, "resize-none")}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Full Description</label>
                <textarea
                  value={editedJob.description || ""}
                  onChange={(e) => setEditedJob({ ...editedJob, description: e.target.value })}
                  rows={8}
                  className={cn(inputClass, "resize-none")}
                />
              </div>
            </div>
          ) : (
            <>
              {job.summary && (
                <p className="text-sm text-zinc-600 mb-4 p-4 bg-zinc-50 rounded-lg">
                  {job.summary}
                </p>
              )}
              <div className="prose prose-sm max-w-none">
                <p className="text-zinc-700 whitespace-pre-line">
                  {job.description}
                </p>
              </div>
            </>
          )}
        </Card>

        {/* Responsibilities */}
        <Card>
          <CardHeader
            title="Key Responsibilities"
            action={
              editMode ? (
                <button
                  onClick={handleAddResponsibility}
                  className="flex items-center gap-1 px-3 py-1.5 bg-accent-50 text-primary rounded-lg text-xs font-medium hover:bg-accent-100 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              ) : undefined
            }
          />
          {editMode ? (
            <div className="space-y-2">
              {(editedJob.responsibilities || []).map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-accent-50 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{i + 1}</span>
                  </div>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => handleUpdateResponsibility(i, e.target.value)}
                    className={cn(inputClass, "flex-1")}
                  />
                  <button
                    onClick={() => handleRemoveResponsibility(i)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {(!editedJob.responsibilities || editedJob.responsibilities.length === 0) && (
                <p className="text-sm text-zinc-400 text-center py-4">No responsibilities added</p>
              )}
            </div>
          ) : (
            <ul className="space-y-3">
              {(job.responsibilities || []).map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-accent-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">{i + 1}</span>
                  </div>
                  <span className="text-sm text-zinc-700">
                    {item}
                  </span>
                </li>
              ))}
              {(!job.responsibilities || job.responsibilities.length === 0) && (
                <p className="text-sm text-zinc-400 text-center py-4">No responsibilities listed</p>
              )}
            </ul>
          )}
        </Card>
      </div>

      {/* Sidebar */}
      <div className="col-span-12 lg:col-span-4 space-y-6">
        {/* Skills Matrix */}
        <Card>
          <CardHeader title="Skills Matrix" />

          {/* Required Skills */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-zinc-500">Required Skills</p>
              {editMode && (
                <button
                  onClick={() => handleAddSkill("required")}
                  className="flex items-center gap-1 px-2 py-1 bg-accent-50 text-primary rounded text-xs font-medium hover:bg-accent-100 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              )}
            </div>
            {editMode ? (
              <div className="space-y-2">
                {(editedJob.skills_matrix?.required || []).map((skill, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={skill.skill}
                      onChange={(e) => handleUpdateSkill("required", i, { skill: e.target.value })}
                      placeholder="Skill name"
                      className="flex-1 px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs focus:ring-2 focus:ring-zinc-300 focus:border-zinc-400 transition-colors"
                    />
                    <select
                      value={skill.proficiency}
                      onChange={(e) => handleUpdateSkill("required", i, { proficiency: e.target.value as Skill["proficiency"] })}
                      className="px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs focus:ring-2 focus:ring-zinc-300 focus:border-zinc-400 transition-colors"
                    >
                      {proficiencyLevels.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemoveSkill("required", i)}
                      className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {(!editedJob.skills_matrix?.required || editedJob.skills_matrix.required.length === 0) && (
                  <p className="text-xs text-zinc-400 text-center py-2">No required skills</p>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(job.skills_matrix?.required || []).map((skill, i) => (
                  <Badge
                    key={i}
                    variant="primary"
                  >
                    {skill.skill}
                  </Badge>
                ))}
                {(!job.skills_matrix?.required || job.skills_matrix.required.length === 0) && (
                  <p className="text-xs text-zinc-400">No required skills listed</p>
                )}
              </div>
            )}
          </div>

          {/* Nice to Have Skills */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-zinc-500">Nice to Have</p>
              {editMode && (
                <button
                  onClick={() => handleAddSkill("nice_to_have")}
                  className="flex items-center gap-1 px-2 py-1 bg-zinc-100 text-zinc-600 rounded text-xs font-medium hover:bg-zinc-200 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              )}
            </div>
            {editMode ? (
              <div className="space-y-2">
                {(editedJob.skills_matrix?.nice_to_have || []).map((skill, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={skill.skill}
                      onChange={(e) => handleUpdateSkill("nice_to_have", i, { skill: e.target.value })}
                      placeholder="Skill name"
                      className="flex-1 px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs focus:ring-2 focus:ring-zinc-300 focus:border-zinc-400 transition-colors"
                    />
                    <select
                      value={skill.proficiency}
                      onChange={(e) => handleUpdateSkill("nice_to_have", i, { proficiency: e.target.value as Skill["proficiency"] })}
                      className="px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs focus:ring-2 focus:ring-zinc-300 focus:border-zinc-400 transition-colors"
                    >
                      {proficiencyLevels.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemoveSkill("nice_to_have", i)}
                      className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {(!editedJob.skills_matrix?.nice_to_have || editedJob.skills_matrix.nice_to_have.length === 0) && (
                  <p className="text-xs text-zinc-400 text-center py-2">No nice to have skills</p>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(job.skills_matrix?.nice_to_have || []).map((skill, i) => (
                  <Badge key={i} variant="default">
                    {skill.skill}
                  </Badge>
                ))}
                {(!job.skills_matrix?.nice_to_have || job.skills_matrix.nice_to_have.length === 0) && (
                  <p className="text-xs text-zinc-400">No nice to have skills listed</p>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Evaluation Criteria */}
        {job.evaluation_criteria && job.evaluation_criteria.length > 0 && (
          <Card>
            <CardHeader title="Evaluation Criteria" />
            <div className="space-y-4">
              {job.evaluation_criteria.map((criterion, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-zinc-700">
                      {criterion.criterion}
                    </span>
                    <span className="text-xs text-zinc-500">{criterion.weight}%</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${criterion.weight}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// Sourcing Tab Component
function SourcingTab({
  jobId,
  job,
  candidates,
  loading,
  onCandidatesUpdated,
}: {
  jobId: string;
  job: Job | null;
  candidates: SourcedCandidate[];
  loading: boolean;
  onCandidatesUpdated: () => void;
}) {
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SourcedCandidate[]>([]);
  const [showModal, setShowModal] = useState(false);

  const handleSourceCandidates = async () => {
    if (!job) return;

    setSearching(true);
    try {
      const response = await sourcingApi.search({
        job_id: jobId,
        platforms: ["linkedin", "github"],
        limit: 20,
      });

      const results = response.data?.results || [];
      if (results.length > 0) {
        // Transform results to match SourcedCandidate type with temporary IDs
        const transformedResults = results.map((r: Record<string, unknown>, idx: number) => ({
          id: `search-${idx}`,
          job_id: jobId,
          company_id: null,
          first_name: r.first_name as string || "",
          last_name: r.last_name as string || "",
          email: r.email as string || null,
          phone: null,
          current_title: r.current_title as string || r.headline as string || "",
          current_company: r.current_company as string || "",
          location: r.location as string || "",
          experience_years: r.experience_years as number || null,
          headline: r.headline as string || null,
          summary: r.summary as string || null,
          profile_picture_url: null,
          skills: r.skills as string[] || [],
          fit_score: null,
          fit_analysis: null,
          source: r.platform as string || "linkedin",
          source_url: r.profile_url as string || null,
          source_data: r.raw_data as Record<string, unknown> || null,
          status: "new" as const,
          email_status: null,
          email_found_via: null,
          sourced_at: null,
          contacted_at: null,
          responded_at: null,
          converted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        setSearchResults(transformedResults);
        setShowModal(true);
        toast.success(`Found ${results.length} potential candidates`);
      } else {
        toast.info("No candidates found. Try adjusting your job requirements.");
      }
    } catch (error) {
      console.error("Error sourcing candidates:", error);
      toast.error("Failed to source candidates");
    } finally {
      setSearching(false);
    }
  };

  const handleImportCandidates = async (selectedIds: string[]) => {
    try {
      // Get selected candidates and transform back to search result format
      const selectedCandidates = searchResults
        .filter((_, idx) => selectedIds.includes(`search-${idx}`))
        .map((c) => ({
          platform: c.source || "linkedin",
          profile_url: c.source_url || "",
          first_name: c.first_name || "",
          last_name: c.last_name || "",
          headline: c.headline || c.current_title || null,
          current_company: c.current_company || null,
          current_title: c.current_title || null,
          location: c.location || null,
          summary: c.summary || null,
          skills: c.skills || [],
          experience_years: c.experience_years || null,
          raw_data: c.source_data || null,
        }));

      await sourcingApi.import({
        job_id: jobId,
        results: selectedCandidates,
        auto_score: true,
      });

      toast.success(`${selectedIds.length} candidates added to pipeline!`);
      setShowModal(false);
      setSearchResults([]);
      onCandidatesUpdated();
    } catch (error) {
      console.error("Error importing candidates:", error);
      toast.error("Failed to import candidates");
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
        <p className="text-sm text-zinc-500">{candidates.length} sourced candidates</p>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={handleSourceCandidates}
            loading={searching}
            icon={!searching ? <UserSearch className="w-4 h-4" /> : undefined}
          >
            {searching ? "Searching..." : "Source Candidates"}
          </Button>
          <Link href={`/sourcing?job=${jobId}`}>
            <Button
              variant="secondary"
              icon={<Plus className="w-4 h-4" />}
            >
              Add Manually
            </Button>
          </Link>
        </div>
      </div>

      {/* Search Results Modal */}
      <CandidateApprovalModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSearchResults([]);
        }}
        candidates={searchResults}
        onApprove={handleImportCandidates}
        jobTitle={job?.title || ""}
      />

      {candidates.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserSearch className="w-8 h-8" />}
            title="No sourced candidates yet"
            description="Start sourcing candidates for this job"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {candidates.map((candidate) => (
            <Link
              key={candidate.id}
              href={`/sourcing/${candidate.id}`}
            >
              <Card hover>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-zinc-900">
                      {candidate.first_name} {candidate.last_name}
                    </h4>
                    <p className="text-sm text-zinc-500">{candidate.current_title}</p>
                  </div>
                  <Badge variant={candidateStatusBadgeVariant[candidate.status] || "info"}>
                    {candidate.status.replace("_", " ")}
                  </Badge>
                </div>

                {candidate.fit_score !== null && (
                  <div className="flex items-center gap-1 mb-3">
                    <Star className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-bold text-zinc-700">
                      {candidate.fit_score}% fit
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                  <div className="flex gap-2">
                    {candidate.source === "linkedin" && candidate.source_url && (
                      <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                        <Linkedin className="w-3 h-3" />
                      </span>
                    )}
                    {candidate.source === "github" && candidate.source_url && (
                      <span className="p-1.5 bg-zinc-100 text-zinc-600 rounded-lg">
                        <Github className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-accent font-medium">
                    View Details
                  </span>
                </div>
              </Card>
            </Link>
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
        <p className="text-sm text-zinc-500">{campaigns.length} campaigns</p>
        <Link href={`/campaigns/new?job=${jobId}`}>
          <Button icon={<Plus className="w-4 h-4" />}>
            New Campaign
          </Button>
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Mail className="w-8 h-8" />}
            title="No campaigns yet"
            description="Create an outreach campaign for this job"
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/campaigns/${campaign.id}`}
            >
              <Card hover className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-zinc-900">
                      {campaign.name}
                    </h4>
                    <Badge
                      variant={campaignStatusBadgeVariant[campaign.status] || "default"}
                      dot
                    >
                      {campaign.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-500">
                    {campaign.sequence?.length || 0} steps - {campaign.total_recipients} recipients
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-lg font-bold text-zinc-900">
                      {campaign.messages_sent}
                    </div>
                    <div className="text-xs text-zinc-500">Sent</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-emerald-600">
                      {campaign.messages_sent > 0
                        ? ((campaign.messages_opened / campaign.messages_sent) * 100).toFixed(0)
                        : 0}
                      %
                    </div>
                    <div className="text-xs text-zinc-500">Opened</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">
                      {campaign.messages_replied}
                    </div>
                    <div className="text-xs text-zinc-500">Replied</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                </div>
              </Card>
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
        <p className="text-sm text-zinc-500">{applications.length} candidates</p>
        <Link href={`/jobs/${jobId}/candidates`}>
          <Button icon={<Upload className="w-4 h-4" />}>
            Upload CVs
          </Button>
        </Link>
      </div>

      {applications.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title="No candidates yet"
            description="Upload CVs to screen candidates"
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const candidate = app.candidate;
            return (
              <Card key={app.id} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar
                    name={candidate ? `${candidate.first_name} ${candidate.last_name}` : "?"}
                  />
                  <div>
                    <h4 className="font-semibold text-zinc-900">
                      {candidate
                        ? `${candidate.first_name} ${candidate.last_name}`
                        : "Unknown"}
                    </h4>
                    <p className="text-sm text-zinc-500">{candidate?.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {app.screening_score !== null && (
                    <div className="text-center">
                      <div className="text-lg font-bold text-zinc-900">
                        {app.screening_score}%
                      </div>
                      <div className="text-xs text-zinc-500">Score</div>
                    </div>
                  )}

                  <Badge
                    variant={
                      app.status === "offer"
                        ? "success"
                        : app.status === "rejected"
                        ? "error"
                        : "info"
                    }
                  >
                    {app.status}
                  </Badge>

                  {candidate?.phone && app.status !== "rejected" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleScheduleCall(app.id, candidate.phone!)}
                      loading={scheduling === app.id}
                      icon={scheduling !== app.id ? <Phone className="w-3 h-3" /> : undefined}
                      className="text-blue-600 hover:bg-blue-50"
                    >
                      Call
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
