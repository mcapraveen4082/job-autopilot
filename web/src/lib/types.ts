export type JobStatus =
  | "new" | "skipped" | "queued" | "needs_approval" | "approved"
  | "applying" | "applied" | "failed" | "manual";

export interface Question {
  label: string;
  type: string;            // text, textarea, select, radio, checkbox, file
  required: boolean;
  options?: string[];
  answer?: string;
  source?: string;         // profile, saved, ai, you
}

export interface Job {
  id: string;
  user_id: string;
  source: string;
  external_id: string;
  company: string;
  title: string;
  location: string;
  url: string;
  apply_url: string;
  apply_email: string;
  description: string;
  posted_at: string | null;
  match_score: number | null;
  match_reason: string;
  missing_skills: string[];
  status: JobStatus;
  status_reason: string;
  questions: Question[];
  cover_letter: string;
  applied_at: string | null;
  created_at: string;
}

export interface Profile {
  user_id: string;
  full_name: string; first_name: string; last_name: string;
  email: string; phone: string; location: string;
  current_title: string; current_company: string;
  years_experience: number; notice_period: string;
  current_ctc: string; expected_ctc: string;
  linkedin_url: string; github_url: string; portfolio_url: string;
  work_authorization: string; willing_to_relocate: boolean;
  resume_path: string | null; resume_text: string; summary: string;
}

export interface Settings {
  user_id: string;
  target_roles: string[]; skills: string[]; locations: string[];
  remote_ok: boolean; exclude_keywords: string[];
  min_match_score: number; daily_limit: number; max_per_run: number;
  max_job_age_days: number; mode: "auto" | "review";
  approve_if_missing_skills: boolean; paused: boolean; notify_email: string;
}

export interface Company {
  id: string; user_id: string; name: string;
  ats: "greenhouse" | "lever" | "ashby"; slug: string;
  active: boolean; last_checked_at: string | null;
}

export interface Answer {
  id: string; user_id: string; question: string; normalized: string; answer: string;
}

export interface Run {
  id: string; started_at: string; finished_at: string | null;
  found: number; matched: number; applied: number;
  needs_approval: number; failed: number; ai_calls: number; log: string;
}
