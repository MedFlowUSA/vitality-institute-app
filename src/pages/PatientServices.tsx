import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import VitalityHero from "../components/VitalityHero";

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  service_group: string | null;
  location_id: string | null;
  requires_consult: boolean | null;
  pricing_unit: string | null;
  duration_minutes: number | null;
  visit_type: string | null;
  price_marketing_cents: number | null;
  price_regular_cents: number | null;
  is_active?: boolean | null;
};

function fmtMoney(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return null;
  const n = Number(cents);
  if (Number.isNaN(n)) return null;
  return `$${(n / 100).toFixed(2)}`;
}

function categoryLabel(v: string | null) {
  if (!v) return "Other";

  const normalized = v.toLowerCase();

  if (normalized === "iv_drip") return "IV Therapy";
  if (normalized === "neuromodulator") return "Injectables";
  if (normalized === "consult") return "Consultations";
  if (normalized === "glp1") return "GLP-1";
  if (normalized === "hrt") return "Hormone Therapy";
  if (normalized === "trt") return "TRT";
  if (normalized === "wound_care") return "Wound Care";
  if (normalized === "peptides") return "Peptides";
  if (normalized === "botox") return "Botox";

  return v.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function categoryIcon(cat: string | null) {
  switch (cat) {
    case "iv_therapy":
    case "iv_drip":
      return "💧";
    case "injectables":
    case "neuromodulator":
    case "botox":
      return "💉";
    case "wound_care":
      return "🩹";
    case "hormone_therapy":
    case "hrt":
    case "trt":
      return "⚕️";
    case "wellness":
    case "peptides":
    case "glp1":
      return "✨";
    default:
      return "🧬";
  }
}

function categoryEmoji(cat: string | null) {
  return categoryIcon(cat);
}

function serviceDisplayKey(service: ServiceRow) {
  return service.category ?? service.service_group ?? "other";
}

function categoryAccent(cat: string | null) {
  switch (cat) {
    case "iv_therapy":
    case "iv_drip":
      return "rgba(56,189,248,0.22)";
    case "injectables":
    case "neuromodulator":
    case "botox":
      return "rgba(244,114,182,0.22)";
    case "wound_care":
      return "rgba(34,197,94,0.22)";
    case "hormone_therapy":
    case "hrt":
    case "trt":
      return "rgba(59,130,246,0.22)";
    case "wellness":
    case "peptides":
    case "glp1":
      return "rgba(250,204,21,0.22)";
    case "consult":
      return "rgba(168,85,247,0.22)";
    default:
      return "rgba(148,163,184,0.22)";
  }
}

function priceLabel(service: ServiceRow) {
  return fmtMoney(service.price_marketing_cents) ?? fmtMoney(service.price_regular_cents);
}

function pricingUnitLabel(unit: string | null) {
  if (!unit) return "Starting price";
  if (unit === "per_session") return "Per session";
  if (unit === "per_unit") return "Per unit";
  if (unit === "flat") return "Flat rate";
  return unit.replaceAll("_", " ");
}

function estimatedTiming(service: ServiceRow) {
  if (service.duration_minutes) return `${service.duration_minutes} min`;
  if (service.requires_consult) return "Consultation Based";

  const name = service.name.toLowerCase();
  const cat = (service.category ?? service.service_group ?? "").toLowerCase();

  if (name.includes("iv") || cat.includes("iv")) return "30-60 min";
  if (name.includes("botox") || cat.includes("neuromodulator") || cat.includes("aesthetic")) return "15-45 min";
  if (name.includes("wound") || cat.includes("wound")) return "30-60 min";
  if (name.includes("hormone") || name.includes("hrt") || cat.includes("hormone")) return "45-60 min";
  if (name.includes("weight") || name.includes("glp")) return "30-45 min";

  return "Varies by treatment";
}

function shortBlurb(service: ServiceRow) {
  if (service.description?.trim()) return service.description.trim();
  return "Personalized care options designed to support your goals and overall health.";
}

function idealFor(service: ServiceRow) {
  const key = serviceDisplayKey(service);

  switch (key) {
    case "iv_therapy":
    case "iv_drip":
      return "Hydration support, recovery, energy, and wellness optimization.";
    case "injectables":
    case "neuromodulator":
    case "botox":
      return "Targeted aesthetic goals with provider-guided treatment planning.";
    case "wound_care":
      return "Patients needing expert wound evaluation, treatment, and follow-up.";
    case "hormone_therapy":
    case "hrt":
    case "trt":
      return "Hormonal symptom evaluation and tailored management.";
    case "wellness":
    case "peptides":
    case "glp1":
      return "Patients seeking metabolic, peptide, or broader wellness support.";
    case "consult":
      return "Patients who need an initial evaluation before starting treatment.";
    default:
      return "Patients seeking individualized treatment recommendations.";
  }
}

export default function PatientServices() {
  const { activeLocationId, signOut } = useAuth();
  const navigate = useNavigate();

  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showAllLocations, setShowAllLocations] = useState(true);
  const [selectedService, setSelectedService] = useState<ServiceRow | null>(null);

  const visibleServices = useMemo(() => {
    return services.filter((s) => {
      if (!showAllLocations && activeLocationId) {
        if (s.location_id && s.location_id !== activeLocationId) return false;
      }
      return true;
    });
  }, [services, showAllLocations, activeLocationId]);

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceRow[]>();

    for (const service of visibleServices) {
      const key = service.category ?? service.service_group ?? "other";
      const arr = map.get(key) ?? [];
      arr.push(service);
      map.set(key, arr);
    }

    return Array.from(map.entries())
      .sort((a, b) => categoryLabel(a[0]).localeCompare(categoryLabel(b[0])))
      .map(([key, rows]) => ({
        key,
        label: categoryLabel(key),
        rows: rows.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [visibleServices]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);

      try {
        const selectCols =
          "id,name,description,category,service_group,location_id,requires_consult,pricing_unit,duration_minutes,visit_type,price_marketing_cents,price_regular_cents";

        // First attempt: patient-facing display layer
        const displayRes = await supabase
          .from("services_display")
          .select(selectCols)
          .order("category")
          .order("name");

        if (!displayRes.error && displayRes.data) {
          setServices((displayRes.data as ServiceRow[]) ?? []);
          return;
        }

        // Fallback: raw services table
        const rawRes = await supabase
          .from("services")
          .select(
            "id,name,description,category,service_group,location_id,requires_consult,pricing_unit,duration_minutes,visit_type,price_marketing_cents,price_regular_cents,is_active"
          )
          .eq("is_active", true)
          .order("category")
          .order("name");

        if (rawRes.error) {
          throw rawRes.error;
        }

        setServices((rawRes.data as ServiceRow[]) ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load services.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const scrollToCategory = (key: string) => {
    const el = document.getElementById(`svc-cat-${key}`);
    if (!el) return;

    const offset = 120; // space for header
    const y = el.getBoundingClientRect().top + window.pageYOffset - offset;

    window.scrollTo({
      top: y,
      behavior: "smooth",
    });
  };

  const handoffToBooking = (service: ServiceRow) => {
    navigate(
      `/patient/home?serviceId=${service.id}` +
        `&serviceName=${encodeURIComponent(service.name)}` +
        `&category=${encodeURIComponent(serviceDisplayKey(service))}` +
        `&consult=${service.requires_consult ? "1" : "0"}` +
        `&price=${service.price_marketing_cents ?? service.price_regular_cents ?? ""}`
    );
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Vitality Institute"
          subtitle="Explore personalized treatments, compare options, and choose the right next step with confidence."
          secondaryCta={{ label: "Back", to: "/patient" }}
          rightActions={
            <button className="btn btn-secondary" onClick={signOut} type="button">
              Sign out
            </button>
          }
          showKpis={false}
        />

        <div className="space" />

        <div className="card card-pad">
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#CFC3F5", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Vitality Treatment Guide
                </div>
                <div className="h2" style={{ marginTop: 8 }}>Services & Pricing</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  Explore consultations, injectables, IV therapy, wound care, and wellness services. Open any card to review details or continue to booking.
                </div>
              </div>

            <button
              type="button"
              className={showAllLocations ? "btn btn-secondary" : "btn btn-primary"}
              onClick={() => setShowAllLocations((v) => !v)}
            >
              {showAllLocations ? "Show My Location" : "Show All Locations"}
            </button>
          </div>

          <div className="space" />

          {loading && <div className="muted">Loading services…</div>}
          {err && <div style={{ color: "crimson" }}>{err}</div>}

          {!loading && !err && (
            <>
              <div className="muted" style={{ marginBottom: 12, fontSize: 12 }}>
                Showing <strong>{visibleServices.length}</strong> of <strong>{services.length}</strong> available services
                {activeLocationId && !showAllLocations ? " for your selected location" : " across Vitality Institute"}
              </div>

              {grouped.length > 0 && (
                <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                  {grouped.map((group) => (
                    <button
                      key={group.key}
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(200,182,255,0.18)",
                        color: "#F8FAFC",
                      }}
                      onClick={() => scrollToCategory(group.key)}
                    >
                      {categoryEmoji(group.key)} {group.label} ({group.rows.length})
                    </button>
                  ))}
                </div>
              )}

              {grouped.length === 0 ? (
                <div className="muted">No services are available right now. Please check back soon or contact the Vitality team for help with scheduling.</div>
              ) : (
                grouped.map((group) => (
                  <div key={group.key} id={`svc-cat-${group.key}`} style={{ marginBottom: 24 }}>
                    <div className="h2" style={{ marginBottom: 12 }}>
                      {group.label}
                    </div>
                    <div className="space" />

                    <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                      {group.rows.map((service) => {
                        const marketing = fmtMoney(service.price_marketing_cents);
                        const regular = fmtMoney(service.price_regular_cents);
                        const hasPricing = !!marketing || !!regular;

                        return (
                          <div
                            key={service.id}
                            className="card card-pad service-card"
                            role="button"
                            tabIndex={0}
                            style={{
                              flex: "1 1 320px",
                              minWidth: 280,
                              background: `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)), ${categoryAccent(serviceDisplayKey(service))}`,
                              border: "1px solid rgba(255,255,255,0.10)",
                              transition: "all 0.25s ease",
                              cursor: "pointer",
                            }}
                            onClick={() => setSelectedService(service)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedService(service);
                              }
                            }}
                          >
                            <div
                              className="row"
                              style={{
                                justifyContent: "space-between",
                                gap: 10,
                                alignItems: "flex-start",
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div className="h2" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: 20 }}>
                                    {categoryIcon(serviceDisplayKey(service))}
                                  </span>
                                  {service.name}
                                </div>

                                {(serviceDisplayKey(service) === "iv_drip" || serviceDisplayKey(service) === "iv_therapy") && (
                                  <div
                                    style={{
                                      marginTop: 6,
                                      fontSize: 11,
                                      padding: "4px 10px",
                                      borderRadius: 999,
                                      background: "rgba(139,92,246,0.15)",
                                      border: "1px solid rgba(139,92,246,0.35)",
                                      display: "inline-block",
                                    }}
                                  >
                                    Popular Treatment
                                  </div>
                                )}

                                <div style={{ marginTop: 6 }}>
                                  {service.requires_consult ? (
                                    <div className="v-chip">Provider Review Required</div>
                                  ) : (
                                    <div className="v-chip">Bookable Online</div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {service.description ? (
                              <>
                                <div className="space" />
                                <div className="muted" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                                  {service.description}
                                </div>
                              </>
                            ) : null}

                            <div className="space" />

                            <div style={{ fontSize: 12, color: "#E9DFFF", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>
                              Ideal For
                            </div>
                            <div style={{ marginTop: 8, lineHeight: 1.65, color: "rgba(248,250,252,0.92)" }}>
                              {idealFor(service)}
                            </div>

                            <div className="space" />

                            {hasPricing ? (
                              <div>
                                <div
                                  style={{
                                    fontSize: 26,
                                    fontWeight: 900,
                                    lineHeight: 1.1,
                                  }}
                                >
                                  {marketing ?? regular}
                                </div>

                                <div
                                  className="muted"
                                  style={{
                                    marginTop: 4,
                                    fontSize: 12,
                                  }}
                                >
                                  {pricingUnitLabel(service.pricing_unit)}
                                </div>
                              </div>
                            ) : (
                              <div className="muted">Consultation required for pricing.</div>
                            )}

                            <div className="muted" style={{ marginTop: 10, fontSize: 11 }}>
                              {service.location_id ? "Location-specific service" : "Available across locations"} • {estimatedTiming(service)}
                            </div>

                            <div className="space" />

                            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                              <button
                                className="btn btn-primary"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handoffToBooking(service);
                                }}
                              >
                                Book Visit
                              </button>

                              <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedService(service);
                                }}
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {selectedService ? (
          <>
            <div
              onClick={() => setSelectedService(null)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.45)",
                backdropFilter: "blur(4px)",
                zIndex: 80,
              }}
            />

            <div
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                width: "min(520px, 92vw)",
                height: "100vh",
                background: "linear-gradient(180deg, rgba(18,14,32,0.98), rgba(14,11,25,0.98))",
                borderLeft: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "-20px 0 50px rgba(0,0,0,0.35)",
                zIndex: 81,
                overflowY: "auto",
                padding: 24,
              }}
            >
              <div
                className="row"
                style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}
              >
                <div>
                  <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 22,
                        background: categoryAccent(serviceDisplayKey(selectedService)),
                      }}
                    >
                      {categoryEmoji(serviceDisplayKey(selectedService))}
                    </div>

                    <div>
                      <div className="h2" style={{ margin: 0, color: "#F8FAFC" }}>
                        {selectedService.name}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 13, color: "rgba(226,232,240,0.82)" }}>
                        {categoryLabel(serviceDisplayKey(selectedService))}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setSelectedService(null)}
                >
                  Close
                </button>
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <div className="v-chip">{estimatedTiming(selectedService)}</div>
                <div className="v-chip">
                  {selectedService.requires_consult ? "Provider Review Required" : "Bookable Online"}
                </div>
                <div className="v-chip">
                  {selectedService.location_id ? "Select Locations" : "Across Locations"}
                </div>
              </div>

              <div className="space" />

              <div
                className="card card-pad card-light surface-light"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.97), rgba(245,241,255,0.94))",
                  border: "1px solid rgba(184,164,255,0.22)",
                }}
              >
                <div className="muted" style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>Pricing</div>
                <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8, color: "#140F24" }}>
                  {priceLabel(selectedService)
                    ? `Starting at ${priceLabel(selectedService)}`
                    : "Consultation required for pricing"}
                </div>
                <div className="surface-light-helper" style={{ marginTop: 8, lineHeight: 1.6 }}>
                  Pricing may vary depending on provider evaluation, treatment customization, and follow-up needs.
                </div>
              </div>

              <div className="space" />

              <div className="card card-pad card-light surface-light">
                <div className="muted" style={{ marginBottom: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>Overview</div>
                <div className="surface-light-body" style={{ lineHeight: 1.7 }}>
                  {shortBlurb(selectedService)}
                </div>
              </div>

              <div className="space" />

              <div className="card card-pad card-light surface-light">
                <div className="muted" style={{ marginBottom: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>Ideal For</div>
                <div className="surface-light-body" style={{ lineHeight: 1.7 }}>
                  {idealFor(selectedService)}
                </div>
              </div>

              <div className="space" />

              <div className="card card-pad card-light surface-light">
                <div className="muted" style={{ marginBottom: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>Service Details</div>
                <div className="surface-light-body" style={{ lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                  {selectedService.description?.trim() ||
                    "Additional details will be reviewed during your consultation and scheduling process."}
                </div>
              </div>

              <div className="space" />

              <div className="card card-pad card-light surface-light">
                <div className="muted" style={{ marginBottom: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>What To Expect</div>
                <div className="surface-light-body" style={{ lineHeight: 1.7 }}>
                  Your care team will review your goals, health history, and treatment needs to determine the most appropriate next step. Certain treatments may require consultation, provider approval, or a custom care plan before treatment is finalized.
                </div>
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => {
                    handoffToBooking(selectedService);
                    setSelectedService(null);
                  }}
                >
                  Book Visit
                </button>

                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setSelectedService(null)}
                >
                  Keep Browsing
                </button>
              </div>

              <div className="space" />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
