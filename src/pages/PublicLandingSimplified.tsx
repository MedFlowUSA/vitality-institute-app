import { useMemo, useState } from "react";
import { normalizePublicClinicLocationName, PUBLIC_CLINIC_LOCATIONS } from "../lib/publicClinicLocations";
import { Link } from "react-router-dom";
import MarketGroupedSelect from "../components/locations/MarketGroupedSelect";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import { getPublicAccessRoute } from "../lib/publicMarketingCatalog";
import { buildMarketOptionGroups, isPlaceholderMarket } from "../lib/locationMarkets";

const featuredServices = [
  {
    title: "GLP-1 / Weight Optimization",
    category: "Medical Weight Care",
    summary: "Medical weight care with provider-led evaluation and follow-up.",
    to: "/services/glp1-weight-optimization-consultation",
    cta: "View Service",
  },
  {
    title: "Hormone Optimization",
    category: "Hormone Health",
    summary: "Personalized hormone care for symptoms, energy, and long-term balance.",
    to: "/services/testosterone-optimization-consultation",
    cta: "View Service",
  },
  {
    title: "IV / Advanced Therapies",
    category: "Advanced Wellness",
    summary: "Advanced therapies designed to support recovery, performance, and vitality.",
    to: "/services/nad-infusion",
    cta: "View Service",
  },
  {
    title: "Peptide Therapy",
    category: "Recovery & Wellness",
    summary: "Provider-guided peptide support for recovery, metabolic health, and performance goals.",
    to: "/services/peptide-therapy-consultation",
    cta: "View Service",
  },
];

export default function PublicLandingSimplified() {
  const [selectedLocationName, setSelectedLocationName] = useState(
    PUBLIC_CLINIC_LOCATIONS[0]?.name ?? "",
  );
  const normalizedSelectedLocationName = normalizePublicClinicLocationName(selectedLocationName);
  const liveLocations = useMemo(
    () => PUBLIC_CLINIC_LOCATIONS.filter((location) => !isPlaceholderMarket(location)),
    []
  );
  const comingSoonLocations = useMemo(
    () => PUBLIC_CLINIC_LOCATIONS.filter((location) => isPlaceholderMarket(location)),
    []
  );
  const featuredExpansionMarkets = useMemo(
    () =>
      comingSoonLocations
        .slice(0, 6)
        .map((location) => normalizePublicClinicLocationName(location.name)),
    [comingSoonLocations]
  );

  const selectedLocation = useMemo(
    () =>
      PUBLIC_CLINIC_LOCATIONS.find((location) => location.name === normalizedSelectedLocationName) ??
      PUBLIC_CLINIC_LOCATIONS[0],
    [normalizedSelectedLocationName],
  );
  const locationGroups = useMemo(
    () =>
      buildMarketOptionGroups(PUBLIC_CLINIC_LOCATIONS, {
        valueOf: (location) => normalizePublicClinicLocationName(location.name),
        labelOf: (location) => {
          const base = normalizePublicClinicLocationName(location.name);
          return isPlaceholderMarket(location) ? `${base} - Coming Soon` : base;
        },
        includeComingSoon: true,
      }),
    []
  );

  return (
    <PublicSiteLayout title="Vitality Institute" compactHeader>
      <div
        className="card card-pad card-light surface-light public-hero-card"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.99), rgba(245,241,255,0.96))",
        }}
      >
        <div
          className="public-hero-eyebrow public-eyebrow"
        >
          Patient-Centered Care in Redlands and Los Angeles
        </div>
        <div className="h1 public-hero-heading" style={{ marginTop: 18, maxWidth: 760 }}>
          Get the care you need, with a clear and guided next step.
        </div>
        <div className="surface-light-body public-hero-body" style={{ marginTop: 18, lineHeight: 1.75, maxWidth: 720 }}>
          Whether you are concerned about a wound, ready to book treatment, or looking for the right starting point,
          Vitality Institute will guide you forward.
        </div>

        <div style={{ height: 24 }} />

        <div className="row public-hero-actions" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link to="/book" className="btn btn-primary">
            Book a Visit
          </Link>
          <Link to="/vital-ai" className="btn btn-secondary">
            Get Help Choosing
          </Link>
        </div>

        <div className="space" />

        <div className="surface-light-helper" style={{ lineHeight: 1.7 }}>
          Every public request is reviewed by the clinic before scheduling is finalized. Already started with us?{" "}
          <Link to={getPublicAccessRoute("signup")} style={{ color: "inherit", fontWeight: 700 }}>
            Create your account
          </Link>{" "}
          or{" "}
          <Link to={getPublicAccessRoute("login")} style={{ color: "inherit", fontWeight: 700 }}>
            sign in
          </Link>
          .
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-growth-panel">
        <div className="public-growth-header">
          <div>
            <div className="public-eyebrow">Nationwide Growth Markets</div>
            <div className="h2 public-section-title" style={{ marginTop: 10 }}>
              Vitality Institute is expanding beyond our live Southern California clinics.
            </div>
          </div>
          <div className="public-growth-badge">Expansion waitlist available</div>
        </div>

        <div className="surface-light-body public-growth-copy" style={{ marginTop: 12 }}>
          Choose a live clinic if you are ready to move into scheduling now, or select a coming-soon
          city to raise your hand for expansion interest. We keep those paths separate so the site
          feels national without pretending every market is already operational.
        </div>

        <div className="public-growth-stat-grid" style={{ marginTop: 18 }}>
          <div className="public-growth-stat">
            <div className="public-mini-title">Live Clinics</div>
            <div className="public-growth-stat-value">{liveLocations.length}</div>
            <div className="surface-light-helper">Available now for booking, intake, and care routing.</div>
          </div>
          <div className="public-growth-stat">
            <div className="public-mini-title">Coming Soon Markets</div>
            <div className="public-growth-stat-value">{comingSoonLocations.length}</div>
            <div className="surface-light-helper">Visible for waitlist and expansion-interest capture only.</div>
          </div>
          <div className="public-growth-stat">
            <div className="public-mini-title">How It Works</div>
            <div className="public-growth-stat-value">Live first</div>
            <div className="surface-light-helper">Operational teams stay scoped to real clinics until a market activates.</div>
          </div>
        </div>

        <div className="public-growth-market-shell" style={{ marginTop: 18 }}>
          <div className="public-mini-title">Featured Expansion Cities</div>
          <div className="public-growth-market-list" style={{ marginTop: 12 }}>
            {featuredExpansionMarkets.map((market) => (
              <span key={market} className="public-growth-market-chip">
                {market}
              </span>
            ))}
          </div>
        </div>

        <div className="row public-growth-actions" style={{ gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          <Link to="/book" className="btn btn-primary">
            Explore Markets
          </Link>
          <Link to="/vital-ai" className="btn btn-secondary">
            Start with Vital AI
          </Link>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-panel">
        <div className="h2 public-section-title">Need a full app walkthrough?</div>
        <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75, maxWidth: 760 }}>
          Read the step-by-step patient guide to understand how booking, intake, account setup, dashboard use,
          messages, labs, and treatment instructions work together across the full app.
        </div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <Link to="/how-to-use-the-app" className="btn btn-secondary">
            View Patient Guide
          </Link>
          <Link to="/book" className="btn btn-primary">
            Start Booking
          </Link>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-panel">
        <div className="h2 public-section-title">Choose the clearest first step</div>
        <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75, maxWidth: 760 }}>
          Book directly if you already know what you need. Start with Vital AI if you want guided routing before the clinic reviews next steps.
        </div>

        <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch", marginTop: 16 }}>
          <div className="card card-pad card-light surface-light public-panel-nested" style={{ flex: "1 1 280px", minWidth: 240 }}>
            <div className="public-eyebrow">
              Primary
            </div>
            <div className="h2" style={{ marginTop: 10 }}>Book a Visit</div>
            <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.7 }}>
              Best if you already know the service, program, or consultation you want.
            </div>
          </div>
          <div className="card card-pad card-light surface-light public-panel-nested" style={{ flex: "1 1 280px", minWidth: 240 }}>
            <div className="public-eyebrow">
              Guided
            </div>
            <div className="h2" style={{ marginTop: 10 }}>Start with Vital AI</div>
            <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.7 }}>
              Best if you want help choosing the right path before booking or need the clinic to review urgency first.
            </div>
          </div>
          <div className="card card-pad card-light surface-light public-panel-nested" style={{ flex: "1 1 280px", minWidth: 240 }}>
            <div className="public-eyebrow">
              Support
            </div>
            <div className="h2" style={{ marginTop: 10 }}>Need a hand?</div>
            <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.7 }}>
              Call the clinic or use the contact page if you want help choosing between services, intake, or follow-up.
            </div>
          </div>
        </div>
      </div>

      <div className="space" />

      <div
        className="card card-pad card-light surface-light public-panel-soft"
      >
        <div className="public-eyebrow">
          Wound Care Priority
        </div>
        <div className="h2" style={{ marginTop: 10 }}>
          Concerned about a wound that is worsening, draining, or slow to heal?
        </div>
        <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75, maxWidth: 720 }}>
          Start with wound-focused intake so the clinic can review urgency, photos, and next-step needs early.
        </div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <Link to="/vital-ai" className="btn btn-primary">
            Start Wound Review
          </Link>
          <a href="tel:+12139126838" className="btn btn-secondary" style={{ textDecoration: "none" }}>
            Call the Clinic
          </a>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-panel">
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div className="h2 public-section-title">Featured Services</div>
          </div>
          <Link to="/services" className="btn btn-secondary">
            View All Services
          </Link>
        </div>

        <div className="space" />

        <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
          {featuredServices.map((service) => (
            <Link
              key={service.title}
              to={service.to}
              className="card card-pad card-light surface-light public-panel-nested service-card"
              style={{
                flex: "1 1 220px",
                minWidth: 220,
                textDecoration: "none",
              }}
            >
              <div className="public-mini-title">
                {service.category}
              </div>
              <div className="h2" style={{ marginTop: 8 }}>
                {service.title}
              </div>
              <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.7 }}>
                {service.summary}
              </div>
              <div style={{ marginTop: 14 }}>
                <span className="btn btn-secondary">{service.cta}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-panel">
        <div className="h2">Visit or Contact Us</div>
        <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.8, maxWidth: 760 }}>
          Choose a location to see the quickest contact details without expanding the page.
        </div>

        <div className="space" />

          <div
          className="card card-pad card-light surface-light public-panel-nested"
        >
          <div className="public-eyebrow">
            Locations
          </div>

          <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "end", marginTop: 12 }}>
            <label style={{ flex: "1 1 280px", minWidth: 240 }}>
                <div className="public-mini-title" style={{ marginBottom: 8 }}>
                  Select clinic
                </div>
              <MarketGroupedSelect
                label="Select clinic"
                value={normalizedSelectedLocationName}
                onChange={(value) => setSelectedLocationName(normalizePublicClinicLocationName(value))}
                groups={locationGroups}
                placeholder="Select clinic"
                ariaLabel="Select clinic location"
                helperText={
                  selectedLocation && isPlaceholderMarket(selectedLocation)
                    ? "This city is part of our expansion roadmap. Use booking or Vital AI to join the waitlist."
                    : "Choose a live clinic to see the fastest contact details."
                }
              />
            </label>

            <Link to="/contact" className="btn btn-secondary">
              Contact Page
            </Link>
          </div>

          {selectedLocation ? (
            <div
              className="row"
              style={{
                gap: 18,
                flexWrap: "wrap",
                alignItems: "flex-start",
                marginTop: 18,
              }}
            >
              <div style={{ flex: "1 1 260px", minWidth: 220 }}>
                <div className="h2" style={{ marginTop: 0 }}>
                  {selectedLocation.name}
                </div>
                <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.8 }}>
                  {selectedLocation.addressLine1}
                  {selectedLocation.addressLine2 ? (
                    <>
                      <br />
                      {selectedLocation.addressLine2}
                    </>
                  ) : null}
                  <br />
                  {selectedLocation.cityStateZip}
                </div>
              </div>

              <div style={{ flex: "1 1 220px", minWidth: 200 }}>
                <div className="public-mini-title">
                  Hours
                </div>
                <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.8 }}>
                  {selectedLocation.hoursLabel}
                </div>
              </div>

              {selectedLocation.phone ? (
                <div style={{ flex: "1 1 220px", minWidth: 200 }}>
                  <div className="public-mini-title">
                    Phone
                  </div>
                  <a
                    href={`tel:+1${selectedLocation.phone.replace(/\D/g, "")}`}
                    className="surface-light-body"
                    style={{ display: "inline-block", marginTop: 8, textDecoration: "none" }}
                  >
                    {selectedLocation.phone}
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}

          {selectedLocation?.note ? (
            <div className="surface-light-helper" style={{ marginTop: 14, lineHeight: 1.7 }}>
              {selectedLocation.note}
            </div>
          ) : null}

          <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            {selectedLocation?.website ? (
              <a
                href={selectedLocation.website}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ textDecoration: "none" }}
              >
                Visit Website
              </a>
            ) : null}
            {selectedLocation?.phone ? (
              <a
                href={`tel:+1${selectedLocation.phone.replace(/\D/g, "")}`}
                className="btn btn-primary"
                style={{ textDecoration: "none" }}
              >
                Call This Location
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </PublicSiteLayout>
  );
}
