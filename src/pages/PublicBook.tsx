import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import { readPublicBookingDraft, savePublicBookingDraft } from "../lib/publicBookingDraft";
import { loadCatalogLocations, loadCatalogServices, type CatalogLocation, type CatalogService } from "../lib/services/catalog";

export default function PublicBook() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<CatalogLocation[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);

  const draft = readPublicBookingDraft();
  const [locationId, setLocationId] = useState(searchParams.get("locationId") ?? draft?.locationId ?? "");
  const [serviceId, setServiceId] = useState(searchParams.get("serviceId") ?? draft?.serviceId ?? "");
  const [startTimeLocal, setStartTimeLocal] = useState(searchParams.get("start") ?? draft?.startTimeLocal ?? "");
  const [notes, setNotes] = useState(searchParams.get("notes") ?? draft?.notes ?? "");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [locationRows, serviceResult] = await Promise.all([loadCatalogLocations(), loadCatalogServices()]);
        if (cancelled) return;
        setLocations(locationRows);
        setServices(serviceResult.services);
        if (!locationId && locationRows[0]?.id) setLocationId(locationRows[0].id);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load public booking.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const servicesForLocation = useMemo(() => {
    return services.filter((service) => !locationId || service.location_id === locationId);
  }, [services, locationId]);

  useEffect(() => {
    if (!serviceId && servicesForLocation[0]?.id) {
      setServiceId(servicesForLocation[0].id);
    }
  }, [serviceId, servicesForLocation]);

  useEffect(() => {
    savePublicBookingDraft({ locationId, serviceId, startTimeLocal, notes });
  }, [locationId, notes, serviceId, startTimeLocal]);

  const confirmBooking = () => {
    if (!locationId || !serviceId || !startTimeLocal) {
      setError("Select a location, service, and date/time before continuing.");
      return;
    }

    const chosenService = services.find((service) => service.id === serviceId);
    if (!chosenService) {
      setError("That service is no longer available. Please choose another option.");
      return;
    }

    const start = new Date(startTimeLocal);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() - 60 * 1000) {
      setError("That selected time is no longer valid. Please choose a future time.");
      return;
    }

    const nextPath =
      `/patient/book?locationId=${encodeURIComponent(locationId)}` +
      `&serviceId=${encodeURIComponent(serviceId)}` +
      `&start=${encodeURIComponent(startTimeLocal)}` +
      `&notes=${encodeURIComponent(notes)}`;

    if (user?.id) {
      navigate(nextPath);
      return;
    }

    navigate(`/access?mode=login&next=${encodeURIComponent(nextPath)}`);
  };

  return (
    <PublicSiteLayout title="Start Booking" subtitle="Choose a service and preferred time now. Sign-in is only required when you confirm the appointment.">
      <div className="card card-pad">
        <div className="h2">Public Booking Entry</div>
        <div className="muted" style={{ marginTop: 4 }}>
          Select the basics first. You will sign in only when you are ready to confirm the appointment.
        </div>

        {error ? (
          <>
            <div className="space" />
            <div style={{ color: "#fecaca" }}>{error}</div>
          </>
        ) : null}

        {loading ? (
          <>
            <div className="space" />
            <div className="muted">Loading booking options...</div>
          </>
        ) : (
          <>
            <div className="card card-pad card-light surface-light" style={{ marginBottom: 14 }}>
              <div className="h2">How this works</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
                Pick your service and preferred time now. We save that draft in this browser, and you only sign in when you are ready to confirm the booking.
              </div>
            </div>

            <div className="space" />
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 220px" }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Location</div>
                <select className="input" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
                  <option value="">Select...</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name ?? location.id}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ flex: "2 1 320px" }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Service</div>
                <select className="input" value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
                  <option value="">Select service...</option>
                  {servicesForLocation.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ flex: "1 1 240px" }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Preferred time</div>
                <input className="input" type="datetime-local" value={startTimeLocal} onChange={(event) => setStartTimeLocal(event.target.value)} />
              </div>
            </div>

            <div className="space" />

            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Notes (optional)</div>
              <textarea
                className="input"
                style={{ width: "100%", minHeight: 110 }}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Tell the clinic what you want help with."
              />
            </div>

            <div className="space" />

            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-primary" onClick={confirmBooking}>
                {user?.id ? "Continue to Confirm Booking" : "Sign In to Confirm"}
              </button>
              <Link to="/contact" className="btn btn-ghost">
                Need help first?
              </Link>
            </div>
          </>
        )}
      </div>
    </PublicSiteLayout>
  );
}
