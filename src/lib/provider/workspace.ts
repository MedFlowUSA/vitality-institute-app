import { supabase } from "../supabase";

type ProviderPatientRow = {
  id: string | null;
  profile_id: string | null;
  first_name: string | null;
  last_name: string | null;
};

function uniqueIds(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildPatientDisplayName(firstName: string | null, lastName: string | null) {
  const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return fullName || "Patient";
}

export function normalizeProviderStatus(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function formatProviderStatusLabel(value: string | null | undefined) {
  const normalized = normalizeProviderStatus(value);
  if (!normalized) return "-";
  return titleCase(normalized.replaceAll("_", " "));
}

export function formatProviderShortId(value: string, length = 8) {
  const compact = value.replace(/^[a-z]+_/i, "");
  return (compact || value).slice(0, length);
}

export function isVisitClosedStatus(value: string | null | undefined) {
  const normalized = normalizeProviderStatus(value);
  return normalized === "closed" || normalized === "completed";
}

export function isInactiveAppointmentStatus(value: string | null | undefined) {
  const normalized = normalizeProviderStatus(value);
  return ["completed", "missed", "cancelled", "canceled"].includes(normalized);
}

type ProviderActionableAppointment = {
  start_time: string;
  status: string | null;
};

export function sortProviderActionableAppointments<T extends ProviderActionableAppointment>(appointments: T[]) {
  const now = Date.now();

  return [...appointments]
    .filter((item) => !isInactiveAppointmentStatus(item.status))
    .sort((a, b) => {
      const aTime = new Date(a.start_time).getTime();
      const bTime = new Date(b.start_time).getTime();
      const aUpcoming = Number.isFinite(aTime) && aTime >= now;
      const bUpcoming = Number.isFinite(bTime) && bTime >= now;

      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      if (aUpcoming && bUpcoming) return aTime - bTime;
      return bTime - aTime;
    });
}

export async function loadProviderPatientNames(candidateIds: string[]) {
  const ids = uniqueIds(candidateIds);
  if (ids.length === 0) return {} as Record<string, string>;

  const [{ data: byIdRows, error: byIdErr }, { data: byProfileRows, error: byProfileErr }] = await Promise.all([
    supabase.from("patients").select("id,profile_id,first_name,last_name").in("id", ids),
    supabase.from("patients").select("id,profile_id,first_name,last_name").in("profile_id", ids),
  ]);

  if (byIdErr) throw byIdErr;
  if (byProfileErr) throw byProfileErr;

  const names: Record<string, string> = {};
  [((byIdRows as ProviderPatientRow[] | null) ?? []), ((byProfileRows as ProviderPatientRow[] | null) ?? [])].forEach((group) => {
    group.forEach((row) => {
      const label = buildPatientDisplayName(row.first_name, row.last_name);
      if (row.id) names[row.id] = label;
      if (row.profile_id) names[row.profile_id] = label;
    });
  });

  return names;
}

export function getProviderPatientLabel(candidateId: string, patientNames: Record<string, string>) {
  return patientNames[candidateId] ?? `Patient ${formatProviderShortId(candidateId)}`;
}
