"use client";

import { useState, useEffect, useMemo } from "react";
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
  Target,
  Award,
  GraduationCap,
  Building2,
  ExternalLink,
  Plus,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SourcedCandidate, Job, Campaign, OutreachMessage } from "@/types";
import { supabase } from "@/lib/supabase/client";
import { sourcingApi } from "@/lib/api/client";
import { toast } from "sonner";
import { format } from "date-fns";

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

const platformConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string; label: string }> = {
  linkedin: { icon: Linkedin, color: "text-[#0A66C2]", bgColor: "bg-[#0A66C2]/10", label: "LinkedIn" },
  github: { icon: Github, color: "text-slate-800 dark:text-white", bgColor: "bg-slate-100 dark:bg-slate-800", label: "GitHub" },
  manual: { icon: User, color: "text-primary", bgColor: "bg-primary/10", label: "Manual Entry" },
  other: { icon: Globe, color: "text-purple-600", bgColor: "bg-purple-100", label: "Other" },
};

interface SkillMatch {
  skill: string;
  matched: boolean;
  required: boolean;
}

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
  const [showAddToCampaign, setShowAddToCampaign] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  // Compute skill matching
  const skillMatches = useMemo((): SkillMatch[] => {
    if (!candidate?.skills || !job?.skills_matrix) return [];

    const candidateSkillsLower = (candidate.skills || []).map(s => s.toLowerCase());
    const matches: SkillMatch[] = [];

    // Check required skills
    (job.skills_matrix.required || []).forEach(skill => {
      const skillName = typeof skill === 'string' ? skill : skill.skill;
      matches.push({
        skill: skillName,
        matched: candidateSkillsLower.includes(skillName.toLowerCase()),
        required: true,
      });
    });

    // Check nice-to-have skills
    (job.skills_matrix.nice_to_have || []).forEach(skill => {
      const skillName = typeof skill === 'string' ? skill : skill.skill;
      if (!matches.some(m => m.skill.toLowerCase() === skillName.toLowerCase())) {
        matches.push({
          skill: skillName,
          matched: candidateSkillsLower.includes(skillName.toLowerCase()),
          required: false,
        });
      }
    });

    // Add candidate skills that aren't in job requirements
    (candidate.skills || []).forEach(skill => {
      if (!matches.some(m => m.skill.toLowerCase() === skill.toLowerCase())) {
        matches.push({
          skill,
          matched: true,
          required: false,
        });
      }
    });

    return matches;
  }, [candidate?.skills, job?.skills_matrix]);

  const matchedRequiredCount = skillMatches.filter(m => m.required && m.matched).length;
  const totalRequiredCount = skillMatches.filter(m => m.required).length;
  const matchPercentage = totalRequiredCount > 0
    ? Math.round((matchedRequiredCount / totalRequiredCount) * 100)
    : 0;

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
          email: candidate.email || `${(candidate.first_name || "").toLowerCase()}.${(candidate.last_name || "").toLowerCase()}@unknown.com`,
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          phone: candidate.phone,
          linkedin_url: candidate.source === "linkedin" ? candidate.source_url : null,
          source: candidate.source,
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
      toast.success("Candidate converted successfully!");
      router.push(`/jobs/${candidate.job_id}?tab=candidates`);
    } catch (error) {
      console.error("Failed to convert:", error);
      toast.error("Failed to convert candidate");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddToCampaign = async () => {
    if (!candidate || !selectedCampaign) return;
    setActionLoading("addToCampaign");

    try {
      // Create first outreach message for this candidate
      const campaign = campaigns.find(c => c.id === selectedCampaign);
      if (!campaign || !campaign.sequence?.length) {
        toast.error("Campaign has no sequence defined");
        return;
      }

      const firstStep = campaign.sequence[0];
      const { error } = await supabase
        .from("outreach_messages")
        .insert({
          campaign_id: selectedCampaign,
          sourced_candidate_id: candidate.id,
          step_number: 1,
          subject_line: firstStep.subject_line,
          message_body: firstStep.message_body,
          status: "pending",
          scheduled_for: new Date().toISOString(),
        });

      if (error) throw error;

      // Update candidate status if still new
      if (candidate.status === "new") {
        await supabase
          .from("sourced_candidates")
          .update({ status: "contacted", updated_at: new Date().toISOString() })
          .eq("id", candidate.id);
        setCandidate({ ...candidate, status: "contacted" });
      }

      // Update campaign recipient count
      await supabase
        .from("campaigns")
        .update({ total_recipients: campaign.total_recipients + 1 })
        .eq("id", selectedCampaign);

      toast.success(`Added to "${campaign.name}" campaign`);
      setShowAddToCampaign(false);
      setSelectedCampaign(null);

      // Refresh messages
      const { data: messagesData } = await supabase
        .from("outreach_messages")
        .select("*, campaigns(*)")
        .eq("sourced_candidate_id", params.id)
        .order("created_at", { ascending: false });

      if (messagesData) {
        setMessages(messagesData as OutreachMessage[]);
      }
    } catch (error) {
      console.error("Failed to add to campaign:", error);
      toast.error("Failed to add to campaign");
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
  const platform = platformConfig[candidate.source] || platformConfig.other;
  const PlatformIcon = platform.icon;

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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              {candidate.first_name} {candidate.last_name}
            </h1>
            <span
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium",
                platform.bgColor,
                platform.color
              )}
            >
              <PlatformIcon className="w-3.5 h-3.5" />
              {platform.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
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
                {candidate.experience_years !== null && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Briefcase className="w-4 h-4" />
                    {candidate.experience_years} years experience
                  </div>
                )}
                {candidate.created_at && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Calendar className="w-4 h-4" />
                    Sourced on {format(new Date(candidate.created_at), "MMM d, yyyy")}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Match Score */}
            {totalRequiredCount > 0 && (
              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Skill Match Score
                    </span>
                  </div>
                  <span className={cn(
                    "text-lg font-bold",
                    matchPercentage >= 80 ? "text-green-600" :
                    matchPercentage >= 50 ? "text-amber-600" : "text-red-600"
                  )}>
                    {matchPercentage}%
                  </span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      matchPercentage >= 80 ? "bg-green-500" :
                      matchPercentage >= 50 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${matchPercentage}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {matchedRequiredCount} of {totalRequiredCount} required skills matched
                </p>
              </div>
            )}

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
              {candidate.source === "linkedin" && candidate.source_url && (
                <a
                  href={candidate.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <Linkedin className="w-4 h-4" />
                  LinkedIn Profile
                </a>
              )}
              {candidate.source === "github" && candidate.source_url && (
                <a
                  href={candidate.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200 hover:underline"
                >
                  <Github className="w-4 h-4" />
                  GitHub Profile
                </a>
              )}
              {candidate.source !== "linkedin" && candidate.source !== "github" && candidate.source_url && (
                <a
                  href={candidate.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-purple-600 hover:underline"
                >
                  <Globe className="w-4 h-4" />
                  View Profile
                </a>
              )}
            </div>

            {/* Skills with Matching */}
            {skillMatches.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Skills & Job Match
                </h3>

                {/* Required Skills */}
                {skillMatches.some(m => m.required) && (
                  <div className="mb-4">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                      Required Skills
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {skillMatches
                        .filter(m => m.required)
                        .map((match, idx) => (
                          <span
                            key={idx}
                            className={cn(
                              "px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors",
                              match.matched
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            )}
                          >
                            {match.matched ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                            {match.skill}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {/* Nice-to-have & Additional Skills */}
                {skillMatches.some(m => !m.required) && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                      Additional Skills
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {skillMatches
                        .filter(m => !m.required)
                        .map((match, idx) => (
                          <span
                            key={idx}
                            className={cn(
                              "px-3 py-1.5 text-xs font-medium rounded-lg",
                              match.matched
                                ? "bg-primary/10 text-primary"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            )}
                          >
                            {match.skill}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : candidate.skills && candidate.skills.length > 0 ? (
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
            ) : null}
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

              {candidate.fit_analysis?.reasoning && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {candidate.fit_analysis.reasoning}
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

          {/* Summary */}
          {candidate.summary && (
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
                Summary
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {candidate.summary}
              </p>
            </div>
          )}
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 dark:text-white">
                  Campaigns
                </h3>
                <button
                  onClick={() => setShowAddToCampaign(true)}
                  className="flex items-center gap-1 text-primary text-sm hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>

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
                        {campaign.sequence?.length || 0} steps - {campaign.status}
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
              {candidate.created_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Sourced</span>
                  <span className="text-slate-800 dark:text-white">
                    {format(new Date(candidate.created_at), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              {candidate.updated_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Updated</span>
                  <span className="text-slate-800 dark:text-white">
                    {format(new Date(candidate.updated_at), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              {candidate.status === "contacted" && messages.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">First Contact</span>
                  <span className="text-slate-800 dark:text-white">
                    {format(new Date(messages[messages.length - 1].created_at), "MMM d, yyyy")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add to Campaign Modal */}
      {showAddToCampaign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                Add to Campaign
              </h3>
              <button
                onClick={() => {
                  setShowAddToCampaign(false);
                  setSelectedCampaign(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-4">
              Select a campaign to add {candidate.first_name} to:
            </p>

            <div className="space-y-2 mb-6">
              {campaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  onClick={() => setSelectedCampaign(campaign.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl transition-all",
                    selectedCampaign === campaign.id
                      ? "bg-primary/10 border-2 border-primary"
                      : "bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <div className="text-left">
                    <div className="font-medium text-slate-800 dark:text-white">
                      {campaign.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {campaign.sequence?.length || 0} steps - {campaign.total_recipients} recipients
                    </div>
                  </div>
                  {selectedCampaign === campaign.id && (
                    <CheckCircle className="w-5 h-5 text-primary" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddToCampaign(false);
                  setSelectedCampaign(null);
                }}
                className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToCampaign}
                disabled={!selectedCampaign || actionLoading === "addToCampaign"}
                className={cn(
                  "flex-1 px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                  selectedCampaign
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                )}
              >
                <Send className="w-4 h-4" />
                {actionLoading === "addToCampaign" ? "Adding..." : "Add to Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
