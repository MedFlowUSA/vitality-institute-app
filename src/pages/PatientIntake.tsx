// src/pages/PatientIntake.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import VitalityHero from "../components/VitalityHero";

type FormTemplate = {
  id: string;
  name: string;
  therapy_type: string;
  schema: any; // jsonb
};

type LocationRow = { id: string; name: string };

type PatientRow = {
  id: string; // patients.id (uuid)
  profile_id: string; // auth.users.id (uuid)
  first_name: string | null;
  last_name: string | null;
};

type AppointmentRow = {
  id: string;
  location_id: string;
  start_time: string;
  status: string;
};

type Field =
  | { key: string; label: string; type: "text"; required?: boolean }
  | { key: string; label: string; type: "textarea"; required?: boolean }
  | { key: string; label: string; type: "checkbox"; required?: boolean }
  | { key: string; label: string; type: "select"; options: string[]; required?: boolean };

type Section = { title: string; fields: Field[] };

export default function PatientIntake() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const prefillApptId = params.get("appointmentId") ?? "";

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);

  const [therapyType, setTherapyType] = useState("peptides");
  const [appointmentId, setAppointmentId] = useState(prefillApptId);

  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentSignedName, setConsentSignedName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [patient, setPatient] = useState<PatientRow | null>(null);

  useEffect(() => {
    if (prefillApptId) setAppointmentId(prefillApptId);
  }, [prefillApptId]);

  const locName = useMemo(() => {
    const m = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string) => m.get(id) ?? id;
  }, [locations]);

  const templateForTherapy = useMemo(() => {
    return templates.find((t) => t.therapy_type === therapyType) ?? null;
  }, [templates, therapyType]);

  const sections: Section[] = useMemo(() => {
    const schema = templateForTherapy?.schema;
    const s = schema?.sections;
    return Array.isArray(s) ? (s as Section[]) : [];
  }, [templateForTherapy]);

  useEffect(() => {
    setSelectedTemplate(templateForTherapy);
    setAnswers({});
    setConsentAccepted(false);
    setConsentSignedName("");
  }, [templateForTherapy]);

  const setValue = (key: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  // Load patient + locations + appointments + templates
  useEffect(() => {
    const load = async () => {
      setErr(null);
      setLoading(true);

      try {
        if (!user?.id) throw new Error("Not signed in.");

        // 1) Resolve patient (patients.profile_id = auth user id)
        const { data: p, error: pErr } = await supabase
          .from("patients")
          .select("id,profile_id,first_name,last_name")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (pErr) throw pErr;
        const patientRow = (p as PatientRow) ?? null;
        setPatient(patientRow);

        if (!patientRow?.id) {
          throw new Error("No patient record linked to this login yet. Ask front desk to create your patient profile.");
        }

        // 2) Locations
        const { data: locs, error: locErr } = await supabase.from("locations").select("id,name").order("name");
        if (locErr) throw locErr;
        setLocations((locs as LocationRow[]) ?? []);

        // 3) Appointments for this patient (patients.id)
        const { data: appts, error: apptErr } = await supabase
          .from("appointments")
          .select("id,location_id,start_time,status")
          .eq("patient_id", patientRow.id)
          .order("start_time", { ascending: false })
          .limit(25);

        if (apptErr) throw apptErr;
        const apptRows = (appts as AppointmentRow[]) ?? [];
        setAppointments(apptRows);

        if (prefillApptId) {
          const ok = apptRows.some((a) => a.id === prefillApptId);
          if (!ok) setAppointmentId("");
        }

        // 4) Intake templates
        const { data: forms, error: formErr } = await supabase
          .from("intake_forms")
          .select("id,name,therapy_type,schema")
          .eq("is_active", true);

        if (formErr) throw formErr;
        setTemplates((forms as FormTemplate[]) ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load intake.");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const validate = () => {
    if (!user?.id) return "Not signed in.";
    if (!patient?.id) return "No patient record linked to this login.";
    if (!selectedTemplate) return "No intake form template found for this therapy type.";
    if (!appointmentId) return "Please select the appointment this intake is for.";
    if (!consentAccepted) return "Please accept the consent.";
    if (!consentSignedName.trim()) return "Please type your name to sign consent.";

    for (const sec of sections) {
      for (const f of sec.fields) {
        if (!f.required) continue;
        const v = answers[f.key];

        if (f.type === "checkbox") {
          if (v !== true) return `Please confirm: ${f.label}`;
        } else {
          if (v === undefined || v === null || String(v).trim() === "") return `Required: ${f.label}`;
        }
      }
    }

    return null;
  };

  const submit = async () => {
    setErr(null);

    const v = validate();
    if (v) return setErr(v);
    if (!patient?.id || !selectedTemplate) return;

    const appt = appointments.find((a) => a.id === appointmentId);
    if (!appt) return setErr("Appointment not found. Try selecting it again.");

    setSaving(true);

    // Store dynamic answers + useful pointers in wound_data (jsonb)
    const payload = {
      therapy_type: therapyType,
      form_id: selectedTemplate.id,
      appointment_id: appointmentId,
      answers,
      template_name: selectedTemplate.name,
      submitted_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("patient_intakes").insert([
      {
        patient_id: patient.id,
        location_id: appt.location_id,
        service_type: therapyType, // reuse this column for wellness types
        status: "submitted",
        wound_data: payload, // jsonb
        medications: null,
        consent_accepted: true,
        consent_signed_name: consentSignedName.trim(),
        consent_signed_at: new Date().toISOString(),
      },
    ]);

    setSaving(false);

    if (error) return setErr(error.message);

    alert("Intake submitted ✅");
    nav(`/patient/assessment?appointmentId=${appointmentId}`, { replace: true });
  };

  const patientLabel = useMemo(() => {
    const fn = patient?.first_name ?? "";
    const ln = patient?.last_name ?? "";
    const n = `${fn} ${ln}`.trim();
    return n || "Patient";
  }, [patient?.first_name, patient?.last_name]);

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Vitality Institute"
          subtitle="Patient Intake • Select therapy • Complete your form"
          secondaryCta={{ label: "Back", to: "/patient" }}
          rightActions={
            <button className="btn btn-ghost" onClick={signOut} type="button">
              Sign out
            </button>
          }
          showKpis={false}
        />

        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div className="h2">Complete Intake</div>
              <div className="muted" style={{ marginTop: 4 }}>
                Select therapy type and the appointment this intake is for.
              </div>
              {patient?.id ? (
                <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                  Patient: <strong>{patientLabel}</strong>
                </div>
              ) : null}
            </div>

            <button className="btn btn-ghost" onClick={() => nav("/patient")} type="button">
              Back
            </button>
          </div>

          <div className="space" />

          {loading && <div className="muted">Loading…</div>}
          {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

          {!loading && (
            <>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <select className="input" style={{ flex: "1 1 220px" }} value={therapyType} onChange={(e) => setTherapyType(e.target.value)}>
                  <option value="peptides">Peptides</option>
                  <option value="glp1">GLP-1</option>
                  <option value="trt">TRT</option>
                  <option value="hrt">HRT</option>
                  <option value="botox">Botox</option>
                </select>

                <select className="input" style={{ flex: "2 1 320px" }} value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
                  <option value="">Select Appointment</option>
                  {appointments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {new Date(a.start_time).toLocaleString()} — {locName(a.location_id)} — {a.status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space" />

              {selectedTemplate ? (
                <div className="card card-pad">
                  <div className="h2">{selectedTemplate.name}</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    Therapy: {selectedTemplate.therapy_type}
                  </div>

                  <div className="space" />

                  {sections.map((sec, i) => (
                    <div key={i} style={{ marginBottom: 16 }}>
                      <div className="h2">{sec.title}</div>
                      <div className="space" />

                      {sec.fields.map((f) => {
                        const v = answers[f.key];

                        if (f.type === "text") {
                          return (
                            <div key={f.key} style={{ marginBottom: 10 }}>
                              <div className="muted" style={{ marginBottom: 6 }}>
                                {f.label} {f.required ? " *" : ""}
                              </div>
                              <input className="input" value={v ?? ""} onChange={(e) => setValue(f.key, e.target.value)} />
                            </div>
                          );
                        }

                        if (f.type === "textarea") {
                          return (
                            <div key={f.key} style={{ marginBottom: 10 }}>
                              <div className="muted" style={{ marginBottom: 6 }}>
                                {f.label} {f.required ? " *" : ""}
                              </div>
                              <textarea
                                className="input"
                                style={{ width: "100%", minHeight: 90 }}
                                value={v ?? ""}
                                onChange={(e) => setValue(f.key, e.target.value)}
                              />
                            </div>
                          );
                        }

                        if (f.type === "select") {
                          return (
                            <div key={f.key} style={{ marginBottom: 10 }}>
                              <div className="muted" style={{ marginBottom: 6 }}>
                                {f.label} {f.required ? " *" : ""}
                              </div>
                              <select className="input" value={v ?? ""} onChange={(e) => setValue(f.key, e.target.value)}>
                                <option value="">Select…</option>
                                {f.options.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        }

                        // checkbox
                        return (
                          <div key={f.key} style={{ marginBottom: 10 }}>
                            <label className="muted" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <input type="checkbox" checked={v === true} onChange={(e) => setValue(f.key, e.target.checked)} />
                              {f.label} {f.required ? " *" : ""}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  <div className="space" />
                  <div className="card card-pad" style={{ background: "rgba(0,0,0,.06)" }}>
                    <div className="h2">Consent</div>
                    <div className="space" />

                    <label className="muted" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input type="checkbox" checked={consentAccepted} onChange={(e) => setConsentAccepted(e.target.checked)} />
                      I agree to the consent terms for this intake. *
                    </label>

                    <div className="space" />
                    <div className="muted" style={{ marginBottom: 6 }}>
                      Type your full name to sign *
                    </div>
                    <input className="input" value={consentSignedName} onChange={(e) => setConsentSignedName(e.target.value)} placeholder="Full name" />
                  </div>

                  <div className="space" />
                  <button className="btn btn-primary" onClick={submit} disabled={saving} type="button">
                    {saving ? "Submitting…" : "Submit Intake"}
                  </button>
                </div>
              ) : (
                <div className="muted">No form template found for this therapy type yet.</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
