"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  FileText,
  X,
  Loader2,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { screeningApi } from "@/lib/api/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface JobOption {
  id: string;
  title: string;
  department: string | null;
  status: string;
}

export default function AddCandidatePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  // Form state
  const [jobId, setJobId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch jobs for dropdown
  useEffect(() => {
    async function fetchJobs() {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, department, status")
        .in("status", ["approved", "active", "draft"])
        .order("created_at", { ascending: false });

      if (!error && data) {
        setJobs(data);
        if (data.length === 1) {
          setJobId(data[0].id);
        }
      }
      setLoadingJobs(false);
    }
    fetchJobs();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (isValidFile(file)) {
        setResumeFile(file);
      } else {
        toast.error("Only PDF and DOCX files are allowed");
      }
    }
  };

  const isValidFile = (file: File) => {
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    return validTypes.includes(file.type);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (isValidFile(file)) {
        setResumeFile(file);
      } else {
        toast.error("Only PDF and DOCX files are allowed");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!jobId) {
      toast.error("Please select a job");
      return;
    }
    if (!resumeFile) {
      toast.error("Please upload a resume");
      return;
    }

    setSubmitting(true);

    try {
      await screeningApi.uploadCV(jobId, resumeFile, {
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        linkedin_url: linkedinUrl || undefined,
      });

      toast.success("Candidate added and screening started!");
      router.push(`/jobs/${jobId}/candidates`);
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Failed to add candidate";
      toast.error(detail);
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/sourcing" className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-zinc-600" />
        </Link>
        <PageHeader
          title="Add Candidate"
          description="Manually add a candidate with their info and resume"
        />
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Job Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Job Position *
            </label>
            {loadingJobs ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading jobs...
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-sm text-zinc-500 py-2">
                No jobs available.{" "}
                <Link href="/jobs/new" className="text-accent hover:underline">
                  Create a job first
                </Link>
              </div>
            ) : (
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-300"
              >
                <option value="">Select a job...</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                    {job.department ? ` — ${job.department}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-zinc-100" />

          {/* Candidate Info */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 mb-4">
              Candidate Information
              <span className="ml-2 text-xs font-normal text-zinc-400">
                (optional — will be extracted from CV if not provided)
              </span>
            </h3>

            <div className="space-y-4">
              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    placeholder="Doe"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                  placeholder="john@example.com"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              {/* LinkedIn */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                  placeholder="https://linkedin.com/in/johndoe"
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-zinc-100" />

          {/* Resume Upload */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Resume / CV *
            </label>
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                dragActive
                  ? "border-zinc-400 bg-zinc-50"
                  : resumeFile
                    ? "border-green-300 bg-green-50"
                    : "border-zinc-200 hover:border-zinc-300"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                className="hidden"
              />

              {resumeFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-10 h-10 text-green-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-zinc-900">{resumeFile.name}</p>
                    <p className="text-xs text-zinc-500">
                      {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setResumeFile(null);
                    }}
                    className="ml-2 p-1.5 hover:bg-zinc-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
                  <p className="text-sm text-zinc-600">
                    Drag & drop a resume here, or{" "}
                    <span className="text-zinc-900 font-medium">browse</span>
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">PDF or DOCX only</p>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/sourcing">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              loading={submitting}
              disabled={!jobId || !resumeFile || submitting}
              icon={!submitting ? <UserPlus className="w-4 h-4" /> : undefined}
            >
              {submitting ? "Adding & Screening..." : "Add Candidate"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
