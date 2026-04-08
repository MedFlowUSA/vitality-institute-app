import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import RouteHeader from "../components/RouteHeader";
import ProviderGuidePanel from "../components/provider/ProviderGuidePanel";
import ProviderWorkspaceNav from "../components/provider/ProviderWorkspaceNav";
import ProfileSummaryCard from "../components/vital-ai/ProfileSummaryCard";
import { useAuth } from "../auth/AuthProvider";
import InlineNotice from "../components/InlineNotice";
import { supabase } from "../lib/supabase";
import { buildProviderVitalAiQueueGuide } from "../lib/provider/providerGuide";
import {
  PROVIDER_ROUTES,
  providerPatientCenterPath,
  providerVisitBuilderAppointmentPath,
  providerVitalAiProfilePath,
} from "../lib/providerRoutes";
import { fromDateTimeLocalValue, getDefaultJoinWindowOpensAt } from "../lib/virtualVisits";
import type { VitalAiLeadRow, VitalAiPathwayRow, VitalAiProfileRow } from "../lib/vitalAi/types";

type ProviderLite = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  active_location_id: string | null;
};

type AppointmentLite = {
  id: string;
  patient_id: string;
  location_id: string;
  provider_user_id: string | null;
  start_time: string;
  end_time: string | null;
  status: string | null;
  visit_type: string | null;
  telehealth_enabled: boolean | null;
  meeting_url: string | null;
  meeting_status: string | null;
  virtual_instructions: string | null;
};

type QueuePatient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type ProfileQueueRow = Pick<
  VitalAiProfileRow,
  "id" | "session_id" | "pathway_id" | "patient_id" | "profile_id" | "summary" | "profile_json" | "triage_level" | "status" | "created_at" | "updated_at"
>;

type LeadQueueRow = Pick<
  VitalAiLeadRow,
  "id" | "session_id" | "pathway_id" | "patient_id" | "profile_id" | "appointment_id" | "lead_status" | "priority" | "assigned_to" | "next_action_at" | "lead_json" | "created_at" | "updated_at"
>;

type QueueItem = {
  profile: ProfileQueueRow;
  lead: LeadQueueRow | null;
};

const PROFILE_SELECT_FIELDS =
  "id,session_id,pathway_id,patient_id,profile_id,summary,profile_json,triage_level,status,created_at,updated_at";
const LEAD_SELECT_FIELDS =
  "id,session_id,pathway_id,patient_id,profile_id,appointment_id,lead_status,priority,assigned_to,next_action_at,lead_json,created_at,updated_at";
const PATHWAY_SELECT_FIELDS = "id,slug,name,description,is_active,version,definition_json";
const PATIENT_SELECT_FIELDS = "id,first_name,last_name";
const APPOINTMENT_SELECT_FIELDS =
  "id,patient_id,location_id,provider_user_id,start_time,end_time,status,visit_type,telehealth_enabled,meeting_url,meeting_status,virtual_instructions";
const PROVIDER_SELECT_FIELDS = "id,first_name,last_name,role,active_location_id";

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "Awaiting scheduling",
  scheduled_virtual: "Virtual visit scheduled",
  scheduled_in_person: "In-person visit scheduled",
  no_visit_needed: "No visit needed",
  closed: "Closed",
};

function computeEndTimeIso(startIso: string) {
  return new Date(new Date(startIso).getTime() + 30 * 60 * 1000).toISOString();
}

function patientNameFromProfile(profile: ProfileQueueRow, patient?: QueuePatient | null) {
  if (patient) return `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || "Patient";
  const maybePatient = (profile.profile_json as { patient?: { first_name?: string; last_name?: string } } | null)?.patient;
  return `${maybePatient?.first_name ?? ""} ${maybePatient?.last_name ?? ""}`.trim() || "Patient";
}

export default function ProviderVitalAiQueue() {
  const navigate = useNavigate();
  const { activeLocationId, role, user, resumeKey } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileQueueRow[]>([]);
  const [leadsBySession, setLeadsBySession] = useState<Record<string, LeadQueueRow>>({});
  const [pathways, setPathways] = useState<Record<string, VitalAiPathwayRow>>({});
  const [patients, setPatients] = useState<Record<string, QueuePatient>>({});
  const [appointmentsById, setAppointmentsById] = useState<Record<string, AppointmentLite>>({});
  const [providers, setProviders] = useState<ProviderLite[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [scheduleVisitType, setScheduleVisitType] = useState<"virtual" | "in_person">("virtual");
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [providerUserId, setProviderUserId] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [virtualInstructions, setVirtualInstructions] = useState("");
  const [joinWindowLocal, setJoinWindowLocal] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");

  const queueItems = useMemo<QueueItem[]>(
    () =>
      profiles.map((profile) => ({
        profile,
        lead: leadsBySession[profile.session_id] ?? null,
      })),
    [leadsBySession, profiles]
  );

  const selected = useMemo(() => queueItems.find((item) => item.profile.id === selectedId) ?? null, [queueItems, selectedId]);
  const selectedAppointment = selected?.lead?.appointment_id ? appointmentsById[selected.lead.appointment_id] ?? null : null;
  const guide = useMemo(
    () => buildProviderVitalAiQueueGuide(!!selected, !!selectedAppointment),
    [selected, selectedAppointment]
  );
  const locationScopedProviders = useMemo(
    () => providers.filter((provider) => !activeLocationId || !provider.active_location_id || provider.active_location_id === activeLocationId),
    [activeLocationId, providers]
  );

  const loadQueue = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [{ data: profileRows, error: profileError }, { data: leadRows, error: leadError }, { data: providerRows, error: providerError }] =
        await Promise.all([
          supabase.from("vital_ai_profiles").select(PROFILE_SELECT_FIELDS).order("created_at", { ascending: false }),
          supabase.from("vital_ai_leads").select(LEAD_SELECT_FIELDS).order("created_at", { ascending: false }),
          supabase.from("profiles").select(PROVIDER_SELECT_FIELDS).in("role", ["provider", "location_admin"]).order("first_name"),
        ]);

      if (profileError) throw profileError;
      if (leadError) throw leadError;
      if (providerError) throw providerError;

      const nextProfiles = (profileRows as ProfileQueueRow[]) ?? [];
      const nextLeads = (leadRows as LeadQueueRow[]) ?? [];
      setProfiles(nextProfiles);
      setProviders((providerRows as ProviderLite[]) ?? []);
      if (!selectedId && nextProfiles[0]) setSelectedId(nextProfiles[0].id);

      const nextLeadsBySession: Record<string, LeadQueueRow> = {};
      for (const lead of nextLeads) nextLeadsBySession[lead.session_id] = lead;
      setLeadsBySession(nextLeadsBySession);

      const pathwayIds = Array.from(new Set(nextProfiles.map((profile) => profile.pathway_id).filter(Boolean)));
      const patientIds = Array.from(
        new Set(nextProfiles.map((profile) => profile.patient_id).concat(nextLeads.map((lead) => lead.patient_id)).filter(Boolean))
      ) as string[];
      const appointmentIds = Array.from(new Set(nextLeads.map((lead) => lead.appointment_id).filter(Boolean))) as string[];

      const [pathwayResult, patientResult, appointmentResult] = await Promise.all([
        pathwayIds.length ? supabase.from("vital_ai_pathways").select(PATHWAY_SELECT_FIELDS).in("id", pathwayIds) : Promise.resolve({ data: [], error: null }),
        patientIds.length ? supabase.from("patients").select(PATIENT_SELECT_FIELDS).in("id", patientIds) : Promise.resolve({ data: [], error: null }),
        appointmentIds.length
          ? supabase.from("appointments").select(APPOINTMENT_SELECT_FIELDS).in("id", appointmentIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (pathwayResult.error) throw pathwayResult.error;
      if (patientResult.error) throw patientResult.error;
      if (appointmentResult.error) throw appointmentResult.error;

      const nextPathways: Record<string, VitalAiPathwayRow> = {};
      for (const row of (pathwayResult.data as VitalAiPathwayRow[]) ?? []) nextPathways[row.id] = row;
      setPathways(nextPathways);

      const nextPatients: Record<string, QueuePatient> = {};
      for (const row of (patientResult.data as QueuePatient[]) ?? []) nextPatients[row.id] = row;
      setPatients(nextPatients);

      const nextAppointments: Record<string, AppointmentLite> = {};
      for (const row of (appointmentResult.data as AppointmentLite[]) ?? []) nextAppointments[row.id] = row;
      setAppointmentsById(nextAppointments);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load Vital AI provider requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeKey]);

  useEffect(() => {
    if (!selected) {
      setScheduleVisitType("virtual");
      setScheduleDateTime("");
      setProviderUserId(role === "provider" && user?.id ? user.id : "");
      setMeetingUrl("");
      setVirtualInstructions("");
      setJoinWindowLocal("");
      setScheduleNotes("");
      return;
    }

    const leadSummary = (selected.lead?.lead_json as { summary?: string } | null)?.summary ?? "";
    setScheduleNotes(selected.profile.summary ?? leadSummary ?? "");
    setProviderUserId(role === "provider" && user?.id ? user.id : "");

    if (selectedAppointment) {
      setScheduleVisitType(selectedAppointment.visit_type === "virtual" || selectedAppointment.telehealth_enabled ? "virtual" : "in_person");
      setScheduleDateTime(new Date(selectedAppointment.start_time).toISOString().slice(0, 16));
      setMeetingUrl(selectedAppointment.meeting_url ?? "");
      setVirtualInstructions(selectedAppointment.virtual_instructions ?? "");
      setJoinWindowLocal(new Date(selectedAppointment.start_time).toISOString().slice(0, 16));
      return;
    }

    const local = new Date();
    local.setDate(local.getDate() + 1);
    local.setHours(9, 0, 0, 0);
    const yyyy = local.getFullYear();
    const mm = String(local.getMonth() + 1).padStart(2, "0");
    const dd = String(local.getDate()).padStart(2, "0");
    const hh = String(local.getHours()).padStart(2, "0");
    const mi = String(local.getMinutes()).padStart(2, "0");
    setScheduleDateTime(`${yyyy}-${mm}-${dd}T${hh}:${mi}`);
    setMeetingUrl("");
    setVirtualInstructions("");
    setJoinWindowLocal("");
  }, [role, selected, selectedAppointment, user?.id]);

  const refreshQueue = async () => {
    await loadQueue();
  };

  const createAppointmentFromRequest = async () => {
    if (!selected?.lead || !selected.profile.patient_id) return setErr("Select a request with a linked patient record.");
    if (!activeLocationId) return setErr("Set an active location before scheduling.");
    if (!scheduleDateTime) return setErr("Select a date and time.");
    if (scheduleVisitType === "virtual" && !meetingUrl.trim()) return setErr("Meeting URL is required for a virtual visit.");

    if (selected.lead.appointment_id) {
      navigate(providerVisitBuilderAppointmentPath(selected.lead.appointment_id));
      return;
    }

    setSaving(true);
    setErr(null);
    try {
      const startIso = new Date(scheduleDateTime).toISOString();
      const { data: appointmentRow, error: appointmentError } = await supabase
        .from("appointments")
        .insert([
          {
            patient_id: selected.profile.patient_id,
            location_id: activeLocationId,
            provider_user_id: providerUserId || null,
            service_id: null,
            start_time: startIso,
            end_time: computeEndTimeIso(startIso),
            status: "scheduled",
            visit_type: scheduleVisitType,
            telehealth_enabled: scheduleVisitType === "virtual",
            meeting_url: scheduleVisitType === "virtual" ? meetingUrl.trim() : null,
            meeting_provider: "external_link",
            meeting_status: "not_started",
            join_window_opens_at:
              scheduleVisitType === "virtual"
                ? fromDateTimeLocalValue(joinWindowLocal) ?? getDefaultJoinWindowOpensAt(startIso)
                : null,
            virtual_instructions: scheduleVisitType === "virtual" ? virtualInstructions.trim() || null : null,
            notes: scheduleNotes.trim() || selected.profile.summary || null,
          },
        ])
        .select(APPOINTMENT_SELECT_FIELDS)
        .single();
      if (appointmentError) throw appointmentError;

      const nextAppointment = appointmentRow as AppointmentLite;
      const [{ error: leadError }, { error: profileError }, { error: taskError }] = await Promise.all([
        supabase
          .from("vital_ai_leads")
          .update({
            appointment_id: nextAppointment.id,
            lead_status: scheduleVisitType === "virtual" ? "scheduled_virtual" : "scheduled_in_person",
            assigned_to: providerUserId || user?.id || null,
            next_action_at: nextAppointment.start_time,
          })
          .eq("id", selected.lead.id),
        supabase.from("vital_ai_profiles").update({ status: "scheduled" }).eq("id", selected.profile.id),
        supabase
          .from("vital_ai_review_tasks")
          .update({ status: "scheduled" })
          .eq("session_id", selected.profile.session_id)
          .in("task_type", ["staff_follow_up", "provider_review"]),
      ]);
      if (leadError) throw leadError;
      if (profileError) throw profileError;
      if (taskError) throw taskError;

      await refreshQueue();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create an appointment from this Vital AI request.");
    } finally {
      setSaving(false);
    }
  };

  const markNoVisitNeeded = async () => {
    if (!selected?.lead) return setErr("Select a request first.");

    setSaving(true);
    setErr(null);
    try {
      const [{ error: leadError }, { error: profileError }, { error: taskError }] = await Promise.all([
        supabase
          .from("vital_ai_leads")
          .update({
            lead_status: "no_visit_needed",
            assigned_to: user?.id ?? null,
            next_action_at: null,
          })
          .eq("id", selected.lead.id),
        supabase.from("vital_ai_profiles").update({ status: "no_visit_needed" }).eq("id", selected.profile.id),
        supabase
          .from("vital_ai_review_tasks")
          .update({ status: "closed" })
          .eq("session_id", selected.profile.session_id)
          .in("task_type", ["staff_follow_up", "provider_review"]),
      ]);
      if (leadError) throw leadError;
      if (profileError) throw profileError;
      if (taskError) throw taskError;

      await refreshQueue();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to close this request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <RouteHeader
          title="Vital AI Requests"
          subtitle="Review submitted requests and schedule the next step."
          backTo="/provider"
          homeTo="/provider"
        />

        <div className="space" />

        <VitalityHero
          title="Vital AI Requests"
          subtitle="Review Vital AI intakes and convert approved requests into scheduled visits."
          secondaryCta={{ label: "Back", to: "/provider" }}
          showKpis={false}
        />

        <div className="space" />

        <ProviderWorkspaceNav compact />

        <div className="space" />

        <ProviderGuidePanel
          title={guide.title}
          description={guide.description}
          workflowState={guide.workflowState}
          nextAction={guide.nextAction}
          actions={[
            { label: "Review Intake", to: selected ? providerVitalAiProfilePath(selected.profile.id) : PROVIDER_ROUTES.vitalAi, tone: "primary" },
            {
              label: "Schedule Virtual Visit",
              onClick: () => setScheduleVisitType("virtual"),
            },
            {
              label: "Schedule In-Person Visit",
              onClick: () => setScheduleVisitType("in_person"),
            },
          ]}
        />

        <div className="space" />

        {loading ? (
          <div className="card card-pad">
            <div className="muted">Loading Vital AI requests...</div>
          </div>
        ) : err ? (
          <InlineNotice message={err} tone="error" style={{ marginBottom: 12 }} />
        ) : (
          <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div className="card card-pad" style={{ flex: "1 1 380px", minWidth: 320 }}>
              <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div className="h2">Pending Scheduling</div>
                  <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                    Submitted Vital AI requests ready for provider or staff scheduling.
                  </div>
                </div>
                <button className="btn btn-ghost" type="button" onClick={loadQueue} disabled={saving}>
                  Refresh
                </button>
              </div>

              <div className="space" />

              {queueItems.length === 0 ? (
                <div className="muted">No Vital AI requests are waiting for scheduling.</div>
              ) : (
                queueItems.map((item) => {
                  const patient = item.profile.patient_id ? patients[item.profile.patient_id] ?? null : null;
                  const appointment = item.lead?.appointment_id ? appointmentsById[item.lead.appointment_id] ?? null : null;
                  return (
                    <button
                      key={item.profile.id}
                      className={selectedId === item.profile.id ? "btn btn-primary" : "btn btn-ghost"}
                      type="button"
                      style={{ width: "100%", justifyContent: "space-between", marginBottom: 8, textAlign: "left" }}
                      onClick={() => setSelectedId(item.profile.id)}
                    >
                      <span>
                        <div style={{ fontWeight: 800 }}>{patientNameFromProfile(item.profile, patient)}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {pathways[item.profile.pathway_id]?.name ?? "Pathway"} |{" "}
                          {LEAD_STATUS_LABELS[item.lead?.lead_status ?? "new"] ?? item.lead?.lead_status ?? "Awaiting scheduling"} |{" "}
                          {new Date(item.profile.created_at).toLocaleString()}
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {item.profile.summary ?? "No summary available yet."}
                        </div>
                      </span>
                      <span className="muted" style={{ fontSize: 12 }}>{appointment ? "Scheduled" : "Open"}</span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="card card-pad" style={{ flex: "2 1 720px", minWidth: 340 }}>
              {!selected ? (
                <div className="muted">Select a request.</div>
              ) : (
                <>
                  <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div>
                      <div className="h2">Request Bridge</div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        {pathways[selected.profile.pathway_id]?.name ?? "Pathway"} |{" "}
                        {LEAD_STATUS_LABELS[selected.lead?.lead_status ?? "new"] ?? selected.lead?.lead_status ?? "Awaiting scheduling"}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <button className="btn btn-primary" type="button" onClick={() => navigate(providerVitalAiProfilePath(selected.profile.id))}>
                        Review Intake
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => setScheduleVisitType("virtual")}>
                        Schedule Virtual Visit
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => setScheduleVisitType("in_person")}>
                        Schedule In-Person Visit
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={markNoVisitNeeded}
                        disabled={saving || selected.lead?.lead_status === "no_visit_needed"}
                      >
                        Mark No Visit Needed
                      </button>
                    </div>
                  </div>

                  <div className="space" />

                  <ProfileSummaryCard profile={selected.profile as VitalAiProfileRow} />

                  <div className="space" />

                  <div className="card card-pad card-light surface-light" style={{ background: "rgba(250,247,255,0.72)", border: "1px solid rgba(184,164,255,0.18)" }}>
                    <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                      <div style={{ flex: "1 1 320px" }}>
                        <div className="h2">Schedule From Request</div>
                        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                          Create a real appointment row from this submitted intake. Patient-side visit cards only appear after scheduling is complete.
                        </div>
                      </div>
                      {selectedAppointment ? (
                        <div className="v-chip">
                          Linked appointment: <strong>{new Date(selectedAppointment.start_time).toLocaleString()}</strong>
                        </div>
                      ) : null}
                    </div>

                    <div className="space" />

                    {selectedAppointment ? (
                      <div style={{ display: "grid", gap: 12 }}>
                        <div className="muted">
                          This request is already linked to a{" "}
                          {selectedAppointment.visit_type === "virtual" || selectedAppointment.telehealth_enabled ? "virtual" : "in-person"} appointment.
                        </div>
                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          <button className="btn btn-primary" type="button" onClick={() => navigate(providerVisitBuilderAppointmentPath(selectedAppointment.id))}>
                            Open Appointment Setup
                          </button>
                          <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={() => navigate(providerPatientCenterPath(selected.profile.patient_id))}
                            disabled={!selected.profile.patient_id}
                          >
                            Open Patient
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {!activeLocationId ? (
                          <div className="muted">Set an active location before scheduling a visit from this request.</div>
                        ) : null}

                        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                          <select
                            className="input"
                            value={scheduleVisitType}
                            onChange={(e) => setScheduleVisitType(e.target.value as "virtual" | "in_person")}
                            style={{ flex: "1 1 220px" }}
                          >
                            <option value="virtual">Virtual</option>
                            <option value="in_person">In Person</option>
                          </select>

                          <input
                            className="input"
                            type="datetime-local"
                            value={scheduleDateTime}
                            onChange={(e) => setScheduleDateTime(e.target.value)}
                            style={{ flex: "1 1 240px" }}
                          />

                          <select
                            className="input"
                            value={providerUserId}
                            onChange={(e) => setProviderUserId(e.target.value)}
                            style={{ flex: "1 1 220px" }}
                          >
                            <option value="">Assign provider later</option>
                            {locationScopedProviders.map((provider) => (
                              <option key={provider.id} value={provider.id}>
                                {`${provider.first_name ?? ""} ${provider.last_name ?? ""}`.trim() || provider.id}
                              </option>
                            ))}
                          </select>
                        </div>

                        {scheduleVisitType === "virtual" ? (
                          <>
                            <div className="space" />
                            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                              <input
                                className="input"
                                placeholder="Meeting URL"
                                value={meetingUrl}
                                onChange={(e) => setMeetingUrl(e.target.value)}
                                style={{ flex: "2 1 320px" }}
                              />
                              <input
                                className="input"
                                type="datetime-local"
                                value={joinWindowLocal}
                                onChange={(e) => setJoinWindowLocal(e.target.value)}
                                style={{ flex: "1 1 220px" }}
                              />
                            </div>
                            <div className="space" />
                            <textarea
                              className="input"
                              style={{ width: "100%", minHeight: 76 }}
                              placeholder="Virtual visit instructions"
                              value={virtualInstructions}
                              onChange={(e) => setVirtualInstructions(e.target.value)}
                            />
                          </>
                        ) : null}

                        <div className="space" />

                        <textarea
                          className="input"
                          style={{ width: "100%", minHeight: 76 }}
                          placeholder="Scheduling notes"
                          value={scheduleNotes}
                          onChange={(e) => setScheduleNotes(e.target.value)}
                        />

                        <div className="space" />

                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          <button className="btn btn-primary" type="button" onClick={createAppointmentFromRequest} disabled={saving || !activeLocationId}>
                            {saving ? "Scheduling..." : scheduleVisitType === "virtual" ? "Create Virtual Appointment" : "Create In-Person Appointment"}
                          </button>
                          <button className="btn btn-ghost" type="button" onClick={() => navigate(providerVitalAiProfilePath(selected.profile.id))}>
                            Review Intake First
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
