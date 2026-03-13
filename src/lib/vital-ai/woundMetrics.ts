import type { ResponseMap, VitalAiFileRow, VitalAiResponseRow, VitalAiSessionRow } from "../vitalAi/types";
import { getWoundHistory, type WoundObservation } from "./woundTracking";

export type VitalAiWoundMeasurementSummary = {
  woundLocation: string | null;
  duration: string | null;
  lengthCm: number | null;
  widthCm: number | null;
  depthCm: number | null;
  areaCm2: number | null;
  woundImagesUploaded: boolean;
  uploadedImageCount: number;
};

export type VitalAiWoundProgressComparison = {
  previousAreaCm2: number | null;
  currentAreaCm2: number | null;
  percentChange: number | null;
  interpretation: "improving" | "stable" | "worsening" | "insufficient_data";
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
    return asText(record.label ?? record.value ?? "");
  }
  return "";
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

function firstNumber(answers: ResponseMap, keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumber(answers[key]);
    if (value != null) return value;
  }
  return null;
}

function isWoundPathway(pathwaySlug: string | null | undefined, answers: ResponseMap) {
  return Boolean(
    (pathwaySlug ?? "").toLowerCase().includes("wound") ||
      firstText(answers, ["wound_location", "wound_duration", "wound_length_cm", "wound_width_cm"])
  );
}

function roundArea(length: number | null, width: number | null) {
  if (length == null || width == null) return null;
  return Number((length * width).toFixed(2));
}

export function buildWoundMeasurementSummary(
  session: VitalAiSessionRow,
  responses: VitalAiResponseRow[],
  files: VitalAiFileRow[]
): VitalAiWoundMeasurementSummary | null {
  const answers = responsesToMap(responses);
  if (!isWoundPathway(session.current_step_key ?? null, answers)) return null;

  const lengthCm = firstNumber(answers, ["wound_length_cm", "wound_length", "length_cm", "length"]);
  const widthCm = firstNumber(answers, ["wound_width_cm", "wound_width", "width_cm", "width"]);
  const depthCm = firstNumber(answers, ["wound_depth_cm", "wound_depth", "depth_cm", "depth"]);
  const woundLocation =
    firstText(answers, ["wound_location_other", "wound_location", "location_of_wound", "wound_site", "body_site"]) || null;
  const duration = firstText(answers, ["wound_duration", "duration", "wound_duration_weeks"]) || null;
  const uploadedImageCount = files.filter(
    (file) => (file.content_type ?? "").startsWith("image/") || file.category.toLowerCase().includes("image")
  ).length;

  return {
    woundLocation,
    duration,
    lengthCm,
    widthCm,
    depthCm,
    areaCm2: roundArea(lengthCm, widthCm),
    woundImagesUploaded: uploadedImageCount > 0,
    uploadedImageCount,
  };
}

export function compareWoundMeasurements(
  current: VitalAiWoundMeasurementSummary | null,
  priorHistory: WoundObservation[],
  currentSessionId: string
): VitalAiWoundProgressComparison {
  if (!current?.areaCm2) {
    return {
      previousAreaCm2: null,
      currentAreaCm2: current?.areaCm2 ?? null,
      percentChange: null,
      interpretation: "insufficient_data",
    };
  }

  const previous = [...priorHistory]
    .filter((entry) => entry.sessionId !== currentSessionId && entry.area != null)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] ?? null;

  if (!previous?.area) {
    return {
      previousAreaCm2: null,
      currentAreaCm2: current.areaCm2,
      percentChange: null,
      interpretation: "insufficient_data",
    };
  }

  const percentChange = Number((((previous.area - current.areaCm2) / previous.area) * 100).toFixed(1));
  if (percentChange >= 5) {
    return {
      previousAreaCm2: previous.area,
      currentAreaCm2: current.areaCm2,
      percentChange,
      interpretation: "improving",
    };
  }
  if (percentChange <= -5) {
    return {
      previousAreaCm2: previous.area,
      currentAreaCm2: current.areaCm2,
      percentChange,
      interpretation: "worsening",
    };
  }
  return {
    previousAreaCm2: previous.area,
    currentAreaCm2: current.areaCm2,
    percentChange,
    interpretation: "stable",
  };
}

export async function buildWoundProgressSnapshot(
  session: VitalAiSessionRow,
  responses: VitalAiResponseRow[],
  files: VitalAiFileRow[]
) {
  const measurement = buildWoundMeasurementSummary(session, responses, files);
  if (!measurement || !session.patient_id) {
    return {
      measurement,
      comparison: {
        previousAreaCm2: null,
        currentAreaCm2: measurement?.areaCm2 ?? null,
        percentChange: null,
        interpretation: "insufficient_data" as const,
      },
    };
  }

  const history = await getWoundHistory(session.patient_id);
  return {
    measurement,
    comparison: compareWoundMeasurements(measurement, history, session.id),
  };
}

export function buildWoundMeasurementIndicator(summary: VitalAiWoundMeasurementSummary | null) {
  if (!summary?.areaCm2) return "";
  const parts = [`estimated area ${summary.areaCm2} cm2`];
  if (summary.depthCm != null) parts.push(`depth ${summary.depthCm} cm`);
  return parts.join(", ");
}

export function isWoundCareSession(session: VitalAiSessionRow, responses: VitalAiResponseRow[]) {
  const answers = responsesToMap(responses);
  return isWoundPathway(session.current_step_key ?? null, answers);
}
