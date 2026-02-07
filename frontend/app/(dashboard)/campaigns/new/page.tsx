"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Mail,
  Clock,
  Calendar,
  ChevronUp,
  ChevronDown,
  Briefcase,
  Save,
  Sparkles,
  Send,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job, SequenceStep } from "@/types";
import { supabase } from "@/lib/supabase/client";
import { campaignApi } from "@/lib/api/client";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const defaultStep: Omit<SequenceStep, "step_number"> = {
  channel: "email",
  template_id: null,
  subject_line: "",
  message_body: "",
  delay_days: 0,
  delay_hours: 0,
  send_on_days: [1, 2, 3, 4, 5], // Mon-Fri
  send_after_hour: 9,
  send_before_hour: 17,
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function StepEditor({
  step,
  index,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  step: SequenceStep;
  index: number;
  onUpdate: (step: SequenceStep) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const isFirstStep = index === 0;

  return (
    <Card>
      {/* Step Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
            {step.step_number}
          </div>
          <div>
            <h3 className="font-semibold text-zinc-900">
              Step {step.step_number}
            </h3>
            <p className="text-xs text-zinc-500">
              {isFirstStep
                ? "Sent immediately"
                : `${step.delay_days}d ${step.delay_hours}h after previous`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              canMoveUp
                ? "hover:bg-zinc-100 text-zinc-600"
                : "text-zinc-300 cursor-not-allowed"
            )}
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              canMoveDown
                ? "hover:bg-zinc-100 text-zinc-600"
                : "text-zinc-300 cursor-not-allowed"
            )}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Delay Settings (not for first step) */}
      {!isFirstStep && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">
              Days After Previous
            </label>
            <input
              type="number"
              min="0"
              max="30"
              value={step.delay_days}
              onChange={(e) =>
                onUpdate({ ...step, delay_days: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-700 focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">
              Hours
            </label>
            <input
              type="number"
              min="0"
              max="23"
              value={step.delay_hours}
              onChange={(e) =>
                onUpdate({ ...step, delay_hours: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-700 focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Subject Line */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-zinc-500 mb-1">
          Subject Line
        </label>
        <input
          type="text"
          value={step.subject_line || ""}
          onChange={(e) => onUpdate({ ...step, subject_line: e.target.value })}
          placeholder="e.g., Quick question about {{role}} at {{company}}"
          className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-700 placeholder-zinc-400 focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none"
        />
        <p className="text-xs text-zinc-400 mt-1">
          Use {"{{first_name}}"}, {"{{company}}"}, {"{{role}}"} for personalization
        </p>
      </div>

      {/* Message Body */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-zinc-500 mb-1">
          Message Body
        </label>
        <textarea
          value={step.message_body}
          onChange={(e) => onUpdate({ ...step, message_body: e.target.value })}
          placeholder="Write your outreach message..."
          rows={6}
          className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-700 placeholder-zinc-400 focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none resize-none"
        />
      </div>

      {/* Send Window */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Send After (hour)
          </label>
          <select
            value={step.send_after_hour}
            onChange={(e) =>
              onUpdate({ ...step, send_after_hour: parseInt(e.target.value) })
            }
            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-700 focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {i.toString().padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Send Before (hour)
          </label>
          <select
            value={step.send_before_hour}
            onChange={(e) =>
              onUpdate({ ...step, send_before_hour: parseInt(e.target.value) })
            }
            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-700 focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {i.toString().padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Send Days */}
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-2">
          Send On Days
        </label>
        <div className="flex gap-2">
          {dayNames.map((day, idx) => (
            <button
              key={day}
              onClick={() => {
                const days = step.send_on_days.includes(idx)
                  ? step.send_on_days.filter((d) => d !== idx)
                  : [...step.send_on_days, idx].sort();
                onUpdate({ ...step, send_on_days: days });
              }}
              className={cn(
                "w-10 h-10 rounded-lg text-xs font-medium transition-colors",
                step.send_on_days.includes(idx)
                  ? "bg-primary text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              )}
            >
              {day}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [jobId, setJobId] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");
  const [sequence, setSequence] = useState<SequenceStep[]>([
    { ...defaultStep, step_number: 1 },
  ]);

  useEffect(() => {
    async function fetchJobs() {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .in("status", ["active", "paused"])
        .order("created_at", { ascending: false });

      if (data) {
        setJobs(data as Job[]);
      }
    }

    fetchJobs();
  }, []);

  const addStep = () => {
    setSequence([
      ...sequence,
      {
        ...defaultStep,
        step_number: sequence.length + 1,
        delay_days: 3, // Default 3 day delay for follow-ups
      },
    ]);
  };

  const updateStep = (index: number, updatedStep: SequenceStep) => {
    const newSequence = [...sequence];
    newSequence[index] = updatedStep;
    setSequence(newSequence);
  };

  const deleteStep = (index: number) => {
    if (sequence.length === 1) return;
    const newSequence = sequence
      .filter((_, i) => i !== index)
      .map((step, i) => ({ ...step, step_number: i + 1 }));
    setSequence(newSequence);
  };

  const moveStep = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sequence.length) return;

    const newSequence = [...sequence];
    [newSequence[index], newSequence[newIndex]] = [
      newSequence[newIndex],
      newSequence[index],
    ];
    // Update step numbers
    newSequence.forEach((step, i) => (step.step_number = i + 1));
    setSequence(newSequence);
  };

  const generateWithAI = async () => {
    if (!jobId) return;

    setGenerating(true);
    try {
      // This would call the outreach agent to generate personalized templates
      // For now, we'll use placeholder templates
      const job = jobs.find((j) => j.id === jobId);
      const templates = [
        {
          subject: `Exciting ${job?.title || "opportunity"} at your team`,
          body: `Hi {{first_name}},

I came across your profile and was impressed by your background in {{current_company}}. We have an exciting {{role}} opportunity that I think could be a great fit for your skills.

Would you be open to a quick chat to learn more?

Best,
{{sender_name}}`,
        },
        {
          subject: `Following up - {{role}} opportunity`,
          body: `Hi {{first_name}},

I wanted to follow up on my previous message about the {{role}} position. I think your experience would be a great addition to our team.

Are you available for a brief 15-minute call this week?

Best,
{{sender_name}}`,
        },
        {
          subject: `Last chance to connect`,
          body: `Hi {{first_name}},

I understand you're busy, but I didn't want to miss the chance to connect with you about this opportunity.

If now isn't the right time, I completely understand. Just let me know if you'd like to revisit this in the future.

Best,
{{sender_name}}`,
        },
      ];

      const newSequence = templates.map((template, i) => ({
        ...defaultStep,
        step_number: i + 1,
        subject_line: template.subject,
        message_body: template.body,
        delay_days: i === 0 ? 0 : i === 1 ? 3 : 5,
        delay_hours: 0,
      }));

      setSequence(newSequence);
    } catch (error) {
      console.error("Failed to generate templates:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (!name || !jobId || sequence.length === 0) return;

    setLoading(true);
    try {
      const campaignData = {
        job_id: jobId,
        name,
        description: description || undefined,
        sequence,
        sender_email: senderEmail || undefined,
        sender_name: senderName || undefined,
        reply_to_email: replyToEmail || undefined,
      };

      const result = await campaignApi.create(campaignData);
      router.push(`/campaigns/${result.data.id}`);
    } catch (error) {
      console.error("Failed to create campaign:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedJob = jobs.find((j) => j.id === jobId);

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
          <h1 className="text-2xl font-bold text-zinc-900">
            Create Campaign
          </h1>
          <p className="text-sm text-zinc-500">Build your outreach sequence</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Campaign Info */}
          <Card>
            <CardHeader title="Campaign Details" />

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Q1 Engineering Outreach"
                  className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-lg text-zinc-700 placeholder-zinc-400 focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Target Job *
                </label>
                <select
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-lg text-zinc-700 focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none"
                >
                  <option value="">Select a job</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} - {job.department}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description for this campaign..."
                  rows={2}
                  className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-lg text-zinc-700 placeholder-zinc-400 focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none resize-none"
                />
              </div>
            </div>
          </Card>

          {/* Sender Settings */}
          <Card>
            <CardHeader title="Sender Settings" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Sender Name
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g., Alex from TalentAI"
                  className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-lg text-zinc-700 placeholder-zinc-400 focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Sender Email
                </label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="alex@company.com"
                  className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-lg text-zinc-700 placeholder-zinc-400 focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Reply-To Email
                </label>
                <input
                  type="email"
                  value={replyToEmail}
                  onChange={(e) => setReplyToEmail(e.target.value)}
                  placeholder="recruiting@company.com (optional)"
                  className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-lg text-zinc-700 placeholder-zinc-400 focus:ring-2 focus:ring-primary-200 focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </Card>

          {/* Sequence Builder */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">
                Email Sequence
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  onClick={generateWithAI}
                  disabled={!jobId || generating}
                  variant={jobId && !generating ? "secondary" : "ghost"}
                  icon={<Sparkles className="w-4 h-4" />}
                  loading={generating}
                  className={cn(
                    jobId && !generating
                      ? "border-purple-200 text-purple-700 hover:bg-purple-50"
                      : ""
                  )}
                >
                  {generating ? "Generating..." : "Generate with AI"}
                </Button>
                <Button
                  onClick={addStep}
                  variant="ghost"
                  icon={<Plus className="w-4 h-4" />}
                  className="text-primary hover:bg-primary/5"
                >
                  Add Step
                </Button>
              </div>
            </div>

            {/* Sequence Steps */}
            <div className="space-y-4">
              {sequence.map((step, index) => (
                <StepEditor
                  key={index}
                  step={step}
                  index={index}
                  onUpdate={(updated) => updateStep(index, updated)}
                  onDelete={() => deleteStep(index)}
                  onMoveUp={() => moveStep(index, "up")}
                  onMoveDown={() => moveStep(index, "down")}
                  canMoveUp={index > 0}
                  canMoveDown={index < sequence.length - 1}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Preview Card */}
          <Card>
            <CardHeader title="Campaign Summary" />

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-zinc-700">
                <Mail className="w-4 h-4 text-zinc-400" />
                <span>{sequence.length} email{sequence.length !== 1 ? "s" : ""} in sequence</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-700">
                <Clock className="w-4 h-4 text-zinc-400" />
                <span>
                  {sequence.reduce((total, step) => total + step.delay_days, 0)} days total
                </span>
              </div>
              {selectedJob && (
                <div className="flex items-center gap-2 text-zinc-700">
                  <Briefcase className="w-4 h-4 text-zinc-400" />
                  <span className="truncate">{selectedJob.title}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader title="Actions" />

            <div className="space-y-3">
              <Button
                onClick={handleSubmit}
                disabled={!name || !jobId || sequence.length === 0 || loading}
                loading={loading}
                icon={<Save className="w-4 h-4" />}
                className="w-full"
                size="lg"
              >
                {loading ? "Creating..." : "Save as Draft"}
              </Button>

              <Button
                disabled
                variant="ghost"
                icon={<Send className="w-4 h-4" />}
                className="w-full text-emerald-600 opacity-50 cursor-not-allowed"
                size="lg"
              >
                Save & Start (Add Recipients First)
              </Button>
            </div>

            <p className="text-xs text-zinc-500 mt-4">
              After creating the campaign, you&apos;ll be able to add sourced candidates as recipients.
            </p>
          </Card>

          {/* Tips */}
          <Card className="bg-amber-50 border-amber-200">
            <h3 className="font-semibold text-amber-900 mb-2">
              Tips for Great Outreach
            </h3>
            <ul className="text-xs text-amber-700 space-y-2">
              <li>Keep first message short (under 100 words)</li>
              <li>Personalize with candidate&apos;s name and company</li>
              <li>Wait 3-5 days between follow-ups</li>
              <li>Limit sequence to 3-4 emails max</li>
              <li>Send during business hours (9am-5pm)</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
