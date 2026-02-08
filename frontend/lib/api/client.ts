import axios from "axios";
import type { ScreeningResponse } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

// JD Assist API
export const jdApi = {
  create: (data: { input_text?: string; voice_transcript?: string }) =>
    api.post("/jd/create", data),
  get: (id: string) => api.get(`/jd/${id}`),
  update: (id: string, data: Record<string, unknown>) => api.put(`/jd/${id}`, data),
  approve: (id: string) => api.post(`/jd/${id}/approve`),
  approveWithSourcing: (
    id: string,
    params?: { platforms?: string[]; limit?: number }
  ) => api.post(`/jd/${id}/approve-with-sourcing`, null, { params }),
  list: () => api.get("/jd"),
};

// Screening API
export const screeningApi = {
  start: (jobId: string) => api.post("/screen/start", { job_id: jobId }),
  uploadCV: (
    jobId: string,
    file: File,
    candidateInfo?: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      linkedin_url?: string;
    }
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("job_id", jobId);
    if (candidateInfo?.first_name) formData.append("first_name", candidateInfo.first_name);
    if (candidateInfo?.last_name) formData.append("last_name", candidateInfo.last_name);
    if (candidateInfo?.email) formData.append("candidate_email", candidateInfo.email);
    if (candidateInfo?.phone) formData.append("phone", candidateInfo.phone);
    if (candidateInfo?.linkedin_url) formData.append("linkedin_url", candidateInfo.linkedin_url);
    return api.post("/screen/upload-cv", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getCandidates: async (jobId: string): Promise<ScreeningResponse> => {
    const response = await api.get(`/screen/${jobId}/candidates`);
    return response.data;
  },
  shortlist: (applicationIds: string[]) =>
    api.put("/screen/shortlist", applicationIds),
  reject: (applicationId: string, reason?: string) =>
    api.post(`/screen/${applicationId}/reject`, null, {
      params: reason ? { reason } : undefined,
    }),
};

// Assessment API
export const assessmentApi = {
  generateQuestions: (applicationId: string) =>
    api.post("/assess/generate-questions", null, { params: { application_id: applicationId } }),
  schedule: (data: { application_id: string; candidate_email: string; duration_minutes?: number }) =>
    api.post("/assess/schedule", data),
  submitVideo: (assessmentId: string, formData: FormData) =>
    api.post("/assess/submit-video", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  get: (assessmentId: string) => api.get(`/assess/${assessmentId}`),
  getAnalysis: (assessmentId: string) => api.get(`/assess/${assessmentId}/analysis`),
  approve: (assessmentId: string) => api.post(`/assess/${assessmentId}/approve`),
  reject: (assessmentId: string, reason?: string) =>
    api.post(`/assess/${assessmentId}/reject`, null, {
      params: reason ? { reason } : undefined,
    }),
  // Public endpoint - no auth required
  getByToken: (token: string) => api.get(`/assess/token/${token}`),
  getForApplication: (applicationId: string) =>
    api.get(`/assess/application/${applicationId}/assessments`),
};

// Offer API
export const offerApi = {
  generate: (applicationId: string) =>
    api.post("/offer/generate", null, { params: { application_id: applicationId } }),
  get: (id: string) => api.get(`/offer/${id}`),
  update: (id: string, data: Record<string, unknown>) => api.put(`/offer/${id}`, data),
  send: (id: string) => api.post(`/offer/${id}/send`),
  updateStatus: (id: string, status: string) =>
    api.put(`/offer/${id}/status`, { status }),
};

// Dashboard API
export const dashboardApi = {
  getMetrics: () => api.get("/dashboard/metrics"),
  getPipeline: () => api.get("/dashboard/pipeline"),
  getAgentLogs: () => api.get("/dashboard/agent-logs"),
};

// Phone Screen API
export const phoneScreenApi = {
  schedule: (data: { application_id: string; phone_number: string; scheduled_at?: string }) =>
    api.post("/phone-screen/schedule", data),
  get: (id: string) => api.get(`/phone-screen/${id}`),
  getForApplication: (applicationId: string) =>
    api.get(`/phone-screen/application/${applicationId}`),
  list: (params?: { status?: string; limit?: number }) =>
    api.get("/phone-screen", { params }),
  approve: (id: string) => api.post(`/phone-screen/${id}/approve`),
  reject: (id: string, reason?: string) =>
    api.post(`/phone-screen/${id}/reject`, null, {
      params: reason ? { reason } : undefined,
    }),
  retry: (id: string) => api.post(`/phone-screen/${id}/retry`),
  cancel: (id: string) => api.post(`/phone-screen/${id}/cancel`),
  analyze: (id: string, force?: boolean) =>
    api.post(`/phone-screen/${id}/analyze`, null, {
      params: { force: force || false },
    }),
  simulate: (id: string) => api.post(`/phone-screen/${id}/simulate`),
};

// Email API
export const emailApi = {
  getStatus: () => api.get("/email/status"),
  previewAssessment: (assessmentId: string) =>
    api.get(`/email/preview/assessment/${assessmentId}`),
  previewOffer: (offerId: string) =>
    api.get(`/email/preview/offer/${offerId}`),
  preview: (data: { template: string; context?: Record<string, unknown> }) =>
    api.post("/email/preview", data),
};

// Sourcing API
export const sourcingApi = {
  search: (data: {
    job_id: string;
    query?: string;
    platforms?: string[];
    location?: string;
    experience_min?: number;
    experience_max?: number;
    skills?: string[];
    limit?: number;
  }) => api.post("/sourcing/search", data),
  import: (data: { job_id: string; results: unknown[]; auto_score?: boolean }) =>
    api.post("/sourcing/import", data),
  create: (data: {
    job_id: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    current_title?: string;
    current_company?: string;
    location?: string;
    experience_years?: number;
    skills?: string[];
    source?: string;
    source_url?: string;
  }) => api.post("/sourcing", data),
  get: (id: string) => api.get(`/sourcing/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/sourcing/${id}`, data),
  listForJob: (jobId: string, params?: { status?: string; limit?: number }) =>
    api.get(`/sourcing/job/${jobId}`, { params }),
  score: (candidateId: string) =>
    api.post(`/sourcing/${candidateId}/score`),
  bulkScore: (data: { candidate_ids: string[]; job_id: string }) =>
    api.post("/sourcing/bulk-score", data),
  convert: (candidateId: string) =>
    api.post(`/sourcing/${candidateId}/convert`),
  reject: (candidateId: string, reason?: string) =>
    api.post(`/sourcing/${candidateId}/reject`, null, {
      params: reason ? { reason } : undefined,
    }),
};

// Sourcing Chat API (Chatbot-based candidate sourcing)
export const sourcingChatApi = {
  start: (data: { job_id?: string; initial_message?: string }) =>
    api.post("/sourcing-chat/start", data).then((res) => res.data),
  sendMessage: (conversationId: string, message: string) => {
    // Note: This endpoint returns SSE stream, handle on client side
    return `${API_URL}/api/v1/sourcing-chat/message?conversation_id=${conversationId}&message=${encodeURIComponent(message)}`;
  },
  revealCandidate: (data: {
    candidate_id: string;
    conversation_id: string;
    reveal_reason?: string;
  }) => api.post("/sourcing-chat/reveal", data).then((res) => res.data),
  createJob: (data: {
    conversation_id: string;
    additional_fields?: Record<string, unknown>;
  }) => api.post("/sourcing-chat/create-job", data).then((res) => res.data),
  addToJob: (data: {
    conversation_id: string;
    candidate_ids: string[];
    job_id: string;
  }) => api.post("/sourcing-chat/add-to-job", data).then((res) => res.data),
  getConversation: (conversationId: string) =>
    api.get(`/sourcing-chat/${conversationId}`).then((res) => res.data),
  listConversations: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get("/sourcing-chat", { params }).then((res) => res.data),
};

// Credits API (Pay-per-reveal model)
export const creditsApi = {
  getBalance: () => api.get("/credits/balance").then((res) => res.data),
  getTransactions: (params?: { limit?: number; offset?: number }) =>
    api.get("/credits/transactions", { params }).then((res) => res.data),
  purchase: (data: { package: string; payment_method?: string }) =>
    api.post("/credits/purchase", data).then((res) => res.data),
};

// Phone Interview API (Web-based interviews)
export const phoneInterviewApi = {
  // Schedule a web-based interview
  scheduleWeb: (data: { application_id: string; is_simulation?: boolean }) =>
    api.post("/phone-interview/schedule-web", data).then((res) => res.data),
  // Get interview info (authenticated)
  get: (id: string) => api.get(`/phone-interview/${id}`).then((res) => res.data),
  // Public endpoints - no auth required
  getByToken: (token: string) =>
    api.get(`/phone-interview/token/${token}`).then((res) => res.data),
  getTranscript: (token: string) =>
    api.get(`/phone-interview/token/${token}/transcript`).then((res) => res.data),
  complete: (token: string) =>
    api.post(`/phone-interview/token/${token}/complete`).then((res) => res.data),
  // SSE endpoints - return URLs for EventSource
  getStartUrl: (token: string) =>
    `${API_URL}/api/v1/phone-interview/token/${token}/start`,
  getMessageUrl: (token: string, content: string) =>
    `${API_URL}/api/v1/phone-interview/token/${token}/message?content=${encodeURIComponent(content)}`,
};

// Voice Interview API (ElevenLabs browser voice)
export const voiceInterviewApi = {
  schedule: (data: { application_id: string }) =>
    api.post("/voice-interview/schedule", data).then((res) => res.data),
  createSession: (token: string) =>
    api.post(`/voice-interview/token/${token}/session`).then((res) => res.data),
  complete: (
    token: string,
    data: {
      elevenlabs_conversation_id?: string | null;
      client_transcript?: Array<{
        role: string;
        content: string;
        timestamp?: string;
      }>;
    }
  ) =>
    api
      .post(`/voice-interview/token/${token}/complete`, data)
      .then((res) => res.data),
};

// Speech-to-Text API (ElevenLabs Scribe)
export const speechApi = {
  transcribe: (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    return api
      .post<{ text: string; language_code: string }>("/speech-to-text", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => res.data);
  },
};

// Public API (no auth required)
export const publicApi = {
  getJob: (jobId: string) =>
    api.get(`/public/jobs/${jobId}`).then((res) => res.data),
  apply: (jobId: string, formData: FormData, ref?: string) =>
    api
      .post(`/public/jobs/${jobId}/apply${ref ? `?ref=${ref}` : ""}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => res.data),
};

// Campaign API
export const campaignApi = {
  create: (data: {
    name: string;
    job_id: string;
    description?: string;
    sequence: unknown[];
    sender_email?: string;
    sender_name?: string;
    reply_to_email?: string;
  }) => api.post("/campaigns", data),
  get: (id: string) => api.get(`/campaigns/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/campaigns/${id}`, data),
  list: (params?: { job_id?: string; status?: string; limit?: number }) =>
    api.get("/campaigns", { params }),
  updateStatus: (id: string, status: string) =>
    api.put(`/campaigns/${id}/status`, { status }),
  addRecipients: (id: string, sourced_candidate_ids: string[]) =>
    api.post(`/campaigns/${id}/recipients`, { sourced_candidate_ids }),
  getMessages: (id: string, params?: { status?: string; limit?: number }) =>
    api.get(`/campaigns/${id}/messages`, { params }),
  sendPending: (id: string, limit?: number) =>
    api.post(`/campaigns/${id}/send`, null, { params: { limit: limit || 50 } }),
  retryMessage: (messageId: string) =>
    api.post(`/campaigns/messages/${messageId}/retry`),
  getStats: (id: string) => api.get(`/campaigns/${id}/stats`),
};
