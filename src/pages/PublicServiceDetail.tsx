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
  serviceDisplayKey,
  shortBlurb,
  type CatalogService,
} from "../lib/services/catalog";

export default function PublicServiceDetail() {
  const { id } = useParams();
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

  const service = useMemo(() => services.find((row) => row.id === id) ?? null, [services, id]);

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
                Book Now
              </Link>
              <Link to={`/contact?serviceId=${encodeURIComponent(service.id)}`} className="btn btn-ghost">
                Contact the Clinic
              </Link>
            </div>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 14, flexWrap: "wrap", alignItems: "stretch" }}>
            <div className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
              <div className="h2">What this is best for</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7 }}>
                {idealFor(service)}
              </div>
            </div>

            <div className="card card-pad card-light surface-light" style={{ flex: "1 1 260px" }}>
              <div className="h2">Typical timing</div>
              <div className="surface-light-body" style={{ marginTop: 8 }}>{estimatedTiming(service)}</div>
              <div className="surface-light-helper" style={{ marginTop: 8, fontSize: 13 }}>
                Some services may still require provider review before final confirmation.
              </div>
            </div>
          </div>

          {service.description ? (
            <>
              <div className="space" />
              <div className="card card-pad card-light surface-light">
                <div className="h2">About this service</div>
                <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                  {service.description}
                </div>
              </div>
            </>
          ) : null}
        </>
      )}
    </PublicSiteLayout>
  );
}
