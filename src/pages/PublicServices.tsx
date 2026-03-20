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
    <PublicSiteLayout title="Services" subtitle="Browse provider-led consultations, programs, and advanced therapies.">
      <div className="card card-pad card-light surface-light">
        <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ flex: "1 1 440px" }}>
            <div className="h2">Explore Services</div>
            <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75, maxWidth: 720 }}>
              Browse by category, compare care paths, and choose the next step that fits you best.
            </div>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link to="/book" className="btn btn-primary">
              Request Visit
            </Link>
            <Link to="/vital-ai" className="btn btn-ghost">
              Start with Vital AI
            </Link>
          </div>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 460px" }}>
            <div className="h2">Wound care should start with clinical routing</div>
            <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
              If you are dealing with slow healing, drainage, infection concern, or a worsening wound, start with Vital AI so the clinic can review urgency early.
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Link to="/vital-ai" className="btn btn-primary">
              Start Wound Review
            </Link>
            <Link to="/contact" className="btn btn-ghost">
              Contact the Clinic
            </Link>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="row" style={{ justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div className="h2">Filter by Category</div>
            <div className="muted" style={{ marginTop: 4 }}>Tap a category to narrow the list.</div>
          </div>
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
      </div>

      <div className="space" />

      {grouped.map((group) => (
        <div key={group.key} className="card card-pad" style={{ marginBottom: 14 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div className="h2">{group.label}</div>
              <div className="muted" style={{ marginTop: 4 }}>
                {group.rows.length} offering{group.rows.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>
          <div className="space" />
          <div style={{ display: "grid", gap: 12 }}>
            {group.rows.map((service) => (
              <div
                key={service.slug}
                className="card card-pad service-card"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(245,241,255,0.94))",
                }}
              >
                <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 320px" }}>
                    <div style={{ fontSize: 12, color: "var(--v-helper-dark)", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
                      {service.category}
                    </div>
                    <div className="h2" style={{ marginTop: 8 }}>{service.title}</div>
                    <div style={{ marginTop: 8, lineHeight: 1.65, color: "#334155" }}>
                      {service.summary}
                    </div>
                  </div>
                  <div className="v-chip">{service.price}</div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                  <Link to={`/services/${service.slug}`} className="btn btn-ghost">
                    View Details
                  </Link>
                  <Link to={`/book?interest=${encodeURIComponent(service.slug)}`} className="btn btn-primary">
                    Request Visit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="card card-pad card-light surface-light">
        <div className="row" style={{ justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 420px" }}>
            <div className="h2">Not sure which service fits best?</div>
            <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
              Start with Vital AI if you want guided intake before choosing a final service.
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Link to="/vital-ai" className="btn btn-primary">
              Start with Vital AI
            </Link>
            <Link to="/book" className="btn btn-ghost">
              Request Visit
            </Link>
          </div>
        </div>
      </div>
    </PublicSiteLayout>
  );
}
