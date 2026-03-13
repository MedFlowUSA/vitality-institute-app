import type { ResponseMap, VitalAiFileRow, VitalAiResponseRow, VitalAiSessionRow } from "../vitalAi/types";
import { buildWoundMeasurementSummary } from "./woundMetrics";

export type VitalAiClinicalInsights = {
  indicators: string[];
  suggestedPriority: "low" | "moderate" | "high";
  riskScore: number;
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
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
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

function includesToken(value: string, token: string): boolean {
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

function inferPathway(pathwaySlug: string | null | undefined, answers: ResponseMap): string {
  if (pathwaySlug) return pathwaySlug;
  if (firstText(answers, ["wound_location", "wound_duration", "drainage_amount", "exudate"])) return "wound-care";
  if (firstText(answers, ["current_weight", "goal_weight", "prior_glp1_use", "diabetes_status"])) return "glp1";
  if (firstText(answers, ["peptide_primary_goal", "prior_peptide_use", "relevant_symptoms"])) return "peptides";
  if (firstText(answers, ["energy_level", "sleep_quality", "stress_level", "health_goals"])) return "wellness";
  return "general-consult";
}

function buildIndicators(pathway: string, answers: ResponseMap, files: VitalAiFileRow[]): string[] {
  const indicators: string[] = [];
  const pain = firstNumber(answers, ["pain_level", "pain_score", "wound_pain_score"]);
  const duration = firstText(answers, ["wound_duration", "duration", "wound_duration_weeks"]);
  const durationInDays = durationDays(duration);

  if (includesToken(pathway, "wound")) {
    if (durationInDays != null && durationInDays > 14) indicators.push("chronic wound");
    if (firstBool(answers, ["has_diabetes", "diabetes", "diabetes_reported"])) indicators.push("diabetes risk factor");
    if (firstBool(answers, ["infection_concern", "signs_of_infection"])) indicators.push("infection indicators present");

    const drainage = firstText(answers, ["drainage_amount", "exudate", "drainage"]);
    if (drainage) {
      indicators.push("active drainage");
    }

    const imageCount = files.filter((file) => (file.content_type ?? "").startsWith("image/") || file.category.includes("image")).length;
    if (imageCount > 0) indicators.push("wound imaging available");
  }

  if (includesToken(pathway, "glp1")) {
    const weight = firstNumber(answers, ["current_weight"]);
    const goalWeight = firstNumber(answers, ["goal_weight"]);
    const heightInches = firstNumber(answers, ["height_inches"]);
    const bmi = weight != null && heightInches != null && heightInches > 0
      ? Number((((weight / (heightInches * heightInches)) * 703)).toFixed(1))
      : null;

    if (bmi != null && bmi >= 30) indicators.push(`BMI ${bmi}`);
    const diabetes = firstText(answers, ["diabetes_status"]);
    if (diabetes && !includesToken(diabetes, "none")) indicators.push(`${diabetes} history`);
    if (firstBool(answers, ["pancreatitis_history"])) indicators.push("pancreatitis history");
    if (firstBool(answers, ["thyroid_history"])) indicators.push("thyroid history");
    if (firstBool(answers, ["gallbladder_history"])) indicators.push("gallbladder history");
    if (firstText(answers, ["gi_symptoms"])) indicators.push("GI symptoms reported");
    if (firstBool(answers, ["prior_glp1_use"])) indicators.push("prior GLP-1 use");
    if (goalWeight != null && weight != null && goalWeight < weight) indicators.push("active weight-loss goal");
  }

  if (includesToken(pathway, "wellness")) {
    if (includesToken(firstText(answers, ["energy_level"]), "low")) indicators.push("low energy reported");
    if (includesToken(firstText(answers, ["sleep_quality"]), "poor")) indicators.push("poor sleep quality");
    if (includesToken(firstText(answers, ["stress_level"]), "high")) indicators.push("high stress reported");
    if (includesToken(firstText(answers, ["hydration_level"]), "dehydrated")) indicators.push("hydration concerns");
    if (includesToken(firstText(answers, ["exercise_frequency"]), "rarely")) indicators.push("low exercise frequency");
  }

  if (includesToken(pathway, "peptide")) {
    if (firstBool(answers, ["prior_peptide_use"])) indicators.push("prior peptide use");
    if (firstText(answers, ["medication_allergies"])) indicators.push("medication allergies noted");
    if (firstText(answers, ["relevant_symptoms"])) indicators.push("symptoms reported");
    if (firstText(answers, ["peptide_primary_goal"])) indicators.push(`${firstText(answers, ["peptide_primary_goal"])} goal`);
  }

  if (pain != null && pain >= 8) indicators.push("high pain reported");
  if (pain != null && pain >= 5 && pain < 8) indicators.push("moderate pain reported");

  return Array.from(new Set(indicators));
}

function buildSuggestedPriority(pathway: string, answers: ResponseMap, files: VitalAiFileRow[]): "low" | "moderate" | "high" {
  const indicators = buildIndicators(pathway, answers, files);

  if (includesToken(pathway, "wound")) {
    if (indicators.some((item) => includesToken(item, "infection"))) return "high";
    if (indicators.some((item) => includesToken(item, "chronic wound"))) return "moderate";
    return "low";
  }

  if (includesToken(pathway, "glp1")) {
    if (indicators.some((item) => includesToken(item, "pancreatitis")) || indicators.some((item) => includesToken(item, "thyroid"))) {
      return "high";
    }
    if (indicators.some((item) => includesToken(item, "BMI")) || indicators.some((item) => includesToken(item, "diabetes"))) {
      return "moderate";
    }
    return "low";
  }

  if (includesToken(pathway, "peptide")) {
    if (indicators.some((item) => includesToken(item, "allerg"))) return "moderate";
    return indicators.length >= 2 ? "moderate" : "low";
  }

  if (includesToken(pathway, "wellness")) {
    return indicators.length >= 3 ? "moderate" : "low";
  }

  if (indicators.some((item) => includesToken(item, "high pain"))) return "moderate";
  return "low";
}

function buildRiskScore(indicators: string[], suggestedPriority: "low" | "moderate" | "high") {
  const base = suggestedPriority === "high" ? 80 : suggestedPriority === "moderate" ? 50 : 20;
  return Math.min(100, base + indicators.length * 5);
}

export function generateClinicalInsights(
  session: VitalAiSessionRow,
  responses: VitalAiResponseRow[],
  files: VitalAiFileRow[]
): VitalAiClinicalInsights {
  const answers = responsesToMap(responses);
  const pathway = inferPathway(session.current_step_key ?? null, answers);
  const indicators = buildIndicators(pathway, answers, files);
  const woundMeasurement = buildWoundMeasurementSummary(session, responses, files);
  if (woundMeasurement?.areaCm2 != null) indicators.push(`estimated wound area ${woundMeasurement.areaCm2} cm2`);
  if (woundMeasurement?.depthCm != null) indicators.push(`wound depth ${woundMeasurement.depthCm} cm`);
  const suggestedPriority = buildSuggestedPriority(pathway, answers, files);

  return {
    indicators: Array.from(new Set(indicators)),
    suggestedPriority,
    riskScore: buildRiskScore(Array.from(new Set(indicators)), suggestedPriority),
  };
}
