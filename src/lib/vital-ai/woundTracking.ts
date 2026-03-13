import { supabase } from "../supabase";
import type { ResponseMap, VitalAiFileRow, VitalAiResponseRow, VitalAiSessionRow } from "../vitalAi/types";

export type WoundObservation = {
  sessionId: string;
  patientId: string | null;
  timestamp: string;
  woundLocation: string | null;
  duration: string | null;
  length: number | null;
  width: number | null;
  area: number | null;
  images: VitalAiFileRow[];
};

export type HealingTrend = {
  percentChange: number | null;
  direction: "improving" | "stable" | "worsening";
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

function isWoundPathway(session: VitalAiSessionRow, answers: ResponseMap) {
  const stepKey = (session.current_step_key ?? "").toLowerCase();
  return Boolean(
    stepKey.includes("wound") ||
      firstText(answers, ["wound_location", "location_of_wound", "wound_site", "body_site", "wound_duration", "drainage_amount"])
  );
}

function roundArea(length: number | null, width: number | null) {
  if (length == null || width == null) return null;
  return Number((length * width).toFixed(2));
}

function selectImages(files: VitalAiFileRow[]) {
  return files.filter((file) => (file.content_type ?? "").startsWith("image/") || file.category.toLowerCase().includes("image"));
}

export function recordWoundObservation(
  session: VitalAiSessionRow,
  responses: VitalAiResponseRow[],
  files: VitalAiFileRow[]
): WoundObservation | null {
  const answers = responsesToMap(responses);
  if (!isWoundPathway(session, answers)) return null;

  const length = firstNumber(answers, ["wound_length", "wound_length_cm", "length_cm", "length"]);
  const width = firstNumber(answers, ["wound_width", "wound_width_cm", "width_cm", "width"]);
  const woundLocation = firstText(answers, ["wound_location", "location_of_wound", "wound_site", "body_site"]) || null;
  const duration = firstText(answers, ["wound_duration", "duration", "wound_duration_weeks"]) || null;
  const images = selectImages(files);
  const area = roundArea(length, width);

  if (length == null && width == null && !woundLocation && images.length === 0) return null;

  return {
    sessionId: session.id,
    patientId: session.patient_id,
    timestamp: session.completed_at ?? session.last_saved_at ?? session.updated_at ?? session.created_at,
    woundLocation,
    duration,
    length,
    width,
    area,
    images,
  };
}

export async function getWoundHistory(patientId: string) {
  const { data: sessionsData, error: sessionsError } = await supabase
    .from("vital_ai_sessions")
    .select("*")
    .eq("patient_id", patientId)
    .eq("status", "submitted")
    .order("created_at", { ascending: true });

  if (sessionsError) throw sessionsError;

  const sessions = (sessionsData as VitalAiSessionRow[]) ?? [];
  if (sessions.length === 0) return [] as WoundObservation[];

  const sessionIds = sessions.map((session) => session.id);

  const [{ data: responsesData, error: responsesError }, { data: filesData, error: filesError }] = await Promise.all([
    supabase.from("vital_ai_responses").select("*").in("session_id", sessionIds).order("updated_at", { ascending: true }),
    supabase.from("vital_ai_files").select("*").in("session_id", sessionIds).order("created_at", { ascending: true }),
  ]);

  if (responsesError) throw responsesError;
  if (filesError) throw filesError;

  const responses = (responsesData as VitalAiResponseRow[]) ?? [];
  const files = (filesData as VitalAiFileRow[]) ?? [];

  const responsesBySession = new Map<string, VitalAiResponseRow[]>();
  for (const row of responses) {
    const nextRows = responsesBySession.get(row.session_id) ?? [];
    nextRows.push(row);
    responsesBySession.set(row.session_id, nextRows);
  }

  const filesBySession = new Map<string, VitalAiFileRow[]>();
  for (const file of files) {
    const nextFiles = filesBySession.get(file.session_id) ?? [];
    nextFiles.push(file);
    filesBySession.set(file.session_id, nextFiles);
  }

  return sessions
    .map((session) => recordWoundObservation(session, responsesBySession.get(session.id) ?? [], filesBySession.get(session.id) ?? []))
    .filter((row): row is WoundObservation => Boolean(row))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function calculateHealingTrend(history: WoundObservation[]): HealingTrend {
  const withArea = history.filter((row) => row.area != null);
  if (withArea.length < 2) {
    return {
      percentChange: null,
      direction: "stable",
    };
  }

  const first = withArea[0].area ?? null;
  const latest = withArea[withArea.length - 1].area ?? null;
  if (first == null || latest == null || first <= 0) {
    return {
      percentChange: null,
      direction: "stable",
    };
  }

  const percentChange = Number((((first - latest) / first) * 100).toFixed(1));
  if (percentChange >= 5) {
    return { percentChange, direction: "improving" };
  }
  if (percentChange <= -5) {
    return { percentChange, direction: "worsening" };
  }
  return { percentChange, direction: "stable" };
}
