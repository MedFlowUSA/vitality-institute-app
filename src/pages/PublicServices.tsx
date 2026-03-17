import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import { PUBLIC_OFFERINGS, PUBLIC_SERVICE_GROUPS } from "../lib/publicMarketingCatalog";

export default function PublicServices() {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const grouped = useMemo(() => {
    const map = new Map<string, typeof PUBLIC_OFFERINGS>();
    const source = activeCategory === "all" ? PUBLIC_OFFERINGS : PUBLIC_OFFERINGS.filter((service) => service.category === activeCategory);
    for (const service of source) {
      const key = service.category;
      const rows = map.get(key) ?? [];
      rows.push(service);
      map.set(key, rows);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, rows]) => ({ key, label: key, rows }));
  }, [activeCategory]);

  return (
    <PublicSiteLayout title="Services" subtitle="Browse treatment options, pricing where available, and the right next step for each care path.">
      <div className="card card-pad">
        <div className="h2">Available Services</div>
        <div className="muted" style={{ marginTop: 4 }}>
          {`${PUBLIC_OFFERINGS.length} public offerings currently shown across consultations, programs, bundles, and add-ons.`}
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad">
        <div className="h2">Filter by Category</div>
        <div className="space" />
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button type="button" className={activeCategory === "all" ? "btn btn-primary" : "btn btn-ghost"} onClick={() => setActiveCategory("all")}>
            All
          </button>
          {PUBLIC_SERVICE_GROUPS.map((category) => (
            <button
              key={category}
              type="button"
              className={activeCategory === category ? "btn btn-primary" : "btn btn-ghost"}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="space" />

      {grouped.map((group) => (
          <div key={group.key} className="card card-pad" style={{ marginBottom: 14 }}>
            <div className="h2">{group.label}</div>
            <div className="space" />
            <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
              {group.rows.map((service) => (
                <div
                  key={service.slug}
                  className="card card-pad service-card"
                  style={{
                    flex: "1 1 300px",
                    minWidth: 260,
                    background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))",
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#C8B6FF", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
                        {service.category}
                      </div>
                      <div className="h2" style={{ marginTop: 8 }}>{service.title}</div>
                    </div>
                    <div className="v-chip">{service.price}</div>
                  </div>
                  <div style={{ marginTop: 10, lineHeight: 1.7, color: "rgba(255,255,255,0.9)" }}>
                    {service.summary}
                  </div>
                  <div className="muted" style={{ marginTop: 12, fontSize: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {service.duration ? <span>{service.duration}</span> : <span>Program or package pricing</span>}
                  </div>
                  <div className="space" />
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <Link to={`/services/${service.slug}`} className="btn btn-ghost">
                      View Details
                    </Link>
                    <Link to={`/book?interest=${encodeURIComponent(service.slug)}`} className="btn btn-primary">
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
