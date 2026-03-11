// src/lib/referralFiles.ts
import { supabase } from "./supabase";

export type ReferralFileCategory =
  | "insurance_front"
  | "insurance_back"
  | "wound_photo"
  | "measurements"
  | "history"
  | "care_plan"
  | "infection_docs"
  | "other";

export async function uploadReferralFile(opts: {
  referralId: string;
  file: File;
  category: ReferralFileCategory;
  uploadedBy?: string | null;
  bucket?: string; // default patient-files
}) {
  const bucket = opts.bucket ?? "patient-files";
  const safeName = opts.file.name.replace(/[^\w.\-]+/g, "_");
  const path = `referrals/${opts.referralId}/${Date.now()}_${safeName}`;

  // 1) upload to storage
  const { error: upErr } = await supabase.storage.from(bucket).upload(path, opts.file, {
    cacheControl: "3600",
    upsert: false,
    contentType: opts.file.type || undefined,
  });
  if (upErr) throw upErr;

  // 2) create DB row
  const { data, error: dbErr } = await supabase
    .from("referral_files")
    .insert([
      {
        referral_id: opts.referralId,
        uploaded_by: opts.uploadedBy ?? null,
        bucket,
        path,
        filename: opts.file.name,
        content_type: opts.file.type ?? null,
        size_bytes: opts.file.size ?? null,
        category: opts.category,
      },
    ])
    .select("id")
    .maybeSingle();

  if (dbErr) throw dbErr;

  return { id: data?.id as string, bucket, path };
}
