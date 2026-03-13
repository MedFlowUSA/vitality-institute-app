import type { ResponseMap, VitalAiFileRow, VitalAiResponseRow, VitalAiSessionRow } from "../vitalAi/types";

export type VitalAiTreatmentPlan = {
  opportunities: string[];
};

function responsesToMap(rows: VitalAiResponseRow[]): ResponseMap {
  const next: ResponseMap = {};
  for (const row of rows) next[row.question_key] = row.value_json;
  return next;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
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

export function detectTreatmentOpportunities(_session: VitalAiSessionRow, responses: VitalAiResponseRow[], files: VitalAiFileRow[]): VitalAiTreatmentPlan {
  const answers = responsesToMap(responses);
  const opportunities: string[] = [];
  const duration = durationDays(asText(answers.wound_duration ?? answers.duration ?? answers.wound_duration_weeks) || "");
  const diabetes = asBool(answers.has_diabetes ?? answers.diabetes ?? answers.diabetes_reported);
  const infection = asBool(answers.infection_concern ?? answers.signs_of_infection);
  const drainage = asText(answers.drainage_amount ?? answers.exudate ?? answers.drainage);
  const hasImages = files.some((file) => (file.content_type ?? "").startsWith("image/") || file.category.includes("image"));

  if (duration != null && duration > 14) {
    opportunities.push("biologic graft evaluation");
    opportunities.push("debridement evaluation");
  }
  if (diabetes || infection) opportunities.push("hyperbaric consult");
  if (hasImages || drainage) opportunities.push("wound imaging comparison");

  return { opportunities: Array.from(new Set(opportunities)) };
}
