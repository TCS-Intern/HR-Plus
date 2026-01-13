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
  list: () => api.get("/jd"),
};

// Screening API
export const screeningApi = {
  start: (jobId: string) => api.post("/screen/start", { job_id: jobId }),
  uploadCV: (jobId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("job_id", jobId);
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
  getByToken: (token: string) => api.get(`/assess/token/${token}`),
  getForApplication: (applicationId: string) =>
    api.get(`/assess/application/${applicationId}/assessments`),
};

// Offer API
export const offerApi = {
  generate: (applicationId: string) =>
    api.post("/offer/generate", { application_id: applicationId }),
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
