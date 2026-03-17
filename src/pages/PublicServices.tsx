import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import {
  categoryAccent,
  categoryLabel,
  loadCatalogServices,
  priceLabel,
  pricingUnitLabel,
  serviceDisplayKey,
  shortBlurb,
  type CatalogService,
} from "../lib/services/catalog";

export default function PublicServices() {
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
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load services.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogService[]>();
    for (const service of services) {
      const key = serviceDisplayKey(service);
      const rows = map.get(key) ?? [];
      rows.push(service);
      map.set(key, rows);
    }
    return Array.from(map.entries())
      .sort((a, b) => categoryLabel(a[0]).localeCompare(categoryLabel(b[0])))
      .map(([key, rows]) => ({ key, label: categoryLabel(key), rows }));
  }, [services]);

  return (
    <PublicSiteLayout title="Services" subtitle="Browse treatment options, pricing where available, and the right next step for each care path.">
      <div className="card card-pad">
        <div className="h2">Available Services</div>
        <div className="muted" style={{ marginTop: 4 }}>
          {loading ? "Loading services..." : `${services.length} services currently available to explore.`}
        </div>
        {error ? (
          <>
            <div className="space" />
            <div style={{ color: "#fecaca" }}>{error}</div>
          </>
        ) : null}
      </div>

      <div className="space" />

      {!loading &&
        !error &&
        grouped.map((group) => (
          <div key={group.key} className="card card-pad" style={{ marginBottom: 14 }}>
            <div className="h2">{group.label}</div>
            <div className="space" />
            <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
              {group.rows.map((service) => (
                <Link
                  key={service.id}
                  to={`/services/${service.id}`}
                  className="card card-pad service-card"
                  style={{
                    flex: "1 1 300px",
                    minWidth: 260,
                    textDecoration: "none",
                    background: `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)), ${categoryAccent(serviceDisplayKey(service))}`,
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <div className="h2">{service.name}</div>
                    {priceLabel(service) ? <div className="v-chip">{priceLabel(service)}</div> : null}
                  </div>
                  <div className="muted" style={{ marginTop: 10, lineHeight: 1.7 }}>
                    {shortBlurb(service)}
                  </div>
                  <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>
                    {pricingUnitLabel(service.pricing_unit)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
    </PublicSiteLayout>
  );
}
