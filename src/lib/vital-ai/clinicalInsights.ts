import type { ResponseMap, VitalAiFileRow, VitalAiResponseRow, VitalAiSessionRow } from "../vitalAi/types";

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
  const suggestedPriority = buildSuggestedPriority(pathway, answers, files);

  return {
    indicators,
    suggestedPriority,
    riskScore: buildRiskScore(indicators, suggestedPriority),
  };
}
