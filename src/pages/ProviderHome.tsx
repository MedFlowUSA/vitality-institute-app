// src/pages/ProviderHome.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";

type LocationRow = { id: string; name: string };
type ServiceRow = { id: string; name: string; location_id: string };
type UserLocationRow = { location_id: string; is_primary: boolean };

type ApptRow = {
  id: string;
  location_id: string;
  service_id: string | null;
  patient_id: string;
  start_time: string;
  status: string;
  notes: string | null;
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

type NavItem = {
  label: string;
  to: string;
};

export default function ProviderHome() {
  const { user, role, signOut, activeLocationId, setActiveLocationId } = useAuth();
  const navigate = useNavigate();
  const routerLocation = useLocation();

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [appointments, setAppointments] = useState<ApptRow[]>([]);
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

  const navItems = useMemo<NavItem[]>(
    () => [
      { label: "Queue", to: "/provider/queue" },
      { label: "Intake Review", to: "/provider/intake" },
      { label: "Command Center", to: "/provider/command" },
      { label: "Referrals", to: "/provider/referrals" },
      { label: "Messages", to: "/provider/chat" },
      { label: "Labs", to: "/provider/labs" },
      { label: "Patient Center", to: "/provider/patients" },
    ],
    []
  );

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

  const nextAppointments = useMemo(() => appointments.slice(0, 3), [appointments]);

  const summaryItems = useMemo(
    () => [
      { label: "Role", value: role ?? "-" },
      { label: "Active Location", value: locName(activeLocationId) },
      { label: "Today", value: countsLoading ? "..." : `${counts.apptsToday} appointments` },
      { label: "Pending Intake", value: countsLoading ? "..." : `${counts.woundIntakesPending} awaiting review` },
    ],
    [activeLocationId, counts, countsLoading, locName, role]
  );

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const getLocationScopeFilter = (query: any) => {
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
        .select("id,location_id,service_id,patient_id,start_time,status,notes")
        .order("start_time", { ascending: true });

      query = getLocationScopeFilter(query);

      const { data, error } = await query;
      if (error) throw error;

      setAppointments((data as ApptRow[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load appointments.");
      setAppointments([]);
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
        requestedToday: (todayRows ?? []).filter((item: any) => (item.status || "").toLowerCase() === "requested").length,
        confirmedToday: (todayRows ?? []).filter((item: any) => (item.status || "").toLowerCase() === "confirmed").length,
        completedToday: (todayRows ?? []).filter((item: any) => (item.status || "").toLowerCase() === "completed").length,
        requestedUpcoming: (upcomingRows ?? []).filter((item: any) => (item.status || "").toLowerCase() === "requested").length,
        confirmedUpcoming: (upcomingRows ?? []).filter((item: any) => (item.status || "").toLowerCase() === "confirmed").length,
        woundIntakesPending: (intakeRows ?? []).length,
      });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load provider counts.");
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
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load base data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [activeLocationId, isAdmin, setActiveLocationId, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    loadAppointments();
    loadCounts();
  }, [activeLocationId, user?.id]);

  const refreshAll = async () => {
    await loadAppointments();
    await loadCounts();
  };

  const updateActiveLocation = async (nextLocationId: string) => {
    setLocationSaving(true);
    setErr(null);
    try {
      await setActiveLocationId(nextLocationId || null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update active location.");
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

  const messagePatient = async (appt: ApptRow) => {
    setErr(null);
    if (!user) return;

    const { data: existing, error: findErr } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("appointment_id", appt.id)
      .maybeSingle();

    if (findErr) {
      setErr(findErr.message);
      return;
    }

    let threadId = existing?.id;

    if (!threadId) {
      const { data: created, error: createErr } = await supabase
        .from("chat_threads")
        .insert([
          {
            location_id: appt.location_id,
            patient_id: appt.patient_id,
            appointment_id: appt.id,
            status: "open",
            subject: "Appointment message",
          },
        ])
        .select("id")
        .maybeSingle();

      if (createErr) {
        setErr(createErr.message);
        return;
      }

      threadId = created?.id ?? "";
    }

    if (!threadId) {
      setErr("Could not create message thread.");
      return;
    }

    navigate(`/provider/chat?threadId=${threadId}`);
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
        .maybeSingle();

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

      const nextVisitId = typeof visitId === "string" ? visitId : (visitId as any)?.id;
      if (!nextVisitId) throw new Error("Visit created but no visitId was returned.");

      navigate(`/provider/patients/${visitPatientId}?visitId=${nextVisitId}`);
      await refreshAll();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to start visit.");
    } finally {
      setStartingVisitId(null);
    }
  };

  const StatCard = ({ label, value, note }: { label: string; value: string | number; note?: string }) => (
    <div
      className="card card-pad"
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

  const WorkflowCard = ({
    title,
    description,
    actions,
  }: {
    title: string;
    description: string;
    actions: Array<{ label: string; to: string; tone?: "primary" | "ghost" }>;
  }) => (
    <div
      className="card card-pad"
      style={{
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(184,164,255,0.2)",
        display: "grid",
        gap: 12,
      }}
    >
      <div>
        <div className="h2" style={{ margin: 0 }}>
          {title}
        </div>
        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          {description}
        </div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {actions.map((action) => (
          <button
            key={action.to}
            className={action.tone === "primary" ? "btn btn-primary" : "btn btn-ghost"}
            type="button"
            onClick={() => navigate(action.to)}
          >
            {action.label}
          </button>
        ))}
      </div>
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
                One workspace for today&apos;s clinical flow
              </div>
              <div style={{ marginTop: 10, maxWidth: 760, color: "rgba(233,226,255,.8)", lineHeight: 1.7 }}>
                Review your active location, move through queue and intake review, then continue into patients, referrals, messages,
                labs, and command tools without stacked duplicate controls.
              </div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" type="button" onClick={refreshAll}>
                Refresh
              </button>
              <button className="btn btn-ghost" type="button" onClick={signOut}>
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

            <div style={{ flex: "2 1 480px", minWidth: 280 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(216,204,255,.76)", marginBottom: 8 }}>Primary Navigation</div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {navItems.map((item) => {
                  const isActive = routerLocation.pathname === item.to;
                  return (
                    <button
                      key={item.to}
                      type="button"
                      className={isActive ? "btn btn-primary" : "btn btn-ghost"}
                      onClick={() => navigate(item.to)}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="space" />

        <div
          className="card card-pad"
          style={{
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(184,164,255,0.2)",
          }}
        >
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            {summaryItems.map((item) => (
              <div
                key={item.label}
                style={{
                  flex: "1 1 180px",
                  minWidth: 160,
                  padding: "12px 14px",
                  borderRadius: 16,
                  border: "1px solid rgba(184,164,255,0.2)",
                  background: "rgba(250,247,255,0.92)",
                }}
              >
                <div className="muted" style={{ fontSize: 12 }}>
                  {item.label}
                </div>
                <div style={{ marginTop: 6, fontWeight: 800, color: "#241B3D" }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

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

        <div className="space" />

        <div
          className="grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          <WorkflowCard
            title="Flow Control"
            description="Start with queue and command views when you need the fastest operational path through today's workload."
            actions={[
              { label: "Open Queue", to: "/provider/queue", tone: "primary" },
              { label: "Command Center", to: "/provider/command" },
            ]}
          />
          <WorkflowCard
            title="Clinical Review"
            description="Move through intake review, referrals, and labs without jumping between overlapping headers or duplicate launch areas."
            actions={[
              { label: "Intake Review", to: "/provider/intake", tone: "primary" },
              { label: "Referrals", to: "/provider/referrals" },
              { label: "Labs", to: "/provider/labs" },
            ]}
          />
          <WorkflowCard
            title="Patient Follow-up"
            description="Open the patient center or message threads when you need chart context, communication, and next-step coordination."
            actions={[
              { label: "Patient Center", to: "/provider/patients", tone: "primary" },
              { label: "Messages", to: "/provider/chat" },
            ]}
          />
        </div>

        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="h2">Today's Appointment Queue</div>
              <div className="muted" style={{ marginTop: 6 }}>
                {activeLocationId
                  ? `Appointments scoped to ${locName(activeLocationId)}.`
                  : "Select an active location to load queue data for the provider portal."}
              </div>
            </div>
            <button className="btn btn-ghost" type="button" onClick={() => navigate("/provider/queue")}>
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
                    className="card card-pad"
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
                        <button className="btn btn-ghost" type="button" onClick={() => messagePatient(appt)}>
                          Message Patient
                        </button>
                        <button className="btn btn-ghost" type="button" onClick={() => navigate(`/provider/patients/${appt.patient_id}`)}>
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
                        <button className="btn btn-ghost" type="button" onClick={() => setStatus(appt.id, "confirmed")}>
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
