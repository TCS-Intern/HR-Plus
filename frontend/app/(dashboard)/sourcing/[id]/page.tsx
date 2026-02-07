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
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { SkeletonCard } from "@/components/ui/skeleton";

const statusConfig: Record<
  string,
  { variant: "info" | "purple" | "default" | "success" | "error" | "warning"; label: string }
> = {
  new: { variant: "info", label: "New" },
  contacted: { variant: "purple", label: "Contacted" },
  replied: { variant: "info", label: "Replied" },
  interested: { variant: "success", label: "Interested" },
  not_interested: { variant: "default", label: "Not Interested" },
  converted: { variant: "success", label: "Converted" },
  rejected: { variant: "error", label: "Rejected" },
};

const platformConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  linkedin: { icon: Linkedin, label: "LinkedIn" },
  github: { icon: Github, label: "GitHub" },
  manual: { icon: User, label: "Manual Entry" },
  other: { icon: Globe, label: "Other" },
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
      // Skip if this is the "new" route (handled by sourcing/new/page.tsx)
      if (params.id === "new") return;

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
        <SkeletonCard />
      </div>
    );
  }

  if (!candidate) {
    return (
      <Card>
        <EmptyState
          icon={<User className="w-8 h-8" />}
          title="Candidate not found"
          action={
            <Link href="/jobs" className="text-primary hover:underline text-sm">
              Back to jobs
            </Link>
          }
        />
      </Card>
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
          className="p-2 bg-white border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900">
              {candidate.first_name} {candidate.last_name}
            </h1>
            <Badge variant="default">
              <PlatformIcon className="w-3.5 h-3.5 mr-1" />
              {platform.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-500 mt-1">
            {candidate.current_title && <span>{candidate.current_title}</span>}
            {candidate.current_company && (
              <>
                <span>at</span>
                <span className="font-medium">{candidate.current_company}</span>
              </>
            )}
          </div>
        </div>
        <Badge variant={status.variant}>
          {status.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card */}
          <Card>
            <CardHeader title="Profile" />

            <div className="flex items-start gap-6 mb-6">
              <div className="w-20 h-20 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
                {candidate.first_name?.charAt(0) || ""}
                {candidate.last_name?.charAt(0) || ""}
              </div>

              <div className="flex-1 space-y-2">
                {candidate.location && (
                  <div className="flex items-center gap-2 text-sm text-zinc-700">
                    <MapPin className="w-4 h-4 text-zinc-400" />
                    {candidate.location}
                  </div>
                )}
                {candidate.experience_years !== null && (
                  <div className="flex items-center gap-2 text-sm text-zinc-700">
                    <Briefcase className="w-4 h-4 text-zinc-400" />
                    {candidate.experience_years} years experience
                  </div>
                )}
                {candidate.created_at && (
                  <div className="flex items-center gap-2 text-sm text-zinc-700">
                    <Calendar className="w-4 h-4 text-zinc-400" />
                    Sourced on {format(new Date(candidate.created_at), "MMM d, yyyy")}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Match Score */}
            {totalRequiredCount > 0 && (
              <div className="mb-6 p-4 bg-zinc-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-zinc-700">
                      Skill Match Score
                    </span>
                  </div>
                  <span className={cn(
                    "text-lg font-bold",
                    matchPercentage >= 80 ? "text-emerald-600" :
                    matchPercentage >= 50 ? "text-amber-600" : "text-rose-600"
                  )}>
                    {matchPercentage}%
                  </span>
                </div>
                <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      matchPercentage >= 80 ? "bg-emerald-500" :
                      matchPercentage >= 50 ? "bg-amber-500" : "bg-rose-500"
                    )}
                    style={{ width: `${matchPercentage}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-2">
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
                  className="flex items-center gap-2 text-sm text-zinc-700 hover:underline"
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
                <h3 className="text-sm font-semibold text-zinc-700 mb-3">
                  Skills & Job Match
                </h3>

                {/* Required Skills */}
                {skillMatches.some(m => m.required) && (
                  <div className="mb-4">
                    <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
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
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-700"
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
                    <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
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
                                : "bg-zinc-100 text-zinc-500"
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
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">
                  Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {candidate.skills.map((skill, idx) => (
                    <Badge key={idx} variant="primary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          {/* Fit Score */}
          {candidate.fit_score !== null && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-zinc-900">
                  Fit Analysis
                </h2>
                <Badge
                  variant={
                    candidate.fit_score >= 80
                      ? "success"
                      : candidate.fit_score >= 60
                      ? "warning"
                      : "default"
                  }
                  className="text-sm px-3 py-1"
                >
                  <Star className="w-4 h-4 mr-1" />
                  {candidate.fit_score}% Match
                </Badge>
              </div>

              {candidate.fit_analysis?.reasoning && (
                <p className="text-sm text-zinc-700">
                  {candidate.fit_analysis.reasoning}
                </p>
              )}
            </Card>
          )}

          {/* Outreach History */}
          <Card>
            <CardHeader title="Outreach History" />

            {messages.length > 0 ? (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="bg-zinc-50 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            message.status === "replied"
                              ? "success"
                              : message.status === "opened"
                              ? "purple"
                              : message.status === "sent"
                              ? "info"
                              : "default"
                          }
                        >
                          {message.status}
                        </Badge>
                        <span className="text-xs text-zinc-500">
                          Step {message.step_number}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-500">
                        {message.sent_at
                          ? new Date(message.sent_at).toLocaleDateString()
                          : "Pending"}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-zinc-900 mb-1">
                      {message.subject_line}
                    </div>
                    <p className="text-sm text-zinc-700 line-clamp-2">
                      {message.personalized_body || message.message_body}
                    </p>
                    {message.reply_content && (
                      <div className="mt-3 pt-3 border-t border-zinc-200">
                        <div className="text-xs font-medium text-emerald-600 mb-1">
                          Reply:
                        </div>
                        <p className="text-sm text-zinc-700">
                          {message.reply_content}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<MessageSquare className="w-8 h-8" />}
                title="No outreach sent yet"
                description="Add to a campaign to start outreach"
              />
            )}
          </Card>

          {/* Summary */}
          {candidate.summary && (
            <Card>
              <CardHeader title="Summary" />
              <p className="text-sm text-zinc-700">
                {candidate.summary}
              </p>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader title="Actions" />

            <div className="space-y-3">
              {candidate.status === "new" && (
                <Button
                  onClick={() => handleStatusChange("contacted")}
                  disabled={actionLoading !== null}
                  loading={actionLoading === "contacted"}
                  icon={<Send className="w-4 h-4" />}
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                  size="lg"
                >
                  {actionLoading === "contacted" ? "Updating..." : "Mark as Contacted"}
                </Button>
              )}

              {candidate.status === "contacted" && (
                <Button
                  onClick={() => handleStatusChange("replied")}
                  disabled={actionLoading !== null}
                  loading={actionLoading === "replied"}
                  icon={<MessageSquare className="w-4 h-4" />}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
                  size="lg"
                >
                  {actionLoading === "replied" ? "Updating..." : "Mark as Replied"}
                </Button>
              )}

              {(candidate.status === "replied" || candidate.status === "new") && (
                <Button
                  onClick={() => handleStatusChange("interested")}
                  disabled={actionLoading !== null}
                  loading={actionLoading === "interested"}
                  variant="success"
                  icon={<CheckCircle className="w-4 h-4" />}
                  className="w-full"
                  size="lg"
                >
                  {actionLoading === "interested" ? "Updating..." : "Mark as Interested"}
                </Button>
              )}

              {candidate.status === "interested" && (
                <Button
                  onClick={handleConvertToApplication}
                  disabled={actionLoading !== null}
                  loading={actionLoading === "convert"}
                  icon={<UserPlus className="w-4 h-4" />}
                  className="w-full"
                  size="lg"
                >
                  {actionLoading === "convert" ? "Converting..." : "Convert to Candidate"}
                </Button>
              )}

              {candidate.status !== "rejected" && candidate.status !== "converted" && (
                <Button
                  onClick={() => handleStatusChange("not_interested")}
                  disabled={actionLoading !== null}
                  variant="secondary"
                  icon={<XCircle className="w-4 h-4" />}
                  className="w-full"
                  size="lg"
                >
                  Not Interested
                </Button>
              )}
            </div>
          </Card>

          {/* Target Job */}
          {job && (
            <Card>
              <CardHeader title="Target Job" />

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-zinc-900">
                      {job.title}
                    </h4>
                    <p className="text-sm text-zinc-500">{job.department}</p>
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
            </Card>
          )}

          {/* Add to Campaign */}
          {campaigns.length > 0 && candidate.status !== "converted" && (
            <Card>
              <CardHeader
                title="Campaigns"
                action={
                  <button
                    onClick={() => setShowAddToCampaign(true)}
                    className="flex items-center gap-1 text-primary text-sm hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                }
              />

              <div className="space-y-2">
                {campaigns.map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/campaigns/${campaign.id}`}
                    className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-zinc-900">
                        {campaign.name}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {campaign.sequence?.length || 0} steps - {campaign.status}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Timestamps */}
          <Card>
            <CardHeader title="Timeline" />

            <div className="space-y-3 text-sm">
              {candidate.created_at && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Sourced</span>
                  <span className="text-zinc-900">
                    {format(new Date(candidate.created_at), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              {candidate.updated_at && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Last Updated</span>
                  <span className="text-zinc-900">
                    {format(new Date(candidate.updated_at), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              {candidate.status === "contacted" && messages.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">First Contact</span>
                  <span className="text-zinc-900">
                    {format(new Date(messages[messages.length - 1].created_at), "MMM d, yyyy")}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Add to Campaign Modal */}
      <Modal
        isOpen={showAddToCampaign}
        onClose={() => {
          setShowAddToCampaign(false);
          setSelectedCampaign(null);
        }}
        title="Add to Campaign"
        description={`Select a campaign to add ${candidate.first_name} to:`}
      >
        <div className="p-6">
          <div className="space-y-2 mb-6">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                onClick={() => setSelectedCampaign(campaign.id)}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-lg transition-all",
                  selectedCampaign === campaign.id
                    ? "bg-primary/10 border-2 border-primary"
                    : "bg-zinc-50 border-2 border-transparent hover:bg-zinc-100"
                )}
              >
                <div className="text-left">
                  <div className="font-medium text-zinc-900">
                    {campaign.name}
                  </div>
                  <div className="text-xs text-zinc-500">
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
            <Button
              onClick={() => {
                setShowAddToCampaign(false);
                setSelectedCampaign(null);
              }}
              variant="secondary"
              className="flex-1"
              size="lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddToCampaign}
              disabled={!selectedCampaign || actionLoading === "addToCampaign"}
              loading={actionLoading === "addToCampaign"}
              icon={<Send className="w-4 h-4" />}
              className="flex-1"
              size="lg"
            >
              {actionLoading === "addToCampaign" ? "Adding..." : "Add to Campaign"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
