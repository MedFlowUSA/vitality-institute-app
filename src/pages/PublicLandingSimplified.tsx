import { Link } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import { PUBLIC_OFFERINGS, type PublicOffering } from "../lib/publicMarketingCatalog";

export default function PublicLandingSimplified() {
  const featuredCarePaths = [
    PUBLIC_OFFERINGS.find((item) => item.slug === "glp1-weight-optimization-consultation"),
    PUBLIC_OFFERINGS.find((item) => item.slug === "nad-infusion"),
    PUBLIC_OFFERINGS.find((item) => item.slug === "womens-hormone-balance-consultation"),
  ].filter((item): item is PublicOffering => Boolean(item));

  return (
    <PublicSiteLayout
      title="Vitality Institute"
      compactHeader
    >
      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
        <div
          className="card card-pad card-light surface-light"
          style={{
            flex: "1 1 700px",
            background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,241,255,0.96))",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: "var(--v-helper-dark)",
              letterSpacing: ".12em",
              textTransform: "uppercase",
            }}
          >
            Vitality Institute
          </div>
          <div className="h1" style={{ marginTop: 10 }}>
            Premium, provider-led care with a calmer way to begin.
          </div>
          <div className="surface-light-body" style={{ marginTop: 12, lineHeight: 1.75, maxWidth: 760 }}>
            Request a visit, start with Vital AI, explore services, or sign in. Every public request is reviewed so the team can guide the right next step with clinical context.
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div className="v-chip">Provider-led review</div>
            <div className="v-chip">Guided intake available</div>
            <div className="v-chip">Wound care remains a priority path</div>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <Link to="/book" className="btn btn-primary">
              Request Visit
            </Link>
            <Link to="/vital-ai" className="btn btn-ghost">
              Start with Vital AI
            </Link>
            <Link to="/services" className="btn btn-ghost">
              Explore Services
            </Link>
            <Link to="/login" className="btn btn-ghost">
              Sign In
            </Link>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
            <div className="card card-pad" style={{ flex: "1 1 220px", background: "rgba(255,255,255,0.72)" }}>
              <div className="surface-light-helper" style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" }}>
                Request Visit
              </div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7 }}>
                Best if you already know the service or consultation you want to pursue.
              </div>
            </div>
            <div className="card card-pad" style={{ flex: "1 1 220px", background: "rgba(255,255,255,0.72)" }}>
              <div className="surface-light-helper" style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" }}>
                Start with Vital AI
              </div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7 }}>
                Best if you want guided routing before scheduling or service selection is finalized.
              </div>
            </div>
            <div className="card card-pad" style={{ flex: "1 1 220px", background: "rgba(255,255,255,0.72)" }}>
              <div className="surface-light-helper" style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" }}>
                Sign In
              </div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7 }}>
                Best if you already have a portal account and want to continue booking, intake, or follow-up.
              </div>
            </div>
          </div>
        </div>

        <div className="card card-pad card-light surface-light" style={{ flex: "1 1 280px" }}>
          <div className="h2">Clinical Priority</div>
          <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7 }}>
            Wound care should begin with urgency-aware intake, not a generic scheduling flow.
          </div>
          <div className="surface-light-helper" style={{ marginTop: 10, lineHeight: 1.7 }}>
            If you are dealing with drainage, infection concern, slow healing, or a worsening wound, start with Vital AI so the clinic can review urgency and next steps sooner.
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <Link to="/vital-ai" className="btn btn-primary">
              Start Wound Review
            </Link>
            <Link to="/contact" className="btn btn-ghost">
              Contact the Clinic
            </Link>
          </div>

          <div className="space" />

          <div className="h2">Talk to the Clinic</div>
          <a href="tel:+19095004572" className="h2" style={{ display: "inline-block", marginTop: 12, textDecoration: "none", color: "#140f24" }}>
            909-500-4572
          </a>
          <div className="surface-light-helper" style={{ marginTop: 10, lineHeight: 1.7 }}>
            A coordinator may follow up to confirm scheduling, intake needs, or provider review where appropriate.
          </div>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad">
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div className="h2">Featured Care Paths</div>
              <div className="muted" style={{ marginTop: 4 }}>
                A quick look at common public entry points with clear next steps.
              </div>
            </div>
          <Link to="/services" className="btn btn-ghost">
            View All Services
          </Link>
        </div>

        <div className="space" />

        <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
          {featuredCarePaths.map((service) => (
            <Link
              key={service.slug}
              to={`/services/${service.slug}`}
              className="card card-pad card-light surface-light service-card"
              style={{ flex: "1 1 240px", minWidth: 220, textDecoration: "none" }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--v-helper-dark)",
                  fontWeight: 800,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                }}
              >
                {service.category}
              </div>
              <div className="h2" style={{ marginTop: 8 }}>
                {service.title}
              </div>
              <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.7 }}>
                {service.summary}
              </div>
              <div className="surface-light-helper" style={{ marginTop: 10, lineHeight: 1.7 }}>
                {service.duration ? `Typical consult timing: ${service.duration}` : "Timing and fit are finalized after clinic review."}
              </div>
              <div className="row" style={{ justifyContent: "space-between", gap: 10, marginTop: 14, alignItems: "center" }}>
                <div className="v-chip">{service.price}</div>
                <span className="btn btn-primary">View Details</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad">
        <div className="row" style={{ justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 420px" }}>
            <div className="h2">Need help choosing the right path?</div>
            <div className="muted" style={{ marginTop: 6, lineHeight: 1.75 }}>
              Explore services if you want to compare options, request a visit if you already know what you want, or sign in if you are returning to your portal.
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Link to="/services" className="btn btn-ghost">
              Explore Services
            </Link>
            <Link to="/login" className="btn btn-ghost">
              Sign In
            </Link>
          </div>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light">
        <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 320px" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: "var(--v-helper-dark)",
                letterSpacing: ".12em",
                textTransform: "uppercase",
              }}
            >
              Visit or Contact Us
            </div>
            <div className="h2" style={{ marginTop: 10 }}>
              Vitality Institute of Redlands
            </div>
            <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.8 }}>
              1250 Vitality Avenue, Suite 200
              <br />
              Redlands, CA 92373
            </div>
          </div>

          <div style={{ flex: "1 1 260px" }}>
            <div className="surface-light-helper" style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
              Phone
            </div>
            <a href="tel:+19095004572" className="h2" style={{ display: "inline-block", marginTop: 8, textDecoration: "none", color: "#140f24" }}>
              909-500-4572
            </a>

            <div className="surface-light-helper" style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", marginTop: 16 }}>
              Hours
            </div>
            <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.8 }}>
              Monday to Friday
              <br />
              10:00 AM to 4:00 PM
            </div>
          </div>

          <div style={{ flex: "1 1 220px" }}>
            <div className="surface-light-helper" style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
              Next Step
            </div>
            <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.8 }}>
              Request a visit, begin with Vital AI, sign in to continue, or reach the clinic directly for help choosing the right path.
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <Link to="/book" className="btn btn-primary">
                Request Visit
              </Link>
              <Link to="/vital-ai" className="btn btn-ghost">
                Start with Vital AI
              </Link>
              <Link to="/contact" className="btn btn-ghost">
                Contact Page
              </Link>
              <Link to="/login" className="btn btn-ghost">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicSiteLayout>
  );
}
