// src/pages/PatientHome.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import VitalityHero from "../components/VitalityHero";

type LocationRow = { id: string; name: string; city: string | null; state: string | null };
type ServiceRow = {
  id: string;
  name: string;
  location_id: string;
  category: string | null;
  visit_type: string | null;
};

type LocationHoursRow = {
  location_id: string;
  day_of_week: number; // 0=Sun..6=Sat
  open_time: string; // "09:00:00"
  close_time: string; // "17:00:00"
  slot_minutes: number;
  is_closed: boolean;
};

type ApptRow = {
  id: string;
  location_id: string;
  start_time: string;
  status: string;
  service_id: string | null;
  notes: string | null;
};

type LatestWoundIntake = {
  id: string;
  status: "submitted" | "needs_info" | "approved" | "locked" | string;
  created_at: string;
  locked_at: string | null;
};

function toLocalTimeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusBadge(status: string) {
  const s = (status || "").toLowerCase();
  const base = {
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid rgba(255,255,255,.25)",
    background: "rgba(255,255,255,.08)",
  } as const;

  if (s === "locked")
    return { ...base, background: "rgba(34,197,94,.18)", border: "1px solid rgba(34,197,94,.35)" };
  if (s === "approved")
    return { ...base, background: "rgba(59,130,246,.18)", border: "1px solid rgba(59,130,246,.35)" };
  if (s === "needs_info")
    return { ...base, background: "rgba(245,158,11,.18)", border: "1px solid rgba(245,158,11,.35)" };
  if (s === "submitted")
    return { ...base, background: "rgba(148,163,184,.18)", border: "1px solid rgba(148,163,184,.35)" };

  return base;
}

export default function PatientHome() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  // ✅ ONBOARDING GATE
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [locationId, setLocationId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [date, setDate] = useState<string>(""); // YYYY-MM-DD
  const [notes, setNotes] = useState<string>("");

  const [hours, setHours] = useState<LocationHoursRow | null>(null);
  const [taken, setTaken] = useState<Set<string>>(new Set()); // ISO strings
  const [selectedSlotIso, setSelectedSlotIso] = useState<string>("");

  // patient appointment list
  const [myAppointments, setMyAppointments] = useState<ApptRow[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);

  // latest wound intake status
  const [latestWoundIntake, setLatestWoundIntake] = useState<LatestWoundIntake | null>(null);
  const [loadingWound, setLoadingWound] = useState(false);

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === locationId) ?? null,
    [locations, locationId]
  );

  const filteredServices = useMemo(
    () => services.filter((s) => s.location_id === locationId),
    [services, locationId]
  );

  const locName = useMemo(() => {
    const m = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string) => m.get(id) ?? id;
  }, [locations]);

  const svcName = useMemo(() => {
    const m = new Map(services.map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? m.get(id) ?? "—" : "—");
  }, [services]);

  const dayOfWeek = useMemo(() => {
    if (!date) return null;
    const [y, m, d] = date.split("-").map((x) => Number(x));
    const local = new Date(y, m - 1, d);
    return local.getDay(); // 0..6
  }, [date]);

  const scrollToBooking = () => {
    const el = document.getElementById("book-appointment");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const loadMyAppointments = async () => {
    if (!user) return;
    setLoadingMine(true);

    const { data, error } = await supabase
      .from("appointments")
      .select("id,location_id,start_time,status,service_id,notes")
      .eq("patient_id", user.id)
      .order("start_time", { ascending: false })
      .limit(25);

    setLoadingMine(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setMyAppointments((data as ApptRow[]) ?? []);
  };

  const loadLatestWoundIntake = async () => {
    if (!user?.id) return;
    setLoadingWound(true);

    try {
      // patient_id in patient_intakes references patients.id, so we need patients.id first
      const { data: p, error: pErr } = await supabase
        .from("patients")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (pErr) throw pErr;

      const patientId = (p as any)?.id as string | undefined;
      if (!patientId) {
        setLatestWoundIntake(null);
        return;
      }

      const { data, error } = await supabase
        .from("patient_intakes")
        .select("id,status,created_at,locked_at")
        .eq("patient_id", patientId)
        .eq("service_type", "wound_care")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      const latest = (data?.[0] ?? null) as LatestWoundIntake | null;
      setLatestWoundIntake(latest);
    } catch {
      setLatestWoundIntake(null);
    } finally {
      setLoadingWound(false);
    }
  };

  // ✅ ONBOARDING GATE EFFECT (runs first)
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!user?.id) return;

      try {
        setCheckingOnboarding(true);

        const { data, error } = await supabase
          .from("patients")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (!cancelled && !data?.id) {
          navigate("/patient/onboarding", { replace: true });
          return;
        }
      } catch (e) {
        console.error("Patient onboarding gate failed:", e);
        // Don't lock the user out if something temporary fails.
      } finally {
        if (!cancelled) setCheckingOnboarding(false);
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [user?.id, navigate]);

  // ✅ Prevent running the heavy portal loaders until onboarding is confirmed
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setErr(null);
      setLoading(true);

      try {
        const { data: locs, error: locErr } = await supabase
          .from("locations")
          .select("id,name,city,state")
          .order("name");
        if (locErr) throw locErr;

        const { data: svcs, error: svcErr } = await supabase
          .from("services")
          .select("id,name,location_id,category,visit_type")
          .eq("is_active", true)
          .order("name");
        if (svcErr) throw svcErr;

        if (cancelled) return;

        setLocations(locs ?? []);
        setServices(svcs ?? []);

        await loadMyAppointments();
        await loadLatestWoundIntake();
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load patient portal.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (user?.id && !checkingOnboarding) load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, checkingOnboarding]);

  useEffect(() => {
    let cancelled = false;

    const loadSlots = async () => {
      setErr(null);
      setHours(null);
      setTaken(new Set());
      setSelectedSlotIso("");

      if (!locationId || !date || dayOfWeek === null) return;

      const { data: hrs, error: hrsErr } = await supabase
        .from("location_hours")
        .select("location_id,day_of_week,open_time,close_time,slot_minutes,is_closed")
        .eq("location_id", locationId)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle();

      if (hrsErr) {
        if (!cancelled) setErr(hrsErr.message);
        return;
      }

      if (!hrs) {
        if (!cancelled) setErr("No business hours set for this location/day yet.");
        return;
      }

      if (cancelled) return;

      setHours(hrs);
      if (hrs.is_closed) return;

      const [y, m, d] = date.split("-").map((x) => Number(x));
      const startLocal = new Date(y, m - 1, d, 0, 0, 0);
      const endLocal = new Date(y, m - 1, d, 23, 59, 59);

      const { data: appts, error: apptErr } = await supabase
        .from("appointments")
        .select("start_time")
        .eq("location_id", locationId)
        .gte("start_time", startLocal.toISOString())
        .lte("start_time", endLocal.toISOString());

      if (apptErr) {
        if (!cancelled) setErr(apptErr.message);
        return;
      }

      const set = new Set<string>();
      (appts as { start_time: string }[] | null)?.forEach((a) => set.add(a.start_time));
      if (!cancelled) setTaken(set);
    };

    loadSlots();

    return () => {
      cancelled = true;
    };
  }, [locationId, date, dayOfWeek]);

  const slots = useMemo(() => {
    if (!hours || !locationId || !date) return [];
    if (hours.is_closed) return [];

    const slotMinutes = hours.slot_minutes || 30;

    const [y, m, d] = date.split("-").map((x) => Number(x));
    const [oh, om] = hours.open_time.split(":").map((x) => Number(x));
    const [ch, cm] = hours.close_time.split(":").map((x) => Number(x));

    const open = new Date(y, m - 1, d, oh, om, 0);
    const close = new Date(y, m - 1, d, ch, cm, 0);

    const out: { iso: string; label: string; isTaken: boolean }[] = [];

    for (let t = new Date(open); t < close; t = new Date(t.getTime() + slotMinutes * 60000)) {
      const iso = t.toISOString();
      const isTaken = taken.has(iso);
      out.push({ iso, label: toLocalTimeLabel(iso), isTaken });
    }

    return out;
  }, [hours, locationId, date, taken]);

  const submit = async () => {
    setErr(null);

    if (!user) return;
    if (!locationId) return setErr("Please select a location.");
    if (!date) return setErr("Please select a date.");
    if (!selectedSlotIso) return setErr("Please choose an available time slot.");

    const { error } = await supabase.from("appointments").insert([
      {
        patient_id: user.id,
        location_id: locationId,
        service_id: serviceId || null,
        start_time: selectedSlotIso,
        status: "requested",
        notes: notes || null,
      },
    ]);

    if (error) {
      if ((error as any).code === "23505") {
        setErr("That time just got booked — please choose a different slot.");
        return;
      }
      setErr(error.message);
      return;
    }

    setNotes("");
    alert("Appointment request submitted ✅");
    await loadMyAppointments();
  };

  const messageFromAppointment = async (appt: ApptRow) => {
    if (!user) return;

    const { data: existing, error: exErr } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("appointment_id", appt.id)
      .maybeSingle();
    if (exErr) return alert(exErr.message);

    let threadId = existing?.id;

    if (!threadId) {
      const subject = `Appointment • ${new Date(appt.start_time).toLocaleString()}`;
      const { data: created, error: crErr } = await supabase
        .from("chat_threads")
        .insert([
          {
            location_id: appt.location_id,
            patient_id: user.id,
            appointment_id: appt.id,
            subject,
            status: "open",
          },
        ])
        .select("id")
        .maybeSingle();

      if (crErr) return alert(crErr.message);
      threadId = created?.id ?? "";
    }

    if (threadId) navigate(`/patient/chat?threadId=${threadId}`);
  };

  const quickBtnProps = {
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    type: "button" as const,
  };

  // ✅ Gate loading UI (keeps your full page intact, but prevents rendering before gate check)
  if (checkingOnboarding) {
    return (
      <div className="app-bg">
        <div className="shell">
          <div className="card card-pad">
            <div className="muted">Loading patient profile…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Vitality Institute"
          subtitle="Patient Portal • Scheduling • Treatments • Messaging • Labs • Intake"
          primaryCta={{ label: "Book Appointment", onClick: scrollToBooking }}
          secondaryCta={{ label: "Wound Intake", to: "/patient/intake/wound" }}
          rightActions={
            <>
              <button className="btn btn-ghost" {...quickBtnProps} onClick={() => navigate("/patient/treatments")}>
                Treatments
              </button>
              <button className="btn btn-ghost" {...quickBtnProps} onClick={() => navigate("/patient/chat")}>
                Messages
              </button>
              <button className="btn btn-ghost" {...quickBtnProps} onClick={() => navigate("/patient/labs")}>
                Labs
              </button>
              <button className="btn btn-ghost" onClick={signOut} type="button">
                Sign out
              </button>
            </>
          }
          activityItems={[
            { t: "Just now", m: "Request appointments instantly", s: "Scheduling" },
            { t: "Today", m: "View current + past treatments", s: "Treatments" },
            { t: "Anytime", m: "Message the clinic securely", s: "Messaging" },
            { t: "Fast", m: "Complete wound intake securely", s: "Wound Intake" },
          ]}
        />

        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div className="h1">Patient Portal</div>
              <div className="muted">Role: {role}</div>
              <div className="muted">Signed in: {user?.email}</div>

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div className="muted">Wound intake status:</div>
                {loadingWound ? (
                  <span className="muted">Loading…</span>
                ) : latestWoundIntake ? (
                  <span style={statusBadge(latestWoundIntake.status)}>{latestWoundIntake.status.toUpperCase()}</span>
                ) : (
                  <span className="muted">Not submitted</span>
                )}
              </div>

              {latestWoundIntake?.created_at ? (
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Last submitted: {new Date(latestWoundIntake.created_at).toLocaleString()}
                </div>
              ) : null}
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap", minHeight: 44 }}>
              <button className="btn btn-primary" {...quickBtnProps} onClick={scrollToBooking}>
                Book Appointment
              </button>

              <button className="btn btn-primary" {...quickBtnProps} onClick={() => navigate("/patient/intake/wound")}>
                Wound Care Intake
              </button>

              <button className="btn btn-ghost" {...quickBtnProps} onClick={() => navigate("/patient/treatments")}>
                Treatments
              </button>

              <button className="btn btn-ghost" {...quickBtnProps} onClick={() => navigate("/patient/labs")}>
                Labs
              </button>

              <button className="btn btn-ghost" {...quickBtnProps} onClick={() => navigate("/patient/chat")}>
                Messages
              </button>
            </div>
          </div>
        </div>

        <div className="space" />

        <div id="book-appointment" className="card card-pad">
          <div className="h2">Book an Appointment</div>
          <div className="muted" style={{ marginTop: 4 }}>
            Choose your location, service, date, and an available time slot.
          </div>

          <div className="space" />

          {loading && <div className="muted">Loading…</div>}
          {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

          {!loading && (
            <>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <select
                  className="input"
                  style={{ flex: "1 1 260px" }}
                  value={locationId}
                  onChange={(e) => {
                    setLocationId(e.target.value);
                    setServiceId("");
                    setSelectedSlotIso("");
                  }}
                >
                  <option value="">Select Location</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.city ? ` — ${l.city}` : ""}
                    </option>
                  ))}
                </select>

                <select
                  className="input"
                  style={{ flex: "1 1 260px" }}
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  disabled={!locationId}
                >
                  <option value="">Select Service (optional)</option>
                  {filteredServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  className="input"
                  style={{ flex: "1 1 200px" }}
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSelectedSlotIso("");
                  }}
                />

                {hours && hours.is_closed && <div className="muted">This location is closed on that day.</div>}

                {hours && !hours.is_closed && (
                  <div className="muted" style={{ fontSize: 12 }}>
                    Slots every {hours.slot_minutes} min • Hours {hours.open_time.slice(0, 5)}–{hours.close_time.slice(0, 5)}
                  </div>
                )}
              </div>

              <div className="space" />

              {locationId && date && hours && !hours.is_closed && (
                <div className="card card-pad" style={{ marginBottom: 16 }}>
                  <div className="h2">Available Times</div>
                  <div className="space" />

                  {slots.length === 0 ? (
                    <div className="muted">No slots available (or hours not set).</div>
                  ) : (
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      {slots.map((s) => {
                        const active = selectedSlotIso === s.iso;
                        const disabled = s.isTaken;

                        return (
                          <button
                            key={s.iso}
                            className={active ? "btn btn-primary" : "btn btn-ghost"}
                            onClick={() => setSelectedSlotIso(s.iso)}
                            disabled={disabled}
                            title={disabled ? "Already booked" : "Select"}
                            type="button"
                            style={{
                              minWidth: 96,
                              fontWeight: 800,
                              letterSpacing: 0.2,
                              color: active ? undefined : "rgba(255,255,255,0.96)",
                              WebkitTextFillColor: active ? undefined : "rgba(255,255,255,0.96)",
                              opacity: disabled ? 0.45 : 1,
                              borderWidth: 2,
                              borderColor: active ? undefined : "rgba(255,255,255,0.22)",
                              background: active ? undefined : "rgba(0,0,0,0.18)",
                            }}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedSlotIso && (
                    <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                      Selected time: {toLocalTimeLabel(selectedSlotIso)}
                    </div>
                  )}
                </div>
              )}

              <textarea
                className="input"
                style={{ width: "100%", minHeight: 90 }}
                placeholder="Notes (optional) — what are you coming in for?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <div className="space" />

              <button className="btn btn-primary" onClick={submit} type="button">
                Request Appointment
              </button>

              {selectedLocation && (
                <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>
                  Selected: {selectedLocation.name}
                  {selectedLocation.city ? ` (${selectedLocation.city}, ${selectedLocation.state ?? ""})` : ""}
                </div>
              )}
            </>
          )}
        </div>

        <div className="space" />

        <div className="card card-pad">
          <div className="h2">My Appointments</div>
          <div className="muted" style={{ marginTop: 4 }}>
            Tap “Message Clinic” to start a thread tied to that appointment.
          </div>

          <div className="space" />

          {loadingMine && <div className="muted">Loading…</div>}
          {!loadingMine && myAppointments.length === 0 && <div className="muted">No appointments yet.</div>}

          {!loadingMine &&
            myAppointments.map((a) => (
              <div key={a.id} className="card card-pad" style={{ marginBottom: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div className="h2">{new Date(a.start_time).toLocaleString()}</div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                      Location: {locName(a.location_id)} {" • "} Service: {svcName(a.service_id)}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      Status: <strong>{a.status}</strong>
                    </div>
                    {a.notes && (
                      <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                        Notes: {a.notes}
                      </div>
                    )}
                    <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                      Appointment ID: {a.id}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <button className="btn btn-ghost" type="button" onClick={() => messageFromAppointment(a)}>
                      Message Clinic
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}