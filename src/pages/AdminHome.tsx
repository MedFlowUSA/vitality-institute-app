import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import logo from "../assets/vitality-logo.png";
import SystemStatusBar from "../components/SystemStatusBar";
import LocationPicker from "../components/LocationPicker";

type LocationRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  is_active: boolean | null;
};

type HoursRow = {
  location_id: string;
  day_of_week: number; // 0=Sun..6=Sat
  open_time: string; // "09:00:00"
  close_time: string; // "17:00:00"
  slot_minutes: number;
  is_closed: boolean;
};

type AppointmentRow = {
  id: string;
  location_id: string;
  patient_id: string;
  service_id: string | null;
  start_time: string;
  status: string | null;
  notes: string | null;
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toHHMM(t: string) {
  return (t ?? "").slice(0, 5);
}
function fromHHMM(t: string) {
  if (!t) return "09:00:00";
  return t.length === 5 ? `${t}:00` : t;
}

function fmtLocal(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminHome() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);

  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [hoursByDay, setHoursByDay] = useState<Record<number, HoursRow>>({});
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursMsg, setHoursMsg] = useState<string | null>(null);

  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [apptsLoading, setApptsLoading] = useState(false);
  const [apptsErr, setApptsErr] = useState<string | null>(null);

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedLocationId) ?? null,
    [locations, selectedLocationId]
  );

  const locName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;

  const loadLocations = async () => {
    setErr(null);
    setLoading(true);

    const { data, error } = await supabase
      .from("locations")
      .select("id,name,city,state,is_active")
      .order("name");

    if (error) setErr(error.message);
    setLocations((data as LocationRow[]) ?? []);
    setLoading(false);
  };

  const loadHours = async (locationId: string) => {
    setHoursMsg(null);

    if (!locationId) {
      setHoursByDay({});
      return;
    }

    const { data, error } = await supabase
      .from("location_hours")
      .select("location_id,day_of_week,open_time,close_time,slot_minutes,is_closed")
      .eq("location_id", locationId);

    if (error) {
      setHoursMsg(error.message);
      setHoursByDay({});
      return;
    }

    const base: Record<number, HoursRow> = {};
    for (let d = 0; d <= 6; d++) {
      base[d] = {
        location_id: locationId,
        day_of_week: d,
        open_time: "09:00:00",
        close_time: "17:00:00",
        slot_minutes: 30,
        is_closed: d === 0 || d === 6,
      };
    }

    (data ?? []).forEach((r: HoursRow) => {
      base[r.day_of_week] = r;
    });

    setHoursByDay(base);
  };

  const upsertOneDay = async (row: HoursRow) => {
    return supabase.from("location_hours").upsert(
      {
        location_id: row.location_id,
        day_of_week: row.day_of_week,
        open_time: row.open_time,
        close_time: row.close_time,
        slot_minutes: row.slot_minutes,
        is_closed: row.is_closed,
      },
      { onConflict: "location_id,day_of_week" }
    );
  };

  const saveHours = async () => {
    if (!selectedLocationId) return;

    setHoursSaving(true);
    setHoursMsg(null);

    const rows = Object.values(hoursByDay);

    for (const r of rows) {
      if (!r.is_closed && toHHMM(r.open_time) >= toHHMM(r.close_time)) {
        setHoursSaving(false);
        setHoursMsg(`Invalid hours on ${DOW[r.day_of_week]}: open must be before close.`);
        return;
      }

      const { error } = await upsertOneDay(r);
      if (error) {
        setHoursSaving(false);
        setHoursMsg(error.message);
        return;
      }
    }

    setHoursSaving(false);
    setHoursMsg("Saved ✅");
    await loadHours(selectedLocationId);
  };

  const setDay = (day: number, patch: Partial<HoursRow>) => {
    setHoursMsg(null);
    setHoursByDay((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...patch },
    }));
  };

  const loadAppointments = async () => {
    setApptsErr(null);
    setApptsLoading(true);

    const { data, error } = await supabase
      .from("appointments")
      .select("id,location_id,patient_id,service_id,start_time,status,notes")
      .order("start_time", { ascending: false })
      .limit(50);

    if (error) setApptsErr(error.message);
    setAppointments((data as AppointmentRow[]) ?? []);
    setApptsLoading(false);
  };

  useEffect(() => {
    loadLocations();
    loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedLocationId) loadHours(selectedLocationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId]);

  return (
    <div className="app-bg">
      <div className="shell">
        {/* ====== PREMIUM HERO ====== */}
        <div className="v-hero">
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 520px" }}>
              <div className="v-brand">
                <div className="v-logo">
                  <img src={logo} alt="Vitality Institute" />
                </div>

                <div className="v-brand-title">
                  <div className="title">Vitality Institute</div>
                  <div className="sub">
                    Admin Console • Multi-Location • Hours • Scheduling • Messaging • Labs (Next)
                  </div>
                </div>
              </div>

              <div className="v-chips">
                <div className="v-chip">
                  Role: <strong>{role}</strong>
                </div>
                <div className="v-chip">
                  Signed in: <strong>{user?.email ?? "—"}</strong>
                </div>
                <div className="v-chip">
                  Status: <strong>Active</strong>
                </div>
              </div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" type="button" onClick={() => navigate("/")}>
                Home
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => navigate("/admin/staff")}>
                Staff Management
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => navigate("/admin/inquiries")}>
                Public Inquiries
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => navigate("/admin/booking-requests")}>
                Booking Requests
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => navigate("/admin/vital-ai-lite")}>
                Vital AI Lite
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => alert("Coming next: AI Summary + Plan Builder")}
              >
                AI Plan Builder
              </button>
              <button className="btn btn-ghost" onClick={signOut}>
                Sign out
              </button>
            </div>
          </div>

          <div className="v-statgrid">
            <div className="v-stat">
              <div className="k">Modules Built</div>
              <div className="v">Admin • Patient • Provider</div>
            </div>
            <div className="v-stat">
              <div className="k">Scheduling</div>
              <div className="v">Hours + Slot Engine</div>
            </div>
            <div className="v-stat">
              <div className="k">Messaging</div>
              <div className="v">Threads + Realtime</div>
            </div>
            <div className="v-stat">
              <div className="k">Next Upgrade</div>
              <div className="v">Labs + AI Plan</div>
            </div>
          </div>

          {/* "WE BUILT A LOT" card */}
          <div className="card card-pad" style={{ marginTop: 14 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <div className="h2">Recent Activity</div>
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                  Live feed of platform actions (appointments, intake, labs, messaging)
                </div>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>Auto-refresh enabled</div>
            </div>

            <hr className="hr-soft" />

            {[
              { t: "Just now", m: "Appointment request submitted", s: "Scheduling" },
              { t: "2 min ago", m: "New message thread created (appointment-linked)", s: "Messaging" },
              { t: "8 min ago", m: "Provider reviewed intake and added plan notes", s: "Intake Review" },
              { t: "Today", m: "Labs uploaded and flagged for provider review", s: "Labs" },
            ].map((x, i) => (
              <div key={i} className="row" style={{ justifyContent: "space-between", gap: 10, padding: "10px 0" }}>
                <div>
                  <div style={{ fontWeight: 650 }}>{x.m}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{x.s}</div>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>{x.t}</div>
              </div>
            ))}
          </div>
        </div>
        <SystemStatusBar />
        <div className="space" />
        <LocationPicker />

        <div className="space" />

        {/* LOCATIONS */}
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="h2">Locations</div>
              <div className="muted" style={{ marginTop: 4 }}>
                Manage clinic locations.
              </div>
            </div>

            <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
              {adding ? "Close" : "Add Location"}
            </button>
          </div>

          <div className="space" />

          {loading && <div className="muted">Loading…</div>}
          {err && <div style={{ color: "crimson" }}>{err}</div>}

          {!loading && !err && (
            <>
              {adding && (
                <div className="card card-pad" style={{ marginBottom: 12 }}>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget as HTMLFormElement;
                      const name = (form.elements.namedItem("name") as HTMLInputElement).value;
                      const city = (form.elements.namedItem("city") as HTMLInputElement).value;
                      const state = (form.elements.namedItem("state") as HTMLInputElement).value;

                      const { error } = await supabase.from("locations").insert([
                        { name, city: city || null, state: state || null, is_active: true },
                      ]);

                      if (error) return alert(error.message);

                      form.reset();
                      setAdding(false);
                      await loadLocations();
                    }}
                  >
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <input className="input" style={{ flex: "1 1 220px" }} name="name" placeholder="Location Name" required />
                      <input className="input" style={{ flex: "1 1 160px" }} name="city" placeholder="City" />
                      <input className="input" style={{ flex: "1 1 110px" }} name="state" placeholder="State" />
                      <button className="btn btn-primary" type="submit">Save</button>
                    </div>
                  </form>
                </div>
              )}

              {locations.map((l) => (
                <div key={l.id} className="card card-pad" style={{ marginBottom: 12 }}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div>
                      <div className="h2">{l.name}</div>
                      <div className="muted">
                        {(l.city ?? "")}
                        {l.city && l.state ? ", " : ""}
                        {(l.state ?? "")}
                      </div>
                    </div>

                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => setSelectedLocationId(l.id)}
                      title="Edit business hours"
                    >
                      Edit Hours
                    </button>
                  </div>
                </div>
              ))}

              {locations.length === 0 && <div className="muted">No locations found yet.</div>}
            </>
          )}
        </div>

        {/* BUSINESS HOURS */}
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="h2">Business Hours</div>
          <div className="muted" style={{ marginTop: 4 }}>
            Set hours and appointment slot length per day.
          </div>

          <div className="space" />

          <select className="input" value={selectedLocationId} onChange={(e) => setSelectedLocationId(e.target.value)}>
            <option value="">Select Location</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          {selectedLocation && (
            <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
              Editing: {selectedLocation.name}
            </div>
          )}

          <div className="space" />

          {hoursMsg && (
            <div style={{ color: hoursMsg.includes("Saved") ? "green" : "crimson" }}>{hoursMsg}</div>
          )}

          {selectedLocationId && Object.keys(hoursByDay).length > 0 && (
            <div>
              {DOW.map((label, idx) => {
                const row = hoursByDay[idx];
                return (
                  <div key={idx} className="card card-pad" style={{ marginBottom: 10 }}>
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div className="h2" style={{ marginBottom: 0 }}>{label}</div>

                      <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={!!row?.is_closed}
                          onChange={(e) => setDay(idx, { is_closed: e.target.checked })}
                        />
                        Closed
                      </label>
                    </div>

                    <div className="space" />

                    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <input
                        className="input"
                        style={{ width: 140 }}
                        type="time"
                        value={toHHMM(row?.open_time ?? "09:00:00")}
                        disabled={row?.is_closed}
                        onChange={(e) => setDay(idx, { open_time: fromHHMM(e.target.value) })}
                      />
                      <input
                        className="input"
                        style={{ width: 140 }}
                        type="time"
                        value={toHHMM(row?.close_time ?? "17:00:00")}
                        disabled={row?.is_closed}
                        onChange={(e) => setDay(idx, { close_time: fromHHMM(e.target.value) })}
                      />

                      <select
                        className="input"
                        style={{ width: 160 }}
                        value={row?.slot_minutes ?? 30}
                        disabled={row?.is_closed}
                        onChange={(e) => setDay(idx, { slot_minutes: Number(e.target.value) })}
                      >
                        <option value={10}>10 min slots</option>
                        <option value={15}>15 min slots</option>
                        <option value={20}>20 min slots</option>
                        <option value={30}>30 min slots</option>
                        <option value={45}>45 min slots</option>
                        <option value={60}>60 min slots</option>
                      </select>

                      <div className="muted" style={{ fontSize: 12 }}>
                        {row?.is_closed ? "Closed" : `Open ${toHHMM(row.open_time)}–${toHHMM(row.close_time)}`}
                      </div>
                    </div>
                  </div>
                );
              })}

              <button className="btn btn-primary" onClick={saveHours} disabled={hoursSaving}>
                {hoursSaving ? "Saving…" : "Save Hours"}
              </button>
            </div>
          )}

          {selectedLocationId && Object.keys(hoursByDay).length === 0 && <div className="muted">Loading hours…</div>}
        </div>

        {/* APPOINTMENTS */}
        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="h2">Appointments</div>
              <div className="muted" style={{ marginTop: 4 }}>
                Latest 50 appointments.
              </div>
            </div>

            <button className="btn btn-ghost" type="button" onClick={loadAppointments}>
              Refresh
            </button>
          </div>

          <div className="space" />

          {apptsLoading && <div className="muted">Loading appointments…</div>}
          {apptsErr && <div style={{ color: "crimson" }}>{apptsErr}</div>}

          {!apptsLoading && !apptsErr && (
            <div>
              {appointments.length === 0 && <div className="muted">No appointments found.</div>}

              {appointments.map((a) => (
                <div key={a.id} className="card card-pad" style={{ marginBottom: 12 }}>
                  <div className="h2">{fmtLocal(a.start_time)}</div>
                  <div className="muted">Location: {locName(a.location_id)}</div>
                  <div className="muted">Status: {a.status ?? "—"}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Patient: {a.patient_id}
                  </div>
                  {a.notes && <div className="muted" style={{ marginTop: 6 }}>Notes: {a.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
