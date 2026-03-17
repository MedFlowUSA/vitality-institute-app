import { supabase } from "../supabase";

type EnsureLegacyAppointmentThreadInput = {
  appointmentId: string;
  patientCandidateId: string;
  locationId: string;
  title?: string | null;
};

async function resolvePatientProfileId(candidateId: string) {
  if (!candidateId) {
    throw new Error("Missing patient id.");
  }

  const { data: byPatientId, error: byPatientIdError } = await supabase
    .from("patients")
    .select("profile_id")
    .eq("id", candidateId)
    .maybeSingle();

  if (byPatientIdError) {
    throw byPatientIdError;
  }

  if (byPatientId?.profile_id) {
    return byPatientId.profile_id as string;
  }

  const { data: byProfileId, error: byProfileIdError } = await supabase
    .from("patients")
    .select("profile_id")
    .eq("profile_id", candidateId)
    .maybeSingle();

  if (byProfileIdError) {
    throw byProfileIdError;
  }

  if (byProfileId?.profile_id) {
    return byProfileId.profile_id as string;
  }

  return candidateId;
}

export async function ensureLegacyAppointmentThread({
  appointmentId,
  patientCandidateId,
  locationId,
  title,
}: EnsureLegacyAppointmentThreadInput) {
  const patientProfileId = await resolvePatientProfileId(patientCandidateId);

  const { data: existingRows, error: existingError } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("appointment_id", appointmentId)
    .eq("patient_id", patientProfileId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (existingError) {
    throw existingError;
  }

  const existingThreadId = existingRows?.[0]?.id;
  if (existingThreadId) {
    return existingThreadId as string;
  }

  const { data: insertedRow, error: insertError } = await supabase
    .from("chat_threads")
    .insert([
      {
        location_id: locationId,
        patient_id: patientProfileId,
        appointment_id: appointmentId,
        subject: title?.trim() || "Appointment Message",
        status: "open",
      },
    ])
    .select("id")
    .maybeSingle();

  if (insertError) {
    throw insertError;
  }

  if (!insertedRow?.id) {
    throw new Error("Failed to create chat thread.");
  }

  return insertedRow.id as string;
}

export async function countLegacyOpenThreadsForPatient(patientProfileId: string) {
  const { count, error } = await supabase
    .from("chat_threads")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientProfileId)
    .eq("status", "open");

  if (error) {
    throw error;
  }

  return count ?? 0;
}
