import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import {
  categoryAccent,
  categoryIcon,
  loadCatalogServices,
  priceLabel,
  serviceSlug,
  serviceDisplayKey,
  shortBlurb,
  type CatalogService,
} from "../lib/services/catalog";

export default function PublicLanding() {
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { services: rows } = await loadCatalogServices();
        if (!cancelled) setServices(rows.slice(0, 6));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PublicSiteLayout
      title="Care that feels polished before you even sign in"
      subtitle="Explore services, request an appointment, and start your booking flow before creating an account."
      rightAction={
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link to="/services" className="btn btn-ghost">
            Explore Services
          </Link>
          <Link to="/book" className="btn btn-primary">
            Book Appointment
          </Link>
        </div>
      }
    >
      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
        <div className="card card-pad" style={{ flex: "1 1 520px" }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#C8B6FF", letterSpacing: ".12em", textTransform: "uppercase" }}>
            Public Access
          </div>
          <div className="h1" style={{ marginTop: 10 }}>
            Start with services, not a login wall
          </div>
          <div className="muted" style={{ marginTop: 10, lineHeight: 1.7, maxWidth: 760 }}>
            Browse treatments, compare pricing where available, and choose a preferred appointment time. We only ask you to sign in when you are ready to confirm the booking.
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
              Patient Login
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
        <div className="muted" style={{ marginTop: 4 }}>
          Explore the most common ways patients begin with Vitality Institute.
        </div>
        <div className="space" />
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          {[
            ["Consultations", "Clinical guidance and next-step planning."],
            ["Wellness", "Metabolic, energy, and whole-body optimization."],
            ["Wound Care", "Structured wound evaluation and follow-up support."],
            ["Injectables", "Provider-guided aesthetic and injectable care."],
          ].map(([title, copy]) => (
            <div key={title} className="card card-pad card-light surface-light" style={{ flex: "1 1 220px", minWidth: 220 }}>
              <div className="h2">{title}</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7 }}>
                {copy}
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
              key={service.id}
              to={`/services/${serviceSlug(service)}`}
              className="card card-pad service-card"
              style={{
                flex: "1 1 280px",
                minWidth: 260,
                textDecoration: "none",
                background: `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)), ${categoryAccent(serviceDisplayKey(service))}`,
              }}
            >
              <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#C8B6FF", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
                    {categoryIcon(serviceDisplayKey(service))}
                  </div>
                  <div className="h2" style={{ marginTop: 8 }}>
                    {service.name}
                  </div>
                </div>
                {priceLabel(service) ? <div className="v-chip">{priceLabel(service)}</div> : null}
              </div>
              <div className="muted" style={{ marginTop: 10, lineHeight: 1.7 }}>
                {shortBlurb(service)}
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
            Vitality Institute pairs a premium patient experience with practical clinical workflows, so services feel approachable before login and organized after you become a patient.
          </div>
        </div>
        <div className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
          <div className="h2">How it works</div>
          <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
            1. Explore services.
            <br />
            2. Pick a preferred appointment time.
            <br />
            3. Sign in only when you are ready to confirm.
          </div>
        </div>
        <div id="download-app" className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
          <div className="h2">Download the app later</div>
          <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
            After your account is active, the app becomes your home for messages, labs, follow-up, and visit visibility without changing this public entry flow.
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
            <a href="tel:+15555550147" className="h2" style={{ display: "inline-block", marginTop: 8, textDecoration: "none", color: "#140f24" }}>
              (555) 555-0147
            </a>

            <div className="surface-light-helper" style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", marginTop: 16 }}>
              Hours
            </div>
            <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.8 }}>
              Monday to Friday
              <br />
              8:00 AM to 5:00 PM
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
