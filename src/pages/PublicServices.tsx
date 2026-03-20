import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import { PUBLIC_OFFERINGS, PUBLIC_SERVICE_GROUPS } from "../lib/publicMarketingCatalog";

export default function PublicServices() {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const featuredGroups = useMemo(() => {
    return [
      {
        title: "Request Visit",
        body: "Choose this if you already know the service or consultation you want to pursue.",
        to: "/book",
        label: "Request Visit",
        variant: "primary" as const,
      },
      {
        title: "Start with Vital AI",
        body: "Use a guided pre-intake if you want help being routed before scheduling is finalized.",
        to: "/vital-ai",
        label: "Start with Vital AI",
        variant: "ghost" as const,
      },
      {
        title: "Wound Care Review",
        body: "For drainage, infection concern, slow healing, or higher-acuity wound issues, start with clinical context first.",
        to: "/vital-ai",
        label: "Start Wound Review",
        variant: "ghost" as const,
      },
    ];
  }, []);

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
    <PublicSiteLayout title="Services" subtitle="Browse consultations, programs, and advanced therapies with clearer public next steps.">
      <div className="card card-pad card-light surface-light">
        <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ flex: "1 1 440px" }}>
            <div className="h2">Choose the right starting path</div>
            <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75, maxWidth: 720 }}>
              Browse the service list if you want to compare options, request a visit if you already know what you need, or start with Vital AI if you want guidance before scheduling is confirmed.
            </div>
            <div className="surface-light-helper" style={{ marginTop: 10 }}>
              {`${PUBLIC_OFFERINGS.length} public offerings are currently shown across consultations, monthly programs, bundles, and add-ons.`}
            </div>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link to="/book" className="btn btn-primary">
              Request Visit
            </Link>
            <Link to="/vital-ai" className="btn btn-ghost">
              Start with Vital AI
            </Link>
            <Link to="/login" className="btn btn-ghost">
              Sign In
            </Link>
          </div>
        </div>
      </div>

      <div className="space" />

      <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
        {featuredGroups.map((item) => (
          <div key={item.title} className="card card-pad card-light surface-light" style={{ flex: "1 1 240px" }}>
            <div className="h2">{item.title}</div>
            <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
              {item.body}
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <Link to={item.to} className={item.variant === "primary" ? "btn btn-primary" : "btn btn-ghost"}>
                {item.label}
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 460px" }}>
            <div className="h2">Wound care should start with clinical routing</div>
            <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
              If you are dealing with slow healing, drainage, infection concern, or a worsening wound, start with Vital AI so the clinic can review urgency and decide whether faster follow-up or provider review is needed.
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
            <div className="muted" style={{ marginTop: 4 }}>
              Scan by care type, then choose whether to view details or request a visit.
            </div>
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
              {group.label === "Medical Consultations" ? (
                <div className="v-chip">Good starting point for new patients</div>
              ) : null}
            </div>
            <div className="space" />
            <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
              {group.rows.map((service) => (
                <div
                  key={service.slug}
                  className="card card-pad service-card"
                  style={{
                    flex: "1 1 300px",
                    minWidth: 260,
                    background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(245,241,255,0.94))",
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--v-helper-dark)", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
                        {service.category}
                      </div>
                      <div className="h2" style={{ marginTop: 8 }}>{service.title}</div>
                    </div>
                    <div className="v-chip">{service.price}</div>
                  </div>
                  <div style={{ marginTop: 10, lineHeight: 1.7, color: "#334155" }}>
                    {service.summary}
                  </div>
                  <div className="surface-light-helper" style={{ marginTop: 10, lineHeight: 1.65 }}>
                    {service.duration
                      ? `Typical timing: ${service.duration}`
                      : "Program structure, exact timing, and treatment fit are finalized after clinic review."}
                  </div>
                  <div className="muted" style={{ marginTop: 12, fontSize: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span>{group.label === "Medical Consultations" ? "Consult-first path" : "Clinic review may be required"}</span>
                  </div>
                  <div className="space" />
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
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
              Start with Vital AI if you want the clinic to review your concern before scheduling is finalized. This is especially helpful for wound care, more complex medical questions, or when you are comparing multiple care paths.
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
