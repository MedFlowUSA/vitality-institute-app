// src/pages/PatientBookAppointment.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { clearPublicBookingDraft, readPublicBookingDraft, savePublicBookingDraft } from "../lib/publicBookingDraft";
import { supabase } from "../lib/supabase";
import VitalityHero from "../components/VitalityHero";
import RouteHeader from "../components/RouteHeader";

type LocationRow = { id: string; name: string };
type ServiceRow = {
  id: string;
  name: string;
  location_id: string;
  duration_minutes: number | null;
  visit_type: string | null;
  is_active: boolean | null;
};

type PatientRow = { id: string; profile_id: string; first_name: string | null; last_name: string | null };

export default function PatientBookAppointment() {
  const { user, signOut, resumeKey } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);

  const [locationId, setLocationId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [startTimeLocal, setStartTimeLocal] = useState(""); // datetime-local
  const [notes, setNotes] = useState("");

  const storedDraft = readPublicBookingDraft();
  const prefillLocationId = searchParams.get("locationId") ?? storedDraft?.locationId ?? "";
  const prefillServiceId = searchParams.get("serviceId") ?? storedDraft?.serviceId ?? "";
  const prefillStart = searchParams.get("start") ?? storedDraft?.startTimeLocal ?? "";
  const prefillNotes = searchParams.get("notes") ?? storedDraft?.notes ?? "";

  const servicesForLocation = useMemo(() => {
    return services.filter((s) => s.location_id === locationId && (s.is_active ?? true));
  }, [services, locationId]);

  const selectedService = useMemo(() => {
    return services.find((s) => s.id === serviceId) ?? null;
  }, [services, serviceId]);

  useEffect(() => {
    const load = async () => {
      setErr(null);
      setLoading(true);

      try {
        if (!user?.id) {
          nav(`/access?mode=login&next=${encodeURIComponent(`/patient/book${window.location.search}`)}`, { replace: true });
          return;
        }

        // 1) Resolve patient record (patients.profile_id = auth user id)
        const { data: p, error: pErr } = await supabase
          .from("patients")
          .select("id,profile_id,first_name,last_name")
          .eq("profile_id", user.id)
          .maybeSingle();
        if (pErr) throw pErr;

        const patientRow = (p as PatientRow) ?? null;
        setPatient(patientRow);

        if (!patientRow?.id) {
          throw new Error("No patient record is linked to your login yet. Ask front desk to create your patient profile.");
        }

        // 2) Locations
        const { data: locs, error: locErr } = await supabase
          .from("locations")
          .select("id,name")
          .order("name");
        if (locErr) throw locErr;
        setLocations((locs as LocationRow[]) ?? []);

        // default location
        if ((locs as LocationRow[] | null)?.length) {
          setLocationId(prefillLocationId || (locs as LocationRow[])[0].id);
        }

        // 3) Services
        const { data: svcs, error: svcErr } = await supabase
          .from("services")
          .select("id,name,location_id,duration_minutes,visit_type,is_active")
          .eq("is_active", true)
          .order("name");
        if (svcErr) throw svcErr;
        const serviceRows = (svcs as ServiceRow[]) ?? [];
        setServices(serviceRows);
        if (prefillStart) setStartTimeLocal(prefillStart);
        if (prefillNotes) setNotes(prefillNotes);

        if (prefillLocationId && !(locs as LocationRow[]).some((location) => location.id === prefillLocationId)) {
          setErr("Your saved location is no longer available. Please choose a new location.");
        }

        if (prefillServiceId && !serviceRows.some((service) => service.id === prefillServiceId)) {
          setErr("Your saved service is no longer available. Please choose another service.");
        }
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load booking.");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, prefillLocationId, prefillNotes, prefillStart, resumeKey, user?.id]);

  // when location changes, pick first service for that location
  useEffect(() => {
    const selectedStillVisible = servicesForLocation.some((service) => service.id === serviceId);
    if (selectedStillVisible) return;

    const requestedStillVisible = servicesForLocation.some((service) => service.id === prefillServiceId);
    if (requestedStillVisible && !serviceId) {
      setServiceId(prefillServiceId);
      return;
    }

    const first = servicesForLocation[0];
    if (first?.id) setServiceId(first.id);
    else setServiceId("");
  }, [prefillServiceId, serviceId, servicesForLocation]);

  useEffect(() => {
    savePublicBookingDraft({ locationId, serviceId, startTimeLocal, notes });
  }, [locationId, notes, serviceId, startTimeLocal]);

  const computeEndTimeIso = (startIso: string) => {
    const mins = selectedService?.duration_minutes ?? 30;
    const start = new Date(startIso);
    const end = new Date(start.getTime() + mins * 60 * 1000);
    return end.toISOString();
  };

  const toIsoFromLocal = (local: string) => {
    // datetime-local -> Date assumes local timezone
    const d = new Date(local);
    return d.toISOString();
  };

  const createAppointment = async () => {
    setErr(null);

    if (!user?.id) return setErr("Not signed in.");
    if (!patient?.id) return setErr("No patient record linked to this login.");
    if (!locationId) return setErr("Select a location.");
    if (!serviceId) return setErr("Select a service.");
    if (!startTimeLocal) return setErr("Select a date/time.");

    const start = new Date(startTimeLocal);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() - 60 * 1000) {
      return setErr("Select a future date/time.");
    }

    const startIso = toIsoFromLocal(startTimeLocal);
    const endIso = computeEndTimeIso(startIso);

    setSaving(true);

    const { data, error } = await supabase
      .from("appointments")
      .insert([
        {
          location_id: locationId,
          patient_id: patient.id,          // ✅ patients.id (NOT auth uid)
          provider_user_id: null,          // can be assigned later
          service_id: serviceId,
          start_time: startIso,
          end_time: endIso,
          status: "scheduled",
          visit_type: "in_person",
          telehealth_enabled: false,
          notes: notes || null,
          referral_id: null,
        },
      ])
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      setErr(error.message);
      return;
    }

    clearPublicBookingDraft();

    // go straight into intake for this appointment
    nav(`/patient/intake?appointmentId=${data.id}`, { replace: true });
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <RouteHeader
          title="Book Appointment"
          subtitle="Choose a service, time, and next step."
          backTo="/patient"
          homeTo="/patient"
          rightAction={
            <button className="btn btn-ghost" onClick={signOut} type="button">
              Sign out
            </button>
          }
        />

        <div className="space" />

        <VitalityHero
          title="Vitality Institute"
          subtitle="Book your appointment, then continue into intake."
          secondaryCta={{ label: "Back", to: "/patient" }}
          rightActions={null}
          showKpis={false}
        />

        <div className="space" />

        <div className="card card-pad">
          <div className="h2">Book Appointment</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Choose a location, service, and time — then you’ll be taken straight to intake.
          </div>

          <div className="space" />

          {loading && <div className="muted">Loading…</div>}
          {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

          {!loading && (
            <>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <select className="input" style={{ flex: "1 1 220px" }} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>

                <select className="input" style={{ flex: "2 1 320px" }} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                  {servicesForLocation.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.duration_minutes ? ` • ${s.duration_minutes} min` : ""}
                    </option>
                  ))}
                </select>

                <input
                  className="input"
                  style={{ flex: "1 1 220px" }}
                  type="datetime-local"
                  value={startTimeLocal}
                  onChange={(e) => setStartTimeLocal(e.target.value)}
                />
              </div>

              <div className="space" />

              <div style={{ marginBottom: 10 }}>
                <div className="muted" style={{ marginBottom: 6 }}>
                  Notes (optional)
                </div>
                <textarea
                  className="input"
                  style={{ width: "100%", minHeight: 90 }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button className="btn btn-primary" onClick={createAppointment} disabled={saving} type="button">
                {saving ? "Creating…" : "Continue to Intake"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
