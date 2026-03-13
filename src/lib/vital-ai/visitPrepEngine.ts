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
  return "general-consult";
}

function buildPatientConcern(pathway: string, answers: ResponseMap) {
  if (includesToken(pathway, "wound")) {
    const location = firstText(answers, ["wound_location", "location_of_wound", "wound_site", "body_site"]) || "unspecified location";
    const duration = durationDays(firstText(answers, ["wound_duration", "duration", "wound_duration_weeks"]) || "");
    return `${duration != null && duration > 14 ? "Chronic wound" : "Wound concern"} - ${location}`;
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
    focus.push("consult review");
    if (pain >= 5) focus.push("symptom severity review");
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
