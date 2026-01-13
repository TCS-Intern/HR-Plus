// Database types matching Supabase schema

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "admin" | "hiring_manager" | "recruiter" | "interviewer";
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  job_type: "full-time" | "part-time" | "contract" | "internship";
  remote_policy: "remote" | "hybrid" | "onsite";
  summary: string | null;
  description: string | null;
  responsibilities: string[];
  qualifications: {
    required: string[];
    preferred: string[];
  };
  skills_matrix: {
    required: Skill[];
    nice_to_have: Skill[];
  };
  evaluation_criteria: EvaluationCriterion[];
  suggested_questions: {
    technical: string[];
    behavioral: string[];
    situational: string[];
  };
  salary_range: {
    min: number | null;
    max: number | null;
    currency: string;
  };
  status: "draft" | "active" | "paused" | "closed" | "filled";
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  skill: string;
  proficiency: "beginner" | "intermediate" | "advanced" | "expert";
  weight: number;
}

export interface EvaluationCriterion {
  criterion: string;
  weight: number;
  description: string;
  assessment_method: "interview" | "technical" | "behavioral" | "portfolio";
}

export interface Candidate {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  linkedin_url: string | null;
  linkedin_data: Record<string, unknown> | null;
  resume_url: string | null;
  resume_parsed: Record<string, unknown> | null;
  source: "linkedin" | "referral" | "direct" | "job_board";
  source_details: string | null;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  job_id: string;
  candidate_id: string;
  status:
    | "new"
    | "screening"
    | "shortlisted"
    | "assessment"
    | "offer"
    | "hired"
    | "rejected"
    | "withdrawn";
  screening_score: number | null;
  screening_recommendation:
    | "strong_match"
    | "potential_match"
    | "weak_match"
    | null;
  screening_notes: Record<string, unknown> | null;
  match_breakdown: Record<string, unknown> | null;
  strengths: string[];
  gaps: string[];
  red_flags: string[];
  current_stage: string;
  stage_history: StageHistoryEntry[];
  applied_at: string;
  screened_at: string | null;
  shortlisted_at: string | null;
  assessed_at: string | null;
  offered_at: string | null;
  hired_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  candidate?: Candidate;
  job?: Job;
}

export interface StageHistoryEntry {
  stage: string;
  timestamp: string;
  actor: string;
}

export interface Assessment {
  id: string;
  application_id: string;
  assessment_type: "video" | "technical" | "take_home";
  questions: AssessmentQuestion[];
  scheduled_at: string | null;
  scheduled_duration_minutes: number;
  calendar_event_id: string | null;
  video_url: string | null;
  video_duration_seconds: number | null;
  video_analysis: VideoAnalysis | null;
  response_scores: ResponseScore[];
  overall_score: number | null;
  recommendation: "STRONG_YES" | "YES" | "MAYBE" | "NO" | null;
  confidence_level: "high" | "medium" | "low" | null;
  summary: AssessmentSummary | null;
  status: "pending" | "scheduled" | "in_progress" | "completed" | "analyzed" | "expired";
  completed_at: string | null;
  analyzed_at: string | null;
  behavioral_analysis_enabled: boolean;
  access_token: string;
  token_expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface AssessmentQuestion {
  question_id: string;
  question_type: "technical" | "behavioral" | "situational";
  question_text: string;
  time_limit: number;
  rubric: Record<string, string>;
  key_topics: string[];
}

export interface VideoAnalysis {
  response_analysis: ResponseAnalysis[];
  communication_assessment: CommunicationAssessment;
  behavioral_assessment: BehavioralAssessment;
}

export interface ResponseAnalysis {
  question_id: string;
  relevance_score: number;
  depth_score: number;
  key_points: string[];
  missed_topics: string[];
}

export interface CommunicationAssessment {
  clarity: number;
  vocabulary: number;
  structure: number;
  pace: "too_slow" | "good" | "too_fast";
  filler_frequency: "low" | "medium" | "high";
}

export interface BehavioralAssessment {
  confidence: number;
  engagement: number;
  professionalism: number;
  observations: string[];
}

export interface ResponseScore {
  question_id: string;
  score: number;
  feedback: string;
}

export interface AssessmentSummary {
  top_strengths: string[];
  areas_of_concern: string[];
  hiring_recommendation: string;
}

export interface Offer {
  id: string;
  application_id: string;
  base_salary: number;
  currency: string;
  signing_bonus: number;
  annual_bonus_target: number | null;
  equity_type: "options" | "rsu" | "none" | null;
  equity_amount: number | null;
  equity_vesting_schedule: string | null;
  benefits: Benefit[];
  start_date: string | null;
  offer_expiry_date: string | null;
  offer_letter_url: string | null;
  contract_url: string | null;
  contingencies: string[];
  negotiation_notes: NegotiationNote[];
  negotiation_guidance: NegotiationGuidance | null;
  status:
    | "draft"
    | "pending_approval"
    | "approved"
    | "sent"
    | "viewed"
    | "accepted"
    | "rejected"
    | "negotiating"
    | "expired";
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  response_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Benefit {
  benefit_type: string;
  description: string;
  value_estimate: number | null;
}

export interface NegotiationNote {
  timestamp: string;
  note: string;
  actor: string;
}

export interface NegotiationGuidance {
  salary_flexibility: {
    min: number;
    max: number;
  };
  other_levers: string[];
  walk_away_point: number;
}

export interface AgentLog {
  id: string;
  agent_type: "jd_assist" | "screener" | "assessor" | "offer_gen";
  action: string;
  entity_type: "job" | "candidate" | "application" | "assessment" | "offer" | null;
  entity_id: string | null;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  tokens_used: number | null;
  latency_ms: number | null;
  model_used: string | null;
  status: "success" | "error" | "partial";
  error_message: string | null;
  error_details: Record<string, unknown> | null;
  triggered_by: string | null;
  created_at: string;
}

// Dashboard types
export interface PipelineMetrics {
  total_applicants: number;
  screened: number;
  assessed: number;
  offers: number;
  hired: number;
}

export interface AgentStatus {
  name: string;
  status: "active" | "idle" | "error";
  last_action: string;
  actions_today: number;
}

// Screening types
export interface ScreenedCandidate {
  application_id: string;
  candidate_id: string;
  candidate: Candidate;
  screening_score: number | null;
  screening_recommendation: "strong_match" | "potential_match" | "weak_match" | null;
  match_breakdown: {
    skills_match?: number;
    experience_match?: number;
    education_match?: number;
    culture_fit?: number;
  } | null;
  strengths: string[];
  gaps: string[];
  red_flags: string[];
  status: Application["status"];
  screened_at: string | null;
}

export interface ScreeningResponse {
  job_id: string;
  job_title: string;
  total_candidates: number;
  candidates: ScreenedCandidate[];
}
