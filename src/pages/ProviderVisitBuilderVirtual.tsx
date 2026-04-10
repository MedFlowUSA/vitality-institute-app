import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import InlineNotice from "../components/InlineNotice";
import VitalityHero from "../components/VitalityHero";
import RouteHeader from "../components/RouteHeader";
import ProviderGuidePanel from "../components/provider/ProviderGuidePanel";
import VirtualVisitFormFields from "../components/VirtualVisitFormFields";
import { buildProviderVisitBuilderGuide } from "../lib/provider/providerGuide";
import { resolvePatientRecordId } from "../lib/provider/visitLaunch";
import { PROVIDER_ROUTES, providerVisitChartPath } from "../lib/providerRoutes";
import VirtualVisitBadge from "../components/VirtualVisitBadge";
import JoinVirtualVisitButton from "../components/JoinVirtualVisitButton";
import {
  fromDateTimeLocalValue,
  getDefaultJoinWindowOpensAt,
  isVirtualVisit,
  toDateTimeLocalValue,
} from "../lib/virtualVisits";

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
  end_time: string | null;
  status: string | null;
  notes: string | null;
  referral_id: string | null;
  visit_type: string | null;
  telehealth_enabled: boolean | null;
  meeting_url: string | null;
  meeting_provider: string | null;
  meeting_status: string | null;
  join_window_opens_at: string | null;
  virtual_instructions: string | null;
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

export default function ProviderVisitBuilderVirtual() {
  const { signOut, activeLocationId, resumeKey } = useAuth();
  const nav = useNavigate();
  const { patientId: routePatientId } = useParams<{ patientId?: string }>();
  const [params] = useSearchParams();
  const appointmentId = params.get("appointmentId") ?? "";

  const [loading, setLoading] = useState(true);
  const [savingVisit, setSavingVisit] = useState(false);
  const [savingWound, setSavingWound] = useState(false);
  const [savingAppointmentConfig, setSavingAppointmentConfig] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [appointment, setAppointment] = useState<AppointmentRow | null>(null);
  const [visit, setVisit] = useState<VisitRow | null>(null);
  const [resolvedPatientId, setResolvedPatientId] = useState("");

  const [visitDate, setVisitDate] = useState("");
  const [visitStatus, setVisitStatus] = useState("open");
  const [visitSummary, setVisitSummary] = useState("");

  const [appointmentVisitType, setAppointmentVisitType] = useState<"in_person" | "virtual">("in_person");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [virtualInstructions, setVirtualInstructions] = useState("");
  const [joinWindowLocal, setJoinWindowLocal] = useState("");
  const [meetingProvider, setMeetingProvider] = useState("external_link");
  const [meetingStatus, setMeetingStatus] = useState("not_started");

  const [woundLabel, setWoundLabel] = useState("");
  const [bodySite, setBodySite] = useState("");
  const [laterality, setLaterality] = useState("");
  const [woundType, setWoundType] = useState("");

  const fullName = useMemo(() => {
    if (!patient) return "Patient";
    return `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || "Patient";
  }, [patient]);
  const guide = useMemo(
    () => buildProviderVisitBuilderGuide(!!appointment, !!visit, appointmentVisitType === "virtual"),
    [appointment, appointmentVisitType, visit]
  );

  useEffect(() => {
    const load = async () => {
      setErr(null);
      setLoading(true);

      try {
        let candidatePatientId = routePatientId ?? "";

        if (appointmentId) {
          const { data: appt, error: apptErr } = await supabase
            .from("appointments")
            .select(
              "id,location_id,patient_id,start_time,end_time,status,notes,referral_id,visit_type,telehealth_enabled,meeting_url,meeting_provider,meeting_status,join_window_opens_at,virtual_instructions"
            )
            .eq("id", appointmentId)
            .maybeSingle();

          if (apptErr) throw apptErr;
          if (!appt?.id) throw new Error("Appointment not found.");

          const appointmentRow = appt as AppointmentRow;
          setAppointment(appointmentRow);
          setAppointmentVisitType(isVirtualVisit(appointmentRow) ? "virtual" : "in_person");
          setMeetingUrl(appointmentRow.meeting_url ?? "");
          setVirtualInstructions(appointmentRow.virtual_instructions ?? "");
          setJoinWindowLocal(toDateTimeLocalValue(appointmentRow.join_window_opens_at));
          setMeetingProvider(appointmentRow.meeting_provider ?? "external_link");
          setMeetingStatus(appointmentRow.meeting_status ?? "not_started");
          candidatePatientId = appointmentRow.patient_id;

          const local = new Date(appointmentRow.start_time);
          const yyyy = local.getFullYear();
          const mm = String(local.getMonth() + 1).padStart(2, "0");
          const dd = String(local.getDate()).padStart(2, "0");
          const hh = String(local.getHours()).padStart(2, "0");
          const mi = String(local.getMinutes()).padStart(2, "0");
          setVisitDate(`${yyyy}-${mm}-${dd}T${hh}:${mi}`);
        } else {
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

        const { data: patientRow, error: patientErr } = await supabase
          .from("patients")
          .select("id,first_name,last_name,email,phone")
          .eq("id", patientRecordId)
          .maybeSingle();

        if (patientErr) throw patientErr;
        if (!patientRow?.id) throw new Error("Patient not found.");

        setPatient(patientRow as PatientRow);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load visit builder.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [appointmentId, resumeKey, routePatientId]);

  const saveAppointmentSettings = async () => {
    setErr(null);

    if (!appointment?.id) return setErr("Load an appointment first.");
    if (appointmentVisitType === "virtual" && !meetingUrl.trim()) {
      return setErr("Meeting URL is required for a virtual visit.");
    }

    setSavingAppointmentConfig(true);

    try {
      const joinWindowIso =
        appointmentVisitType === "virtual"
          ? fromDateTimeLocalValue(joinWindowLocal) ?? getDefaultJoinWindowOpensAt(appointment.start_time)
          : null;

      const payload =
        appointmentVisitType === "virtual"
          ? {
              visit_type: "virtual",
              telehealth_enabled: true,
              meeting_url: meetingUrl.trim(),
              meeting_provider: meetingProvider || "external_link",
              meeting_status: meetingStatus || "not_started",
              join_window_opens_at: joinWindowIso,
              virtual_instructions: virtualInstructions.trim() || null,
            }
          : {
              visit_type: "in_person",
              telehealth_enabled: false,
              meeting_url: null,
              meeting_provider: "external_link",
              meeting_status: "not_started",
              join_window_opens_at: null,
              virtual_instructions: null,
            };

      const { data, error } = await supabase
        .from("appointments")
        .update(payload)
        .eq("id", appointment.id)
        .select(
          "id,location_id,patient_id,start_time,end_time,status,notes,referral_id,visit_type,telehealth_enabled,meeting_url,meeting_provider,meeting_status,join_window_opens_at,virtual_instructions"
        )
        .single();

      if (error) throw error;

      const nextAppointment = data as AppointmentRow;
      setAppointment(nextAppointment);
      setAppointmentVisitType(isVirtualVisit(nextAppointment) ? "virtual" : "in_person");
      setMeetingUrl(nextAppointment.meeting_url ?? "");
      setVirtualInstructions(nextAppointment.virtual_instructions ?? "");
      setJoinWindowLocal(toDateTimeLocalValue(nextAppointment.join_window_opens_at));
      setMeetingProvider(nextAppointment.meeting_provider ?? "external_link");
      setMeetingStatus(nextAppointment.meeting_status ?? "not_started");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save appointment settings.");
    } finally {
      setSavingAppointmentConfig(false);
    }
  };

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
    setActionMessage(null);

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

      setActionMessage("Wound assessment saved.");
      nav(providerVisitChartPath(visit.id));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save wound assessment.");
    } finally {
      setSavingWound(false);
    }
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <RouteHeader
          title="Visit Builder"
          subtitle="Set up the visit, then continue into the chart."
          backTo={PROVIDER_ROUTES.queue}
          homeTo={PROVIDER_ROUTES.home}
          rightAction={
            <button className="btn btn-ghost" onClick={signOut} type="button">
              Sign out
            </button>
          }
        />

        <div className="space" />

        <VitalityHero
          title="Visit Builder"
          subtitle="Create the visit, add assessment details, and continue to chart."
          secondaryCta={{ label: "Back", to: PROVIDER_ROUTES.queue }}
          rightActions={null}
          showKpis={false}
        />

        <div className="space" />

        <ProviderGuidePanel
          title={guide.title}
          description={guide.description}
          workflowState={guide.workflowState}
          nextAction={guide.nextAction}
          actions={[
            {
              label: visit ? "Open Visit Chart" : "Create Visit",
              onClick: () => {
                if (visit) {
                  nav(providerVisitChartPath(visit.id));
                  return;
                }
                void createVisit();
              },
              tone: "primary",
            },
            { label: "Open Queue", to: PROVIDER_ROUTES.queue },
          ]}
        />

        <div className="space" />

        <div className="card card-pad">
          {loading && <div className="muted">Loading...</div>}
          {actionMessage && <InlineNotice message={actionMessage} tone="success" style={{ marginBottom: 12 }} />}
          {err && <InlineNotice message={err} tone="error" style={{ marginBottom: 12 }} />}

          {!loading ? (
            <>
              <div className="h2">Patient</div>
              <div className="muted" style={{ marginTop: 6 }}>
                <strong>{fullName}</strong>
              </div>
              <div className="muted" style={{ marginTop: 4 }}>
                {patient?.email ?? "-"} | {patient?.phone ?? "-"}
              </div>

              {appointment ? (
                <>
                  <div className="space" />
                  <div className="h2">Appointment</div>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
                    <div className="muted">
                      {new Date(appointment.start_time).toLocaleString()} | {appointment.status ?? "-"}
                    </div>
                    <VirtualVisitBadge appointment={appointment} />
                  </div>
                  {appointment.notes ? (
                    <div className="muted" style={{ marginTop: 4 }}>
                      {appointment.notes}
                    </div>
                  ) : null}
                </>
              ) : null}

              {appointment ? (
                <>
                  <div className="space" />
                  <div className="card card-pad card-light surface-light" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                      <div style={{ flex: "1 1 320px" }}>
                        <div className="h2">Appointment Setup</div>
                        <div className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
                          Configure whether this consult is in person or virtual. Virtual visits require a meeting link before patients can join.
                        </div>
                      </div>

                      <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <JoinVirtualVisitButton appointment={appointment} className="btn btn-ghost" label="Join as Provider" />
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={saveAppointmentSettings}
                          disabled={savingAppointmentConfig}
                        >
                          {savingAppointmentConfig ? "Saving..." : "Save Appointment Setup"}
                        </button>
                      </div>
                    </div>

                    <div className="space" />

                    <VirtualVisitFormFields
                      visitType={appointmentVisitType}
                      onVisitTypeChange={setAppointmentVisitType}
                      meetingUrl={meetingUrl}
                      onMeetingUrlChange={setMeetingUrl}
                      virtualInstructions={virtualInstructions}
                      onVirtualInstructionsChange={setVirtualInstructions}
                      joinWindowLocal={joinWindowLocal}
                      onJoinWindowLocalChange={setJoinWindowLocal}
                      meetingProvider={meetingProvider}
                      onMeetingProviderChange={setMeetingProvider}
                      meetingStatus={meetingStatus}
                      onMeetingStatusChange={setMeetingStatus}
                      disabled={savingAppointmentConfig}
                    />
                  </div>
                </>
              ) : null}

              <div className="space" />

              <div className="card card-pad card-light surface-light" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="h2">Step 1: Create Visit</div>
                <div className="space" />

                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <input
                    className="input"
                    type="datetime-local"
                    style={{ flex: "1 1 240px" }}
                    value={visitDate}
                    onChange={(event) => setVisitDate(event.target.value)}
                  />

                  <select
                    className="input"
                    style={{ flex: "1 1 180px" }}
                    value={visitStatus}
                    onChange={(event) => setVisitStatus(event.target.value)}
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
                  onChange={(event) => setVisitSummary(event.target.value)}
                />

                <div className="space" />

                {!visit ? (
                  <button className="btn btn-primary" type="button" onClick={createVisit} disabled={savingVisit}>
                    {savingVisit ? "Creating..." : "Create Visit"}
                  </button>
                ) : (
                  <div className="muted">
                    Visit created: <strong>{new Date(visit.visit_date).toLocaleString()}</strong> | You can now add a wound assessment or open the chart.
                  </div>
                )}
              </div>

              <div className="space" />

              <div className="card card-pad card-light surface-light" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="h2">Step 2: Add Wound Assessment</div>
                <div className="space" />

                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <input
                    className="input"
                    style={{ flex: "1 1 220px" }}
                    placeholder="Wound label"
                    value={woundLabel}
                    onChange={(event) => setWoundLabel(event.target.value)}
                    disabled={!visit}
                  />

                  <input
                    className="input"
                    style={{ flex: "1 1 220px" }}
                    placeholder="Body site"
                    value={bodySite}
                    onChange={(event) => setBodySite(event.target.value)}
                    disabled={!visit}
                  />

                  <input
                    className="input"
                    style={{ flex: "1 1 180px" }}
                    placeholder="Laterality"
                    value={laterality}
                    onChange={(event) => setLaterality(event.target.value)}
                    disabled={!visit}
                  />

                  <input
                    className="input"
                    style={{ flex: "1 1 220px" }}
                    placeholder="Wound type"
                    value={woundType}
                    onChange={(event) => setWoundType(event.target.value)}
                    disabled={!visit}
                  />
                </div>

                <div className="space" />

                <button className="btn btn-primary" type="button" onClick={addWoundAssessment} disabled={!visit || savingWound}>
                  {savingWound ? "Saving..." : "Save Wound Assessment"}
                </button>

                {visit ? (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => nav(providerVisitChartPath(visit.id))}
                    style={{ marginLeft: 8 }}
                  >
                    Skip to Visit Chart
                  </button>
                ) : null}
              </div>

              {visit ? (
                <>
                  <div className="space" />
                  <button className="btn btn-ghost" type="button" onClick={() => nav(providerVisitChartPath(visit.id))}>
                    Open Visit Chart
                  </button>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
