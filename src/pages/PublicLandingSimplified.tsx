import { Link } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import { PUBLIC_OFFERINGS, type PublicOffering } from "../lib/publicMarketingCatalog";

export default function PublicLandingSimplified() {
  const featuredCarePaths = [
    PUBLIC_OFFERINGS.find((item) => item.slug === "glp1-weight-optimization-consultation"),
    PUBLIC_OFFERINGS.find((item) => item.slug === "womens-hormone-balance-consultation"),
    PUBLIC_OFFERINGS.find((item) => item.slug === "botox-consultation"),
    PUBLIC_OFFERINGS.find((item) => item.slug === "peptide-therapy-consultation"),
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
            flex: "1 1 620px",
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
            Modern wellness, aesthetics, and medical care - all in one place.
          </div>
          <div className="surface-light-body" style={{ marginTop: 12, lineHeight: 1.75, maxWidth: 760 }}>
            Feel better, look better, and stay on track with personalized care, seamless booking, and direct access to your care team.
          </div>
          <div className="surface-light-helper" style={{ marginTop: 12, maxWidth: 680 }}>
            Explore services, start booking online, or use Vital AI if you want help choosing the most appropriate next step.
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <Link to="/book" className="btn btn-primary">
              Book Appointment
            </Link>
            <Link to="/vital-ai" className="btn btn-primary">
              Start with Vital AI
            </Link>
            <Link to="/services" className="btn btn-ghost">
              Explore Services
            </Link>
          </div>
        </div>

        <div className="card card-pad card-light surface-light" style={{ flex: "1 1 280px" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: "var(--v-helper-dark)",
              letterSpacing: ".12em",
              textTransform: "uppercase",
            }}
          >
            Download App
          </div>
          <div className="h2" style={{ marginTop: 10 }}>
            Stay connected after your visit
          </div>
          <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7 }}>
            Once your account is active, the app becomes your place for messages, labs, visit updates, and direct access to your care team.
          </div>
          <div className="surface-light-helper" style={{ marginTop: 12, fontSize: 13 }}>
            App download links can be connected later without changing the public booking or intake experience.
          </div>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad">
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div className="h2">Featured Care Paths</div>
            <div className="muted" style={{ marginTop: 4 }}>
              A quick look at some of the most common ways patients get started with Vitality.
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
              <div className="row" style={{ justifyContent: "space-between", gap: 10, marginTop: 14, alignItems: "center" }}>
                <div className="v-chip">{service.price}</div>
                <span className="btn btn-primary">View Details</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="space" />

      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
        <div className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
          <div className="h2">Why Vitality</div>
          <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
            Personalized care that blends medical oversight, modern wellness, and a polished patient experience.
          </div>
        </div>
        <div className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
          <div className="h2">Provider-led care</div>
          <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
            Consults, follow-up, labs, and treatment planning stay grounded in clinical review rather than guesswork.
          </div>
        </div>
        <div className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
          <div className="h2">Clear next steps</div>
          <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
            Book online, contact the clinic directly, or start with Vital AI if you want help choosing the right path.
          </div>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light">
        <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ flex: "1 1 240px" }}>
            <div className="h2">How It Works</div>
            <div className="surface-light-helper" style={{ marginTop: 6 }}>
              A clear path from exploration to care.
            </div>
          </div>
          <div className="row" style={{ gap: 12, flexWrap: "wrap", flex: "2 1 640px" }}>
            <div className="v-chip">1. Explore services</div>
            <div className="v-chip">2. Choose your next step</div>
            <div className="v-chip">3. Book or speak with the clinic</div>
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
              Call the clinic, browse services, or start booking online before signing in.
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <Link to="/contact" className="btn btn-ghost">
                Contact Page
              </Link>
              <Link to="/book" className="btn btn-primary">
                Book Now
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicSiteLayout>
  );
}
