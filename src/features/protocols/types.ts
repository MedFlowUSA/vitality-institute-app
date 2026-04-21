import type { PatientRecord, ResponseMap, VitalAiFileRow, VitalAiPathwayRow, VitalAiProfileRow, VitalAiSessionRow } from "../../lib/vitalAi/types";

export type ProtocolServiceLine =
  | "glp1"
  | "trt"
  | "wellness"
  | "peptides"
  | "general_consult"
  | "wound_care";

export type ProtocolRecommendationType =
  | "candidate_review"
  | "missing_information"
  | "follow_up_needed";

export type ProviderProtocolDecision =
  | "approved"
  | "modified"
  | "rejected";

export type StructuredProtocolSuggestion = {
  recommendation_type: ProtocolRecommendationType;
  service_line: ProtocolServiceLine;
  suggested_program: string | null;
  suggested_medications: string[];
  suggested_dosage: string | null;
  suggested_frequency: string | null;
  suggested_duration: string | null;
  rationale_summary: string;
  risk_flags: string[];
  contraindications: string[];
  missing_required_labs: string[];
  followup_recommendations: string[];
  provider_review_required: true;
  confidence_notes: string;
  advisory_note: string;
};

export type AiProtocolAssessmentRow = {
  id: string;
  vital_ai_session_id: string;
  vital_ai_profile_id: string | null;
  patient_id: string | null;
  intake_submission_id: string | null;
  clinic_id: string;
  location_id: string | null;
  service_line: ProtocolServiceLine;
  recommendation_type: ProtocolRecommendationType;
  raw_output_json: Record<string, unknown>;
  structured_output_json: StructuredProtocolSuggestion;
  model_key: string;
  model_version: string;
  status: "generated" | "reviewed" | "archived" | "error";
  provider_review_required: boolean;
  created_at: string;
  updated_at: string;
};

export type ProtocolTemplateRow = {
  id: string;
  clinic_id: string | null;
  service_line: ProtocolServiceLine;
  name: string;
  config_json: Record<string, unknown>;
  is_active: boolean;
  template_version: number;
  created_at: string;
  updated_at: string;
};

export type ProtocolAssessmentInput = {
  session: VitalAiSessionRow;
  pathway: VitalAiPathwayRow;
  profile: VitalAiProfileRow | null;
  patient: PatientRecord | null;
  answers: ResponseMap;
  files: VitalAiFileRow[];
};

export type ProviderProtocolReviewRow = {
  id: string;
  ai_protocol_assessment_id: string;
  provider_id: string;
  clinic_id: string;
  decision: ProviderProtocolDecision;
  final_protocol_json: StructuredProtocolSuggestion & {
    provider_notes?: string | null;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
  };
  provider_notes: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
};
