// src/pages/PatientBooking.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getGuidedIntakePathwayForService } from "../lib/services/catalog";
import { supabase } from "../lib/supabase";
import VitalityHero from "../components/VitalityHero";
import RouteHeader from "../components/RouteHeader";

type LocationRow = { id: string; name: string | null };
type ServiceRow = {
  id: string;
  location_id: string;
  name: string;
  category: string | null;
  duration_minutes: number | null;
  visit_type: string | null; // e.g., "wound_care" or "wellness"
  is_active: boolean | null;
};

type PatientRow = { id: string; profile_id: string };

type AppointmentRow = {
  id: string;
  location_id: string;
  patient_id: string;
  service_id: string | null;
  start_time: string;
  end_time: string | null;
  status: string | null;
  visit_type: string | null;
  notes: string | null;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

// Simple slot generator: next N days, every 30 min between 9am–5pm (local browser time).
// Later we’ll swap this with location_hours logic.
function buildSlots(days = 7, slotMinutes = 30) {
  const out: Date[] = [];
  const now = new Date();
  const startDay = new Date(now);
  startDay.setMinutes(0, 0, 0);

  for (let d = 0; d < days; d++) {
    const day = new Date(startDay);
    day.setDate(day.getDate() + d);

    for (let hour = 9; hour < 17; hour++) {
      for (let m = 0; m < 60; m += slotMinutes) {
        const t = new Date(day);
        t.setHours(hour, m, 0, 0);
        if (t.getTime() > now.getTime() + 10 * 60 * 1000) out.push(t); // only future slots (+10m buffer)
      }
    }
  }
  return out;
}

export default function PatientBooking() {
  const { user, signOut, activeLocationId, resumeKey } = useAuth();
  const nav = useNavigate();

  const [patient, setPatient] = useState<PatientRow | null>(null);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);

  const [locationId, setLocationId] = useState<string>(activeLocationId ?? "");
  const [serviceType, setServiceType] = useState<string>("wound_care");
  const [serviceId, setServiceId] = useState<string>("");

  const [slot, setSlot] = useState<string>(""); // ISO string
  const [notes, setNotes] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const slots = useMemo(() => buildSlots(7, 30), []);

  const locName = useMemo(() => {
    const m = new Map(locations.map((l) => [l.id, l.name ?? l.id]));
    return (id: string) => m.get(id) ?? id;
  }, [locations]);

  const serviceOptions = useMemo(() => {
    return services
      .filter((s) => (locationId ? s.location_id === locationId : true))
      .filter((s) => (s.is_active === null ? true : s.is_active))
      .filter((s) => (serviceType ? (s.visit_type ?? "") === serviceType : true));
  }, [services, locationId, serviceType]);

  const bookedSlotSet = useMemo(() => {
    // block times already booked at that location (same exact start_time)
    const set = new Set<string>();
    for (const a of appointments) {
      if (a.location_id !== locationId) continue;
      if (!a.start_time) continue;
      set.add(new Date(a.start_time).toISOString());
    }
    return set;
  }, [appointments, locationId]);

  useEffect(() => {
    if (activeLocationId) setLocationId(activeLocationId);
  }, [activeLocationId]);

  useEffect(() => {
    const load = async () => {
      setErr(null);
      setLoading(true);

      try {
        if (!user?.id) throw new Error("Not signed in.");

        // Resolve patient record (patients.profile_id = auth user id)
        const { data: p, error: pErr } = await supabase
          .from("patients")
          .select("id,profile_id")
          .eq("profile_id", user.id)
          .maybeSingle();
        if (pErr) throw pErr;

        const patientRow = (p as PatientRow) ?? null;
        setPatient(patientRow);

        if (!patientRow?.id) {
          throw new Error("No patient profile linked to this login yet. Ask staff to create/link it.");
        }

        // Locations
        const { data: locs, error: locErr } = await supabase
          .from("locations")
          .select("id,name")
          .order("name");
        if (locErr) throw locErr;
        setLocations((locs as LocationRow[]) ?? []);

        // Services
        const { data: svcs, error: svcErr } = await supabase
          .from("services")
          .select("id,location_id,name,category,duration_minutes,visit_type,is_active")
          .order("name");
        if (svcErr) throw svcErr;
        setServices((svcs as ServiceRow[]) ?? []);

        // Appointments: pull upcoming (so we can block slots)
        // NOTE: column names inferred from schema visualizer. If your columns differ, tell me and I’ll adjust.
        const { data: appts, error: apptErr } = await supabase
          .from("appointments")
          .select("id,location_id,patient_id,service_id,start_time,end_time,status,visit_type,notes")
          .gte("start_time", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order("start_time", { ascending: true })
          .limit(500);
        if (apptErr) throw apptErr;
        setAppointments((appts as AppointmentRow[]) ?? []);

        // Default location if missing
        if (!locationId && (locs as LocationRow[] | null)?.[0]?.id) {
          setLocationId((locs as LocationRow[])[0].id);
        }
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load booking.");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeKey, user?.id]);

  useEffect(() => {
    // Reset service/slot when location or visitType changes
    setServiceId("");
    setSlot("");
  }, [locationId, serviceType]);

  const createAppointment = async () => {
    setErr(null);

    if (!user?.id) return setErr("Not signed in.");
    if (!patient?.id) return setErr("No patient profile linked.");
    if (!locationId) return setErr("Select a location.");
    if (!serviceType) return setErr("Select a visit type.");
    if (!serviceId) return setErr("Select a service.");
    if (!slot) return setErr("Select a time slot.");

    if (bookedSlotSet.has(slot)) return setErr("That time is already booked. Pick another.");

    const svc = services.find((s) => s.id === serviceId);
    const duration = svc?.duration_minutes ?? 30;

    const start = new Date(slot);
    const end = new Date(start.getTime() + duration * 60 * 1000);

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .insert([
          {
            location_id: locationId,
            patient_id: patient.id,
            service_id: serviceId,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            status: "scheduled",
            visit_type: "in_person",
            telehealth_enabled: false,
            notes: notes?.trim() ? notes.trim() : null,
          },
        ])
        .select("id")
        .single();

      if (error) throw error;

      const apptId = (data as any)?.id as string;
      if (!apptId) throw new Error("Appointment created but id not returned.");

      const nextPathway = svc
        ? getGuidedIntakePathwayForService({
            name: svc.name,
            category: svc.category ?? svc.visit_type,
            service_group: svc.visit_type,
          })
        : null;
      const nextPath = nextPathway
        ? `/intake?appointmentId=${encodeURIComponent(apptId)}&pathway=${encodeURIComponent(nextPathway)}&autostart=1`
        : `/intake?appointmentId=${encodeURIComponent(apptId)}`;

      nav(nextPath);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create appointment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <RouteHeader
          title="Book Visit"
          subtitle="Choose a service, time, and next step."
          backTo="/patient/home"
          homeTo="/patient/home"
          rightAction={
            <button className="btn btn-ghost" onClick={signOut} type="button">
              Sign out
            </button>
          }
        />

        <div className="space" />

        <VitalityHero
          title="Book Visit"
          subtitle="Select your service, pick a time, and continue to intake."
          secondaryCta={{ label: "Back", to: "/patient/home" }}
          rightActions={null}
          showKpis={false}
        />

        <div className="space" />

        <div className="card card-pad">
          {loading && <div className="muted">Loading...</div>}
          {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

          {!loading && (
            <>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 220px" }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    Location
                  </div>
                  <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                    <option value="">Select...</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name ?? l.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: "1 1 220px" }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    Visit Type
                  </div>
                    <select className="input" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                    <option value="wound_care">Wound Care</option>
                    <option value="wellness">Wellness</option>
                  </select>
                </div>

                <div style={{ flex: "2 1 320px" }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    Service
                  </div>
                  <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                    <option value="">Select service...</option>
                    {serviceOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.duration_minutes ? `� ${s.duration_minutes} min` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ flex: "2 1 420px" }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    Choose a time
                  </div>

                  <div className="card card-pad" style={{ maxHeight: 320, overflow: "auto" }}>
                    {slots
                      .map((d) => {
                        const iso = d.toISOString();
                        const disabled = bookedSlotSet.has(iso);
                        const label = `${d.toLocaleDateString()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

                        return (
                          <button
                            key={iso}
                            type="button"
                            className={`btn ${slot === iso ? "btn-primary" : "btn-ghost"}`}
                            style={{
                              width: "100%",
                              justifyContent: "space-between",
                              marginBottom: 8,
                              opacity: disabled ? 0.5 : 1,
                              pointerEvents: disabled ? "none" : "auto",
                            }}
                            onClick={() => setSlot(iso)}
                            title={disabled ? "Already booked" : ""}
                          >
                            <span>{label}</span>
                            <span className="muted">{disabled ? "Booked" : locName(locationId)}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>

                <div style={{ flex: "1 1 320px" }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    Notes (optional)
                  </div>
                  <textarea
                    className="input"
                    style={{ width: "100%", minHeight: 180 }}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tell us what you need help with..."
                  />

                  <div className="space" />

                  <button className="btn btn-primary" type="button" onClick={createAppointment} disabled={saving}>
                    {saving ? "Creating..." : "Book + Start Intake"}
                  </button>

                  <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                    After booking, you’ll be taken directly to the intake form for this appointment.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space" />
      </div>
    </div>
  );
}

