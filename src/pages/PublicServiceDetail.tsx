import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import {
  categoryAccent,
  categoryIcon,
  estimatedTiming,
  idealFor,
  loadCatalogServices,
  priceLabel,
  pricingUnitLabel,
  serviceDetails,
  serviceExpectations,
  serviceOverview,
  serviceSlug,
  serviceDisplayKey,
  shortBlurb,
  type CatalogService,
} from "../lib/services/catalog";

export default function PublicServiceDetail() {
  const { slug } = useParams();
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { services: rows } = await loadCatalogServices();
        if (!cancelled) setServices(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load service.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const service = useMemo(() => services.find((row) => serviceSlug(row) === slug) ?? null, [services, slug]);

  return (
    <PublicSiteLayout
      title={service?.name ?? "Service Detail"}
      subtitle="Review treatment details, then either start booking or contact the clinic for help."
      rightAction={
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link to="/services" className="btn btn-ghost">
            Back to Services
          </Link>
          {service ? (
            <Link to={`/book?serviceId=${encodeURIComponent(service.id)}`} className="btn btn-primary">
              Book Now
            </Link>
          ) : null}
        </div>
      }
    >
      {loading ? (
        <div className="card card-pad">
          <div className="muted">Loading service details...</div>
        </div>
      ) : error ? (
        <div className="card card-pad">
          <div style={{ color: "#fecaca" }}>{error}</div>
        </div>
      ) : !service ? (
        <div className="card card-pad">
          <div className="h2">Service not found</div>
          <div className="muted" style={{ marginTop: 6 }}>
            The service may be inactive or unavailable in this environment.
          </div>
        </div>
      ) : (
        <>
          <div
            className="card card-pad"
            style={{
              background: `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)), ${categoryAccent(serviceDisplayKey(service))}`,
            }}
          >
            <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 12, color: "#C8B6FF", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
                  {categoryIcon(serviceDisplayKey(service))}
                </div>
                <div className="h1" style={{ marginTop: 10 }}>
                  {service.name}
                </div>
                <div className="muted" style={{ marginTop: 10, lineHeight: 1.7, maxWidth: 760 }}>
                  {shortBlurb(service)}
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  <div className="v-chip">{serviceDisplayKey(service).replaceAll("_", " ")}</div>
                  <div className="v-chip">{estimatedTiming(service)}</div>
                  {service.requires_consult ? <div className="v-chip">Provider review may apply</div> : null}
                </div>
              </div>
              {priceLabel(service) ? (
                <div className="v-chip">
                  <strong>{priceLabel(service)}</strong> {pricingUnitLabel(service.pricing_unit)}
                </div>
              ) : null}
            </div>

            <div className="space" />

            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <Link to={`/book?serviceId=${encodeURIComponent(service.id)}`} className="btn btn-primary">
                Book Appointment
              </Link>
              <Link to={`/contact?serviceId=${encodeURIComponent(service.id)}`} className="btn btn-ghost">
                Contact Us
              </Link>
              <Link to="/access?mode=signup&next=/intake" className="btn btn-ghost">
                Start with Vital AI
              </Link>
            </div>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 14, flexWrap: "wrap", alignItems: "stretch" }}>
            <div className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
              <div className="h2">Overview</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
                {serviceOverview(service)}
              </div>
            </div>

            <div className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
              <div className="h2">Ideal For</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
                {idealFor(service)}
              </div>
            </div>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 14, flexWrap: "wrap", alignItems: "stretch" }}>
            <div className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
              <div className="h2">Service Details</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
                {serviceDetails(service)}
              </div>
            </div>

            <div className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
              <div className="h2">What To Expect</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
                {serviceExpectations(service)}
              </div>
              <div className="surface-light-helper" style={{ marginTop: 10, fontSize: 13 }}>
                Typical timing: {estimatedTiming(service)}
              </div>
            </div>
          </div>

          <div className="space" />

          <div className="card card-pad">
            <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div className="h2">Ready to move forward?</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  Start booking now, contact the clinic, or begin with a guided Vital AI intake.
                </div>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <Link to={`/book?serviceId=${encodeURIComponent(service.id)}`} className="btn btn-primary">
                  Book Appointment
                </Link>
                <Link to={`/contact?serviceId=${encodeURIComponent(service.id)}`} className="btn btn-ghost">
                  Contact Us
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </PublicSiteLayout>
  );
}
