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

function firstText(answers: ResponseMap, keys: string[]): string {
  for (const key of keys) {
    const value = asText(answers[key]);
    if (value) return value;
  }
  return "";
}

function inferPathway(answers: ResponseMap): string {
  if (firstText(answers, ["wound_location", "wound_duration", "drainage_amount", "exudate"])) return "wound_care";
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

  return {
    concern: firstText(answers, ["primary_concern", "reason_for_visit", "visit_reason", "chief_concern"]) || "General consultation",
    duration,
    indicators,
    fileCount: files.length,
  };
}
