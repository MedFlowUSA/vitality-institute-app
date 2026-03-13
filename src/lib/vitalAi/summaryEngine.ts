import type { ResponseMap, VitalAiFileRow, VitalAiResponseRow, VitalAiSessionRow } from "./types";

export type VitalAiStructuredSummary = {
  concern: string;
  indicators: string[];
  durationSeverity: string[];
  uploadedFilesSummary: string;
  suggestedPriority: string;
};

function responsesToMap(rows: VitalAiResponseRow[]) {
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

function asBool(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "yes" || normalized === "true" || normalized === "y";
  }
  return false;
}

function asNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function includesToken(value: string, token: string) {
  return value.toLowerCase().includes(token.toLowerCase());
}

function firstText(answers: ResponseMap, keys: string[]) {
  for (const key of keys) {
    const text = asText(answers[key]);
    if (text) return text;
  }
  return "";
}

function firstBool(answers: ResponseMap, keys: string[]) {
  for (const key of keys) {
    if (asBool(answers[key])) return true;
  }
  return false;
}

function firstNumber(answers: ResponseMap, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(answers[key]);
    if (value != null) return value;
  }
  return null;
}

function inferPathway(pathwaySlug: string | null | undefined, answers: ResponseMap) {
  if (pathwaySlug) return pathwaySlug;
  if (firstText(answers, ["wound_location", "wound_duration", "drainage_amount", "exudate"])) return "wound-care";
  return "general-consult";
}

function durationDays(durationText: string) {
  const normalized = durationText.toLowerCase();
  const numberMatch = normalized.match(/(\d+(\.\d+)?)/);
  const amount = numberMatch ? Number(numberMatch[1]) : null;
  if (amount == null) return null;
  if (normalized.includes("month")) return amount * 30;
  if (normalized.includes("week")) return amount * 7;
  if (normalized.includes("year")) return amount * 365;
  return amount;
}

function buildConcern(pathway: string, answers: ResponseMap) {
  if (includesToken(pathway, "wound")) {
    const woundLocation = firstText(answers, ["wound_location", "location_of_wound", "wound_site"]) || "unspecified location";
    const duration = firstText(answers, ["wound_duration", "duration", "wound_duration_weeks"]);
    const days = durationDays(duration);
    const prefix = days != null && days > 14 ? "Chronic wound" : "Wound concern";
    return `${prefix} - ${woundLocation}`;
  }

  const concern = firstText(answers, ["primary_concern", "reason_for_visit", "visit_reason", "chief_concern"]) || "General consultation";
  const visitType = firstText(answers, ["visit_type", "appointment_type"]);
  return visitType ? `${visitType} - ${concern}` : concern;
}

function buildIndicators(pathway: string, answers: ResponseMap) {
  const indicators: string[] = [];

  if (includesToken(pathway, "wound")) {
    if (firstBool(answers, ["has_diabetes", "diabetes", "diabetes_reported"])) indicators.push("diabetes reported");
    if (firstBool(answers, ["infection_concern", "signs_of_infection"])) indicators.push("infection concern reported");
    if (firstBool(answers, ["multiple_wounds"])) indicators.push("multiple wounds reported");
    if (firstBool(answers, ["smokes", "smoker"])) indicators.push("smoking history reported");

    const drainage = firstText(answers, ["drainage_amount", "exudate", "drainage"]);
    if (drainage && (includesToken(drainage, "moderate") || includesToken(drainage, "heavy"))) {
      indicators.push(`${drainage} drainage`);
    }
  }

  const pain = firstNumber(answers, ["pain_level", "pain_score", "wound_pain_score"]);
  if (pain != null && pain >= 8) indicators.push("high pain reported");
  if (pain != null && pain >= 5 && pain < 8) indicators.push("moderate pain reported");

  const visitType = firstText(answers, ["visit_type", "appointment_type"]);
  if (visitType && includesToken(visitType, "follow")) indicators.push("follow-up requested");

  return indicators;
}

function buildDurationSeverity(answers: ResponseMap) {
  const items: string[] = [];
  const duration = firstText(answers, ["wound_duration", "duration", "wound_duration_weeks"]);
  const days = durationDays(duration);
  if (duration) {
    if (days != null && days > 14) items.push(`wound duration > 14 days (${duration})`);
    else items.push(`duration: ${duration}`);
  }

  const pain = firstNumber(answers, ["pain_level", "pain_score", "wound_pain_score"]);
  if (pain != null) items.push(`pain level: ${pain}/10`);

  const drainage = firstText(answers, ["drainage_amount", "exudate", "drainage"]);
  if (drainage) items.push(`drainage: ${drainage}`);

  return items;
}

function buildUploadedFilesSummary(files: VitalAiFileRow[]) {
  if (files.length === 0) return "No uploaded files";

  const imageCount = files.filter((file) => (file.content_type ?? "").startsWith("image/") || file.category.includes("image")).length;
  const recordCount = files.length - imageCount;
  const parts: string[] = [];

  if (imageCount > 0) parts.push(`${imageCount} wound ${imageCount === 1 ? "image" : "images"}`);
  if (recordCount > 0) parts.push(`${recordCount} supporting ${recordCount === 1 ? "file" : "files"}`);

  return parts.join(" and ");
}

function buildSuggestedPriority(pathway: string, answers: ResponseMap) {
  const pain = firstNumber(answers, ["pain_level", "pain_score", "wound_pain_score"]) ?? 0;
  const duration = durationDays(firstText(answers, ["wound_duration", "duration", "wound_duration_weeks"])) ?? 0;
  const infectionConcern = firstBool(answers, ["infection_concern", "signs_of_infection"]);
  const diabetes = firstBool(answers, ["has_diabetes", "diabetes", "diabetes_reported"]);
  const drainage = firstText(answers, ["drainage_amount", "exudate", "drainage"]);

  if (includesToken(pathway, "wound")) {
    if (infectionConcern || pain >= 8) return "High - schedule within 24 hours";
    if (diabetes || duration > 14 || includesToken(drainage, "moderate") || includesToken(drainage, "heavy")) {
      return "Moderate - schedule within 48 hours";
    }
    return "Standard - next available wound review";
  }

  if (pain >= 8 || includesToken(firstText(answers, ["primary_concern", "reason_for_visit", "chief_concern"]), "urgent")) {
    return "Moderate - review within 48 hours";
  }

  return "Standard - next available review";
}

export function buildVitalAiIntakeSummary(args: {
  session: VitalAiSessionRow;
  responses: VitalAiResponseRow[];
  files: VitalAiFileRow[];
  pathwaySlug?: string | null;
}) {
  const answers = responsesToMap(args.responses);
  const pathway = inferPathway(args.pathwaySlug, answers);

  return {
    concern: buildConcern(pathway, answers),
    indicators: buildIndicators(pathway, answers),
    durationSeverity: buildDurationSeverity(answers),
    uploadedFilesSummary: buildUploadedFilesSummary(args.files),
    suggestedPriority: buildSuggestedPriority(pathway, answers),
  } satisfies VitalAiStructuredSummary;
}
