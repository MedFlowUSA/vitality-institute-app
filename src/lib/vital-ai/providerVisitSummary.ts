import { buildWoundMeasurementSummary } from "./woundMetrics";
import type { VitalAiClinicalInsights } from "./clinicalInsights";
import type { VitalAiSummary } from "./summaryEngine";
import type { VitalAiTreatmentOpportunityResult } from "./treatmentOpportunityEngine";
import type { VitalAiVisitPreparation } from "./visitPrepEngine";
import type { ResponseMap, VitalAiFileRow, VitalAiResponseRow, VitalAiSessionRow } from "../vitalAi/types";

export type VitalAiProviderVisitSummary = {
  visitReason: string;
  conciseNarrative: string;
  keyFindings: string[];
  riskFlags: string[];
  treatmentOpportunities: string[];
  suggestedFocus: string[];
  suggestedNextSteps: string[];
};

function responsesToMap(rows: VitalAiResponseRow[]): ResponseMap {
  const next: ResponseMap = {};
  for (const row of rows) next[row.question_key] = row.value_json;
  return next;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asText(record.label ?? record.value ?? record.filename ?? "");
  }
  return "";
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "yes" || normalized === "true" || normalized === "y";
  }
  return false;
}

function firstText(answers: ResponseMap, keys: string[]) {
  for (const key of keys) {
    const value = asText(answers[key]);
    if (value) return value;
  }
  return "";
}

function includesToken(value: string, token: string) {
  return value.toLowerCase().includes(token.toLowerCase());
}

function inferPathway(pathwaySlug: string | null | undefined, answers: ResponseMap) {
  if (pathwaySlug) return pathwaySlug;
  if (firstText(answers, ["wound_location", "wound_duration", "wound_length_cm", "wound_width_cm"])) return "wound-care";
  if (firstText(answers, ["current_weight", "goal_weight", "prior_glp1_use", "diabetes_status"])) return "glp1";
  if (firstText(answers, ["peptide_primary_goal", "prior_peptide_use", "relevant_symptom_focus"])) return "peptides";
  if (firstText(answers, ["health_goal_primary", "energy_level", "sleep_quality", "stress_level"])) return "wellness";
  return "general-consult";
}

function joinReadable(parts: Array<string | null | undefined>) {
  return parts.map((item) => item?.trim()).filter(Boolean).join(", ");
}

export function generateProviderVisitSummary(
  session: VitalAiSessionRow,
  responses: VitalAiResponseRow[],
  files: VitalAiFileRow[],
  insights: {
    summary: VitalAiSummary;
    clinicalInsights: VitalAiClinicalInsights;
    visitPreparation: VitalAiVisitPreparation;
  },
  opportunities: VitalAiTreatmentOpportunityResult
): VitalAiProviderVisitSummary {
  const answers = responsesToMap(responses);
  const pathway = inferPathway(session.current_step_key ?? null, answers);
  const keyFindings = Array.from(new Set([...insights.visitPreparation.keyIndicators, ...insights.summary.indicators])).slice(0, 6);
  const riskFlags = insights.clinicalInsights.indicators;
  const treatmentOpportunityLabels = opportunities.opportunities.map((item) => item.label);
  const suggestedFocus = insights.visitPreparation.suggestedFocus;
  const suggestedNextSteps = [
    ...suggestedFocus.map((item) => `Review ${item}`),
    ...opportunities.opportunities.slice(0, 2).map((item) => `Consider ${item.label.toLowerCase()}`),
  ];

  if (includesToken(pathway, "wound")) {
    const woundLocation = firstText(answers, ["wound_location_other", "wound_location"]) || "unspecified location";
    const woundDuration = firstText(answers, ["wound_duration", "duration"]) || "unspecified duration";
    const drainage = firstText(answers, ["drainage_description", "drainage_amount", "drainage"]);
    const infectionConcern = asBool(answers.infection_concern ?? answers.signs_of_infection) || Boolean(firstText(answers, ["infection_symptoms"]));
    const woundMeasurements = buildWoundMeasurementSummary(session, responses, files);
    const woundPhotos = files.filter((file) => (file.content_type ?? "").startsWith("image/") || file.category.toLowerCase().includes("image")).length;
    const measurementText =
      woundMeasurements?.areaCm2 != null
        ? `Estimated wound area is ${woundMeasurements.areaCm2} cm2${woundMeasurements.depthCm != null ? ` with depth ${woundMeasurements.depthCm} cm` : ""}.`
        : null;
    const photoText = woundPhotos > 0 ? `Patient uploaded ${woundPhotos} wound ${woundPhotos === 1 ? "photo" : "photos"} for review.` : null;

    return {
      visitReason: insights.summary.concern,
      conciseNarrative: `Patient presents for wound-care evaluation of a ${woundLocation} wound reported for ${woundDuration}${drainage ? ` with ${drainage} drainage` : ""}${infectionConcern ? " and infection concern" : ""}. ${joinReadable([measurementText, photoText, "Provider should assess wound severity, chronicity, infection risk, and candidacy for advanced wound-care interventions."])}`,
      keyFindings,
      riskFlags,
      treatmentOpportunities: treatmentOpportunityLabels,
      suggestedFocus,
      suggestedNextSteps: Array.from(new Set(suggestedNextSteps.concat(["Review wound measurements and uploaded images", "Confirm wound severity and next-step wound-care plan"]))),
    };
  }

  if (includesToken(pathway, "glp1")) {
    const currentWeight = firstText(answers, ["current_weight"]);
    const height = firstText(answers, ["height_inches"]);
    const goalWeight = firstText(answers, ["goal_weight"]);
    const weightHistory = firstText(answers, ["weight_loss_history"]);
    const diabetesStatus = firstText(answers, ["diabetes_status"]);
    const historyFlags = [
      asBool(answers.pancreatitis_history) ? "pancreatitis history" : null,
      asBool(answers.thyroid_history) ? "thyroid history" : null,
      asBool(answers.gallbladder_history) ? "gallbladder history" : null,
    ].filter(Boolean) as string[];

    return {
      visitReason: insights.summary.concern,
      conciseNarrative: `Patient presents for GLP-1 consultation focused on weight-management goals.${currentWeight ? ` Current weight is ${currentWeight} lb` : ""}${height ? ` and height is ${height} in` : ""}${goalWeight ? ` with a goal weight of ${goalWeight} lb` : ""}. ${joinReadable([diabetesStatus && !includesToken(diabetesStatus, "none") ? `${diabetesStatus} was reported.` : null, historyFlags.length > 0 ? `${historyFlags.join(", ")} noted.` : null, weightHistory ? "Prior weight-loss history was provided for review." : null, "Provider should assess candidacy, safety history, and metabolic follow-up needs."])}`,
      keyFindings,
      riskFlags,
      treatmentOpportunities: treatmentOpportunityLabels,
      suggestedFocus,
      suggestedNextSteps: Array.from(new Set(suggestedNextSteps.concat(["Review weight-management history and goals", "Confirm metabolic risk factors and medication safety"]))),
    };
  }

  if (includesToken(pathway, "wellness")) {
    const primaryGoal = firstText(answers, ["health_goal_primary_other", "health_goal_primary", "health_goals"]) || "wellness optimization";
    const baseline = joinReadable([
      firstText(answers, ["energy_level"]) ? `energy ${firstText(answers, ["energy_level"])}` : null,
      firstText(answers, ["sleep_quality"]) ? `sleep ${firstText(answers, ["sleep_quality"])}` : null,
      firstText(answers, ["stress_level"]) ? `stress ${firstText(answers, ["stress_level"])}` : null,
      firstText(answers, ["hydration_level"]) ? `hydration ${firstText(answers, ["hydration_level"])}` : null,
    ]);
    const symptomFocus = firstText(answers, ["symptom_focus_other", "symptom_focus", "symptom_concerns"]);
    const labsAvailable = asBool(answers.prior_labs_available) || files.some((file) => file.category === "prior_labs");

    return {
      visitReason: insights.summary.concern,
      conciseNarrative: `Patient presents for wellness review with a primary focus on ${primaryGoal}.${baseline ? ` Baseline intake notes ${baseline}.` : ""}${symptomFocus ? ` Symptom focus includes ${symptomFocus}.` : ""}${labsAvailable ? " Supporting labs are available for provider review." : ""} Provider should assess wellness priorities, symptom drivers, and the most relevant optimization path for follow-up planning.`,
      keyFindings,
      riskFlags,
      treatmentOpportunities: treatmentOpportunityLabels,
      suggestedFocus,
      suggestedNextSteps: Array.from(new Set(suggestedNextSteps.concat(["Review baseline wellness markers", labsAvailable ? "Review uploaded labs and correlate with goals" : "Determine whether additional data is needed"]))),
    };
  }

  if (includesToken(pathway, "peptide")) {
    const primaryGoal = firstText(answers, ["peptide_primary_goal_other", "peptide_primary_goal"]) || "goal review";
    const priorPeptideUse = asBool(answers.prior_peptide_use);
    const symptomFocus = firstText(answers, ["relevant_symptom_focus_other", "relevant_symptom_focus", "relevant_symptoms"]);
    const medicationAllergies = firstText(answers, ["medication_allergies"]);
    const reviewDisclaimer = asBool(answers.provider_review_disclaimer);

    return {
      visitReason: insights.summary.concern,
      conciseNarrative: `Patient presents for peptide consultation with a primary goal of ${primaryGoal}.${priorPeptideUse ? " Prior peptide use was reported." : ""}${symptomFocus ? ` Symptom focus includes ${symptomFocus}.` : ""}${medicationAllergies ? " Medication or allergy considerations were documented." : ""}${reviewDisclaimer ? " Intake includes acknowledgment that provider approval is required." : ""} Provider should assess goal alignment, safety context, and whether peptide-support discussion is appropriate for the visit.`,
      keyFindings,
      riskFlags,
      treatmentOpportunities: treatmentOpportunityLabels,
      suggestedFocus,
      suggestedNextSteps: Array.from(new Set(suggestedNextSteps.concat(["Review prior peptide experience and goals", "Confirm medication and allergy considerations"]))),
    };
  }

  const visitReason = firstText(answers, ["primary_concern", "visit_reason", "reason_for_visit"]) || insights.summary.concern;
  const symptomFocus = firstText(answers, ["symptom_focus_other", "symptom_focus", "symptoms"]);
  const medicalHistory = firstText(answers, ["medical_history"]);
  const priorRecords = files.filter((file) => file.category === "intake_attachment").length;

  return {
    visitReason,
    conciseNarrative: `Patient presents for general consultation regarding ${visitReason}.${symptomFocus ? ` Symptom focus includes ${symptomFocus}.` : ""}${medicalHistory ? " Relevant medical history was provided in intake." : ""}${priorRecords > 0 ? ` ${priorRecords} prior ${priorRecords === 1 ? "record is" : "records are"} available for review.` : ""} Provider should clarify the main concern, review the history provided, and determine the best next-step clinical discussion.`,
    keyFindings,
    riskFlags,
    treatmentOpportunities: treatmentOpportunityLabels,
    suggestedFocus,
    suggestedNextSteps: Array.from(new Set(suggestedNextSteps.concat(["Clarify primary concern and symptom history", priorRecords > 0 ? "Review uploaded prior records before visit" : "Determine whether supporting records are needed"]))),
  };
}
