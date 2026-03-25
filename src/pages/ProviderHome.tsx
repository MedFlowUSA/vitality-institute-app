// src/pages/ProviderHome.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import VirtualVisitBadge from "../components/VirtualVisitBadge";
import JoinVirtualVisitButton from "../components/JoinVirtualVisitButton";
import ProviderGuidePanel from "../components/provider/ProviderGuidePanel";
import ProviderWorkspaceNav from "../components/provider/ProviderWorkspaceNav";
import { ensureLegacyAppointmentThread } from "../lib/messaging/legacyChat";
import { getErrorMessage } from "../lib/patientRecords";
import { buildProviderHomeGuide } from "../lib/provider/providerGuide";
import { getVirtualVisitState } from "../lib/virtualVisits";

type LocationRow = { id: string; name: string };
type ServiceRow = { id: string; name: string; location_id: string };
type UserLocationRow = { location_id: string; is_primary: boolean };
type PatientNameRow = {
  id?: string | null;
  profile_id?: string | null;
  first_name: string | null;
  last_name: string | null;
};
type AppointmentStatusRow = { status: string | null };
type IntakeStatusRow = { id: string };
type VisitRpcResult = { id?: string | null } | string | null;
type ExistingVisitRow = { id: string };

type ApptRow = {
  id: string;
  location_id: string;
  service_id: string | null;
  patient_id: string;
  start_time: string;
  status: string;
  notes: string | null;
  visit_type: string | null;
  telehealth_enabled: boolean | null;
  meeting_url: string | null;
  meeting_provider: string | null;
  meeting_status: string | null;
  join_window_opens_at: string | null;
  virtual_instructions: string | null;
};

type ProviderCounts = {
  apptsToday: number;
  requestedToday: number;
  confirmedToday: number;
  completedToday: number;
  requestedUpcoming: number;
  confirmedUpcoming: number;
  woundIntakesPending: number;
};

export default function ProviderHome() {
  const { user, role, signOut, activeLocationId, setActiveLocationId, resumeKey } = useAuth();
  const navigate = useNavigate();

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [appointments, setAppointments] = useState<ApptRow[]>([]);
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<ProviderCounts>({
    apptsToday: 0,
    requestedToday: 0,
    confirmedToday: 0,
    completedToday: 0,
    requestedUpcoming: 0,
    confirmedUpcoming: 0,
    woundIntakesPending: 0,
  });

  const [loading, setLoading] = useState(true);
  const [countsLoading, setCountsLoading] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [startingVisitId, setStartingVisitId] = useState<string | null>(null);

  const didInit = useRef(false);
  const isAdmin = useMemo(() => role === "super_admin" || role === "location_admin", [role]);

  const locName = useMemo(() => {
    const map = new Map(locations.map((item) => [item.id, item.name]));
    return (id: string | null) => {
      if (!id) return "No location selected";
      return map.get(id) ?? id;
    };
  }, [locations]);

  const svcName = useMemo(() => {
    const map = new Map(services.map((item) => [item.id, item.name]));
    return (id: string | null) => (id ? map.get(id) ?? "-" : "-");
  }, [services]);

  const patientLabel = (id: string) => patientNames[id] ?? "Patient";
  const getVisitIdFromRpc = (result: VisitRpcResult) => {
    if (typeof result === "string") return result;
    if (result && typeof result === "object" && "id" in result) return result.id ?? null;
    return null;
  };

  const nextAppointments = useMemo(() => appointments.slice(0, 3), [appointments]);
  const guide = useMemo(() => buildProviderHomeGuide(), []);
  const todayVirtualVisits = useMemo(
    () =>
      appointments.filter((item) => {
        const state = getVirtualVisitState(item);
        const start = new Date(item.start_time);
        const now = new Date();
        return (
          state.isVirtual &&
          start.getFullYear() === now.getFullYear() &&
          start.getMonth() === now.getMonth() &&
          start.getDate() === now.getDate()
        );
      }),
    [appointments]
  );

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const getLocationScopeFilter = <T extends { eq(column: string, value: string): T }>(query: T) => {
    if (!activeLocationId) return query;
    return query.eq("location_id", activeLocationId);
  };

  const resolvePatientRecordId = async (candidateId: string) => {
    if (!candidateId) throw new Error("Missing patient id.");

    const { data: byId, error: byIdErr } = await supabase.from("patients").select("id").eq("id", candidateId).maybeSingle();
    if (byIdErr) throw byIdErr;
    if (byId?.id) return byId.id as string;

    const { data: byProfile, error: byProfileErr } = await supabase
      .from("patients")
      .select("id")
      .eq("profile_id", candidateId)
      .maybeSingle();
    if (byProfileErr) throw byProfileErr;
    if (byProfile?.id) return byProfile.id as string;

    throw new Error("Patient record not found.");
  };

  const loadBase = async (uid: string) => {
    setErr(null);

    if (isAdmin) {
      const { data, error } = await supabase.from("locations").select("id,name").order("name");
      if (error) throw error;
      setLocations((data as LocationRow[]) ?? []);
    } else {
      const { data: memberships, error: membershipErr } = await supabase
        .from("user_locations")
        .select("location_id,is_primary")
        .eq("user_id", uid)
        .order("is_primary", { ascending: false });

      if (membershipErr) throw membershipErr;

      const rows = (memberships as UserLocationRow[]) ?? [];
      const ids = rows.map((item) => item.location_id).filter(Boolean);
      if (ids.length === 0) {
        setLocations([]);
        throw new Error("No location access found for your user. Add a row in user_locations.");
      }

      const { data: locationRows, error: locationErr } = await supabase
        .from("locations")
        .select("id,name")
        .in("id", ids)
        .order("name");

      if (locationErr) throw locationErr;

      setLocations((locationRows as LocationRow[]) ?? []);

      const fallbackLocationId = rows.find((item) => item.is_primary)?.location_id ?? rows[0]?.location_id ?? null;
      if (!activeLocationId && fallbackLocationId) {
        await setActiveLocationId(fallbackLocationId);
      }
    }

    const { data: serviceRows, error: serviceErr } = await supabase
      .from("services")
      .select("id,name,location_id")
      .eq("is_active", true)
      .order("name");

    if (serviceErr) throw serviceErr;
    setServices((serviceRows as ServiceRow[]) ?? []);
  };

  const loadAppointments = async () => {
    setErr(null);
    setLoading(true);

    try {
      if (!activeLocationId) {
        setAppointments([]);
        return;
      }

      let query = supabase
        .from("appointments")
        .select(
          "id,location_id,service_id,patient_id,start_time,status,notes,visit_type,telehealth_enabled,meeting_url,meeting_provider,meeting_status,join_window_opens_at,virtual_instructions"
        )
        .order("start_time", { ascending: true });

      query = getLocationScopeFilter(query);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data as ApptRow[]) ?? [];
      setAppointments(rows);

      const patientIds = Array.from(new Set(rows.map((item) => item.patient_id).filter(Boolean)));
      if (patientIds.length === 0) {
        setPatientNames({});
        return;
      }

      const [{ data: byIdRows, error: byIdErr }, { data: byProfileRows, error: byProfileErr }] = await Promise.all([
        supabase.from("patients").select("id,first_name,last_name").in("id", patientIds),
        supabase.from("patients").select("profile_id,first_name,last_name").in("profile_id", patientIds),
      ]);

      if (byIdErr) throw byIdErr;
      if (byProfileErr) throw byProfileErr;

      const names: Record<string, string> = {};
      [((byIdRows as PatientNameRow[] | null) ?? []), ((byProfileRows as PatientNameRow[] | null) ?? [])].forEach((group) => {
        group.forEach((row) => {
          const key = row.id ?? row.profile_id;
          if (!key) return;
          names[key] = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Patient";
        });
      });

      setPatientNames(names);
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Failed to load appointments."));
      setAppointments([]);
      setPatientNames({});
    } finally {
      setLoading(false);
    }
  };

  const loadCounts = async () => {
    if (!user?.id) return;

    setCountsLoading(true);
    setErr(null);

    try {
      if (!activeLocationId) {
        setCounts({
          apptsToday: 0,
          requestedToday: 0,
          confirmedToday: 0,
          completedToday: 0,
          requestedUpcoming: 0,
          confirmedUpcoming: 0,
          woundIntakesPending: 0,
        });
        return;
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const plus7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      let todayQuery = supabase
        .from("appointments")
        .select("id,status,start_time,location_id", { count: "exact" })
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", todayEnd.toISOString());
      todayQuery = getLocationScopeFilter(todayQuery);

      const { data: todayRows, error: todayErr } = await todayQuery;
      if (todayErr) throw todayErr;

      let upcomingQuery = supabase
        .from("appointments")
        .select("id,status,start_time,location_id")
        .gte("start_time", now.toISOString())
        .lte("start_time", plus7.toISOString());
      upcomingQuery = getLocationScopeFilter(upcomingQuery);

      const { data: upcomingRows, error: upcomingErr } = await upcomingQuery;
      if (upcomingErr) throw upcomingErr;

      let intakeQuery = supabase
        .from("patient_intakes")
        .select("id,status,location_id")
        .eq("service_type", "wound_care")
        .in("status", ["submitted", "needs_info"]);
      intakeQuery = getLocationScopeFilter(intakeQuery);

      const { data: intakeRows, error: intakeErr } = await intakeQuery;
      if (intakeErr) throw intakeErr;

      setCounts({
        apptsToday: (todayRows ?? []).length,
        requestedToday: ((todayRows as AppointmentStatusRow[] | null) ?? []).filter((item) => (item.status || "").toLowerCase() === "requested").length,
        confirmedToday: ((todayRows as AppointmentStatusRow[] | null) ?? []).filter((item) => (item.status || "").toLowerCase() === "confirmed").length,
        completedToday: ((todayRows as AppointmentStatusRow[] | null) ?? []).filter((item) => (item.status || "").toLowerCase() === "completed").length,
        requestedUpcoming: ((upcomingRows as AppointmentStatusRow[] | null) ?? []).filter((item) => (item.status || "").toLowerCase() === "requested").length,
        confirmedUpcoming: ((upcomingRows as AppointmentStatusRow[] | null) ?? []).filter((item) => (item.status || "").toLowerCase() === "confirmed").length,
        woundIntakesPending: ((intakeRows as IntakeStatusRow[] | null) ?? []).length,
      });
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Failed to load provider counts."));
    } finally {
      setCountsLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    if (didInit.current) return;
    didInit.current = true;

    (async () => {
      setLoading(true);
      try {
        await loadBase(user.id);
      } catch (e: unknown) {
        setErr(getErrorMessage(e, "Failed to load base data."));
      } finally {
        setLoading(false);
      }
    })();
  }, [activeLocationId, isAdmin, setActiveLocationId, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    loadAppointments();
    loadCounts();
  }, [activeLocationId, resumeKey, user?.id]);

  useEffect(() => {
    if (!user?.id || resumeKey === 0) return;

    (async () => {
      try {
        await loadBase(user.id);
        await refreshAll();
      } catch (e: unknown) {
        setErr(getErrorMessage(e, "Failed to recover the provider dashboard after returning to the app."));
      }
    })();
  }, [resumeKey, user?.id]);

  const refreshAll = async () => {
    await loadAppointments();
    await loadCounts();
  };

  const updateActiveLocation = async (nextLocationId: string) => {
    setLocationSaving(true);
    setErr(null);
    try {
      await setActiveLocationId(nextLocationId || null);
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Failed to update active location."));
    } finally {
      setLocationSaving(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) {
      setErr(error.message);
      return;
    }
    await refreshAll();
  };

  const setMeetingStatus = async (id: string, meetingStatus: string) => {
    const { error } = await supabase.from("appointments").update({ meeting_status: meetingStatus }).eq("id", id);
    if (error) {
      setErr(error.message);
      return;
    }
    await refreshAll();
  };

  const messagePatient = async (appt: ApptRow) => {
    setErr(null);
    if (!user) return;
    try {
      const threadId = await ensureLegacyAppointmentThread({
        appointmentId: appt.id,
        patientCandidateId: appt.patient_id,
        locationId: appt.location_id,
        title: "Appointment conversation",
      });

      navigate(`/provider/chat?threadId=${threadId}`);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Could not open conversation."));
    }
  };

  const startVisit = async (appt: ApptRow) => {
    try {
      setErr(null);
      setStartingVisitId(appt.id);
      const visitPatientId = await resolvePatientRecordId(appt.patient_id);

      const { data: existingVisit, error: visitErr } = await supabase
        .from("patient_visits")
        .select("id")
        .eq("appointment_id", appt.id)
        .maybeSingle<ExistingVisitRow>();

      if (visitErr) throw visitErr;

      if (existingVisit?.id) {
        navigate(`/provider/patients/${visitPatientId}?visitId=${existingVisit.id}`);
        return;
      }

      const { data: visitId, error: rpcErr } = await supabase.rpc("start_patient_visit", {
        p_patient: visitPatientId,
        p_location: appt.location_id,
        p_appointment: appt.id,
      });

      if (rpcErr) throw rpcErr;

      const nextVisitId = getVisitIdFromRpc(visitId as VisitRpcResult);
      if (!nextVisitId) throw new Error("Visit created but no visitId was returned.");

      navigate(`/provider/patients/${visitPatientId}?visitId=${nextVisitId}`);
      await refreshAll();
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Failed to start visit."));
    } finally {
      setStartingVisitId(null);
    }
  };

  const StatCard = ({ label, value, note }: { label: string; value: string | number; note?: string }) => (
    <div
      className="card card-pad card-light surface-light"
      style={{
        flex: "1 1 180px",
        minWidth: 160,
        background: "rgba(255,255,255,0.9)",
        border: "1px solid rgba(184,164,255,0.22)",
      }}
    >
      <div className="muted" style={{ fontSize: 12 }}>
        {label}
      </div>
      <div className="h1" style={{ marginTop: 8 }}>
        {value}
      </div>
      {note ? (
        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
          {note}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="app-bg">
      <div className="shell">
        <div
          className="card card-pad"
          style={{
            background: "linear-gradient(135deg, rgba(27,20,49,.96), rgba(35,26,61,.94))",
            border: "1px solid rgba(184,164,255,.24)",
            boxShadow: "0 24px 70px rgba(10,8,24,.26)",
          }}
        >
          <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 360px", minWidth: 280 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "rgba(216,204,255,.88)",
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                }}
              >
                Provider Dashboard
              </div>
              <div style={{ marginTop: 8, fontSize: 30, fontWeight: 900, color: "#FAF7FF", lineHeight: 1.04 }}>
                Focus your day from one provider workspace.
              </div>
              <div style={{ marginTop: 10, maxWidth: 760, color: "rgba(233,226,255,.8)", lineHeight: 1.7 }}>
                Queue, patients, intake review, referrals, and virtual visits stay one click away.
              </div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" type="button" onClick={refreshAll}>
                Refresh
              </button>
              <button className="btn btn-secondary" type="button" onClick={signOut}>
                Sign out
              </button>
            </div>
          </div>

          <div className="space" />

          <div
            className="row"
            style={{
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              alignItems: "flex-end",
              padding: 16,
              borderRadius: 20,
              background: "rgba(255,255,255,.07)",
              border: "1px solid rgba(216,204,255,.14)",
            }}
          >
            <div style={{ flex: "1 1 280px", minWidth: 260 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(216,204,255,.76)", marginBottom: 6 }}>Active Location</div>
              <select
                className="input"
                style={{ width: "100%" }}
                value={activeLocationId ?? ""}
                onChange={(e) => updateActiveLocation(e.target.value)}
                disabled={locationSaving || locations.length === 0}
                title="Set the location context for the provider portal"
              >
                <option value="" disabled>
                  Select location...
                </option>
                {locations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <div style={{ marginTop: 8, color: "rgba(233,226,255,.72)", fontSize: 12 }}>
                {activeLocationId
                  ? `Current scope: ${locName(activeLocationId)}`
                  : isAdmin
                  ? "Choose a location to scope the provider portal."
                  : "Your location context is required to load provider work."}
              </div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", flex: "1 1 320px", minWidth: 280 }}>
              <div className="v-chip">Role: {role ?? "-"}</div>
              <div className="v-chip">
                Today: {countsLoading ? "..." : `${counts.apptsToday} appointments`}
              </div>
              <div className="v-chip">
                Pending intake: {countsLoading ? "..." : counts.woundIntakesPending}
              </div>
            </div>
          </div>
        </div>

        <div className="space" />

        <ProviderWorkspaceNav compact />

        <div className="space" />

        <ProviderGuidePanel
          title={guide.title}
          description={guide.description}
          workflowState={guide.workflowState}
          nextAction={guide.nextAction}
          actions={[]}
        />

        <div className="space" />

        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <StatCard
            label="Appointments Today"
            value={countsLoading ? "..." : counts.apptsToday}
            note={countsLoading ? undefined : `${counts.requestedUpcoming} requested in the next 7 days`}
          />
          <StatCard label="Requested Today" value={countsLoading ? "..." : counts.requestedToday} />
          <StatCard label="Confirmed Today" value={countsLoading ? "..." : counts.confirmedToday} />
          <StatCard label="Completed Today" value={countsLoading ? "..." : counts.completedToday} />
        </div>

        <div className="card card-pad">
          <div id="virtual-visits" />
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="h2">Today's Virtual Visits</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Join, update readiness, and open the chart from one place.
              </div>
            </div>
            <button className="btn btn-secondary" type="button" onClick={() => navigate("/provider/visit-builder")}>
              Visit Builder
            </button>
          </div>

          <div className="space" />

          {!activeLocationId ? (
            <div className="muted">Select an active location to load virtual visit scheduling.</div>
          ) : todayVirtualVisits.length === 0 ? (
            <div className="muted">No virtual visits scheduled today.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
                {todayVirtualVisits.map((appt) => (
                  <div
                    key={appt.id}
                    className="card card-pad card-light surface-light"
                    style={{ background: "rgba(250,247,255,0.82)", border: "1px solid rgba(184,164,255,0.2)" }}
                  >
                  <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div style={{ flex: "1 1 280px", minWidth: 240 }}>
                      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <div className="h2" style={{ margin: 0 }}>
                          {fmtDateTime(appt.start_time)}
                        </div>
                        <VirtualVisitBadge appointment={appt} />
                      </div>
                      <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                        Patient: {patientLabel(appt.patient_id)} | Service: {svcName(appt.service_id)}
                      </div>
                      <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                        Meeting status: <strong>{(appt.meeting_status || "not_started").replaceAll("_", " ")}</strong>
                      </div>
                      {appt.virtual_instructions ? (
                        <div className="muted" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>
                          {appt.virtual_instructions}
                        </div>
                      ) : null}
                      {!appt.meeting_url ? (
                        <div className="muted" style={{ marginTop: 8, fontSize: 13, color: "#b45309" }}>
                          Virtual setup is incomplete. Add a meeting link in Visit Builder before the patient can join.
                        </div>
                      ) : null}
                    </div>

                    <div style={{ display: "grid", gap: 10, justifyItems: "end" }}>
                      <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <JoinVirtualVisitButton appointment={appt} className="btn btn-primary" label="Join Visit" />
                        <button className="btn btn-secondary" type="button" onClick={() => navigate(`/provider/visit-builder?appointmentId=${appt.id}`)}>
                          Edit Setup
                        </button>
                        <button className="btn btn-secondary" type="button" onClick={() => navigate(`/provider/patients/${appt.patient_id}`)}>
                          Open Patient
                        </button>
                        <button className="btn btn-secondary" type="button" onClick={() => navigate("/provider/intakes")}>
                          Intakes
                        </button>
                      </div>

                      <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {["ready", "in_progress", "completed", "missed"].map((status) => (
                          <button
                            key={status}
                            className={appt.meeting_status === status ? "btn btn-primary" : "btn btn-secondary"}
                            type="button"
                            onClick={() => setMeetingStatus(appt.id, status)}
                          >
                            {status.replaceAll("_", " ")}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="h2">Today's Appointment Queue</div>
              <div className="muted" style={{ marginTop: 6 }}>
                {activeLocationId
                  ? `Appointments scoped to ${locName(activeLocationId)}.`
                  : "Select an active location to load queue data."}
              </div>
            </div>
            <button className="btn btn-secondary" type="button" onClick={() => navigate("/provider/queue")}>
              Full Queue
            </button>
          </div>

          <div className="space" />

          {err ? <div style={{ color: "crimson" }}>{err}</div> : null}
          {!err && !activeLocationId ? <div className="muted">No active location selected.</div> : null}
          {loading && activeLocationId ? <div className="muted">Loading...</div> : null}

          {!loading && !err && activeLocationId ? (
            nextAppointments.length === 0 ? (
              <div className="muted">No appointments found for this location.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {nextAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="card card-pad card-light surface-light"
                    style={{ background: "rgba(250,247,255,0.82)", border: "1px solid rgba(184,164,255,0.2)" }}
                  >
                    <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 260px", minWidth: 220 }}>
                        <div className="h2" style={{ margin: 0 }}>
                          {fmtDateTime(appt.start_time)}
                        </div>
                        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                          Location: {locName(appt.location_id)} | Service: {svcName(appt.service_id)}
                        </div>
                        {appt.notes ? (
                          <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                            Notes: {appt.notes}
                          </div>
                        ) : null}
                        <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                          Status: <strong>{appt.status}</strong>
                        </div>
                      </div>

                      <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button className="btn btn-secondary" type="button" onClick={() => messagePatient(appt)}>
                          Message Patient
                        </button>
                        <button className="btn btn-secondary" type="button" onClick={() => navigate(`/provider/patients/${appt.patient_id}`)}>
                          Open Patient
                        </button>
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={() => startVisit(appt)}
                          disabled={startingVisitId === appt.id}
                        >
                          {startingVisitId === appt.id ? "Starting..." : "Start Visit"}
                        </button>
                        <button className="btn btn-secondary" type="button" onClick={() => setStatus(appt.id, "confirmed")}>
                          Confirm
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
