import { supabase } from "../supabase";

type VisitRpcResult = { id?: string | null } | string | null;

type ExistingVisitRow = { id: string };
type ProfileRow = { id: string; profile_id: string | null };

type StartVisitArgs = {
  appointmentId: string;
  patientCandidateId: string;
  locationId: string;
};

export async function resolvePatientRecordId(candidateId: string) {
  const { data: byProfile, error: byProfileError } = await supabase
    .from("patients")
    .select("id,profile_id")
    .eq("profile_id", candidateId)
    .maybeSingle<ProfileRow>();

  if (byProfileError) throw byProfileError;
  if (byProfile?.id) return byProfile.id;

  const { data: byId, error: byIdError } = await supabase
    .from("patients")
    .select("id,profile_id")
    .eq("id", candidateId)
    .maybeSingle<ProfileRow>();

  if (byIdError) throw byIdError;
  if (!byId?.id) throw new Error("Patient record not found.");
  return byId.id;
}

function getVisitIdFromRpc(result: VisitRpcResult) {
  if (typeof result === "string") return result;
  if (result && typeof result === "object" && "id" in result) return result.id ?? null;
  return null;
}

export async function startVisitFromAppointment({ appointmentId, patientCandidateId, locationId }: StartVisitArgs) {
  const patientId = await resolvePatientRecordId(patientCandidateId);

  const { data: existingVisit, error: visitErr } = await supabase
    .from("patient_visits")
    .select("id")
    .eq("appointment_id", appointmentId)
    .maybeSingle<ExistingVisitRow>();

  if (visitErr) throw visitErr;

  if (existingVisit?.id) {
    return { patientId, visitId: existingVisit.id, reusedExistingVisit: true };
  }

  const { data: visitId, error: rpcErr } = await supabase.rpc("start_patient_visit", {
    p_patient: patientId,
    p_location: locationId,
    p_appointment: appointmentId,
  });

  if (rpcErr) throw rpcErr;

  const nextVisitId = getVisitIdFromRpc(visitId as VisitRpcResult);
  if (!nextVisitId) throw new Error("Visit created but no visitId was returned.");

  return { patientId, visitId: nextVisitId, reusedExistingVisit: false };
}
