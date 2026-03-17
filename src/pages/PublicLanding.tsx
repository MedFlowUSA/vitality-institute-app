import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import {
  categoryAccent,
  categoryIcon,
  loadCatalogServices,
  priceLabel,
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
            Book Now
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

          <div className="space" />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link to="/book" className="btn btn-primary">
              Start Booking
            </Link>
            <Link to="/contact" className="btn btn-ghost">
              Contact the Clinic
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
              to={`/services/${service.id}`}
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
    </PublicSiteLayout>
  );
}
