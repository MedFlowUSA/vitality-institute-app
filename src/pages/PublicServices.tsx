import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import {
  categoryAccent,
  categoryLabel,
  loadCatalogServices,
  priceLabel,
  pricingUnitLabel,
  serviceSlug,
  serviceDisplayKey,
  shortBlurb,
  type CatalogService,
} from "../lib/services/catalog";

export default function PublicServices() {
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

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
    const source = activeCategory === "all" ? services : services.filter((service) => serviceDisplayKey(service) === activeCategory);
    for (const service of source) {
      const key = serviceDisplayKey(service);
      const rows = map.get(key) ?? [];
      rows.push(service);
      map.set(key, rows);
    }
    return Array.from(map.entries())
      .sort((a, b) => categoryLabel(a[0]).localeCompare(categoryLabel(b[0])))
      .map(([key, rows]) => ({ key, label: categoryLabel(key), rows }));
  }, [activeCategory, services]);

  const categories = useMemo(() => {
    return Array.from(new Set(services.map((service) => serviceDisplayKey(service)))).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));
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

      {!loading && !error ? (
        <>
          <div className="card card-pad">
            <div className="h2">Filter by Category</div>
            <div className="space" />
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button type="button" className={activeCategory === "all" ? "btn btn-primary" : "btn btn-ghost"} onClick={() => setActiveCategory("all")}>
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={activeCategory === category ? "btn btn-primary" : "btn btn-ghost"}
                  onClick={() => setActiveCategory(category)}
                >
                  {categoryLabel(category)}
                </button>
              ))}
            </div>
          </div>
          <div className="space" />
        </>
      ) : null}

      {!loading &&
        !error &&
        grouped.map((group) => (
          <div key={group.key} className="card card-pad" style={{ marginBottom: 14 }}>
            <div className="h2">{group.label}</div>
            <div className="space" />
            <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
              {group.rows.map((service) => (
                <div
                  key={service.id}
                  className="card card-pad service-card"
                  style={{
                    flex: "1 1 300px",
                    minWidth: 260,
                    background: `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)), ${categoryAccent(serviceDisplayKey(service))}`,
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#C8B6FF", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
                        {categoryLabel(serviceDisplayKey(service))}
                      </div>
                      <div className="h2" style={{ marginTop: 8 }}>{service.name}</div>
                    </div>
                    {priceLabel(service) ? <div className="v-chip">{priceLabel(service)}</div> : null}
                  </div>
                  <div className="muted" style={{ marginTop: 10, lineHeight: 1.7 }}>
                    {shortBlurb(service)}
                  </div>
                  <div className="muted" style={{ marginTop: 12, fontSize: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span>{pricingUnitLabel(service.pricing_unit)}</span>
                    {service.duration_minutes ? <span>{service.duration_minutes} min</span> : null}
                  </div>
                  <div className="space" />
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <Link to={`/services/${serviceSlug(service)}`} className="btn btn-ghost">
                      View Details
                    </Link>
                    <Link to={`/book?serviceId=${encodeURIComponent(service.id)}`} className="btn btn-primary">
                      Book Now
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
    </PublicSiteLayout>
  );
}
