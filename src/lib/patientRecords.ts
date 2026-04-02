import { supabase } from "./supabase";

export type PatientIdRow = {
  id: string;
};

function getRawErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "";
}

export function isProviderAccountLinkingError(error: unknown) {
  const message = getRawErrorMessage(error).toLowerCase();
  if (!message) return false;

  return (
    message.includes("physician account is not linked") ||
    message.includes("physician record yet") ||
    message.includes("physicians.user_id") ||
    message.includes("before creating patients")
  );
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (isProviderAccountLinkingError(error)) {
    return "Your provider account setup is not fully linked for patient creation yet. Ask an admin to finish linking your provider profile before creating a new patient chart.";
  }

  const message = getRawErrorMessage(error);
  if (message) return message;
  return fallback;
}

export function isDatabaseErrorWithCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code === code
  );
}

export async function getPatientRecordIdForProfile(profileId: string) {
  const { data, error } = await supabase
    .from("patients")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle<PatientIdRow>();

  if (error) throw error;
  return data?.id ?? null;
}
