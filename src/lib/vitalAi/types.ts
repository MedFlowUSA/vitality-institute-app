export type VitalAiPathwayRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  version: number;
  definition_json: PathwayDefinition;
  created_at?: string;
  updated_at?: string;
};

export type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "boolean"
  | "file"
  | "image";

export type VisibilityCondition = {
  key: string;
  operator?: "equals" | "not_equals" | "truthy" | "falsy" | "includes";
  value?: unknown;
};

export type IntakeQuestion = {
  key: string;
  label: string;
  type: QuestionType;
  required?: boolean;
  helpText?: string;
  options?: string[];
  category?: string;
  visibleWhen?: VisibilityCondition[];
};

export type IntakeStep = {
  key: string;
  title: string;
  description?: string;
  questions: IntakeQuestion[];
  visibleWhen?: VisibilityCondition[];
};

export type PathwayDefinition = {
  pathwayKey: string;
  title: string;
  description?: string;
  steps: IntakeStep[];
};

export type VitalAiSessionRow = {
  id: string;
  pathway_id: string;
  patient_id: string | null;
  profile_id: string | null;
  status: "draft" | "submitted" | "cancelled";
  current_step_key: string | null;
  source: string | null;
  started_at: string;
  completed_at: string | null;
  last_saved_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VitalAiResponseRow = {
  id: string;
  session_id: string;
  question_key: string;
  value_json: unknown;
  updated_at: string;
};

export type VitalAiFileRow = {
  id: string;
  session_id: string;
  patient_id: string | null;
  profile_id: string | null;
  bucket: string;
  path: string;
  filename: string;
  content_type: string | null;
  category: string;
  created_at: string;
};

export type VitalAiProfileRow = {
  id: string;
  session_id: string;
  pathway_id: string;
  patient_id: string | null;
  profile_id: string | null;
  summary: string | null;
  profile_json: Record<string, unknown>;
  risk_flags_json: unknown;
  triage_level: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type VitalAiLeadRow = {
  id: string;
  session_id: string;
  pathway_id: string;
  patient_id: string | null;
  profile_id: string | null;
  lead_status: string;
  priority: string | null;
  assigned_to: string | null;
  next_action_at: string | null;
  lead_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type VitalAiReviewTaskRow = {
  id: string;
  session_id: string;
  profile_id: string | null;
  lead_id: string | null;
  task_type: "staff_follow_up" | "provider_review";
  assigned_role: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type PatientRecord = {
  id: string;
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  dob: string | null;
};

export type ResponseMap = Record<string, unknown>;
