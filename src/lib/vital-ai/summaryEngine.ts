import type { ResponseMap, VitalAiFileRow, VitalAiResponseRow, VitalAiSessionRow } from "../vitalAi/types";

export type VitalAiSummary = {
  concern: string;
  duration: string | null;
  indicators: string[];
  fileCount: number;
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

function includesToken(value: string, token: string) {
  return value.toLowerCase().includes(token.toLowerCase());
}

function firstText(answers: ResponseMap, keys: string[]): string {
  for (const key of keys) {
    const value = asText(answers[key]);
    if (value) return value;
  }
  return "";
}

function inferPathway(answers: ResponseMap): string {
  if (firstText(answers, ["wound_location", "wound_duration", "drainage_amount", "exudate"])) return "wound_care";
  if (firstText(answers, ["current_weight", "goal_weight", "prior_glp1_use", "diabetes_status"])) return "glp1";
  if (firstText(answers, ["peptide_primary_goal", "prior_peptide_use", "relevant_symptoms"])) return "peptides";
  if (firstText(answers, ["energy_level", "sleep_quality", "stress_level", "health_goals"])) return "wellness";
  return "general_consult";
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

export function generateSummary(_session: VitalAiSessionRow, responses: VitalAiResponseRow[], files: VitalAiFileRow[]): VitalAiSummary {
  const answers = responsesToMap(responses);
  const pathway = inferPathway(answers);
  const duration = firstText(answers, ["wound_duration", "duration", "wound_duration_weeks"]) || null;
  const indicators: string[] = [];

  if (pathway === "wound_care") {
    const woundLocation = firstText(answers, ["wound_location", "location_of_wound", "wound_site"]) || "unspecified location";
    const concernPrefix = duration && (durationDays(duration) ?? 0) > 14 ? "Chronic wound" : "Wound concern";
    const concern = `${concernPrefix} - ${woundLocation}`;

    if (duration && (durationDays(duration) ?? 0) > 14) indicators.push("chronic wound");
    if (asBool(answers.has_diabetes ?? answers.diabetes ?? answers.diabetes_reported)) indicators.push("diabetes risk factor");
    if (firstText(answers, ["drainage_amount", "exudate", "drainage"])) indicators.push("active drainage");

    return {
      concern,
      duration,
      indicators,
      fileCount: files.length,
    };
  }

  if (pathway === "glp1") {
    const weight = firstText(answers, ["current_weight"]);
    const goalWeight = firstText(answers, ["goal_weight"]);
    const heightInches = Number(firstText(answers, ["height_inches"]) || 0);
    const weightValue = Number(weight || 0);
    const bmi =
      weightValue > 0 && heightInches > 0 ? Number((((weightValue / (heightInches * heightInches)) * 703)).toFixed(1)) : null;

    if (firstText(answers, ["diabetes_status"]).includes("diabetes")) indicators.push("diabetes history reported");
    if (asBool(answers.pancreatitis_history)) indicators.push("pancreatitis history");
    if (asBool(answers.thyroid_history)) indicators.push("thyroid history");
    if (asBool(answers.gallbladder_history)) indicators.push("gallbladder history");
    if (firstText(answers, ["gi_symptoms"])) indicators.push("GI symptoms reported");

    return {
      concern: "GLP-1 consultation - weight management",
      duration: bmi != null ? `BMI ${bmi}${goalWeight ? ` - goal weight ${goalWeight} lb` : ""}` : weight && goalWeight ? `${weight} lb to ${goalWeight} lb goal` : null,
      indicators,
      fileCount: files.length,
    };
  }

  if (pathway === "wellness") {
    const goals = firstText(answers, ["health_goals", "interest_areas"]) || "health optimization";
    const energy = firstText(answers, ["energy_level"]);
    const sleep = firstText(answers, ["sleep_quality"]);
    const stress = firstText(answers, ["stress_level"]);

    if (includesToken(energy, "low")) indicators.push("low energy reported");
    if (includesToken(sleep, "poor")) indicators.push("poor sleep quality");
    if (includesToken(stress, "high")) indicators.push("high stress reported");
    if (firstText(answers, ["symptom_concerns"])) indicators.push("symptom concerns noted");

    return {
      concern: `Wellness optimization - ${goals}`,
      duration: [energy, sleep].filter(Boolean).join(" / ") || null,
      indicators,
      fileCount: files.length,
    };
  }

  if (pathway === "peptides") {
    const goal = firstText(answers, ["peptide_primary_goal"]) || "performance and recovery";
    if (asBool(answers.prior_peptide_use)) indicators.push("prior peptide use");
    if (firstText(answers, ["medication_allergies"])) indicators.push("medication allergies noted");
    if (firstText(answers, ["relevant_symptoms"])) indicators.push("symptoms reported");

    return {
      concern: `Peptide consultation - ${goal}`,
      duration: firstText(answers, ["prior_peptide_details"]) || null,
      indicators,
      fileCount: files.length,
    };
  }

  return {
    concern: firstText(answers, ["primary_concern", "reason_for_visit", "visit_reason", "chief_concern"]) || "General consultation",
    duration,
    indicators,
    fileCount: files.length,
  };
}
