import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import { PUBLIC_OFFERINGS, PUBLIC_SERVICE_GROUPS, type PublicOffering } from "../lib/publicMarketingCatalog";

export default function PublicLanding() {
  const [services, setServices] = useState<PublicOffering[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setServices(PUBLIC_OFFERINGS.slice(0, 6));
    setLoading(false);
  }, []);

  return (
    <PublicSiteLayout
      title="Care that feels polished before you even sign in"
      subtitle="Feel better, look better, and stay on track with personalized care, seamless booking, and direct access to your care team."
      rightAction={
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link to="/book" className="btn btn-primary">
            Book Appointment
          </Link>
          <Link to="/services" className="btn btn-ghost">
            Explore Services
          </Link>
        </div>
      }
    >
      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
        <div className="card card-pad" style={{ flex: "1 1 520px", background: "linear-gradient(180deg, rgba(255,255,255,0.11), rgba(255,255,255,0.05))" }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#C8B6FF", letterSpacing: ".12em", textTransform: "uppercase" }}>
            Vitality Institute
          </div>
          <div className="h1" style={{ marginTop: 10 }}>
            Modern wellness, aesthetics, and medical care — all in one place.
          </div>
          <div style={{ marginTop: 10, lineHeight: 1.7, maxWidth: 760, color: "rgba(255,255,255,0.92)" }}>
            Feel better, look better, and stay on track with personalized care, seamless booking, and direct access to your care team.
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <div className="v-chip">Public service browsing</div>
            <div className="v-chip">Secure booking confirmation</div>
            <div className="v-chip">Vital AI ready</div>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link to="/book" className="btn btn-primary">
              Book Appointment
            </Link>
            <Link to="/services" className="btn btn-ghost">
              Explore Services
            </Link>
            <Link to="/login" className="btn btn-ghost">
              Sign In
            </Link>
            <a href="#download-app" className="btn btn-ghost">
              Download App
            </a>
            <Link to="/access?mode=signup&next=/intake" className="btn btn-ghost">
              Start with Vital AI
            </Link>
          </div>
        </div>

        <div className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#6d5ba8", letterSpacing: ".12em", textTransform: "uppercase" }}>
            Download App
          </div>
          <div className="h2" style={{ marginTop: 10 }}>
            Continue on mobile when you are ready
          </div>
          <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7 }}>
            Keep this step lightweight. Browse publicly now, then download the Vitality Institute app for follow-up, messages, labs, and visit management after your account is active.
          </div>
          <div className="surface-light-helper" style={{ marginTop: 12, fontSize: 13 }}>
            App download links can be connected later without changing this public entry flow.
          </div>
        </div>
      </div>

      <div className="space" />

      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
        <div className="card card-pad card-light surface-light" style={{ flex: "1 1 220px" }}>
          <div className="h2">Trusted workflow</div>
          <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7 }}>
            Booking, intake, and follow-up stay connected once you become a patient.
          </div>
        </div>
        <div className="card card-pad card-light surface-light" style={{ flex: "1 1 220px" }}>
          <div className="h2">Premium experience</div>
          <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7 }}>
            Clear service discovery, polished booking flow, and clinical-grade next steps.
          </div>
        </div>
        <div className="card card-pad card-light surface-light" style={{ flex: "1 1 220px" }}>
          <div className="h2">Provider-led care</div>
          <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7 }}>
            When review is required, the platform keeps the path structured instead of confusing.
          </div>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad">
        <div className="h2">Featured Categories</div>
        <div className="muted" style={{ marginTop: 4 }}>Explore the clinic’s major service lines and pricing programs.</div>
        <div className="space" />
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          {PUBLIC_SERVICE_GROUPS.map((title) => (
            <div key={title} className="card card-pad card-light surface-light" style={{ flex: "1 1 220px", minWidth: 220 }}>
              <div className="h2">{title}</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7 }}>
                Explore pricing, program structure, and the right starting point for this care path.
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad">
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div className="h2">Featured Services</div>
            <div className="muted" style={{ marginTop: 4 }}>
              {loading ? "Loading services..." : "A quick look at some of the care pathways available."}
            </div>
          </div>
          <Link to="/services" className="btn btn-ghost">
            View All Services
          </Link>
        </div>

        <div className="space" />

        <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
          {services.map((service) => (
            <Link
              key={service.slug}
              to={`/services/${service.slug}`}
              className="card card-pad service-card"
              style={{
                flex: "1 1 280px",
                minWidth: 260,
                textDecoration: "none",
                background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))",
              }}
            >
              <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#C8B6FF", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
                    {service.category}
                  </div>
                  <div className="h2" style={{ marginTop: 8 }}>
                    {service.title}
                  </div>
                </div>
                <div className="v-chip">{service.price}</div>
              </div>
              <div style={{ marginTop: 10, lineHeight: 1.7, color: "rgba(255,255,255,0.9)" }}>
                {service.summary}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="space" />

      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
        <div className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
          <div className="h2">Why choose Vitality</div>
          <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
            Personalized care, physician oversight, and clear next steps are presented upfront so patients understand the value before ever logging in.
          </div>
        </div>
        <div className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
          <div className="h2">How it works</div>
          <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
            1. Explore services and program pricing.
            <br />
            2. Choose a preferred appointment time.
            <br />
            3. Sign in only when you are ready to confirm.
          </div>
        </div>
        <div id="download-app" className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
          <div className="h2">Download the app later</div>
          <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
            After your account is active, the app becomes your home for messages, labs, visit updates, and direct access to your care team.
          </div>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad">
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="h2">Contact and Location</div>
            <div className="muted" style={{ marginTop: 4 }}>
              Phone, email, hours, and scheduling support are available before sign-in.
            </div>
          </div>
          <Link to="/contact" className="btn btn-ghost">
            Contact Us
          </Link>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light">
        <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 320px" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#6d5ba8", letterSpacing: ".12em", textTransform: "uppercase" }}>
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
