import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import VitalityHero from "../components/VitalityHero";

type PatientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type AppointmentRow = {
  id: string;
  location_id: string;
  patient_id: string;
  start_time: string;
  status: string | null;
  notes: string | null;
  referral_id: string | null;
};

type VisitRow = {
  id: string;
  patient_id: string;
  location_id: string;
  appointment_id: string | null;
  visit_date: string;
  status: string | null;
  summary: string | null;
};

export default function ProviderVisitBuilder() {
  const { signOut, activeLocationId } = useAuth();
  const nav = useNavigate();
  const { patientId: routePatientId } = useParams<{ patientId?: string }>();
  const [params] = useSearchParams();

  const appointmentId = params.get("appointmentId") ?? "";

  const [loading, setLoading] = useState(true);
  const [savingVisit, setSavingVisit] = useState(false);
  const [savingWound, setSavingWound] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [appointment, setAppointment] = useState<AppointmentRow | null>(null);
  const [visit, setVisit] = useState<VisitRow | null>(null);
  const [resolvedPatientId, setResolvedPatientId] = useState<string>("");

  const [visitDate, setVisitDate] = useState("");
  const [visitStatus, setVisitStatus] = useState("open");
  const [visitSummary, setVisitSummary] = useState("");

  const [woundLabel, setWoundLabel] = useState("");
  const [bodySite, setBodySite] = useState("");
  const [laterality, setLaterality] = useState("");
  const [woundType, setWoundType] = useState("");

  const fullName = useMemo(() => {
    if (!patient) return "Patient";
    return `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || "Patient";
  }, [patient]);

  const resolvePatientRecordId = async (candidateId: string) => {
    if (!candidateId) throw new Error("Missing patient id.");

    const { data: byId, error: byIdErr } = await supabase
      .from("patients")
      .select("id")
      .eq("id", candidateId)
      .maybeSingle();
    if (byIdErr) throw byIdErr;
    if (byId?.id) return byId.id as string;

    const { data: byProfile, error: byProfileErr } = await supabase
      .from("patients")
      .select("id")
      .eq("profile_id", candidateId)
      .maybeSingle();
    if (byProfileErr) throw byProfileErr;
    if (byProfile?.id) return byProfile.id as string;

    throw new Error("Patient not found for appointment/profile.");
  };

  useEffect(() => {
    const load = async () => {
      setErr(null);
      setLoading(true);

      try {
        let candidatePatientId = routePatientId ?? "";

        if (appointmentId) {
          const { data: appt, error: apptErr } = await supabase
            .from("appointments")
            .select("id,location_id,patient_id,start_time,status,notes,referral_id")
            .eq("id", appointmentId)
            .maybeSingle();

          if (apptErr) throw apptErr;
          if (!appt?.id) throw new Error("Appointment not found.");

          setAppointment(appt as AppointmentRow);
          candidatePatientId = appt.patient_id;

          if (!visitDate) {
            const local = new Date(appt.start_time);
            const yyyy = local.getFullYear();
            const mm = String(local.getMonth() + 1).padStart(2, "0");
            const dd = String(local.getDate()).padStart(2, "0");
            const hh = String(local.getHours()).padStart(2, "0");
            const mi = String(local.getMinutes()).padStart(2, "0");
            setVisitDate(`${yyyy}-${mm}-${dd}T${hh}:${mi}`);
          }
        } else if (!visitDate) {
          const local = new Date();
          const yyyy = local.getFullYear();
          const mm = String(local.getMonth() + 1).padStart(2, "0");
          const dd = String(local.getDate()).padStart(2, "0");
          const hh = String(local.getHours()).padStart(2, "0");
          const mi = String(local.getMinutes()).padStart(2, "0");
          setVisitDate(`${yyyy}-${mm}-${dd}T${hh}:${mi}`);
        }

        if (!candidatePatientId) throw new Error("Missing patient id.");
        const patientRecordId = await resolvePatientRecordId(candidatePatientId);
        setResolvedPatientId(patientRecordId);

        const { data: p, error: pErr } = await supabase
          .from("patients")
          .select("id,first_name,last_name,email,phone")
          .eq("id", patientRecordId)
          .maybeSingle();

        if (pErr) throw pErr;
        if (!p?.id) throw new Error("Patient not found.");

        setPatient(p as PatientRow);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load visit builder.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [appointmentId, routePatientId]);

  const createVisit = async () => {
    setErr(null);

    if (!resolvedPatientId) return setErr("Missing patient.");
    if (!visitDate) return setErr("Visit date/time is required.");

    const locationId = appointment?.location_id ?? activeLocationId;
    if (!locationId) return setErr("Missing location. Start from an appointment or set your active location.");

    setSavingVisit(true);

    try {
      const { data, error } = await supabase
        .from("patient_visits")
        .insert([
          {
            patient_id: resolvedPatientId,
            location_id: locationId,
            appointment_id: appointment?.id ?? null,
            visit_date: new Date(visitDate).toISOString(),
            status: visitStatus,
            summary: visitSummary || null,
            referral_id: appointment?.referral_id ?? null,
          },
        ])
        .select("id,patient_id,location_id,appointment_id,visit_date,status,summary")
        .single();

      if (error) throw error;

      const createdVisit = data as VisitRow;
      setVisit(createdVisit);

      if (appointment?.id) {
        await supabase.from("appointments").update({ status: "in_progress" }).eq("id", appointment.id);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create visit.");
    } finally {
      setSavingVisit(false);
    }
  };

  const addWoundAssessment = async () => {
    setErr(null);

    if (!visit?.id) return setErr("Create the visit first.");
    if (!resolvedPatientId) return setErr("Missing patient.");
    if (!visit.location_id) return setErr("Missing visit location.");
    if (!woundLabel.trim()) return setErr("Wound label is required.");
    if (!bodySite.trim()) return setErr("Body site is required.");
    if (!woundType.trim()) return setErr("Wound type is required.");

    setSavingWound(true);

    try {
      const { error } = await supabase.from("wound_assessments").insert([
        {
          location_id: visit.location_id,
          patient_id: resolvedPatientId,
          visit_id: visit.id,
          wound_label: woundLabel.trim(),
          body_site: bodySite.trim(),
          laterality: laterality.trim() || null,
          wound_type: woundType.trim(),
        },
      ]);

      if (error) throw error;

      alert("Wound assessment saved ✅");
      nav(`/provider/visits/${visit.id}`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save wound assessment.");
    } finally {
      setSavingWound(false);
    }
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Visit Builder"
          subtitle="Create visit • add wound assessment • continue to chart"
          secondaryCta={{ label: "Back", to: "/provider/queue" }}
          rightActions={
            <button className="btn btn-ghost" onClick={signOut} type="button">
              Sign out
            </button>
          }
          showKpis={false}
        />

        <div className="space" />

        <div className="card card-pad">
          {loading && <div className="muted">Loading…</div>}
          {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

          {!loading && (
            <>
              <div className="h2">Patient</div>
              <div className="muted" style={{ marginTop: 6 }}>
                <strong>{fullName}</strong>
              </div>
              <div className="muted" style={{ marginTop: 4 }}>
                {patient?.email ?? "—"} • {patient?.phone ?? "—"}
              </div>

              {appointment && (
                <>
                  <div className="space" />
                  <div className="h2">Appointment</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {new Date(appointment.start_time).toLocaleString()} • {appointment.status ?? "—"}
                  </div>
                  {appointment.notes ? (
                    <div className="muted" style={{ marginTop: 4 }}>
                      {appointment.notes}
                    </div>
                  ) : null}
                </>
              )}

              <div className="space" />

              <div className="card card-pad" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="h2">Step 1: Create Visit</div>
                <div className="space" />

                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <input
                    className="input"
                    type="datetime-local"
                    style={{ flex: "1 1 240px" }}
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                  />

                  <select
                    className="input"
                    style={{ flex: "1 1 180px" }}
                    value={visitStatus}
                    onChange={(e) => setVisitStatus(e.target.value)}
                  >
                    <option value="open">open</option>
                    <option value="in_progress">in_progress</option>
                    <option value="completed">completed</option>
                  </select>
                </div>

                <div className="space" />

                <textarea
                  className="input"
                  style={{ width: "100%", minHeight: 90 }}
                  placeholder="Visit summary (optional)"
                  value={visitSummary}
                  onChange={(e) => setVisitSummary(e.target.value)}
                />

                <div className="space" />

                {!visit ? (
                  <button className="btn btn-primary" type="button" onClick={createVisit} disabled={savingVisit}>
                    {savingVisit ? "Creating…" : "Create Visit"}
                  </button>
                ) : (
                  <div className="muted">
                    Visit created: <strong>{new Date(visit.visit_date).toLocaleString()}</strong>
                    {" • "}
                    You can now add a wound assessment or open the chart.
                  </div>
                )}
              </div>

              <div className="space" />

              <div className="card card-pad" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="h2">Step 2: Add Wound Assessment</div>
                <div className="space" />

                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <input
                    className="input"
                    style={{ flex: "1 1 220px" }}
                    placeholder="Wound label"
                    value={woundLabel}
                    onChange={(e) => setWoundLabel(e.target.value)}
                    disabled={!visit}
                  />

                  <input
                    className="input"
                    style={{ flex: "1 1 220px" }}
                    placeholder="Body site"
                    value={bodySite}
                    onChange={(e) => setBodySite(e.target.value)}
                    disabled={!visit}
                  />

                  <input
                    className="input"
                    style={{ flex: "1 1 180px" }}
                    placeholder="Laterality"
                    value={laterality}
                    onChange={(e) => setLaterality(e.target.value)}
                    disabled={!visit}
                  />

                  <input
                    className="input"
                    style={{ flex: "1 1 220px" }}
                    placeholder="Wound type"
                    value={woundType}
                    onChange={(e) => setWoundType(e.target.value)}
                    disabled={!visit}
                  />
                </div>

                <div className="space" />

                <button className="btn btn-primary" type="button" onClick={addWoundAssessment} disabled={!visit || savingWound}>
                  {savingWound ? "Saving…" : "Save Wound Assessment"}
                </button>

                {visit && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => nav(`/provider/visits/${visit.id}`)}
                    style={{ marginLeft: 8 }}
                  >
                    Skip to Visit Chart
                  </button>
                )}
              </div>

              {visit && (
                <>
                  <div className="space" />
                  <button className="btn btn-ghost" type="button" onClick={() => nav(`/provider/visits/${visit.id}`)}>
                    Open Visit Chart
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
