"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Upload,
  CheckCircle,
  Loader2,
  AlertTriangle,
  FileText,
  X,
  Briefcase,
  MapPin,
  Building,
} from "lucide-react";
import { publicApi } from "@/lib/api/client";

interface JobData {
  id: string;
  title: string;
  description: string | null;
  summary: string | null;
  department: string | null;
  location: string | null;
  job_type: string | null;
  remote_policy: string | null;
  skills_matrix: Record<string, unknown> | null;
  company_name: string;
}

type Stage = "loading" | "form" | "submitting" | "success" | "error";

export default function PublicApplyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const jobId = params.jobId as string;
  const ref = searchParams.get("ref") || undefined;

  const [stage, setStage] = useState<Stage>("loading");
  const [job, setJob] = useState<JobData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch job data
  useEffect(() => {
    async function fetchJob() {
      try {
        const data = await publicApi.getJob(jobId);
        setJob(data);
        setStage("form");
      } catch (err: any) {
        setError(err.response?.data?.detail || "This job posting is no longer available.");
        setStage("error");
      }
    }
    fetchJob();
  }, [jobId]);

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
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeFile || !firstName || !lastName || !email) return;

    setStage("submitting");

    try {
      const formData = new FormData();
      formData.append("first_name", firstName);
      formData.append("last_name", lastName);
      formData.append("email", email);
      if (phone) formData.append("phone", phone);
      if (linkedinUrl) formData.append("linkedin_url", linkedinUrl);
      formData.append("file", resumeFile);

      await publicApi.apply(jobId, formData, ref);
      setStage("success");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
      setStage("error");
    }
  };

  // Loading state
  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-zinc-400 mx-auto mb-4" />
          <p className="text-zinc-500">Loading job details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (stage === "error") {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-zinc-900 mb-2">Unable to Load</h1>
          <p className="text-zinc-500">{error}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (stage === "success") {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-4">Application Received!</h1>
          <p className="text-zinc-500">
            Thank you for applying for the <strong>{job?.title}</strong> position.
            We&apos;ll review your application and be in touch.
          </p>
        </div>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <p className="text-sm text-zinc-500 mb-1">{job.company_name}</p>
          <h1 className="text-2xl font-bold text-zinc-900">{job.title}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-zinc-500">
            {job.department && (
              <span className="flex items-center gap-1">
                <Building className="w-4 h-4" />
                {job.department}
              </span>
            )}
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {job.location}
              </span>
            )}
            {job.job_type && (
              <span className="flex items-center gap-1">
                <Briefcase className="w-4 h-4" />
                {job.job_type}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Job Description */}
          {(job.summary || job.description) && (
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-8">
                <h2 className="text-lg font-semibold text-zinc-900 mb-4">About the Role</h2>
                <div className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">
                  {job.summary || job.description}
                </div>
              </div>
            </div>
          )}

          {/* Apply Form */}
          <div className={job.summary || job.description ? "lg:col-span-3" : "lg:col-span-5 max-w-lg mx-auto w-full"}>
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-zinc-900 mb-6">Apply for this Position</h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
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
                    Email *
                  </label>
                  <input
                    type="email"
                    required
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

                {/* Resume Upload */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                    Resume *
                  </label>
                  <div
                    className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
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
                        <FileText className="w-8 h-8 text-green-600" />
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
                          className="ml-2 p-1 hover:bg-zinc-100 rounded-lg"
                        >
                          <X className="w-4 h-4 text-zinc-500" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                        <p className="text-sm text-zinc-600">
                          Drag & drop your resume here, or{" "}
                          <span className="text-zinc-900 font-medium">browse</span>
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">PDF or DOCX only</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={stage === "submitting" || !resumeFile || !firstName || !lastName || !email}
                  className="w-full bg-zinc-900 text-white hover:bg-zinc-800 rounded-xl px-6 py-3 text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {stage === "submitting" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting Application...
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
