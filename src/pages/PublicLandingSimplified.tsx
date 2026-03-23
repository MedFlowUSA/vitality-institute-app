import { Link } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import { getPublicAccessRoute } from "../lib/publicMarketingCatalog";

const howToBegin = [
  {
    title: "Request a Visit",
    body: "Choose a service, location, and preferred time in one clean step.",
    to: "/book",
  },
  {
    title: "Start with Vital AI",
    body: "Begin guided intake if you want help finding the right path.",
    to: "/vital-ai",
  },
  {
    title: "Create or Access Your Account",
    body: "Continue intake, booking, or follow-up inside your portal.",
    to: getPublicAccessRoute("signup"),
  },
];

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
    title: "Aesthetics & Wellness",
    category: "Aesthetic Care",
    summary: "Aesthetic and wellness-focused options designed around confident, provider-guided care.",
    to: "/services/botox-consultation",
    cta: "View Service",
  },
];

export default function PublicLandingSimplified() {
  return (
    <PublicSiteLayout title="Vitality Institute" compactHeader>
      <div
        className="card card-pad card-light surface-light"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.99), rgba(245,241,255,0.96))",
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
          Provider-Led Care in Redlands
        </div>
        <div className="h1" style={{ marginTop: 10, maxWidth: 760 }}>
          Thoughtful provider-led care for wound healing, wellness, and advanced therapies.
        </div>
        <div className="surface-light-body" style={{ marginTop: 12, lineHeight: 1.75, maxWidth: 720 }}>
          Start with a visit request or guided intake, and we will help you move into the right next step with clarity.
        </div>

        <div className="space" />

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link to="/book" className="btn btn-primary">
            Request Visit
          </Link>
          <Link to="/vital-ai" className="btn btn-secondary">
            Start with Vital AI
          </Link>
          <Link to={getPublicAccessRoute("signup")} className="btn btn-secondary">
            Create Account
          </Link>
        </div>

        <div className="space" />

        <div className="surface-light-helper" style={{ lineHeight: 1.7 }}>
          Every public request is reviewed by the clinic before scheduling is finalized.
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light">
        <div className="h2" style={{ color: "#1F1633" }}>How to Begin</div>

        <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
          {howToBegin.map((item) => (
            <Link
              key={item.title}
              to={item.to}
              className="card card-pad card-light surface-light"
              style={{
                flex: "1 1 220px",
                minWidth: 220,
                textDecoration: "none",
                border: "1px solid rgba(184,164,255,0.18)",
                boxShadow: "0 14px 28px rgba(16,24,40,0.06)",
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
                {item.title}
              </div>
              <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.7 }}>
                {item.body}
              </div>
              <div style={{ marginTop: 14 }}>
                <span className="btn btn-secondary">{item.title}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="space" />

      <div
        className="card card-pad card-light surface-light"
        style={{
          background: "linear-gradient(180deg, rgba(255,247,250,0.98), rgba(245,241,255,0.95))",
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
          <a href="tel:+19095004572" className="btn btn-secondary" style={{ textDecoration: "none" }}>
            Call the Clinic
          </a>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light">
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div className="h2" style={{ color: "#1F1633" }}>Featured Services</div>
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
              className="card card-pad card-light surface-light service-card"
              style={{
                flex: "1 1 220px",
                minWidth: 220,
                textDecoration: "none",
                border: "1px solid rgba(184,164,255,0.18)",
                boxShadow: "0 14px 28px rgba(16,24,40,0.06)",
              }}
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
              <div style={{ marginTop: 14 }}>
                <span className="btn btn-secondary">{service.cta}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light">
        <div className="h2">Visit or Contact Us</div>
        <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.8 }}>
          Vitality Institute of Redlands
          <br />
          411 W. State Street, Suite B
          <br />
          Redlands, CA 92373
        </div>

        <div className="space" />

        <div className="row" style={{ gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 220px" }}>
            <div className="surface-light-helper" style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
              Phone
            </div>
            <a href="tel:+19095004572" className="h2" style={{ display: "inline-block", marginTop: 8, textDecoration: "none", color: "#140f24" }}>
              909-500-4572
            </a>
          </div>

          <div style={{ flex: "1 1 220px" }}>
            <div className="surface-light-helper" style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
              Hours
            </div>
            <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.8 }}>
              Monday to Friday
              <br />
              10:00 AM to 4:00 PM
            </div>
          </div>
        </div>

        <div className="space" />

        <div className="surface-light-helper" style={{ lineHeight: 1.7 }}>
          Questions before you begin? Call the clinic or use the contact page for help.
        </div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <Link to="/contact" className="btn btn-secondary">
            Contact Page
          </Link>
          <a href="tel:+19095004572" className="btn btn-primary" style={{ textDecoration: "none" }}>
            Call the Clinic
          </a>
        </div>
      </div>
    </PublicSiteLayout>
  );
}
