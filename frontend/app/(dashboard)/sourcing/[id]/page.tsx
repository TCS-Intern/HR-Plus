"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Briefcase,
  MapPin,
  Mail,
  Phone,
  Linkedin,
  Github,
  Globe,
  Star,
  Clock,
  CheckCircle,
  MessageSquare,
  Send,
  XCircle,
  Edit3,
  Trash2,
  UserPlus,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SourcedCandidate, Job, Campaign, OutreachMessage } from "@/types";
import { supabase } from "@/lib/supabase/client";
import { sourcingApi } from "@/lib/api/client";

const statusConfig: Record<
  string,
  { color: string; bgColor: string; label: string }
> = {
  new: { color: "text-blue-600", bgColor: "bg-blue-100", label: "New" },
  contacted: { color: "text-purple-600", bgColor: "bg-purple-100", label: "Contacted" },
  replied: { color: "text-indigo-600", bgColor: "bg-indigo-100", label: "Replied" },
  interested: { color: "text-green-600", bgColor: "bg-green-100", label: "Interested" },
  not_interested: { color: "text-slate-600", bgColor: "bg-slate-100", label: "Not Interested" },
  converted: { color: "text-emerald-600", bgColor: "bg-emerald-100", label: "Converted" },
  rejected: { color: "text-red-600", bgColor: "bg-red-100", label: "Rejected" },
};

const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  linkedin: Linkedin,
  github: Github,
  manual: User,
  other: Globe,
};

export default function SourcedCandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [candidate, setCandidate] = useState<SourcedCandidate | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notesEditing, setNotesEditing] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function fetchData() {
      // Fetch sourced candidate
      const { data: candidateData, error } = await supabase
        .from("sourced_candidates")
        .select("*")
        .eq("id", params.id)
        .single();

      if (!error && candidateData) {
        setCandidate(candidateData as SourcedCandidate);
        setNotes(candidateData.notes || "");

        // Fetch job
        const { data: jobData } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", candidateData.job_id)
          .single();

        if (jobData) {
          setJob(jobData as Job);
        }

        // Fetch outreach messages for this candidate
        const { data: messagesData } = await supabase
          .from("outreach_messages")
          .select("*, campaigns(*)")
          .eq("sourced_candidate_id", params.id)
          .order("created_at", { ascending: false });

        if (messagesData) {
          setMessages(messagesData as OutreachMessage[]);
        }

        // Fetch available campaigns for this job
        const { data: campaignsData } = await supabase
          .from("campaigns")
          .select("*")
          .eq("job_id", candidateData.job_id)
          .in("status", ["draft", "active", "paused"]);

        if (campaignsData) {
          setCampaigns(campaignsData as Campaign[]);
        }
      }
      setLoading(false);
    }

    fetchData();
  }, [params.id]);

  const handleStatusChange = async (newStatus: SourcedCandidate["status"]) => {
    if (!candidate) return;
    setActionLoading(newStatus);

    try {
      const { error } = await supabase
        .from("sourced_candidates")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", candidate.id);

      if (!error) {
        setCandidate({ ...candidate, status: newStatus });
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!candidate) return;

    try {
      const { error } = await supabase
        .from("sourced_candidates")
        .update({ notes, updated_at: new Date().toISOString() })
        .eq("id", candidate.id);

      if (!error) {
        setCandidate({ ...candidate, notes });
        setNotesEditing(false);
      }
    } catch (error) {
      console.error("Failed to save notes:", error);
    }
  };

  const handleConvertToApplication = async () => {
    if (!candidate) return;
    setActionLoading("convert");

    try {
      // Create candidate record
      const { data: newCandidate, error: candidateError } = await supabase
        .from("candidates")
        .insert({
          email: candidate.email || `${candidate.first_name.toLowerCase()}.${candidate.last_name.toLowerCase()}@unknown.com`,
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          phone: candidate.phone,
          linkedin_url: candidate.linkedin_url,
          source: "linkedin",
        })
        .select()
        .single();

      if (candidateError) throw candidateError;

      // Create application
      const { error: applicationError } = await supabase
        .from("applications")
        .insert({
          job_id: candidate.job_id,
          candidate_id: newCandidate.id,
          status: "new",
          current_stage: "sourced",
        });

      if (applicationError) throw applicationError;

      // Update sourced candidate status
      await supabase
        .from("sourced_candidates")
        .update({ status: "converted", updated_at: new Date().toISOString() })
        .eq("id", candidate.id);

      setCandidate({ ...candidate, status: "converted" });

      // Redirect to job candidates page
      router.push(`/jobs/${candidate.job_id}?tab=candidates`);
    } catch (error) {
      console.error("Failed to convert:", error);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass-card rounded-2xl p-6 animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="glass-card rounded-3xl p-12 text-center">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
          Candidate not found
        </h3>
        <Link href="/jobs" className="text-primary hover:underline">
          Back to jobs
        </Link>
      </div>
    );
  }

  const status = statusConfig[candidate.status] || statusConfig.new;
  const PlatformIcon = platformIcons[candidate.source_platform] || Globe;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            {candidate.first_name} {candidate.last_name}
          </h1>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            {candidate.current_title && <span>{candidate.current_title}</span>}
            {candidate.current_company && (
              <>
                <span>at</span>
                <span className="font-medium">{candidate.current_company}</span>
              </>
            )}
          </div>
        </div>
        <span
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-semibold",
            status.bgColor,
            status.color
          )}
        >
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
              Profile
            </h2>

            <div className="flex items-start gap-6 mb-6">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
                {candidate.first_name.charAt(0)}
                {candidate.last_name.charAt(0)}
              </div>

              <div className="flex-1 space-y-2">
                {candidate.location && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <MapPin className="w-4 h-4" />
                    {candidate.location}
                  </div>
                )}
                {candidate.years_experience !== null && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Briefcase className="w-4 h-4" />
                    {candidate.years_experience} years experience
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <PlatformIcon className="w-4 h-4" />
                  Sourced from {candidate.source_platform}
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {candidate.email && (
                <a
                  href={`mailto:${candidate.email}`}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Mail className="w-4 h-4" />
                  {candidate.email}
                </a>
              )}
              {candidate.phone && (
                <a
                  href={`tel:${candidate.phone}`}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Phone className="w-4 h-4" />
                  {candidate.phone}
                </a>
              )}
              {candidate.linkedin_url && (
                <a
                  href={candidate.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <Linkedin className="w-4 h-4" />
                  LinkedIn Profile
                </a>
              )}
              {candidate.github_url && (
                <a
                  href={candidate.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200 hover:underline"
                >
                  <Github className="w-4 h-4" />
                  GitHub Profile
                </a>
              )}
              {candidate.portfolio_url && (
                <a
                  href={candidate.portfolio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-purple-600 hover:underline"
                >
                  <Globe className="w-4 h-4" />
                  Portfolio
                </a>
              )}
            </div>

            {/* Skills */}
            {candidate.skills && candidate.skills.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {candidate.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-lg"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Fit Score */}
          {candidate.fit_score !== null && (
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                  Fit Analysis
                </h2>
                <div
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl font-bold",
                    candidate.fit_score >= 80
                      ? "bg-green-100 text-green-700"
                      : candidate.fit_score >= 60
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                  )}
                >
                  <Star className="w-4 h-4" />
                  {candidate.fit_score}% Match
                </div>
              </div>

              {candidate.fit_reasoning && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {candidate.fit_reasoning}
                </p>
              )}
            </div>
          )}

          {/* Outreach History */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
              Outreach History
            </h2>

            {messages.length > 0 ? (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-lg text-xs font-medium",
                            message.status === "replied"
                              ? "bg-green-100 text-green-600"
                              : message.status === "opened"
                              ? "bg-purple-100 text-purple-600"
                              : message.status === "sent"
                              ? "bg-blue-100 text-blue-600"
                              : "bg-slate-100 text-slate-600"
                          )}
                        >
                          {message.status}
                        </span>
                        <span className="text-xs text-slate-500">
                          Step {message.step_number}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {message.sent_at
                          ? new Date(message.sent_at).toLocaleDateString()
                          : "Pending"}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-slate-800 dark:text-white mb-1">
                      {message.subject_line}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                      {message.personalized_body || message.message_body}
                    </p>
                    {message.reply_content && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <div className="text-xs font-medium text-green-600 mb-1">
                          Reply:
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {message.reply_content}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No outreach sent yet</p>
                <p className="text-sm text-slate-400">
                  Add to a campaign to start outreach
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                Notes
              </h2>
              {!notesEditing && (
                <button
                  onClick={() => setNotesEditing(true)}
                  className="text-primary text-sm hover:underline flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  Edit
                </button>
              )}
            </div>

            {notesEditing ? (
              <div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 bg-white/60 dark:bg-slate-800/60 border-none rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Add notes about this candidate..."
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => {
                      setNotes(candidate.notes || "");
                      setNotesEditing(false);
                    }}
                    className="px-4 py-2 text-slate-600 dark:text-slate-400 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    className="px-4 py-2 bg-primary text-white text-sm rounded-xl hover:bg-primary/90"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {candidate.notes || "No notes yet"}
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-bold text-slate-800 dark:text-white mb-4">
              Actions
            </h3>

            <div className="space-y-3">
              {candidate.status === "new" && (
                <button
                  onClick={() => handleStatusChange("contacted")}
                  disabled={actionLoading !== null}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {actionLoading === "contacted" ? "Updating..." : "Mark as Contacted"}
                </button>
              )}

              {candidate.status === "contacted" && (
                <button
                  onClick={() => handleStatusChange("replied")}
                  disabled={actionLoading !== null}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
                >
                  <MessageSquare className="w-4 h-4" />
                  {actionLoading === "replied" ? "Updating..." : "Mark as Replied"}
                </button>
              )}

              {(candidate.status === "replied" || candidate.status === "new") && (
                <button
                  onClick={() => handleStatusChange("interested")}
                  disabled={actionLoading !== null}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {actionLoading === "interested" ? "Updating..." : "Mark as Interested"}
                </button>
              )}

              {candidate.status === "interested" && (
                <button
                  onClick={handleConvertToApplication}
                  disabled={actionLoading !== null}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  {actionLoading === "convert" ? "Converting..." : "Convert to Candidate"}
                </button>
              )}

              {candidate.status !== "rejected" && candidate.status !== "converted" && (
                <button
                  onClick={() => handleStatusChange("not_interested")}
                  disabled={actionLoading !== null}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Not Interested
                </button>
              )}
            </div>
          </div>

          {/* Target Job */}
          {job && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4">
                Target Job
              </h3>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-white">
                      {job.title}
                    </h4>
                    <p className="text-sm text-slate-500">{job.department}</p>
                  </div>
                </div>
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex items-center gap-1 text-primary text-sm hover:underline"
                >
                  View Job Details
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          {/* Add to Campaign */}
          {campaigns.length > 0 && candidate.status !== "converted" && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4">
                Available Campaigns
              </h3>

              <div className="space-y-2">
                {campaigns.map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/campaigns/${campaign.id}`}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-800 dark:text-white">
                        {campaign.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {campaign.sequence?.length || 0} steps
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-bold text-slate-800 dark:text-white mb-4">
              Timeline
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Sourced</span>
                <span className="text-slate-800 dark:text-white">
                  {new Date(candidate.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last Updated</span>
                <span className="text-slate-800 dark:text-white">
                  {new Date(candidate.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
