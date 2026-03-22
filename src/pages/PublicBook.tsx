import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, type AppRole } from "../auth/AuthProvider";
import PublicFlowStatusCard from "../components/public/PublicFlowStatusCard";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import { createBookingRequest } from "../lib/bookingRequests";
import { buildFollowUpMessage, resolveBookingRequestLead } from "../lib/publicFollowUpEngine";
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
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [interestMessage, setInterestMessage] = useState<string | null>(null);
  const [locations, setLocations] = useState<CatalogLocation[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);

  const draft = useMemo(() => readPublicBookingDraft(), []);
  const [locationId, setLocationId] = useState(searchParams.get("locationId") ?? draft?.locationId ?? "");
  const [serviceId, setServiceId] = useState(searchParams.get("serviceId") ?? draft?.serviceId ?? "");
  const [startTimeLocal, setStartTimeLocal] = useState(searchParams.get("start") ?? draft?.startTimeLocal ?? "");
  const [notes, setNotes] = useState(searchParams.get("notes") ?? draft?.notes ?? "");
  const hydratedSelectionRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [locationRows, serviceResult] = await Promise.all([loadCatalogLocations(), loadCatalogServices()]);
        if (cancelled) return;
        setLocations(locationRows);
        setServices(serviceResult.services);
        setCatalogError(null);
      } catch {
        if (!cancelled) setCatalogError("Booking options are temporarily unavailable. Please try again in a moment.");
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

  const normalizedStartTime = useMemo(() => startTimeLocal.trim(), [startTimeLocal]);
  const hasCompleteStartTimeValue = normalizedStartTime.length >= 16;

  const startTimeDate = useMemo(() => {
    if (!hasCompleteStartTimeValue) return null;
    const next = new Date(normalizedStartTime);
    return Number.isNaN(next.getTime()) ? null : next;
  }, [hasCompleteStartTimeValue, normalizedStartTime]);

  const hasValidLocation = !!renderedLocationId && !!selectedLocation;
  const hasValidService = !!renderedServiceId && !!selectedServiceRow;
  const needsPreferredTime = !intakeOnlyPathway;
  const hasValidTime = !needsPreferredTime || (!!startTimeDate && hasCompleteStartTimeValue);
  const isFormComplete = hasValidLocation && hasValidService && hasValidTime;

  const validationMessage = useMemo(() => {
    if (!hasValidLocation || !hasValidService) {
      return "Please select a service and time to continue";
    }
    if (!selectedServiceRow || servicesForLocation.length === 0) {
      return "Something went wrong. Please try again.";
    }
    if (!hasValidTime) {
      return "Please select a service and time to continue";
    }
    return null;
  }, [hasValidLocation, hasValidService, hasValidTime, selectedServiceRow, servicesForLocation.length]);

  const matchedInterestService = useMemo(() => {
    return matchCatalogServiceFromInterest({
      interest: selectedInterestSlug,
      offeringTitle: selectedInterest?.title ?? null,
      services,
    });
  }, [selectedInterest?.title, selectedInterestSlug, services]);

  useEffect(() => {
    if (loading || hydratedSelectionRef.current) return;
    if (locations.length === 0) return;

    const matchedLocationId =
      matchedInterestService?.service.location_id && locations.some((location) => location.id === matchedInterestService.service.location_id)
        ? matchedInterestService.service.location_id
        : "";
    const nextLocationId =
      (locationId && locations.some((location) => location.id === locationId) ? locationId : "") ||
      (searchParams.get("locationId") && locations.some((location) => location.id === searchParams.get("locationId")) ? searchParams.get("locationId")! : "") ||
      matchedLocationId ||
      (draft?.locationId && locations.some((location) => location.id === draft.locationId) ? draft.locationId : "") ||
      locations[0]?.id ||
      "";

    const nextServices = services.filter((service) => service.location_id === nextLocationId);
    const nextServiceId =
      (serviceId && nextServices.some((service) => service.id === serviceId) ? serviceId : "") ||
      (searchParams.get("serviceId") && nextServices.some((service) => service.id === searchParams.get("serviceId")) ? searchParams.get("serviceId")! : "") ||
      (matchedInterestService?.service.id && nextServices.some((service) => service.id === matchedInterestService.service.id)
        ? matchedInterestService.service.id
        : "") ||
      (draft?.serviceId && nextServices.some((service) => service.id === draft.serviceId) ? draft.serviceId : "") ||
      "";

    hydratedSelectionRef.current = true;
    setLocationId(nextLocationId);
    setServiceId(nextServiceId);
  }, [draft?.locationId, draft?.serviceId, loading, locationId, locations, matchedInterestService?.service.id, matchedInterestService?.service.location_id, searchParams, serviceId, services]);

  useEffect(() => {
    if (loading || !renderedLocationId) return;
    if (!serviceId) return;
    if (servicesForLocation.some((service) => service.id === serviceId)) return;
    setServiceId("");
  }, [loading, renderedLocationId, serviceId, servicesForLocation]);

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
    setInterestMessage(
      matchedInterestService.confidence === "exact"
        ? `We selected ${matchedService.name} from your link.`
        : `We selected the closest available service: ${matchedService.name}.`
    );
  }, [loading, matchedInterestService, selectedInterestSlug, services.length]);

  useEffect(() => {
    setSubmitError(null);
  }, [locationId, notes, serviceId, startTimeLocal]);

  useEffect(() => {
    const requestId = getRequestIdForBookingSelection(draft, {
      locationId: renderedLocationId,
      serviceId: renderedServiceId,
      startTimeLocal: normalizedStartTime,
      notes,
    });

    savePublicBookingDraft({
      locationId: renderedLocationId,
      serviceId: renderedServiceId,
      startTimeLocal: normalizedStartTime,
      notes,
      locationName: selectedLocation?.name ?? draft?.locationName,
      serviceName: selectedServiceRow?.name ?? draft?.serviceName,
      requestId,
    });
  }, [draft, draft?.locationName, draft?.serviceName, normalizedStartTime, notes, renderedLocationId, renderedServiceId, selectedLocation?.name, selectedServiceRow?.name]);

  const fieldHelperMessage = useMemo(() => {
    if (loading) return " ";
    if (catalogError) return catalogError;
    if (!hasValidLocation || !hasValidService) return "Please select a service and time to continue";
    if (!hasValidTime) return "Please select a service and time to continue";
    if (intakeOnlyPathway) return "This service starts with guided intake instead of direct booking.";
    return " ";
  }, [catalogError, hasValidLocation, hasValidService, hasValidTime, intakeOnlyPathway, loading]);

  const canContinue = useMemo(() => {
    if (loading || submitting) return false;
    if (catalogError) return false;
    return !validationMessage;
  }, [catalogError, loading, submitting, validationMessage]);

  const confirmBooking = async () => {
    if (loading || submitting || catalogError) return;

    if (!hasValidLocation || !hasValidService || !hasValidTime) {
      setSubmitError("Please select a service and time to continue");
      return;
    }

    if (!selectedServiceRow) {
      setSubmitError("Something went wrong. Please try again.");
      return;
    }

    if (intakeOnlyPathway) {
      const nextPathway = getPublicVitalAiPathwayParam(selectedServiceRow);
      navigate(`/vital-ai?pathway=${encodeURIComponent(nextPathway)}`);
      return;
    }

    const start = startTimeDate;
    if (!start || start.getTime() < Date.now() - 60 * 1000) {
      setSubmitError("Please select a service and time to continue");
      return;
    }

    const nextPath =
      `/patient/book?locationId=${encodeURIComponent(renderedLocationId)}` +
      `&serviceId=${encodeURIComponent(renderedServiceId)}` +
      `&start=${encodeURIComponent(normalizedStartTime)}` +
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
    setSubmitError(null);

    try {
      const request = await createBookingRequest({
        locationId: renderedLocationId,
        serviceId: renderedServiceId,
        requestedStart: start.toISOString(),
        notes,
        source: selectedInterestSlug ? `public_booking_interest:${selectedInterestSlug}` : "public_booking_flow",
      });
      const followUp = buildFollowUpMessage(
        resolveBookingRequestLead({
          serviceName: selectedServiceRow.name,
          notes,
        }).leadType,
        resolveBookingRequestLead({
          serviceName: selectedServiceRow.name,
          notes,
        }).urgencyLevel
      );
      console.info("[Public follow-up]", {
        type: "booking_request",
        requestId: request.id,
        serviceName: selectedServiceRow.name,
        patientMessage: followUp.patientMessage,
        staffNote: followUp.staffNote,
      });

      savePublicBookingDraft({
        locationId: renderedLocationId,
        serviceId: renderedServiceId,
        startTimeLocal: normalizedStartTime,
        notes,
        locationName: selectedLocation?.name ?? draft?.locationName,
        serviceName: selectedServiceRow.name,
        requestId: request.id,
      });

      const onboardingPath = buildOnboardingRoute({ next: "/intake", handoff: "booking_request" });
      navigate(buildAuthRoute({ mode: "signup", next: onboardingPath, handoff: "booking_request" }));
    } catch {
      setSubmitError("Something went wrong. Please try again.");
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

        {submitError ? (
          <>
            <div className="space" />
            <div style={{ color: "#fecaca", minHeight: 22 }}>{submitError}</div>
          </>
        ) : null}

        {catalogError && !submitError ? (
          <>
            <div className="space" />
            <div style={{ color: "#fecaca", minHeight: 22 }}>{catalogError}</div>
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
              </div>

              <div style={{ flex: "1 1 240px" }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Preferred time</div>
                <input className="input" type="datetime-local" value={startTimeLocal} onChange={(event) => setStartTimeLocal(event.target.value)} />
              </div>
            </div>

            <div className="muted" style={{ fontSize: 12, marginTop: 8, minHeight: 18 }}>
              {!isFormComplete || intakeOnlyPathway || catalogError ? fieldHelperMessage : " "}
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
                disabled={!canContinue}
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
              title="What Happens Next"
              body={
                "Once you send your request, our team will review it and follow up with the right next step."
              }
              detail="Depending on your concern, we may help you schedule first or have a provider review your information before confirming your visit."
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
