// src/pages/PatientWoundIntake.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import VitalityHero from "../components/VitalityHero";
import {
  formatPatientFileSize,
  getSignedUrl,
  MAX_IMAGE_UPLOAD_BYTES,
  uploadPatientFile,
  validatePatientFileSelection,
} from "../lib/patientFiles";

type PatientRow = { id: string; profile_id: string; location_id: string | null };
type LocationRow = { id: string; name: string };

type UploadedItem = {
  filename: string;
  path: string;
  bucket: string;
  category: string;
  signedUrl?: string;
};

export default function PatientWoundIntake() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [location, setLocation] = useState<LocationRow | null>(null);

  // Simple form fields
  const [woundLocation, setWoundLocation] = useState("");
  const [woundDuration, setWoundDuration] = useState("");
  const [woundCause, setWoundCause] = useState("");
  const [priorTreatments, setPriorTreatments] = useState("");
  const [currentDressing, setCurrentDressing] = useState("");
  const [sex, setSex] = useState<"Male" | "Female" | "">("");
  const [painLevel, setPainLevel] = useState<number>(0);
  const [hasDiabetes, setHasDiabetes] = useState<"unknown" | "yes" | "no">("unknown");
  const [smokes, setSmokes] = useState<"unknown" | "yes" | "no">("unknown");
  const [medications, setMedications] = useState("");

  // Consent
  const [consentHipaa, setConsentHipaa] = useState(false);
  const [consentFinancial, setConsentFinancial] = useState(false);
  const [consentTreatment, setConsentTreatment] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");

  // Uploads
  const [uploads, setUploads] = useState<UploadedItem[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingCategories, setUploadingCategories] = useState<Record<string, boolean>>({});

  const consentAccepted = useMemo(
    () => consentHipaa && consentFinancial && consentTreatment && typedSignature.trim().length >= 3,
    [consentHipaa, consentFinancial, consentTreatment, typedSignature]
  );

  useEffect(() => {
    let mounted = true;

    async function boot() {
      setLoading(true);
      setUploadError(null);
      setPageError(null);

      try {
        if (!user?.id) return;

        // Find patient row by profile_id (profile_id = auth.users.id)
        const { data: p, error: pErr } = await supabase
          .from("patients")
          .select("id, profile_id, location_id")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (pErr) throw pErr;
        if (!p) throw new Error("Patient record not found for this user.");

        if (!mounted) return;
        setPatient(p as PatientRow);

        const { data: demographics, error: demographicsError } = await supabase
          .from("patient_demographics")
          .select("sex")
          .eq("patient_id", (p as PatientRow).id)
          .maybeSingle();

        if (demographicsError) throw demographicsError;
        if (!mounted) return;
        setSex(((demographics as { sex?: string | null } | null)?.sex as "Male" | "Female" | null) ?? "");

        // Resolve location (prefer patients.location_id, else first assigned user_location_roles)
        let locId = (p as any).location_id as string | null;

        if (!locId) {
          const { data: ulr, error: ulrErr } = await supabase
            .from("user_location_roles")
            .select("location_id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

          if (ulrErr) throw ulrErr;
          locId = (ulr?.location_id as string) || null;
        }

        if (!locId) throw new Error("No location assigned. Please contact support.");

        const { data: loc, error: locErr } = await supabase
          .from("locations")
          .select("id, name")
          .eq("id", locId)
          .single();

        if (locErr) throw locErr;

        if (!mounted) return;
        setLocation(loc as LocationRow);
      } catch (e: any) {
        console.error(e);
        if (mounted) setPageError(e?.message || "Failed to load wound intake page.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    boot();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  async function handleUpload(file: File, category: string) {
    if (!patient || !location || !user?.id) return;
    setUploadError(null);
    setUploadingCategories((prev) => ({ ...prev, [category]: true }));

    try {
      const inserted = (await uploadPatientFile({
        patientId: patient.id,
        locationId: location.id,
        visitId: null,
        category,
        file,
      })) as { bucket: string; path: string; filename: string };

      const signedUrl = await getSignedUrl(inserted.bucket, inserted.path);

      setUploads((prev) => [
        ...prev,
        {
          filename: inserted.filename,
          path: inserted.path,
          bucket: inserted.bucket,
          category,
          signedUrl,
        },
      ]);
    } catch (e: any) {
      console.error(e);
      setUploadError(e?.message || "Upload failed.");
    } finally {
      setUploadingCategories((prev) => ({ ...prev, [category]: false }));
    }
  }

  async function handleSelectedUploads(files: File[], category: string, options?: { allowPdf?: boolean; maxFiles?: number }) {
    const validationError = validatePatientFileSelection(files, {
      allowPdf: options?.allowPdf,
      maxFiles: options?.maxFiles,
      label:
        category === "id"
          ? "Photo ID"
          : category === "insurance"
            ? "Insurance card"
            : "Wound photos",
    });

    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploadError(null);
    for (const file of files) {
      await handleUpload(file, category);
    }
  }
  async function submitIntake() {
    if (!patient || !location) return;

    if (!consentAccepted) {
      alert("Please complete consent + typed signature.");
      return;
    }

    // Minimal validation for soft launch
    if (!woundLocation.trim() || !woundDuration.trim() || !sex) {
      alert("Please enter wound location, duration, and gender.");
      return;
    }

    setSubmitting(true);
    setPageError(null);

    try {
      const wound_data = {
        gender: sex,
        wound_location: woundLocation.trim(),
        wound_duration: woundDuration.trim(),
        wound_cause: woundCause.trim(),
        prior_treatments: priorTreatments.trim(),
        current_dressing: currentDressing.trim(),
        pain_level: painLevel,
        has_diabetes: hasDiabetes,
        smokes,
        uploads: uploads.map((u) => ({
          bucket: u.bucket,
          path: u.path,
          filename: u.filename,
          category: u.category,
        })),
      };

      const payload = {
        patient_id: patient.id,
        location_id: location.id,
        service_type: "wound_care",
        status: "submitted",
        wound_data,
        medications: medications.trim() || null,
        consent_accepted: true,
        consent_signed_name: typedSignature.trim(),
        consent_signed_at: new Date().toISOString(),
      };

      const { error: demographicsError } = await supabase.from("patient_demographics").upsert(
        [
          {
            patient_id: patient.id,
            sex,
          },
        ],
        { onConflict: "patient_id" }
      );
      if (demographicsError) throw demographicsError;

      const { error } = await supabase.from("patient_intakes").insert(payload);
      if (error) throw error;

      setSubmitted(true);
    } catch (e: any) {
      console.error(e);
      setPageError(e?.message || "Failed to submit intake.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <VitalityHero title="Wound Care Intake" subtitle="Loading..." />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="p-6">
        <VitalityHero
          title="We received your information"
          subtitle="Next steps: our clinical team will review your wound care intake. If we need anything else, we'll notify you inside your portal."
        />
        <div className="max-w-3xl mx-auto mt-6 bg-white/70 rounded-xl p-5 border">
          <div className="text-sm opacity-80">
            Location: <span className="font-medium">{location?.name}</span>
          </div>
          <div className="mt-4">
            <button className="btn btn-primary" type="button" onClick={() => nav("/patient")}>
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <VitalityHero
        title="Wound Care Intake"
        subtitle="Please complete this intake packet. A provider will review your submission before initiating communication."
      />

      <div className="max-w-3xl mx-auto mt-6 space-y-6">
        {pageError ? <div className="alert alert-error">{pageError}</div> : null}

        <div className="bg-white/70 rounded-xl p-5 border">
          <div className="text-sm opacity-80">
            Location: <span className="font-medium">{location?.name}</span>
          </div>
        </div>

        {/* Wound history */}
        <section className="bg-white/70 rounded-xl p-5 border space-y-4">
          <h2 className="text-lg font-semibold">Wound History</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <label className="form-control">
              <span className="label-text">Wound location (e.g., left foot, shin)</span>
              <input className="input input-bordered" value={woundLocation} onChange={(e) => setWoundLocation(e.target.value)} />
            </label>

            <label className="form-control">
              <span className="label-text">How long have you had this wound?</span>
              <input className="input input-bordered" value={woundDuration} onChange={(e) => setWoundDuration(e.target.value)} />
            </label>
          </div>

          <label className="form-control">
            <span className="label-text">Gender</span>
            <select className="select select-bordered" value={sex} onChange={(e) => setSex(e.target.value as "Male" | "Female" | "")}>
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </label>

          <label className="form-control">
            <span className="label-text">Cause (if known)</span>
            <input className="input input-bordered" value={woundCause} onChange={(e) => setWoundCause(e.target.value)} />
          </label>

          <label className="form-control">
            <span className="label-text">Prior treatments</span>
            <textarea className="textarea textarea-bordered" rows={3} value={priorTreatments} onChange={(e) => setPriorTreatments(e.target.value)} />
          </label>

          <label className="form-control">
            <span className="label-text">Current dressing / care</span>
            <textarea className="textarea textarea-bordered" rows={2} value={currentDressing} onChange={(e) => setCurrentDressing(e.target.value)} />
          </label>

          <div className="grid md:grid-cols-3 gap-4">
            <label className="form-control">
              <span className="label-text">Pain level (0-10)</span>
              <input
                type="number"
                min={0}
                max={10}
                className="input input-bordered"
                value={painLevel}
                onChange={(e) => setPainLevel(Number(e.target.value || 0))}
              />
            </label>

            <label className="form-control">
              <span className="label-text">Diabetes</span>
              <select className="select select-bordered" value={hasDiabetes} onChange={(e) => setHasDiabetes(e.target.value as any)}>
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>

            <label className="form-control">
              <span className="label-text">Smoking</span>
              <select className="select select-bordered" value={smokes} onChange={(e) => setSmokes(e.target.value as any)}>
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>
        </section>

        {/* Medications */}
        <section className="bg-white/70 rounded-xl p-5 border space-y-3">
          <h2 className="text-lg font-semibold">Medication List</h2>
          <label className="form-control">
            <span className="label-text">List any medications (comma separated is fine)</span>
            <textarea className="textarea textarea-bordered" rows={3} value={medications} onChange={(e) => setMedications(e.target.value)} />
          </label>
        </section>

        {/* Uploads */}
        <section className="bg-white/70 rounded-xl p-5 border space-y-4">
          <h2 className="text-lg font-semibold">Uploads</h2>

          {uploadError ? <div className="alert alert-error">{uploadError}</div> : null}

          <div
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="grid md:grid-cols-3 gap-4">
               <div>
                 <div className="text-sm font-medium mb-2">Photo ID</div>
                 <input
                   type="file"
                   accept="image/*,application/pdf"
                   capture="environment"
                   onChange={(e) => {
                     const f = e.target.files?.[0];
                     if (f) void handleSelectedUploads([f], "id", { allowPdf: true, maxFiles: 1 });
                     e.currentTarget.value = "";
                   }}
                 />
                 <div className="text-xs opacity-70 mt-2">Image or PDF, up to {formatPatientFileSize(MAX_IMAGE_UPLOAD_BYTES)}.</div>
                 {uploadingCategories.id ? <div className="text-xs mt-2 opacity-70">Uploading ID...</div> : null}
               </div>

               <div>
                 <div className="text-sm font-medium mb-2">Insurance Card</div>
                 <input
                   type="file"
                   accept="image/*,application/pdf"
                   capture="environment"
                   onChange={(e) => {
                     const f = e.target.files?.[0];
                     if (f) void handleSelectedUploads([f], "insurance", { allowPdf: true, maxFiles: 1 });
                     e.currentTarget.value = "";
                   }}
                 />
                 <div className="text-xs opacity-70 mt-2">Image or PDF, up to {formatPatientFileSize(MAX_IMAGE_UPLOAD_BYTES)}.</div>
                 {uploadingCategories.insurance ? <div className="text-xs mt-2 opacity-70">Uploading insurance card...</div> : null}
               </div>

               <div>
                 <div className="text-sm font-medium mb-2">Wound Photos</div>
                 <input
                  type="file"
                   accept="image/*"
                   capture="environment"
                   multiple
                   onChange={(e) => {
                     const files = Array.from(e.target.files ?? []);
                     if (files.length > 0) void handleSelectedUploads(files, "wound_photo", { maxFiles: 6 });
                     e.currentTarget.value = "";
                   }}
                 />
                 <div className="text-xs opacity-70 mt-2">Up to 6 images at a time, {formatPatientFileSize(MAX_IMAGE_UPLOAD_BYTES)} max per photo.</div>
                 {uploadingCategories.wound_photo ? <div className="text-xs mt-2 opacity-70">Uploading wound photos...</div> : null}
               </div>
             </div>
           </div>

           {uploads.length > 0 ? (
             <div className="mt-4 space-y-2">
               <div className="text-sm font-semibold">Uploaded</div>
               <div className="grid gap-3 md:grid-cols-2">
                 {uploads.map((u, idx) => (
                   <div key={`${u.path}-${idx}`} className="rounded-xl border bg-white/70 p-3">
                     {u.signedUrl && u.filename.match(/\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i) ? (
                       <img
                         src={u.signedUrl}
                         alt={u.filename}
                         className="mb-3 h-36 w-full rounded-lg object-cover"
                       />
                     ) : null}
                     <div className="text-sm font-medium">{u.category.replace("_", " ")}</div>
                     <div className="mt-1 text-sm">
                       {u.signedUrl ? (
                         <a className="link" href={u.signedUrl} target="_blank" rel="noreferrer">
                           {u.filename}
                         </a>
                       ) : (
                         u.filename
                       )}
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           ) : null}
        </section>

        {/* Consent */}
        <section className="bg-white/70 rounded-xl p-5 border space-y-4">
          <h2 className="text-lg font-semibold">Consent & Acknowledgments</h2>

          <label className="flex gap-3 items-start">
            <input type="checkbox" className="checkbox mt-1" checked={consentHipaa} onChange={(e) => setConsentHipaa(e.target.checked)} />
            <span className="text-sm">I acknowledge the HIPAA privacy notice.</span>
          </label>

          <label className="flex gap-3 items-start">
            <input
              type="checkbox"
              className="checkbox mt-1"
              checked={consentFinancial}
              onChange={(e) => setConsentFinancial(e.target.checked)}
            />
            <span className="text-sm">I acknowledge financial responsibility for services not covered by insurance.</span>
          </label>

          <label className="flex gap-3 items-start">
            <input
              type="checkbox"
              className="checkbox mt-1"
              checked={consentTreatment}
              onChange={(e) => setConsentTreatment(e.target.checked)}
            />
            <span className="text-sm">I consent to evaluation and treatment as clinically appropriate.</span>
          </label>

          <label className="form-control">
            <span className="label-text">Type your full legal name as your signature</span>
            <input className="input input-bordered" value={typedSignature} onChange={(e) => setTypedSignature(e.target.value)} />
          </label>

          <div className="text-xs opacity-70">This typed signature is used for soft launch. A full signature capture can be added later.</div>
        </section>

        {/* Submit */}
        <section className="bg-white/70 rounded-xl p-5 border">
          <button className="btn btn-primary w-full" type="button" disabled={submitting || !consentAccepted} onClick={submitIntake}>
            {submitting ? "Submitting..." : "Submit Wound Intake"}
          </button>

          {!consentAccepted ? (
            <div className="text-xs mt-2 opacity-70">Complete all consent checkboxes and type your signature to enable submission.</div>
          ) : null}
        </section>
      </div>
    </div>
  );
}



