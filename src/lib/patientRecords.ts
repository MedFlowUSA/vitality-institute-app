import { supabase } from "./supabase";

export type PatientIdRow = {
  id: string;
};

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
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
