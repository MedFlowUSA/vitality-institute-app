import type { ResponseMap, VitalAiFileRow, VitalAiResponseRow, VitalAiSessionRow } from "../vitalAi/types";

export type VitalAiVisitPreparation = {
  patientConcern: string;
  keyIndicators: string[];
  fileSummary: string;
  suggestedFocus: string[];
  treatmentConsiderations: string[];
  suggestedVisitDuration: string;
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

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value.replace(/[^\d.-]/g, "");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstText(answers: ResponseMap, keys: string[]): string {
  for (const key of keys) {
    const value = asText(answers[key]);
    if (value) return value;
  }
  return "";
}

function firstBool(answers: ResponseMap, keys: string[]): boolean {
  for (const key of keys) {
    if (asBool(answers[key])) return true;
  }
  return false;
}

function firstNumber(answers: ResponseMap, keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumber(answers[key]);
    if (value != null) return value;
  }
  return null;
}

function includesToken(value: string, token: string) {
  return value.toLowerCase().includes(token.toLowerCase());
}

function durationDays(durationText: string): number | null {
  const normalized = durationText.toLowerCase();
  const numberMatch = normalized.match(/(\d+(\.\d+)?)/);
  const amount = numberMatch ? Number(numberMatch[1]) : null;
  if (amount == null) return null;
  if (normalized.includes("month")) return amount * 30;
  if (normalized.includes("week")) return amount * 7;
  if (normalized.includes("year")) return amount * 365;
  return amount;
}

function inferPathway(pathwaySlug: string | null | undefined, answers: ResponseMap) {
  if (pathwaySlug) return pathwaySlug;
  if (firstText(answers, ["wound_location", "wound_duration", "drainage_amount", "exudate"])) return "wound-care";
  if (firstText(answers, ["current_weight", "goal_weight", "prior_glp1_use", "diabetes_status"])) return "glp1";
  if (firstText(answers, ["peptide_primary_goal", "prior_peptide_use", "relevant_symptoms"])) return "peptides";
  if (firstText(answers, ["energy_level", "sleep_quality", "stress_level", "health_goals"])) return "wellness";
  return "general-consult";
}

function buildPatientConcern(pathway: string, answers: ResponseMap) {
  if (includesToken(pathway, "wound")) {
    const location = firstText(answers, ["wound_location", "location_of_wound", "wound_site", "body_site"]) || "unspecified location";
    const duration = durationDays(firstText(answers, ["wound_duration", "duration", "wound_duration_weeks"]) || "");
    return `${duration != null && duration > 14 ? "Chronic wound" : "Wound concern"} - ${location}`;
  }

  if (includesToken(pathway, "glp1")) {
    const diabetes = firstText(answers, ["diabetes_status"]);
    if (diabetes && !includesToken(diabetes, "none")) return "GLP-1 consultation - metabolic weight management";
    return "GLP-1 consultation - weight management";
  }

  if (includesToken(pathway, "wellness")) {
    return `Wellness consultation - ${firstText(answers, ["health_goals", "interest_areas"]) || "health optimization"}`;
  }

  if (includesToken(pathway, "peptide")) {
    return `Peptide consultation - ${firstText(answers, ["peptide_primary_goal"]) || "goal review"}`;
  }

  return firstText(answers, ["primary_concern", "reason_for_visit", "visit_reason", "chief_concern"]) || "General consultation request";
}

function buildKeyIndicators(pathway: string, answers: ResponseMap) {
  const items: string[] = [];
  const durationText = firstText(answers, ["wound_duration", "duration", "wound_duration_weeks"]);
  const duration = durationDays(durationText);
  const drainage = firstText(answers, ["drainage_amount", "exudate", "drainage"]);
  const swelling = firstText(answers, ["swelling", "edema", "swelling_present"]);
  const pain = firstNumber(answers, ["pain_level", "pain_score", "wound_pain_score"]);

  if (includesToken(pathway, "wound")) {
    if (firstBool(answers, ["has_diabetes", "diabetes", "diabetes_reported"])) items.push("diabetes");
    if (duration != null && duration > 14) items.push("wound present > 14 days");
    if (firstBool(answers, ["infection_concern", "signs_of_infection"])) items.push("infection indicators");
    if (drainage) items.push(`${drainage} drainage`);
    if (swelling) items.push("swelling reported");
  }

  if (includesToken(pathway, "glp1")) {
    const diabetes = firstText(answers, ["diabetes_status"]);
    const giSymptoms = firstText(answers, ["gi_symptoms"]);
    const weight = firstNumber(answers, ["current_weight"]);
    const goal = firstNumber(answers, ["goal_weight"]);
    const height = firstNumber(answers, ["height_inches"]);
    const bmi = weight != null && goal != null && height != null && height > 0 ? Number((((weight / (height * height)) * 703)).toFixed(1)) : null;

    if (bmi != null && bmi >= 30) items.push(`BMI ${bmi}`);
    if (diabetes && !includesToken(diabetes, "none")) items.push(`${diabetes} history`);
    if (firstBool(answers, ["pancreatitis_history"])) items.push("pancreatitis history");
    if (firstBool(answers, ["thyroid_history"])) items.push("thyroid history");
    if (firstBool(answers, ["gallbladder_history"])) items.push("gallbladder history");
    if (giSymptoms) items.push("GI symptoms reported");
    if (weight != null && goal != null && goal < weight) items.push("active weight-loss goal");
  }

  if (includesToken(pathway, "wellness")) {
    const energy = firstText(answers, ["energy_level"]);
    const sleep = firstText(answers, ["sleep_quality"]);
    const stress = firstText(answers, ["stress_level"]);
    if (includesToken(energy, "low")) items.push("low energy");
    if (includesToken(sleep, "poor")) items.push("poor sleep quality");
    if (includesToken(stress, "high")) items.push("high stress");
    if (firstText(answers, ["symptom_concerns"])) items.push("symptom concerns reported");
  }

  if (includesToken(pathway, "peptide")) {
    const goal = firstText(answers, ["peptide_primary_goal"]);
    if (goal) items.push(`${goal} goal`);
    if (firstBool(answers, ["prior_peptide_use"])) items.push("prior peptide use");
    if (firstText(answers, ["medication_allergies"])) items.push("medication allergies noted");
    if (firstText(answers, ["relevant_symptoms"])) items.push("symptoms reported");
  }

  if (pain != null && pain >= 8) items.push("high pain severity");
  else if (pain != null && pain >= 5) items.push("moderate pain severity");

  return Array.from(new Set(items));
}

function buildFileSummary(files: VitalAiFileRow[]) {
  const imageCount = files.filter((file) => (file.content_type ?? "").startsWith("image/") || file.category.toLowerCase().includes("image")).length;
  const otherCount = files.length - imageCount;

  if (files.length === 0) return "No uploaded files";
  if (imageCount > 0 && otherCount === 0) return `${imageCount} wound ${imageCount === 1 ? "photo" : "photos"}`;
  if (imageCount > 0 && otherCount > 0) return `${imageCount} wound ${imageCount === 1 ? "photo" : "photos"} and ${otherCount} supporting ${otherCount === 1 ? "file" : "files"}`;
  return `${otherCount} supporting ${otherCount === 1 ? "file" : "files"}`;
}

function buildSuggestedFocus(pathway: string, answers: ResponseMap) {
  const focus: string[] = [];
  const duration = durationDays(firstText(answers, ["wound_duration", "duration", "wound_duration_weeks"]) || "");
  const infection = firstBool(answers, ["infection_concern", "signs_of_infection"]);
  const diabetes = firstBool(answers, ["has_diabetes", "diabetes", "diabetes_reported"]);
  const pain = firstNumber(answers, ["pain_level", "pain_score", "wound_pain_score"]) ?? 0;

  if (includesToken(pathway, "wound")) {
    focus.push("wound evaluation");
    if (infection) focus.push("infection screening");
    if (diabetes || duration != null && duration > 14) focus.push("vascular assessment");
    if (pain >= 5) focus.push("pain management review");
  } else {
    if (includesToken(pathway, "glp1")) {
      focus.push("metabolic assessment");
      focus.push("medication safety review");
      if (firstText(answers, ["weight_loss_history"])) focus.push("weight-loss history review");
      if (firstText(answers, ["gi_symptoms"]) || firstBool(answers, ["pancreatitis_history", "gallbladder_history", "thyroid_history"])) {
        focus.push("contraindication screening");
      }
    } else if (includesToken(pathway, "wellness")) {
      focus.push("wellness baseline review");
      focus.push("lifestyle assessment");
      if (firstText(answers, ["prior_labs_available"]).includes("yes") || firstBool(answers, ["prior_labs_available"])) focus.push("lab review");
    } else if (includesToken(pathway, "peptide")) {
      focus.push("goal alignment review");
      focus.push("medication and allergy review");
      focus.push("peptide candidacy review");
    } else {
      focus.push("consult review");
      if (pain >= 5) focus.push("symptom severity review");
    }
  }

  return Array.from(new Set(focus));
}

function buildTreatmentConsiderations(pathway: string, answers: ResponseMap, files: VitalAiFileRow[]) {
  const items: string[] = [];
  const duration = durationDays(firstText(answers, ["wound_duration", "duration", "wound_duration_weeks"]) || "");
  const diabetes = firstBool(answers, ["has_diabetes", "diabetes", "diabetes_reported"]);
  const infection = firstBool(answers, ["infection_concern", "signs_of_infection"]);
  const drainage = firstText(answers, ["drainage_amount", "exudate", "drainage"]);
  const hasImages = files.some((file) => (file.content_type ?? "").startsWith("image/") || file.category.toLowerCase().includes("image"));

  if (includesToken(pathway, "wound")) {
    if (duration != null && duration > 14) items.push("biologic graft evaluation");
    if (duration != null && duration > 7 || drainage || infection) items.push("debridement");
    if (diabetes || infection) items.push("hyperbaric consult");
    if (hasImages) items.push("wound imaging comparison");
  }

  if (includesToken(pathway, "glp1")) {
    items.push("GLP-1 candidacy review");
    if (firstText(answers, ["diabetes_status"]) && !includesToken(firstText(answers, ["diabetes_status"]), "none")) items.push("metabolic lab review");
    if (firstText(answers, ["current_weight"]) && firstText(answers, ["goal_weight"])) items.push("nutrition and weight-loss planning");
  }

  if (includesToken(pathway, "wellness")) {
    items.push("wellness optimization review");
    if (firstText(answers, ["prior_labs_available"]).includes("yes") || firstBool(answers, ["prior_labs_available"])) items.push("lab review");
    if (firstText(answers, ["interest_areas"])) items.push("targeted wellness planning");
  }

  if (includesToken(pathway, "peptide")) {
    items.push("peptide candidacy review");
    if (firstText(answers, ["peptide_primary_goal"])) items.push("goal-specific protocol review");
    if (firstText(answers, ["supporting_records"]) || files.length > 0) items.push("supporting record review");
  }

  return Array.from(new Set(items));
}

function buildSuggestedVisitDuration(pathway: string, answers: ResponseMap) {
  const duration = durationDays(firstText(answers, ["wound_duration", "duration", "wound_duration_weeks"]) || "");
  const diabetes = firstBool(answers, ["has_diabetes", "diabetes", "diabetes_reported"]);
  const infection = firstBool(answers, ["infection_concern", "signs_of_infection"]);
  const pain = firstNumber(answers, ["pain_level", "pain_score", "wound_pain_score"]) ?? 0;
  const visitType = firstText(answers, ["visit_type", "appointment_type"]);

  if (includesToken(pathway, "wound") && (infection || diabetes || (duration != null && duration > 14) || pain >= 5)) {
    return "30 minutes";
  }
  if (includesToken(pathway, "glp1")) {
    return firstBool(answers, ["pancreatitis_history", "thyroid_history", "gallbladder_history"]) ? "30 minutes" : "20 minutes";
  }
  if (includesToken(pathway, "wellness")) {
    return firstText(answers, ["symptom_concerns"]) ? "20 minutes" : "15 minutes";
  }
  if (includesToken(pathway, "peptide")) {
    return "20 minutes";
  }
  if (includesToken(visitType, "follow")) {
    return "15 minutes";
  }
  return includesToken(pathway, "wound") ? "20 minutes" : "20 minutes";
}

export function generateVisitPreparation(
  session: VitalAiSessionRow,
  responses: VitalAiResponseRow[],
  files: VitalAiFileRow[]
): VitalAiVisitPreparation {
  const answers = responsesToMap(responses);
  const pathway = inferPathway(session.current_step_key ?? null, answers);

  return {
    patientConcern: buildPatientConcern(pathway, answers),
    keyIndicators: buildKeyIndicators(pathway, answers),
    fileSummary: buildFileSummary(files),
    suggestedFocus: buildSuggestedFocus(pathway, answers),
    treatmentConsiderations: buildTreatmentConsiderations(pathway, answers, files),
    suggestedVisitDuration: buildSuggestedVisitDuration(pathway, answers),
  };
}
