// src/pages/PatientBookAppointment.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { clearPublicBookingDraft, getRequestIdForBookingSelection, readPublicBookingDraft, savePublicBookingDraft } from "../lib/publicBookingDraft";
import { buildAuthRoute, buildCurrentPath } from "../lib/routeFlow";
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

function getBookingErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message) return "We couldn't load booking details right now. Please try again.";
  if (message.toLowerCase().includes("row-level security") || message.toLowerCase().includes("permission")) {
    return "We couldn't finalize the appointment from your portal right now. Please try again or contact the clinic for help.";
  }
  return message;
}

export default function PatientBookAppointment() {
  const { user, signOut, resumeKey } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
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

  const storedDraft = useMemo(() => readPublicBookingDraft(), [resumeKey]);
  const prefillLocationId = searchParams.get("locationId") ?? storedDraft?.locationId ?? "";
  const prefillServiceId = searchParams.get("serviceId") ?? storedDraft?.serviceId ?? "";
  const prefillStart = searchParams.get("start") ?? storedDraft?.startTimeLocal ?? "";
  const prefillNotes = searchParams.get("notes") ?? storedDraft?.notes ?? "";

  const renderedLocationId = useMemo(() => {
    return locations.some((locationRow) => locationRow.id === locationId) ? locationId : "";
  }, [locationId, locations]);

  const servicesForLocation = useMemo(() => {
    if (!renderedLocationId) return [];
    return services.filter((s) => s.location_id === renderedLocationId && (s.is_active ?? true));
  }, [renderedLocationId, services]);

  const renderedServiceId = useMemo(() => {
    return servicesForLocation.some((serviceRow) => serviceRow.id === serviceId) ? serviceId : "";
  }, [serviceId, servicesForLocation]);

  const selectedService = useMemo(() => {
    return servicesForLocation.find((s) => s.id === renderedServiceId) ?? null;
  }, [renderedServiceId, servicesForLocation]);

  useEffect(() => {
    const load = async () => {
      setErr(null);
      setLoading(true);

      try {
        if (!user?.id) {
          nav(buildAuthRoute({ mode: "login", next: buildCurrentPath(location.pathname, location.search) }), { replace: true });
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

        // 3) Services
        const { data: svcs, error: svcErr } = await supabase
          .from("services")
          .select("id,name,location_id,duration_minutes,visit_type,is_active")
          .eq("is_active", true)
          .order("name");
        if (svcErr) throw svcErr;
        const serviceRows = (svcs as ServiceRow[]) ?? [];
        setServices(serviceRows);
        const locationRows = (locs as LocationRow[]) ?? [];
        const resolvedLocationId =
          (prefillLocationId && locationRows.some((location) => location.id === prefillLocationId) ? prefillLocationId : "") ||
          locationRows[0]?.id ||
          "";
        const resolvedServices = serviceRows.filter((service) => service.location_id === resolvedLocationId && (service.is_active ?? true));
        const resolvedServiceId =
          (prefillServiceId && resolvedServices.some((service) => service.id === prefillServiceId) ? prefillServiceId : "") ||
          resolvedServices[0]?.id ||
          "";

        setLocationId(resolvedLocationId);
        setServiceId(resolvedServiceId);
        setStartTimeLocal(prefillStart || "");
        setNotes(prefillNotes || "");
        setErr(null);
      } catch (e: unknown) {
        setErr(getBookingErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, nav, prefillLocationId, prefillNotes, prefillServiceId, prefillStart, resumeKey, user?.id]);

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
    if (loading) return;
    if (!renderedLocationId) return;
    if (servicesForLocation.length === 0) {
      setErr("No services are available for this location right now. Please choose another location.");
      return;
    }
    if (!renderedServiceId) {
      setErr("Choose a service to continue.");
      return;
    }
    setErr((current) => {
      if (!current) return null;
      if (current.includes("No services are available") || current.includes("Choose a service")) return null;
      return current;
    });
  }, [loading, renderedLocationId, renderedServiceId, servicesForLocation.length]);

  useEffect(() => {
    setErr((current) => {
      if (!current) return current;
      if (!renderedLocationId || !renderedServiceId || !startTimeLocal) return current;
      return null;
    });
  }, [renderedLocationId, renderedServiceId, startTimeLocal]);

  useEffect(() => {
    const locationName = locations.find((location) => location.id === renderedLocationId)?.name ?? storedDraft?.locationName;
    const serviceName = servicesForLocation.find((service) => service.id === renderedServiceId)?.name ?? storedDraft?.serviceName;
    const requestId = getRequestIdForBookingSelection(storedDraft, {
      locationId: renderedLocationId,
      serviceId: renderedServiceId,
      startTimeLocal,
      notes,
    });
    savePublicBookingDraft({
      locationId: renderedLocationId,
      serviceId: renderedServiceId,
      startTimeLocal,
      notes,
      locationName,
      serviceName,
      requestId,
    });
  }, [locations, notes, renderedLocationId, renderedServiceId, servicesForLocation, startTimeLocal, storedDraft, storedDraft?.locationName, storedDraft?.serviceName]);

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
    if (!renderedLocationId) return setErr("Select a location.");
    if (!renderedServiceId) return setErr("Select a service.");
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
          location_id: renderedLocationId,
          patient_id: patient.id,          // ✅ patients.id (NOT auth uid)
          provider_user_id: null,          // can be assigned later
          service_id: renderedServiceId,
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
      setErr(getBookingErrorMessage(error));
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
                <select className="input" style={{ flex: "1 1 220px" }} value={renderedLocationId} onChange={(e) => setLocationId(e.target.value)}>
                  <option value="">Select location...</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>

                <select className="input" style={{ flex: "2 1 320px" }} value={renderedServiceId} onChange={(e) => setServiceId(e.target.value)} disabled={!renderedLocationId || servicesForLocation.length === 0}>
                  <option value="">Select service...</option>
                  {servicesForLocation.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.duration_minutes ? ` • ${s.duration_minutes} min` : ""}
                    </option>
                  ))}
                </select>
                {!renderedServiceId && renderedLocationId ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    {servicesForLocation.length === 0 ? "No services are available for this location right now." : "Choose a service to continue."}
                  </div>
                ) : null}

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
