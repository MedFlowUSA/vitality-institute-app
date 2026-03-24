export type ProviderVisitStatus = string | null;
export type ProviderStructuredValues = Record<string, unknown>;

export type ProviderVisitSummary = {
  id: string;
  patient_id: string;
  location_id: string;
  visit_date: string;
  status: ProviderVisitStatus;
  summary: string | null;
};

export type ProviderPatientSummary = {
  id: string;
  profile_id: string | null;
};

export type SoapNoteSectionFields = {
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
};

export type SoapNoteRecord = SoapNoteSectionFields & {
  id: string;
  visit_id: string;
  patient_id: string;
  location_id: string;
  provider_profile_id: string | null;
  created_by: string;
  is_signed: boolean | null;
  is_locked: boolean | null;
  locked_at: string | null;
  signed_at: string | null;
  signed_by: string | null;
  created_at: string;
  updated_at: string;
  amended_from_id: string | null;
  amendment_reason: string | null;
  amendment_at: string | null;
  amendment_by: string | null;
};

export type TreatmentPlanStatus = "draft" | "active" | "completed";

export type TreatmentPlanData = {
  dressing_plan: string | null;
  frequency: string | null;
  offloading: string | null;
  follow_up_days: number | null;
  orders: string | null;
  medications: string | null;
};

export type TreatmentPlanRecord = {
  id: string;
  visit_id: string;
  patient_id: string;
  location_id: string;
  status: TreatmentPlanStatus | string | null;
  summary: string | null;
  patient_instructions: string | null;
  internal_notes: string | null;
  plan: TreatmentPlanData | null;
  signed_by: string | null;
  signed_at: string | null;
  is_locked: boolean | null;
  created_at: string;
  updated_at: string;
};

export type WoundLaterality = "left" | "right" | "bilateral" | "";
export type WoundExudateLevel = "none" | "low" | "moderate" | "high" | "";

export type WoundAssessmentRecord = {
  id: string;
  created_at: string;
  location_id: string;
  patient_id: string;
  visit_id: string;
  wound_label: string;
  body_site: string | null;
  laterality: WoundLaterality | null;
  wound_type: string | null;
  stage: string | null;
  length_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  undermining_cm: number | null;
  tunneling_cm: number | null;
  exudate: WoundExudateLevel | null;
  odor: string | null;
  infection_signs: string | null;
  necrotic_pct: number | null;
  slough_pct: number | null;
  granulation_pct: number | null;
  epithelial_pct: number | null;
  pain_score: number | null;
  notes: string | null;
  photo_file_id: string | null;
};

export type ProviderLabStatus = "ordered" | "collected" | "resulted" | "reviewed" | "cancelled";

export type ProviderHealingCurveRow = {
  id: string;
  created_at: string;
  visit_id: string;
  wound_label: string;
  body_site: string | null;
  laterality: WoundLaterality | null;
  wound_type: string | null;
  length_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  area_cm2: number | null;
};
