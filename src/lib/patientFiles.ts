// src/lib/patientFiles.ts
import { supabase } from "./supabase";

type UploadArgs = {
  patientId: string;
  locationId: string;
  visitId: string | null;
  appointmentId?: string | null;
  category: string;
  file: File;
};

export type UploadedPatientFile = {
  id?: string | null;
  bucket: string;
  path: string;
  filename: string;
};

export async function uploadPatientFile(args: UploadArgs): Promise<UploadedPatientFile> {
  const { patientId, locationId, visitId, appointmentId = null, category, file } = args;

  if (!patientId) throw new Error("Missing patientId");
  if (!locationId) throw new Error("Missing locationId");
  if (!category) throw new Error("Missing category");
  if (!file) throw new Error("Missing file");

  const bucket = "patient-files";

  // patient_files.patient_id expects auth.users.id; callers may pass patients.id.
  let effectivePatientId = patientId;
  const { data: patientRow } = await supabase
    .from("patients")
    .select("profile_id")
    .eq("id", patientId)
    .maybeSingle();
  if (patientRow?.profile_id) effectivePatientId = patientRow.profile_id as string;

  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const ext = safeName.includes(".") ? safeName.split(".").pop() : "";
  const stamp = Date.now();
  const filename = ext ? `${stamp}_${safeName}` : `${stamp}_${safeName}`;

  let path = `patients/${effectivePatientId}`;
  if (appointmentId) path += `/appointments/${appointmentId}`;
  else if (visitId) path += `/visits/${visitId}`;
  else path += `/misc`;

  path += `/${category}/${filename}`;

  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (upErr) throw upErr;

  const authUser = await supabase.auth.getUser();

  const { data: inserted, error: insErr } = await supabase
    .from("patient_files")
    .insert({
      patient_id: effectivePatientId,
      location_id: locationId,
      visit_id: visitId,
      appointment_id: appointmentId,
      uploaded_by: authUser.data.user?.id ?? null,
      bucket,
      path,
      filename: file.name,
      content_type: file.type || null,
      size_bytes: file.size || null,
      category,
    })
    .select("bucket,path,filename")
    .maybeSingle();

  if (insErr) throw insErr;

  return inserted ?? { bucket, path, filename: file.name };
}

export async function getSignedUrl(bucket: string, path: string, expiresInSeconds = 60 * 60) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
