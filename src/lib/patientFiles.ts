// src/lib/patientFiles.ts
import { supabase } from "./supabase";

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

export function buildPatientFilePath(opts: {
  locationId: string;
  patientId: string;
  visitId?: string | null;
  filename: string;
}) {
  const clean = safeName(opts.filename);
  const ts = Date.now();
  const folder = opts.visitId ? opts.visitId : "general";
  return `${opts.locationId}/${opts.patientId}/${folder}/${ts}_${clean}`;
}

export async function uploadPatientFile(opts: {
  file: File;
  locationId: string;
  patientId: string;
  visitId?: string | null;
}) {
  const bucket = "patient-files";

  const path = buildPatientFilePath({
    locationId: opts.locationId,
    patientId: opts.patientId,
    visitId: opts.visitId ?? null,
    filename: opts.file.name,
  });

  const { data, error } = await supabase.storage.from(bucket).upload(path, opts.file, {
    upsert: false,
    contentType: opts.file.type,
  });

  if (error) throw new Error(error.message);

  return { bucket, path: data.path };
}

export async function getSignedUrl(bucket: string, path: string, seconds = 120) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
