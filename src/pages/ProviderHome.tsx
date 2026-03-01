// src/pages/ProviderHome.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import VitalityHero from "../components/VitalityHero";

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

  requestedUpcoming: number; // next 7 days
  confirmedUpcoming: number; // next 7 days

  woundIntakesPending: number; // status submitted/needs_info
};

export default function ProviderHome() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [locationId, setLocationId] = useState<string>("");

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
  const [err, setErr] = useState<string | null>(null);

  const isAdmin = useMemo(() => role === "super_admin" || role === "location_admin", [role]);
  const canChooseLocation = useMemo(() => isAdmin, [isAdmin]);

  const locName = useMemo(() => {
    const map = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string) => map.get(id) ?? id;
  }, [locations]);

  const svcName = useMemo(() => {
    const map = new Map(services.map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? map.get(id) ?? "—" : "—");
  }, [services]);

  const fmt = (iso: string) => new Date(iso).toLocaleString();

  const didInit = useRef(false);

  const getLocationScopeFilter = (query: any) => {
    // Admins: if locationId empty => all locations. If set => filter.
    // Non-admins: locationId should be set to allowed location by loadBase; filter to it.
    if (locationId) return query.eq("location_id", locationId);
    return query;
  };

  const loadBase = async (uid: string) => {
    setErr(null);

    // Locations
    let locs: LocationRow[] = [];

    if (canChooseLocation) {
      const { data, error } = await supabase.from("locations").select("id,name").order("name");
      if (error) throw error;
      locs = (data as LocationRow[]) ?? [];
      setLocations(locs);
      // allow "All Locations" by leaving locationId empty
    } else {
      const { data: ul, error: ulErr } = await supabase
        .from("user_locations")
        .select("location_id,is_primary")
        .eq("user_id", uid)
        .order("is_primary", { ascending: false });

      if (ulErr) throw ulErr;

      const ids = ((ul as UserLocationRow[]) ?? []).map((x) => x.location_id).filter(Boolean);
      if (ids.length === 0) {
        setLocations([]);
        setLocationId("");
        throw new Error("No location access found for your user. Add a row in user_locations.");
      }

      const { data: l, error: lErr } = await supabase.from("locations").select("id,name").in("id", ids).order("name");
      if (lErr) throw lErr;

      locs = (l as LocationRow[]) ?? [];
      setLocations(locs);

      const primary = ((ul as UserLocationRow[]) ?? []).find((x) => x.is_primary)?.location_id;
      const fallback = primary ?? ids[0];
      setLocationId((prev) => prev || fallback);
    }

    // Services
    const { data: svcs, error: svcErr } = await supabase
      .from("services")
      .select("id,name,location_id")
      .eq("is_active", true)
      .order("name");
    if (svcErr) throw svcErr;

    setServices((svcs as ServiceRow[]) ?? []);
  };

  const loadAppointments = async () => {
    setErr(null);
    setLoading(true);

    try {
      if (!canChooseLocation && !locationId) {
        setAppointments([]);
        return;
      }

      let q = supabase
        .from("appointments")
        .select("id,location_id,service_id,patient_id,start_time,status,notes")
        .order("start_time", { ascending: true });

      q = getLocationScopeFilter(q);

      const { data, error } = await q;
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
    if (!canChooseLocation && !locationId) return;

    setCountsLoading(true);
    setErr(null);

    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      const plus7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // 1) Appointments today (for cards)
      let qToday = supabase
        .from("appointments")
        .select("id,status,start_time,location_id", { count: "exact" })
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", todayEnd.toISOString());

      qToday = getLocationScopeFilter(qToday);

      const { data: todayRows, error: todayErr } = await qToday;
      if (todayErr) throw todayErr;

      const apptsToday = (todayRows ?? []).length;
      const requestedToday = (todayRows ?? []).filter((a: any) => (a.status || "").toLowerCase() === "requested").length;
      const confirmedToday = (todayRows ?? []).filter((a: any) => (a.status || "").toLowerCase() === "confirmed").length;
      const completedToday = (todayRows ?? []).filter((a: any) => (a.status || "").toLowerCase() === "completed").length;

      // 2) Upcoming 7 days counts (requested + confirmed)
      let qUpcoming = supabase
        .from("appointments")
        .select("id,status,start_time,location_id")
        .gte("start_time", now.toISOString())
        .lte("start_time", plus7.toISOString());

      qUpcoming = getLocationScopeFilter(qUpcoming);

      const { data: upRows, error: upErr } = await qUpcoming;
      if (upErr) throw upErr;

      const requestedUpcoming = (upRows ?? []).filter((a: any) => (a.status || "").toLowerCase() === "requested").length;
      const confirmedUpcoming = (upRows ?? []).filter((a: any) => (a.status || "").toLowerCase() === "confirmed").length;

      // 3) Wound intake pending (submitted / needs_info)
      // Assumes patient_intakes has location_id, service_type, status columns.
      let qWound = supabase
        .from("patient_intakes")
        .select("id,status,location_id")
        .eq("service_type", "wound_care")
        .in("status", ["submitted", "needs_info"]);

      qWound = getLocationScopeFilter(qWound);

      const { data: woundRows, error: woundErr } = await qWound;
      if (woundErr) throw woundErr;

      const woundIntakesPending = (woundRows ?? []).length;

      setCounts({
        apptsToday,
        requestedToday,
        confirmedToday,
        completedToday,
        requestedUpcoming,
        confirmedUpcoming,
        woundIntakesPending,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (!canChooseLocation && !locationId) return;

    loadAppointments();
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, canChooseLocation, user?.id]);

  const refreshAll = async () => {
    await loadAppointments();
    await loadCounts();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) return alert(error.message);
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

  const StatPill = ({ label, value }: { label: string; value: number | string }) => (
    <div className="card card-pad" style={{ minWidth: 190 }}>
      <div className="muted" style={{ fontSize: 12 }}>
        {label}
      </div>
      <div className="h1" style={{ marginTop: 6 }}>
        {value}
      </div>
    </div>
  );

  const ActionCard = ({
    title,
    desc,
    to,
    badge,
  }: {
    title: string;
    desc: string;
    to: string;
    badge?: string;
  }) => (
    <button
      type="button"
      className="card card-pad"
      onClick={() => navigate(to)}
      style={{
        textAlign: "left",
        cursor: "pointer",
        border: "1px solid rgba(255,255,255,.14)",
        background: "rgba(255,255,255,.06)",
      }}
    >
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div className="h2" style={{ margin: 0 }}>
          {title}
        </div>
        {badge ? (
          <span
            className="muted"
            style={{
              fontSize: 12,
              padding: "2px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,.25)",
              background: "rgba(255,255,255,.08)",
              whiteSpace: "nowrap",
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
        {desc}
      </div>
    </button>
  );

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Vitality Institute"
          subtitle="Provider Dashboard • Queue • Intake • Scheduling • Messaging • Labs"
          secondaryCta={{ label: "Refresh", onClick: refreshAll }}
          primaryCta={{ label: "Queue", to: "/provider/queue" }}
          rightActions={
            <button className="btn btn-ghost" onClick={signOut} type="button">
              Sign out
            </button>
          }
          showKpis={true}
        />

        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="h1">Provider Portal</div>
              <div className="muted">Role: {role}</div>
              <div className="muted">Signed in: {user?.email}</div>
            </div>

            <div style={{ minWidth: 260 }}>
              <select
                className="input"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                disabled={!canChooseLocation}
                title={!canChooseLocation ? "Location is set by your access membership." : "Filter by location"}
              >
                {canChooseLocation && <option value="">All Locations</option>}
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {locationId ? `Viewing: ${locName(locationId)}` : canChooseLocation ? "Viewing: All Locations" : "Viewing: Assigned Location"}
              </div>
            </div>
          </div>
        </div>

        <div className="space" />

        {/* KPI strip */}
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <StatPill label="Appointments Today" value={countsLoading ? "…" : counts.apptsToday} />
          <StatPill label="Requested Today" value={countsLoading ? "…" : counts.requestedToday} />
          <StatPill label="Confirmed Today" value={countsLoading ? "…" : counts.confirmedToday} />
          <StatPill label="Completed Today" value={countsLoading ? "…" : counts.completedToday} />
        </div>

        <div className="space" />

        {/* Action tiles */}
        <div className="card card-pad">
          <div className="h2">Workflows</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Jump into the main provider actions — queue, intake, patients, messaging, labs.
          </div>

          <div className="space" />

          <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            <ActionCard
              title="Provider Queue"
              desc="Your working list of visits. Open patient center fast."
              to="/provider/queue"
            />
            <ActionCard
              title="Intake Review"
              desc="Review incoming submissions and move them forward."
              to="/provider/intake"
              badge={countsLoading ? "…" : `${counts.woundIntakesPending} pending`}
            />
            <ActionCard title="Patient Center" desc="Search patients, open their chart, notes, files." to="/provider/patients" />
            <ActionCard title="Messages" desc="Secure threads with patients tied to appointments." to="/provider/chat" />
            <ActionCard title="Labs" desc="Review uploaded lab results & provider notes." to="/provider/labs" />
            <ActionCard title="AI Drafts" desc="Generate plans, summaries, and documentation drafts." to="/provider/ai" />
          </div>
        </div>

        <div className="space" />

        {/* Admin tools */}
        {isAdmin ? (
          <>
            <div className="card card-pad">
              <div className="h2">Admin Tools</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Visible only to super admin / location admin.
              </div>
              <div className="space" />
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-ghost" type="button" onClick={() => navigate("/admin/services")}>
                  Services Panel
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => navigate("/admin")}>
                  Location Hours
                </button>
              </div>
            </div>
            <div className="space" />
          </>
        ) : null}

        {/* Appointments */}
        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="h2">Appointments</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Review requests and update status.
                <span className="muted" style={{ marginLeft: 10, fontSize: 12 }}>
                  Upcoming 7 days:{" "}
                  <strong>{countsLoading ? "…" : counts.requestedUpcoming}</strong> requested •{" "}
                  <strong>{countsLoading ? "…" : counts.confirmedUpcoming}</strong> confirmed
                </span>
              </div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" type="button" onClick={refreshAll}>
                Refresh
              </button>
            </div>
          </div>

          <div className="space" />

          {loading && <div className="muted">Loading…</div>}
          {err && <div style={{ color: "crimson" }}>{err}</div>}

          {!loading && !err && (
            <div>
              {appointments.map((a) => (
                <div key={a.id} className="card card-pad" style={{ marginBottom: 12 }}>
                  <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div className="h2">{fmt(a.start_time)}</div>
                      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                        Location: {locName(a.location_id)} {" • "} Service: {svcName(a.service_id)}
                      </div>

                      {a.notes ? (
                        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                          Notes: {a.notes}
                        </div>
                      ) : null}

                      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                        Appointment ID: {a.id}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", minWidth: 260 }}>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Status: <strong>{a.status}</strong>
                      </div>

                      <div className="space" />

                      <div className="row" style={{ gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <button className="btn btn-ghost" type="button" onClick={() => messagePatient(a)}>
                          Message Patient
                        </button>

                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => navigate(`/provider/patients/${a.patient_id}`)}
                        >
                          Open Patient
                        </button>

                        <button className="btn btn-ghost" type="button" onClick={() => setStatus(a.id, "confirmed")}>
                          Confirm
                        </button>
                        <button className="btn btn-ghost" type="button" onClick={() => setStatus(a.id, "completed")}>
                          Complete
                        </button>
                        <button className="btn btn-ghost" type="button" onClick={() => setStatus(a.id, "cancelled")}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {appointments.length === 0 ? <div className="muted">No appointments found.</div> : null}
            </div>
          )}
        </div>

        <div className="space" />
      </div>
    </div>
  );
}