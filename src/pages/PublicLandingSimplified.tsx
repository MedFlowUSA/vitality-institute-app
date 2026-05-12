import { useMemo, useState } from "react";
import { normalizePublicClinicLocationName, PUBLIC_CLINIC_LOCATIONS } from "../lib/publicClinicLocations";
import { Link } from "react-router-dom";
import MarketGroupedSelect from "../components/locations/MarketGroupedSelect";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import { getPublicAccessRoute } from "../lib/publicMarketingCatalog";
import { buildMarketOptionGroups, isPlaceholderMarket } from "../lib/locationMarkets";

const topCarePaths = [
  {
    title: "Weight Optimization",
    category: "Medical Weight Care",
    summary: "Start with a provider-led consultation for GLP-1, metabolic support, and structured follow-up.",
    bestFor: "Patients who already know they want a medical weight-care path.",
    to: "/services/glp1-weight-optimization-consultation",
    cta: "Explore Weight Care",
  },
  {
    title: "Wound Review",
    category: "Wound Care",
    summary: "Use guided intake first when you need help deciding urgency, next steps, or the right clinical path.",
    bestFor: "Patients with wound concerns, drainage, pain, or healing questions.",
    to: "/vital-ai",
    cta: "Start Wound Review",
  },
  {
    title: "In-Clinic IV Drips",
    category: "Advanced Wellness",
    summary: "Base IV drips start at $199, with optional NAD+ 1000 and B12 add-ons in clinic.",
    bestFor: "Patients looking for hydration, recovery, energy, or higher-touch infusion support.",
    to: "/services/nad-infusion",
    cta: "View IV Drips",
  },
  {
    title: "Peptide Therapy",
    category: "Recovery & Wellness",
    summary: "Provider-guided peptide support for recovery, metabolic health, and performance goals.",
    bestFor: "Patients who want consultation first before moving into peptide planning.",
    to: "/services/peptide-therapy-consultation",
    cta: "Explore Peptide Care",
  },
];

const trustHighlights = [
  {
    label: "Physician-Led Review",
    value: "Every case is reviewed",
    detail: "Public requests and guided intake are reviewed before scheduling or treatment steps are finalized.",
  },
  {
    label: "Live Clinics",
    value: "Southern California now",
    detail: "Book into live operational clinics today while expansion markets stay separate and non-operational.",
  },
  {
    label: "Guided Intake",
    value: "Clear next step",
    detail: "Start with Vital AI when you want help choosing the right care path before booking.",
  },
  {
    label: "Follow-Through",
    value: "Account + dashboard",
    detail: "Create your account once and continue booking, intake, messaging, and follow-up in one place.",
  },
];

const howItWorks = [
  {
    step: "1",
    title: "Choose your path",
    detail: "Book directly if you already know what you need, or start with Vital AI if you want guided routing first.",
  },
  {
    step: "2",
    title: "Submit your request",
    detail: "Share your service interest, intake details, or preferred market so the clinic has a clean starting point.",
  },
  {
    step: "3",
    title: "Clinic reviews next steps",
    detail: "Vitality confirms the right follow-up, whether that means scheduling now, continuing intake, or provider review first.",
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
          Physician-Led Care Across Southern California
        </div>
        <div className="h1 public-hero-heading" style={{ marginTop: 18, maxWidth: 760 }}>
          Choose the right care path in minutes.
        </div>
        <div className="surface-light-body public-hero-body" style={{ marginTop: 18, lineHeight: 1.75, maxWidth: 720 }}>
          Book directly when you already know what you want, or start with guided intake when you want help deciding the right next step for wound care, weight care, IV therapy, or wellness support.
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
          Every public request is reviewed by the clinic before scheduling is finalized. Need help now?{" "}
          <a href="tel:+12139126838" style={{ color: "inherit", fontWeight: 700 }}>
            Call the clinic
          </a>
          . Already started with us?{" "}
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

      <div className="card card-pad card-light surface-light public-panel">
        <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
          {trustHighlights.map((item) => (
            <div
              key={item.label}
              className="card card-pad card-light surface-light public-panel-nested"
              style={{ flex: "1 1 220px", minWidth: 220 }}
            >
              <div className="public-mini-title">{item.label}</div>
              <div className="h2" style={{ marginTop: 10 }}>{item.value}</div>
              <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.7 }}>
                {item.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-panel">
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div className="public-eyebrow">Top Care Paths</div>
            <div className="h2 public-section-title" style={{ marginTop: 10 }}>Start with the lane that best matches your reason for visiting.</div>
          </div>
          <Link to="/services" className="btn btn-secondary">
            View All Services
          </Link>
        </div>

        <div className="space" />

        <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
          {topCarePaths.map((service) => (
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
              <div className="surface-light-helper" style={{ marginTop: 10, lineHeight: 1.7 }}>
                Best for: {service.bestFor}
              </div>
              <div style={{ marginTop: 14 }}>
                <span className="btn btn-secondary">{service.cta}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-panel-soft">
        <div className="public-eyebrow">How It Works</div>
        <div className="h2 public-section-title" style={{ marginTop: 10 }}>
          One simple path from interest to clinic-reviewed next steps.
        </div>
        <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch", marginTop: 16 }}>
          {howItWorks.map((item) => (
            <div
              key={item.step}
              className="card card-pad card-light surface-light public-panel-nested"
              style={{ flex: "1 1 240px", minWidth: 220 }}
            >
              <div className="public-eyebrow">Step {item.step}</div>
              <div className="h2" style={{ marginTop: 10 }}>{item.title}</div>
              <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.7 }}>
                {item.detail}
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <Link to="/how-to-use-the-app" className="btn btn-secondary">
            View Patient Guide
          </Link>
          <a href="tel:+12139126838" className="btn btn-secondary" style={{ textDecoration: "none" }}>
            Call the Clinic
          </a>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-panel-soft">
        <div className="public-eyebrow">In-Clinic IV Drips</div>
        <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start", marginTop: 10 }}>
          <div style={{ flex: "1 1 420px", minWidth: 280 }}>
            <div className="h2 public-section-title">Build your IV drip visit with clear base and add-on pricing.</div>
            <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75, maxWidth: 720 }}>
              In-clinic IV drips start at $199 base. NAD+ 1000 is an additional $199 and requires a minimum 2-hour visit. B12 add-on pricing starts at $49.
            </div>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link to="/services/nad-infusion" className="btn btn-primary">
              View IV Drips
            </Link>
            <Link to="/book" className="btn btn-secondary">
              Book In-Clinic Visit
            </Link>
          </div>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <div className="v-chip">Base drip from $199</div>
          <div className="v-chip">NAD+ 1000 add-on +$199</div>
          <div className="v-chip">B12 add-on +$49</div>
          <div className="v-chip">NAD+ minimum 2 hours</div>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-growth-panel">
        <div className="public-growth-header">
          <div>
            <div className="public-eyebrow">Growth Markets</div>
            <div className="h2 public-section-title" style={{ marginTop: 10 }}>
              Live clinics first, expansion interest second.
            </div>
          </div>
          <div className="public-growth-badge">Expansion waitlist available</div>
        </div>

        <div className="surface-light-body public-growth-copy" style={{ marginTop: 12 }}>
          Choose a live clinic if you are ready to move into scheduling now, or select a coming-soon city to join the waitlist. We keep those paths separate so patients know exactly which markets are operational today.
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
            <div className="public-mini-title">Operating Rule</div>
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
        <div className="h2">Visit or Contact Us</div>
        <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.8, maxWidth: 760 }}>
          Choose a location to see fast contact details and the clearest next step for that market.
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
