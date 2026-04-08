// src/pages/PatientAssessment.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import VitalityHero from "../components/VitalityHero";

type PatientRow = { id: string; profile_id: string; first_name: string | null; last_name: string | null };
type AppointmentRow = { id: string; location_id: string; patient_id: string; start_time: string; status: string | null; referral_id: string | null };
type IntakeRow = { id: string; appointment_id: string; patient_id: string; location_id: string; status: string | null; answers: any; created_at: string };

export default function PatientAssessment() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const appointmentId = params.get("appointmentId") ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [appt, setAppt] = useState<AppointmentRow | null>(null);
  const [intake, setIntake] = useState<IntakeRow | null>(null);

  // Assessment fields (keep these aligned with what you want to capture first)
  const [woundLabel, setWoundLabel] = useState("Primary wound");
  const [bodySite, setBodySite] = useState("");
  const [laterality, setLaterality] = useState<"" | "left" | "right" | "bilateral">("");
  const [woundType, setWoundType] = useState("");
  const [stage, setStage] = useState("");
  const [lengthCm, setLengthCm] = useState<string>("");
  const [widthCm, setWidthCm] = useState<string>("");
  const [depthCm, setDepthCm] = useState<string>("");
  const [painScore, setPainScore] = useState<number>(0);
  const [infectionSigns, setInfectionSigns] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const state = location.state as { patientNotice?: string } | null;
    if (!state?.patientNotice) return;

    setNotice(state.patientNotice);
    nav(`${location.pathname}${location.search}`, { replace: true, state: {} });
  }, [location.pathname, location.search, location.state, nav]);
  const canSave = useMemo(() => {
    return !!(patient?.id && appt?.id && appointmentId);
  }, [patient?.id, appt?.id, appointmentId]);

  useEffect(() => {
    const load = async () => {
      setErr(null);
      setLoading(true);

      try {
        if (!user?.id) throw new Error("Not signed in.");
        if (!appointmentId) throw new Error("Missing appointmentId.");

        // 1) Resolve patient (patients.profile_id = auth uid)
        const { data: p, error: pErr } = await supabase
          .from("patients")
          .select("id,profile_id,first_name,last_name")
          .eq("profile_id", user.id)
          .maybeSingle();
        if (pErr) throw pErr;

        const patientRow = (p as PatientRow) ?? null;
        if (!patientRow?.id) throw new Error("No patient record linked to this login.");
        setPatient(patientRow);

        // 2) Appointment (must belong to this patient)
        const { data: a, error: aErr } = await supabase
          .from("appointments")
          .select("id,location_id,patient_id,start_time,status,referral_id")
          .eq("id", appointmentId)
          .maybeSingle();
        if (aErr) throw aErr;

        const apptRow = (a as AppointmentRow) ?? null;
        if (!apptRow?.id) throw new Error("Appointment not found.");
        if (apptRow.patient_id !== patientRow.id) throw new Error("This appointment does not belong to the current patient.");
        setAppt(apptRow);

        // 3) Latest intake for this appointment (optional but we'll link it)
        const { data: i, error: iErr } = await supabase
          .from("intake_submissions")
          .select("id,appointment_id,patient_id,location_id,status,answers,created_at")
          .eq("appointment_id", appointmentId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (iErr) throw iErr;

        const intakeRow = (Array.isArray(i) && i.length ? (i[0] as IntakeRow) : null);
        setIntake(intakeRow);

        // OPTIONAL: prefill some fields if your intake answers contain wound basics
        // (safe reads; won't crash if keys don't exist)
        const ans = intakeRow?.answers ?? {};
        const maybeBody = ans?.wound_location ?? ans?.body_site ?? "";
        const maybeType = ans?.wound_type ?? "";
        const maybePain = typeof ans?.pain_score === "number" ? ans.pain_score : (typeof ans?.pain === "number" ? ans.pain : null);

        if (maybeBody && !bodySite) setBodySite(String(maybeBody));
        if (maybeType && !woundType) setWoundType(String(maybeType));
        if (maybePain !== null && Number.isFinite(maybePain)) setPainScore(maybePain);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load assessment.");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, appointmentId]);

  const toNumOrNull = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const save = async () => {
    setErr(null);
    if (!canSave || !patient || !appt) return;

    // light validation (keep it minimal so we don't block you)
    if (!bodySite.trim()) return setErr("Body site is required (ex: sacrum, heel, left leg).");
    if (!woundType.trim()) return setErr("Wound type is required (ex: pressure_ulcer, venous_ulcer).");

    setSaving(true);

    try {
      // 1) Create visit container
      const { data: visit, error: vErr } = await supabase
        .from("patient_visits")
        .insert([
          {
            location_id: appt.location_id,
            patient_id: patient.id,
            appointment_id: appt.id,
            visit_date: appt.start_time,          // use appointment time as visit_date
            status: "in_progress",
            summary: null,
            intake_id: intake?.id ?? null,
            referral_id: appt.referral_id ?? null,
          },
        ])
        .select("id")
        .single();

      if (vErr) throw vErr;

      const visitId = visit.id as string;

      // 2) Create wound assessment tied to the visit
      // IMPORTANT: This assumes these columns exist and are nullable.
      // If your wound_assessments has additional NOT NULL columns, tell me and I'll adjust.
      const { error: waErr } = await supabase.from("wound_assessments").insert([
        {
          location_id: appt.location_id,
          patient_id: patient.id,
          visit_id: visitId,

          wound_label: woundLabel || "Primary wound",
          body_site: bodySite || null,
          laterality: laterality || null,
          wound_type: woundType || null,
          stage: stage || null,

          length_cm: toNumOrNull(lengthCm),
          width_cm: toNumOrNull(widthCm),
          depth_cm: toNumOrNull(depthCm),

          pain_score: painScore ?? 0,
          infection_signs: infectionSigns,
          notes: notes || null,
        },
      ]);

      if (waErr) throw waErr;

      // 3) (Optional) update appointment status so you can pace the workflow
      await supabase.from("appointments").update({ status: "in_progress" }).eq("id", appt.id);

      nav("/patient/home", { replace: true, state: { patientNotice: "Assessment saved successfully.", patientNoticeTone: "success" } });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save assessment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Vitality Institute"
          subtitle="Assessment • Visit created • Wound assessment saved"
          secondaryCta={{ label: "Back", to: "/patient/home" }}
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
              <div className="h2">Patient Assessment</div>
              <div className="muted" style={{ marginTop: 4 }}>
                This creates a <strong>patient visit</strong> and links a <strong>wound assessment</strong>.
              </div>
              {patient?.id ? (
                <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                  Patient: <strong>{patient.first_name} {patient.last_name}</strong>
                </div>
              ) : null}
              {appt?.id ? (
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                  Appointment: <strong>{new Date(appt.start_time).toLocaleString()}</strong>
                </div>
              ) : null}
            </div>

            <button className="btn btn-ghost" onClick={() => nav("/patient/home")} type="button">
              Back
            </button>
          </div>

          <div className="space" />

          {loading && <div className="muted">Loading...</div>}
          {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}
          {notice ? (
            <div
              className="card card-pad card-light surface-light"
              style={{
                marginBottom: 12,
                border: "1px solid rgba(34,197,94,.28)",
                background: "rgba(34,197,94,.12)",
                color: "#1f1633",
              }}
            >
              <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div style={{ lineHeight: 1.7 }}>{notice}</div>
                <button className="btn btn-secondary" type="button" onClick={() => setNotice(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          {!loading && (
            <>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input
                  className="input"
                  style={{ flex: "1 1 240px" }}
                  value={woundLabel}
                  onChange={(e) => setWoundLabel(e.target.value)}
                  placeholder="Wound label (ex: Primary wound)"
                />
                <input
                  className="input"
                  style={{ flex: "1 1 240px" }}
                  value={bodySite}
                  onChange={(e) => setBodySite(e.target.value)}
                  placeholder="Body site (ex: sacrum, heel, left leg)"
                />
                <select
                  className="input"
                  style={{ flex: "1 1 200px" }}
                  value={laterality}
                  onChange={(e) => setLaterality(e.target.value as any)}
                >
                  <option value="">Laterality (optional)</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="bilateral">Bilateral</option>
                </select>
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input
                  className="input"
                  style={{ flex: "1 1 220px" }}
                  value={woundType}
                  onChange={(e) => setWoundType(e.target.value)}
                  placeholder="Wound type (ex: pressure_ulcer)"
                />
                <input
                  className="input"
                  style={{ flex: "1 1 220px" }}
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  placeholder="Stage (optional) (ex: Stage 3)"
                />
                <div className="row" style={{ gap: 10, alignItems: "center", flex: "1 1 220px" }}>
                  <div className="muted" style={{ minWidth: 70 }}>Pain</div>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={10}
                    value={painScore}
                    onChange={(e) => setPainScore(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input
                  className="input"
                  style={{ flex: "1 1 160px" }}
                  value={lengthCm}
                  onChange={(e) => setLengthCm(e.target.value)}
                  placeholder="Length (cm)"
                />
                <input
                  className="input"
                  style={{ flex: "1 1 160px" }}
                  value={widthCm}
                  onChange={(e) => setWidthCm(e.target.value)}
                  placeholder="Width (cm)"
                />
                <input
                  className="input"
                  style={{ flex: "1 1 160px" }}
                  value={depthCm}
                  onChange={(e) => setDepthCm(e.target.value)}
                  placeholder="Depth (cm)"
                />
                <label className="muted" style={{ display: "flex", gap: 10, alignItems: "center", flex: "1 1 220px" }}>
                  <input type="checkbox" checked={infectionSigns} onChange={(e) => setInfectionSigns(e.target.checked)} />
                  Infection signs present
                </label>
              </div>

              <div className="space" />

              <div style={{ marginBottom: 10 }}>
                <div className="muted" style={{ marginBottom: 6 }}>Assessment notes</div>
                <textarea
                  className="input"
                  style={{ width: "100%", minHeight: 110 }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button className="btn btn-primary" onClick={save} disabled={saving} type="button">
                {saving ? "Saving..." : "Save Assessment"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}






