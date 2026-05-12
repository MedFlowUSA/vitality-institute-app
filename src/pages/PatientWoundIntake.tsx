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
      setPageError("Please complete consent and add your typed signature before submitting.");
      return;
    }

    // Minimal validation for soft launch
    if (!woundLocation.trim() || !woundDuration.trim() || !sex) {
      setPageError("Please enter wound location, wound duration, and gender before submitting.");
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
      <div className="app-bg">
        <div className="shell">
          <VitalityHero title="Wound Care Intake" subtitle="Loading..." secondaryCta={{ label: "Back", to: "/patient/home" }} />
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="app-bg">
        <div className="shell">
          <VitalityHero
            title="We received your information"
            subtitle="Next steps: our clinical team will review your wound care intake. If we need anything else, we'll notify you inside your portal."
            secondaryCta={{ label: "Back to Patient Portal", to: "/patient/home" }}
          />
          <div className="card card-pad" style={{ marginTop: 20 }}>
            <div className="muted" style={{ fontSize: 14 }}>
              Location: <strong>{location?.name}</strong>
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary" type="button" onClick={() => nav("/patient/home")}>
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Wound Care Intake"
          subtitle="Please complete this intake packet. A provider will review your submission before initiating communication."
          secondaryCta={{ label: "Back", to: "/patient/home" }}
        />

        <div style={{ display: "grid", gap: 16, marginTop: 20, maxWidth: 760 }}>
          {pageError ? (
            <div className="inline-notice inline-notice-error" style={{ fontSize: 14 }}>{pageError}</div>
          ) : null}

          <div className="card card-pad">
            <div className="muted" style={{ fontSize: 13 }}>
              Location: <strong>{location?.name}</strong>
            </div>
          </div>

          {/* Wound history */}
          <div className="card card-pad">
            <div className="h2" style={{ marginBottom: 16 }}>Wound History</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Wound location (e.g., left foot, shin)</span>
                <input className="input" value={woundLocation} onChange={(e) => setWoundLocation(e.target.value)} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>How long have you had this wound?</span>
                <input className="input" value={woundDuration} onChange={(e) => setWoundDuration(e.target.value)} />
              </label>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
              <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Gender</span>
              <select className="input" value={sex} onChange={(e) => setSex(e.target.value as "Male" | "Female" | "")}>
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
              <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Cause (if known)</span>
              <input className="input" value={woundCause} onChange={(e) => setWoundCause(e.target.value)} />
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
              <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Prior treatments</span>
              <textarea className="input" rows={3} style={{ resize: "vertical" }} value={priorTreatments} onChange={(e) => setPriorTreatments(e.target.value)} />
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
              <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Current dressing / care</span>
              <textarea className="input" rows={2} style={{ resize: "vertical" }} value={currentDressing} onChange={(e) => setCurrentDressing(e.target.value)} />
            </div>

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Pain level (0–10)</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  className="input"
                  value={painLevel}
                  onChange={(e) => setPainLevel(Number(e.target.value || 0))}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Diabetes</span>
                <select className="input" value={hasDiabetes} onChange={(e) => setHasDiabetes(e.target.value as any)}>
                  <option value="unknown">Unknown</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Smoking</span>
                <select className="input" value={smokes} onChange={(e) => setSmokes(e.target.value as any)}>
                  <option value="unknown">Unknown</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
          </div>

          {/* Medications */}
          <div className="card card-pad">
            <div className="h2" style={{ marginBottom: 14 }}>Medication List</div>
            <div style={{ display: "grid", gap: 6 }}>
              <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>List any medications (comma separated is fine)</span>
              <textarea className="input" rows={3} style={{ resize: "vertical" }} value={medications} onChange={(e) => setMedications(e.target.value)} />
            </div>
          </div>

          {/* Uploads */}
          <div className="card card-pad">
            <div className="h2" style={{ marginBottom: 14 }}>Uploads</div>

            {uploadError ? (
              <div className="inline-notice inline-notice-error" style={{ fontSize: 13, marginBottom: 14 }}>{uploadError}</div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Photo ID</div>
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
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Image or PDF, up to {formatPatientFileSize(MAX_IMAGE_UPLOAD_BYTES)}.</div>
                {uploadingCategories.id ? <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Uploading ID...</div> : null}
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Insurance Card</div>
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
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Image or PDF, up to {formatPatientFileSize(MAX_IMAGE_UPLOAD_BYTES)}.</div>
                {uploadingCategories.insurance ? <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Uploading insurance card...</div> : null}
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Wound Photos</div>
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
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Up to 6 images at a time, {formatPatientFileSize(MAX_IMAGE_UPLOAD_BYTES)} max per photo.</div>
                {uploadingCategories.wound_photo ? <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Uploading wound photos...</div> : null}
              </div>
            </div>

            {uploads.length > 0 ? (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Uploaded</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                  {uploads.map((u, idx) => (
                    <div key={`${u.path}-${idx}`} className="card" style={{ padding: 12, overflow: "hidden" }}>
                      {u.signedUrl && u.filename.match(/\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i) ? (
                        <img
                          src={u.signedUrl}
                          alt={u.filename}
                          style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 10, display: "block", marginBottom: 10 }}
                        />
                      ) : null}
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{u.category.replace("_", " ")}</div>
                      <div style={{ marginTop: 4, fontSize: 13 }}>
                        {u.signedUrl ? (
                          <a href={u.signedUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
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
          </div>

          {/* Consent */}
          <div className="card card-pad">
            <div className="h2" style={{ marginBottom: 16 }}>Consent & Acknowledgments</div>

            <div style={{ display: "grid", gap: 14 }}>
              <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
                <input type="checkbox" checked={consentHipaa} onChange={(e) => setConsentHipaa(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 14, lineHeight: 1.6 }}>I acknowledge the HIPAA privacy notice.</span>
              </label>

              <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={consentFinancial}
                  onChange={(e) => setConsentFinancial(e.target.checked)}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
                <span style={{ fontSize: 14, lineHeight: 1.6 }}>I acknowledge financial responsibility for services not covered by insurance.</span>
              </label>

              <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={consentTreatment}
                  onChange={(e) => setConsentTreatment(e.target.checked)}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
                <span style={{ fontSize: 14, lineHeight: 1.6 }}>I consent to evaluation and treatment as clinically appropriate.</span>
              </label>

              <div style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Type your full legal name as your signature</span>
                <input className="input" value={typedSignature} onChange={(e) => setTypedSignature(e.target.value)} />
              </div>

              <div className="muted" style={{ fontSize: 12 }}>This typed signature is used for soft launch. A full e-signature capture can be added later.</div>
            </div>
          </div>

          {/* Submit */}
          <div className="card card-pad">
            <button className="btn btn-primary" type="button" disabled={submitting || !consentAccepted} onClick={submitIntake} style={{ width: "100%" }}>
              {submitting ? "Submitting..." : "Submit Wound Intake"}
            </button>

            {!consentAccepted ? (
              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>Complete all consent checkboxes and type your signature to enable submission.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}



