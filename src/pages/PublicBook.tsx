import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, type AppRole } from "../auth/AuthProvider";
import PublicFlowStatusCard from "../components/public/PublicFlowStatusCard";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import { createBookingRequest } from "../lib/bookingRequests";
import { getPublicOfferingBySlug } from "../lib/publicMarketingCatalog";
import { getRequestIdForBookingSelection, readPublicBookingDraft, savePublicBookingDraft } from "../lib/publicBookingDraft";
import { buildAuthRoute, buildOnboardingRoute } from "../lib/routeFlow";
import {
  getIntakeOnlyPathwayForService,
  getPublicVitalAiPathwayParam,
  loadCatalogLocations,
  loadCatalogServices,
  matchCatalogServiceFromInterest,
  type CatalogLocation,
  type CatalogService,
} from "../lib/services/catalog";

function getHomeRouteForRole(role: AppRole | null) {
  if (role === "super_admin" || role === "location_admin") return "/admin";
  if (role && role !== "patient") return "/provider";
  return "/patient";
}

export default function PublicBook() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedInterestSlug = searchParams.get("interest") ?? "";
  const selectedInterest =
    getPublicOfferingBySlug(selectedInterestSlug) ?? {
      slug: "",
      title: "",
      category: "",
      summary: "",
      price: "",
      overview: "",
      idealFor: "",
      serviceDetails: "",
      whatToExpect: "",
      faqNotes: [],
    };
  const hasSelectedInterest = !!selectedInterest.slug;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [servicePrompt, setServicePrompt] = useState<string | null>(null);
  const [interestMessage, setInterestMessage] = useState<string | null>(null);
  const [locations, setLocations] = useState<CatalogLocation[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);

  const draft = useMemo(() => readPublicBookingDraft(), []);
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
      } catch {
        if (!cancelled) setError("Booking options are temporarily unavailable. Please try again in a moment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const renderedLocationId = useMemo(() => {
    return locations.some((location) => location.id === locationId) ? locationId : "";
  }, [locationId, locations]);

  const servicesForLocation = useMemo(() => {
    if (!renderedLocationId) return [];
    return services.filter((service) => service.location_id === renderedLocationId);
  }, [renderedLocationId, services]);

  const renderedServiceId = useMemo(() => {
    return servicesForLocation.some((service) => service.id === serviceId) ? serviceId : "";
  }, [serviceId, servicesForLocation]);

  const selectedLocation = useMemo(() => {
    return locations.find((location) => location.id === renderedLocationId) ?? null;
  }, [locations, renderedLocationId]);

  const selectedServiceRow = useMemo(() => {
    return servicesForLocation.find((service) => service.id === renderedServiceId) ?? null;
  }, [renderedServiceId, servicesForLocation]);

  const intakeOnlyPathway = useMemo(() => {
    return selectedServiceRow ? getIntakeOnlyPathwayForService(selectedServiceRow) : null;
  }, [selectedServiceRow]);

  const validationMessage = useMemo(() => {
    if (!renderedLocationId || !renderedServiceId) {
      return "Please select a service and time to continue";
    }
    if (!selectedServiceRow || servicesForLocation.length === 0) {
      return "Something went wrong. Please try again.";
    }
    if (!startTimeLocal && !intakeOnlyPathway) {
      return "Please select a service and time to continue";
    }
    return null;
  }, [intakeOnlyPathway, renderedLocationId, renderedServiceId, selectedServiceRow, servicesForLocation.length, startTimeLocal]);

  const matchedInterestService = useMemo(() => {
    return matchCatalogServiceFromInterest({
      interest: selectedInterestSlug,
      offeringTitle: selectedInterest?.title ?? null,
      services,
    });
  }, [selectedInterest?.title, selectedInterestSlug, services]);

  useEffect(() => {
    if (loading || locations.length === 0) return;

    const nextLocationId =
      (locationId && locations.some((location) => location.id === locationId) ? locationId : "") ||
      (matchedInterestService?.service.location_id && locations.some((location) => location.id === matchedInterestService.service.location_id)
        ? matchedInterestService.service.location_id
        : "") ||
      locations[0]?.id ||
      "";

    if (nextLocationId !== locationId) {
      setLocationId(nextLocationId);
      return;
    }

    const nextServices = services.filter((service) => service.location_id === nextLocationId);
    const nextServiceId =
      (serviceId && nextServices.some((service) => service.id === serviceId) ? serviceId : "") ||
      (matchedInterestService?.service.id && nextServices.some((service) => service.id === matchedInterestService.service.id)
        ? matchedInterestService.service.id
        : "") ||
      (draft?.serviceId && nextServices.some((service) => service.id === draft.serviceId) ? draft.serviceId : "") ||
      nextServices[0]?.id ||
      "";

    if (nextServiceId !== serviceId) {
      setServiceId(nextServiceId);
    }
  }, [draft?.serviceId, loading, locationId, locations, matchedInterestService?.service.id, matchedInterestService?.service.location_id, serviceId, services]);

  useEffect(() => {
    if (!selectedInterestSlug) {
      setInterestMessage(null);
      return;
    }
    if (services.length === 0 || loading) return;

    if (!matchedInterestService?.service) {
      setInterestMessage("We couldn't match that link to a specific service, so choose the option that fits best below.");
      return;
    }

    const matchedService = matchedInterestService.service;
    if (matchedService.location_id && matchedService.location_id !== locationId) {
      setLocationId(matchedService.location_id);
    }
    if (serviceId !== matchedService.id) {
      setServiceId(matchedService.id);
    }

    setInterestMessage(
      matchedInterestService.confidence === "exact"
        ? `We selected ${matchedService.name} from your link.`
        : `We selected the closest available service: ${matchedService.name}.`
    );
  }, [loading, locationId, matchedInterestService, selectedInterestSlug, serviceId, services.length]);

  useEffect(() => {
    setError(null);
    setServicePrompt(null);
  }, [locationId, notes, serviceId, startTimeLocal]);

  useEffect(() => {
    if (loading) return;
    if (!renderedLocationId) return;
    if (servicesForLocation.length === 0) {
      setServicePrompt("Something went wrong. Please try again.");
      return;
    }
    if (!renderedServiceId) {
      setServicePrompt("Please select a service and time to continue");
      return;
    }
    setServicePrompt(null);
  }, [loading, renderedLocationId, renderedServiceId, servicesForLocation.length]);

  useEffect(() => {
    if (loading) return;
    if (validationMessage) {
      setError((current) => {
        if (!current || current === "Please select a service and time to continue" || current === "Something went wrong. Please try again.") {
          return validationMessage;
        }
        return current;
      });
      return;
    }

    setError((current) => {
      if (!current) return null;
      if (renderedLocationId && renderedServiceId && startTimeLocal && selectedServiceRow) return null;
      return current;
    });
  }, [loading, renderedLocationId, renderedServiceId, selectedServiceRow, startTimeLocal, validationMessage]);

  useEffect(() => {
    const requestId = getRequestIdForBookingSelection(draft, {
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
      locationName: selectedLocation?.name ?? draft?.locationName,
      serviceName: selectedServiceRow?.name ?? draft?.serviceName,
      requestId,
    });
  }, [draft, draft?.locationName, draft?.serviceName, notes, renderedLocationId, renderedServiceId, selectedLocation?.name, selectedServiceRow?.name, startTimeLocal]);

  const confirmBooking = async () => {
    if (loading || submitting) return;

    if (!renderedLocationId || !renderedServiceId || !startTimeLocal) {
      setError("Please select a service and time to continue");
      return;
    }

    if (!selectedServiceRow) {
      setError("Something went wrong. Please try again.");
      return;
    }

    if (intakeOnlyPathway) {
      const nextPathway = getPublicVitalAiPathwayParam(selectedServiceRow);
      navigate(`/vital-ai?pathway=${encodeURIComponent(nextPathway)}`);
      return;
    }

    const start = new Date(startTimeLocal);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() - 60 * 1000) {
      setError("Please select a service and time to continue");
      return;
    }

    const nextPath =
      `/patient/book?locationId=${encodeURIComponent(renderedLocationId)}` +
      `&serviceId=${encodeURIComponent(renderedServiceId)}` +
      `&start=${encodeURIComponent(startTimeLocal)}` +
      `&notes=${encodeURIComponent(notes)}`;

    if (user?.id && role === "patient") {
      navigate(nextPath);
      return;
    }

    if (user?.id && role && role !== "patient") {
      navigate(getHomeRouteForRole(role), { replace: true });
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const request = await createBookingRequest({
        locationId: renderedLocationId,
        serviceId: renderedServiceId,
        requestedStart: start.toISOString(),
        notes,
        source: selectedInterestSlug ? `public_booking_interest:${selectedInterestSlug}` : "public_booking_flow",
      });

      savePublicBookingDraft({
        locationId: renderedLocationId,
        serviceId: renderedServiceId,
        startTimeLocal,
        notes,
        locationName: selectedLocation?.name ?? draft?.locationName,
        serviceName: selectedServiceRow.name,
        requestId: request.id,
      });

      const onboardingPath = buildOnboardingRoute({ next: "/intake", handoff: "booking_request" });
      navigate(buildAuthRoute({ mode: "signup", next: onboardingPath, handoff: "booking_request" }));
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicSiteLayout
      title={user?.id ? "Book Your Visit" : "Request Your Visit"}
      subtitle={
        user?.id
          ? "Choose your service, location, and preferred time, then continue into intake."
          : "Choose your preferred location, service, and time to begin intake. Our team will review and confirm your appointment."
      }
    >
      <div className="card card-pad">
        <div className="h2">{user?.id ? "Continue Your Booking" : "Start Your Visit Request"}</div>
        <div className="muted" style={{ marginTop: 4 }}>
          {user?.id
            ? "We’ll carry your visit details straight into booking and intake."
            : "Start with the essentials first. We’ll save your preferred visit details, then guide you into account setup and intake."}
        </div>

        {interestMessage ? (
          <>
            <div className="space" />
            <div className="card card-pad card-light surface-light" style={{ marginBottom: 0 }}>
              <div className="surface-light-helper">{interestMessage}</div>
            </div>
          </>
        ) : null}

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
            {false ? (
              <>
                <div className="card card-pad card-light surface-light" style={{ marginBottom: 14 }}>
                  <div className="h2">Selected Program Interest</div>
                  <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
                    <strong>{selectedInterest.title}</strong> — {selectedInterest.price}
                  </div>
                  <div className="surface-light-helper" style={{ marginTop: 8 }}>
                    This public pricing item may map to a consultation, monthly program, or package. Choose the best-fit visit request below and the clinic will confirm the exact next step after review.
                  </div>
                </div>
              </>
            ) : null}

            {hasSelectedInterest ? (
              <div style={{ marginBottom: 14 }}>
                <PublicFlowStatusCard
                  eyebrow="Selected Interest"
                  title={selectedInterest.title}
                  body="This public pricing item may map to a consultation, monthly program, or package. We'll use it to guide the closest visit request and intake path."
                  detail={`Current pricing reference: ${selectedInterest.price}. Final scheduling, provider review, and treatment fit are always confirmed by the clinic.`}
                />
              </div>
            ) : null}

            <div className="card card-pad card-light surface-light" style={{ marginBottom: 14 }}>
              <div className="h2">How this works</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
                {user?.id
                  ? "Choose your service and preferred time now, then continue into a guided intake before your visit."
                  : "Choose your service and preferred time now. We’ll save your request, then guide you through account setup and intake while the clinic reviews availability."}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <PublicFlowStatusCard
                eyebrow="Next Step"
                title={user?.id ? "Intake follows this booking step" : "Clinic review follows this request"}
                body={
                  user?.id
                    ? "After you continue, you'll move into intake so the care team has the right context before the visit is finalized."
                    : "After you continue, your request is saved for review while you move through account setup and intake."
                }
                detail="A coordinator may follow up to confirm scheduling and next steps. Provider review may be required depending on the concern or service selected."
              />
            </div>

            <div className="space" />
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 220px" }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Location</div>
                <select className="input" value={renderedLocationId} onChange={(event) => setLocationId(event.target.value)}>
                  <option value="">Select location...</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name ?? location.id}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ flex: "2 1 320px" }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Service</div>
                <select className="input" value={renderedServiceId} onChange={(event) => setServiceId(event.target.value)} disabled={!renderedLocationId || servicesForLocation.length === 0}>
                  <option value="">Select service...</option>
                  {servicesForLocation.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
                {servicePrompt ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    {servicePrompt}
                  </div>
                ) : null}
                {intakeOnlyPathway ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    This service starts with guided intake instead of direct booking.
                  </div>
                ) : null}
              </div>

              <div style={{ flex: "1 1 240px" }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Preferred time</div>
                <input className="input" type="datetime-local" value={startTimeLocal} onChange={(event) => setStartTimeLocal(event.target.value)} />
                {!startTimeLocal && !intakeOnlyPathway ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Choose a preferred time to continue.
                  </div>
                ) : null}
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
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void confirmBooking()}
                disabled={submitting || (!intakeOnlyPathway && (!!validationMessage || !!error))}
              >
                {submitting ? "Saving Request..." : "Continue to Intake"}
              </button>
              <Link to="/contact" className="btn btn-secondary">
                Need help first?
              </Link>
            </div>

            <div className="space" />

            <PublicFlowStatusCard
              eyebrow="What Happens Next"
              title={user?.id ? "The clinic will use your intake to finalize the visit" : "Your request is saved before scheduling is finalized"}
              body={
                user?.id
                  ? "Continue into intake so the clinic has the right details before confirming the visit plan."
                  : "Your request is saved first, then account setup and intake help our team review the right next step for scheduling."
              }
              detail="Guest requests do not create a confirmed appointment. Wound-care concerns may prompt faster coordinator outreach and additional provider review."
              actions={[
                { label: "Start with Vital AI", to: "/vital-ai", variant: "ghost" },
                { label: "Explore Services", to: "/services", variant: "ghost" },
              ]}
            />
          </>
        )}
      </div>
    </PublicSiteLayout>
  );
}
