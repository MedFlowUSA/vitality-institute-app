import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import { PUBLIC_OFFERINGS, PUBLIC_SERVICE_GROUPS, getPublicOfferingPrimaryCta, getPublicOfferingVitalAiPath } from "../lib/publicMarketingCatalog";

function normalizeCategory(value: string | null) {
  if (!value || value === "all") return "all";
  return PUBLIC_SERVICE_GROUPS.includes(value) ? value : "all";
}

function parseOpenGroups(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((group) => group.trim())
    .filter((group) => PUBLIC_SERVICE_GROUPS.includes(group));
}

function buildDetailQuery(params: URLSearchParams, slug: string) {
  const next = new URLSearchParams();
  const category = params.get("category");
  const query = params.get("q");
  const open = params.get("open");

  if (category && category !== "all") next.set("category", category);
  if (query) next.set("q", query);
  if (open) next.set("open", open);

  const encoded = next.toString();
  return encoded ? `/services/${slug}?${encoded}` : `/services/${slug}`;
}

function appendReturnTo(path: string, returnTo: string) {
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}returnTo=${encodeURIComponent(returnTo)}`;
}

export default function PublicServices() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = useMemo(() => normalizeCategory(searchParams.get("category")), [searchParams]);
  const searchTerm = searchParams.get("q") ?? "";
  const [openGroups, setOpenGroups] = useState<string[]>(() => parseOpenGroups(searchParams.get("open")));

  useEffect(() => {
    setOpenGroups(parseOpenGroups(searchParams.get("open")));
  }, [searchParams]);

  useEffect(() => {
    if (activeCategory !== "all") return;
    if (searchParams.get("open")) return;
    const defaultGroup = searchTerm.trim() ? [] : [PUBLIC_SERVICE_GROUPS[0]];
    setOpenGroups(defaultGroup);
  }, [activeCategory, searchParams, searchTerm]);

  function updateParams(next: { category?: string; q?: string; open?: string[] }) {
    const params = new URLSearchParams(searchParams);

    if (next.category !== undefined) {
      if (!next.category || next.category === "all") params.delete("category");
      else params.set("category", next.category);
    }

    if (next.q !== undefined) {
      const trimmed = next.q.trim();
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
    }

    if (next.open !== undefined) {
      if (!next.open.length || (next.category ?? activeCategory) !== "all") params.delete("open");
      else params.set("open", next.open.join(","));
    }

    setSearchParams(params, { replace: true });
  }

  function toggleGroup(group: string) {
    const nextOpen = openGroups.includes(group) ? openGroups.filter((entry) => entry !== group) : [...openGroups, group];
    setOpenGroups(nextOpen);
    updateParams({ open: nextOpen });
  }

  const grouped = useMemo(() => {
    const map = new Map<string, typeof PUBLIC_OFFERINGS>();
    const normalizedQuery = searchTerm.trim().toLowerCase();
    const source = (activeCategory === "all" ? PUBLIC_OFFERINGS : PUBLIC_OFFERINGS.filter((service) => service.category === activeCategory)).filter((service) => {
      if (!normalizedQuery) return true;
      const haystack = [service.title, service.category, service.summary, service.price, service.overview, service.idealFor].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    for (const service of source) {
      const key = service.category;
      const rows = map.get(key) ?? [];
      rows.push(service);
      map.set(key, rows);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, rows]) => ({ key, label: key, rows }));
  }, [activeCategory, searchTerm]);

  const visibleCategoryCount = grouped.length;
  const visibleServiceCount = useMemo(() => grouped.reduce((count, group) => count + group.rows.length, 0), [grouped]);

  const visibleOpenGroups = useMemo(() => {
    return openGroups.filter((group) => grouped.some((entry) => entry.key === group));
  }, [grouped, openGroups]);

  const compareGroups = useMemo(() => {
    const supportedGroups = ["GLP-1 Weight Optimization", "Hormone Optimization"];
    return supportedGroups
      .map((category) => ({
        category,
        services: PUBLIC_OFFERINGS.filter((service) => service.category === category),
      }))
      .filter((group) => group.services.length >= 2);
  }, []);
  const currentServicesPath = useMemo(() => {
    const encoded = searchParams.toString();
    return encoded ? `/services?${encoded}` : "/services";
  }, [searchParams]);

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
            <Link to="/vital-ai" className="btn btn-secondary">
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
            <Link to="/contact" className="btn btn-secondary">
              Contact the Clinic
            </Link>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="row" style={{ justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div className="h2">Browse by Category</div>
            <div className="muted" style={{ marginTop: 4 }}>
              Search, filter, and keep your place while you explore.
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className={activeCategory === "all" ? "btn btn-primary" : "btn btn-secondary"} onClick={() => updateParams({ category: "all", open: visibleOpenGroups })}>
              All
            </button>
            {PUBLIC_SERVICE_GROUPS.map((category) => (
              <button
                key={category}
                type="button"
                className={activeCategory === category ? "btn btn-primary" : "btn btn-secondary"}
                onClick={() => updateParams({ category, open: [] })}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="space" />

        <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 320px" }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Search services</div>
            <input
              className="input"
              type="search"
              value={searchTerm}
              onChange={(event) => updateParams({ q: event.target.value })}
              placeholder="Search by service, concern, category, or price"
            />
          </div>
          {(searchTerm || activeCategory !== "all") ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => updateParams({ category: "all", q: "", open: [] })}
            >
              Clear Filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="space" />

      <div className="surface-light-helper" style={{ marginBottom: 12, lineHeight: 1.7 }}>
        Showing {visibleServiceCount} service option{visibleServiceCount === 1 ? "" : "s"} across {visibleCategoryCount} categor{visibleCategoryCount === 1 ? "y" : "ies"}.
      </div>

      {compareGroups.length ? (
        <>
          <div className="card card-pad card-light surface-light">
            <div className="h2">Compare plan tiers at a glance</div>
            <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
              If you are comparing similar plans, start here before opening each detail page.
            </div>
            <div className="space" />
            <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
              {compareGroups.map((group) => (
                <div key={group.category} className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
                  <div className="h2">{group.category}</div>
                  <div className="space" />
                  <div style={{ display: "grid", gap: 10 }}>
                    {group.services.map((service) => (
                      <div key={service.slug} style={{ borderTop: "1px solid rgba(184,164,255,0.16)", paddingTop: 10 }}>
                        <div style={{ fontWeight: 800, color: "#1F1633" }}>{service.title}</div>
                        <div className="surface-light-helper" style={{ marginTop: 4 }}>{service.price}</div>
                        {service.duration ? (
                          <div className="surface-light-helper" style={{ marginTop: 4 }}>Typical visit timing: {service.duration}</div>
                        ) : null}
                        <div className="surface-light-body" style={{ marginTop: 6, lineHeight: 1.7 }}>{service.summary}</div>
                        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                          <Link to={buildDetailQuery(searchParams, service.slug)} className="btn btn-secondary">
                            View Details
                          </Link>
                          <Link to={appendReturnTo(getPublicOfferingPrimaryCta(service).to, currentServicesPath)} className="btn btn-primary">
                            {getPublicOfferingPrimaryCta(service).label}
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space" />
        </>
      ) : null}

      {!grouped.length ? (
        <div className="card card-pad card-light surface-light" style={{ marginBottom: 14 }}>
          <div className="h2">No services match that search yet</div>
          <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
            Try a broader phrase, switch categories, or start with Vital AI if you want help narrowing the right care path.
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <button type="button" className="btn btn-secondary" onClick={() => updateParams({ category: "all", q: "", open: [] })}>
              Reset Search
            </button>
            <Link to="/vital-ai" className="btn btn-primary">
              Start with Vital AI
            </Link>
          </div>
        </div>
      ) : null}

      {grouped.map((group) => (
        <details
          key={group.key}
          className="card card-pad"
          style={{ marginBottom: 14 }}
          open={activeCategory === "all" ? visibleOpenGroups.includes(group.label) : true}
        >
          <summary
            style={{
              cursor: "pointer",
              listStyle: "none",
            }}
            onClick={(event) => {
              if (activeCategory !== "all") return;
              event.preventDefault();
              toggleGroup(group.label);
            }}
          >
            <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div className="h2">{group.label}</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {group.rows.length} offering{group.rows.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="v-chip">
                {activeCategory === "all" ? (visibleOpenGroups.includes(group.label) ? "Tap to collapse" : "Tap to expand") : "Category view"}
              </div>
            </div>
          </summary>

          <div className="space" />

          <div style={{ display: "grid", gap: 10 }}>
            {group.rows.map((service) => {
              const primaryCta = getPublicOfferingPrimaryCta(service);
              const vitalAiPath = getPublicOfferingVitalAiPath(service);
              return (
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
                  <Link to={buildDetailQuery(searchParams, service.slug)} className="btn btn-secondary">
                    View Details
                  </Link>
                  <Link to={appendReturnTo(primaryCta.to, currentServicesPath)} className="btn btn-primary">
                    {primaryCta.label}
                  </Link>
                  <Link to={appendReturnTo(vitalAiPath, currentServicesPath)} className="btn btn-secondary">
                    Start with Vital AI
                  </Link>
                </div>
              </div>
              );
            })}
          </div>
        </details>
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
            <Link to={appendReturnTo("/vital-ai", currentServicesPath)} className="btn btn-primary">
              Start with Vital AI
            </Link>
            <Link to={appendReturnTo("/book", currentServicesPath)} className="btn btn-secondary">
              Request Visit
            </Link>
          </div>
        </div>
      </div>
    </PublicSiteLayout>
  );
}
