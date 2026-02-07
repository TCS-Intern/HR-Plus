"use client";

import { useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  MapPin,
  Briefcase,
  Star,
  ExternalLink,
  UserPlus,
  Mail,
  Copy,
  Check,
  Sparkles,
  X,
} from "lucide-react";
import { sourcingChatApi, api } from "@/lib/api/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Candidate {
  id: string;
  role: string;
  company?: string;
  location?: string;
  experience_years?: number;
  skills: string[];
  summary?: string;
  fit_score?: number;
  source?: string;
  is_anonymized: boolean;
  name: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  already_revealed?: boolean;
}

interface Job {
  id: string;
  title: string;
  status: string;
}

interface AnonymizedCandidateCardProps {
  candidate: Candidate;
  conversationId: string;
  index?: number;
}

export default function AnonymizedCandidateCard({
  candidate: initialCandidate,
  conversationId,
  index,
}: AnonymizedCandidateCardProps) {
  const [candidate, setCandidate] = useState<Candidate>(initialCandidate);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showJobSelector, setShowJobSelector] = useState(false);
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [addingToPipeline, setAddingToPipeline] = useState(false);
  const [generatingOutreach, setGeneratingOutreach] = useState(false);
  const [outreachMessage, setOutreachMessage] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Load jobs when modal opens
  useEffect(() => {
    if (showJobSelector && jobs.length === 0) {
      loadJobs();
    }
  }, [showJobSelector]);

  const loadJobs = async () => {
    try {
      setLoadingJobs(true);
      const response = await api.get("/jobs", { params: { status: "active" } });
      setJobs(response.data || []);
    } catch (error) {
      console.error("Failed to load jobs:", error);
      toast.error("Failed to load jobs");
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleReveal = async () => {
    try {
      setIsRevealing(true);

      const response = await sourcingChatApi.revealCandidate({
        candidate_id: candidate.id,
        conversation_id: conversationId,
        reveal_reason: "interested",
      });

      if (response.success && response.candidate) {
        setCandidate({
          ...candidate,
          ...response.candidate,
          is_anonymized: false,
        });
        toast.success(
          `Candidate revealed! ${response.credits_charged} credit${response.credits_charged > 1 ? "s" : ""} used. New balance: ${response.new_balance}`
        );
      } else {
        toast.error(response.error || "Failed to reveal candidate");
      }
    } catch (error: any) {
      console.error("Error revealing candidate:", error);
      if (error.response?.data?.error === "insufficient_credits") {
        toast.error("Insufficient credits. Please purchase more credits to reveal candidates.");
      } else {
        toast.error("Failed to reveal candidate. Please try again.");
      }
    } finally {
      setIsRevealing(false);
    }
  };

  const handleAddToPipeline = async (jobId: string) => {
    try {
      setAddingToPipeline(true);

      const response = await sourcingChatApi.addToJob({
        conversation_id: conversationId,
        candidate_ids: [candidate.id],
        job_id: jobId,
      });

      if (response.success) {
        toast.success(`Added ${candidate.name} to pipeline!`);
        setShowJobSelector(false);
      } else {
        toast.error("Failed to add to pipeline");
      }
    } catch (error: any) {
      console.error("Error adding to pipeline:", error);
      toast.error(error.response?.data?.detail || "Failed to add to pipeline");
    } finally {
      setAddingToPipeline(false);
    }
  };

  const handleGenerateOutreach = async () => {
    try {
      setGeneratingOutreach(true);
      setShowOutreachModal(true);

      const response = await api.post("/sourcing-chat/generate-outreach", {
        candidate_id: candidate.id,
        conversation_id: conversationId,
      });

      setOutreachMessage(response.data.message || generateFallbackOutreach());
    } catch (error: any) {
      console.error("Error generating outreach:", error);
      // Use fallback if endpoint doesn't exist
      setOutreachMessage(generateFallbackOutreach());
    } finally {
      setGeneratingOutreach(false);
    }
  };

  const generateFallbackOutreach = () => {
    return `Hi ${candidate.name.split(" ")[0]},

I came across your profile and was impressed by your experience as a ${candidate.role}${candidate.company ? ` at ${candidate.company}` : ""}. Your background in ${candidate.skills.slice(0, 3).join(", ")} particularly caught my attention.

We're currently looking for talented professionals for an exciting opportunity, and I believe your skills would be a great fit.

Would you be open to a brief conversation to learn more? I'd love to share details about the role and hear about your career goals.

Looking forward to connecting!

Best regards`;
  };

  const copyOutreachToClipboard = () => {
    navigator.clipboard.writeText(outreachMessage);
    toast.success("Message copied to clipboard!");
  };

  const copyEmailToClipboard = () => {
    if (candidate.email) {
      navigator.clipboard.writeText(candidate.email);
      setCopiedEmail(true);
      toast.success("Email copied!");
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const openEmailClient = () => {
    if (candidate.email) {
      const subject = encodeURIComponent(`Exciting Opportunity - ${candidate.role}`);
      const body = encodeURIComponent(outreachMessage);
      window.open(`mailto:${candidate.email}?subject=${subject}&body=${body}`);
    }
  };

  // Get fit score color
  const getFitScoreColor = (score?: number) => {
    if (!score) return "text-zinc-400";
    if (score >= 80) return "text-emerald-600";
    if (score >= 60) return "text-amber-600";
    return "text-rose-600";
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 hover:shadow-md transition-all">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {index && (
                <span className="text-xs font-semibold text-zinc-400">#{index}</span>
              )}
              <h3 className="font-semibold text-zinc-900">
                {candidate.name}
              </h3>
            </div>
            <p className="text-sm text-zinc-500">{candidate.role}</p>
          </div>

          {/* Fit Score */}
          {candidate.fit_score !== undefined && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-50 border border-zinc-200">
              <Star className={cn("w-3 h-3", getFitScoreColor(candidate.fit_score))} />
              <span className={cn("text-xs font-semibold", getFitScoreColor(candidate.fit_score))}>
                {Math.round(candidate.fit_score)}%
              </span>
            </div>
          )}
        </div>

        {/* Company & Location */}
        <div className="space-y-1.5 mb-3 text-sm">
          {candidate.company && (
            <div className="flex items-center gap-2 text-zinc-600">
              <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{candidate.company}</span>
            </div>
          )}

          {candidate.location && (
            <div className="flex items-center gap-2 text-zinc-600">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{candidate.location}</span>
            </div>
          )}

          {candidate.experience_years && (
            <p className="text-xs text-zinc-500">
              {candidate.experience_years} years of experience
            </p>
          )}
        </div>

        {/* Skills */}
        {candidate.skills && candidate.skills.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1.5">
              {candidate.skills.slice(0, 5).map((skill, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-accent-50 text-primary text-xs font-medium rounded-md"
                >
                  {skill}
                </span>
              ))}
              {candidate.skills.length > 5 && (
                <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 text-xs rounded-md">
                  +{candidate.skills.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Summary */}
        {candidate.summary && (
          <p className="text-xs text-zinc-600 mb-3 line-clamp-2">
            {candidate.summary}
          </p>
        )}

        {/* Divider */}
        <div className="border-t border-zinc-200 mb-3" />

        {/* Reveal Section */}
        {candidate.is_anonymized ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <EyeOff className="w-3.5 h-3.5" />
              <span>Contact info hidden</span>
            </div>

            <Button
              onClick={handleReveal}
              loading={isRevealing}
              className="w-full"
              size="sm"
              icon={!isRevealing ? <Eye className="w-4 h-4" /> : undefined}
            >
              {isRevealing ? "Revealing..." : "Reveal Identity & Contact (1 credit)"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Revealed Contact Info */}
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 mb-2">
                <Eye className="w-3.5 h-3.5" />
                <span>Contact Info Revealed</span>
              </div>

              {candidate.email && (
                <div className="flex items-center justify-between">
                  <a
                    href={`mailto:${candidate.email}`}
                    className="text-xs text-zinc-700 hover:text-primary"
                  >
                    <span className="font-medium">Email:</span> {candidate.email}
                  </a>
                  <button
                    onClick={copyEmailToClipboard}
                    className="p-1 hover:bg-emerald-100 rounded transition-colors"
                    title="Copy email"
                  >
                    {copiedEmail ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-zinc-400" />
                    )}
                  </button>
                </div>
              )}

              {candidate.phone && (
                <a
                  href={`tel:${candidate.phone}`}
                  className="block text-xs text-zinc-700 hover:text-primary"
                >
                  <span className="font-medium">Phone:</span> {candidate.phone}
                </a>
              )}

              {candidate.linkedin_url && (
                <a
                  href={candidate.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <span>View LinkedIn Profile</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => setShowJobSelector(true)}
                size="sm"
                variant="secondary"
                icon={<UserPlus className="w-3.5 h-3.5" />}
              >
                Add to Pipeline
              </Button>

              <Button
                onClick={handleGenerateOutreach}
                size="sm"
                variant="secondary"
                icon={<Sparkles className="w-3.5 h-3.5" />}
              >
                Draft Outreach
              </Button>
            </div>

            {/* Source Badge */}
            {candidate.source && (
              <div className="text-xs text-zinc-500 text-center">
                Source: <span className="font-medium capitalize">{candidate.source}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Job Selector Modal */}
      {showJobSelector && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg border border-zinc-200 max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
              <h3 className="font-semibold text-lg text-zinc-900">Add to Job Pipeline</h3>
              <button
                onClick={() => setShowJobSelector(false)}
                className="p-1 hover:bg-zinc-100 rounded-lg"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingJobs ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : jobs.length === 0 ? (
                <p className="text-center text-zinc-500 py-8">
                  No active jobs found. Create a job first.
                </p>
              ) : (
                <div className="space-y-2">
                  {jobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => handleAddToPipeline(job.id)}
                      disabled={addingToPipeline}
                      className="w-full p-3 text-left bg-zinc-50 hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <p className="font-medium text-sm text-zinc-900">{job.title}</p>
                      <p className="text-xs text-zinc-500 capitalize">{job.status}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Outreach Modal */}
      {showOutreachModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg border border-zinc-200 max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg text-zinc-900">AI-Generated Outreach</h3>
              </div>
              <button
                onClick={() => setShowOutreachModal(false)}
                className="p-1 hover:bg-zinc-100 rounded-lg"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="p-4">
              {generatingOutreach ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-3">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-zinc-500">Generating personalized message...</p>
                  </div>
                </div>
              ) : (
                <>
                  <textarea
                    value={outreachMessage}
                    onChange={(e) => setOutreachMessage(e.target.value)}
                    className="w-full h-64 p-3 bg-zinc-50 rounded-lg border border-zinc-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-primary"
                  />

                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={copyOutreachToClipboard}
                      variant="secondary"
                      className="flex-1"
                      icon={<Copy className="w-4 h-4" />}
                    >
                      Copy Message
                    </Button>

                    {candidate.email && (
                      <Button
                        onClick={openEmailClient}
                        className="flex-1"
                        icon={<Mail className="w-4 h-4" />}
                      >
                        Open in Email
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
