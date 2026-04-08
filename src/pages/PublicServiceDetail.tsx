import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import { getPublicAccessRoute, getPublicOfferingBySlug, getPublicOfferingPrimaryCta, getPublicOfferingVitalAiPath } from "../lib/publicMarketingCatalog";
import { loadCatalogServices, matchCatalogServiceFromInterest, resolvedPublicPriceLabel, type CatalogService } from "../lib/services/catalog";

export default function PublicServiceDetail() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const service = getPublicOfferingBySlug(slug);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const primaryCta = service ? getPublicOfferingPrimaryCta(service) : null;
  const vitalAiPath = service ? getPublicOfferingVitalAiPath(service) : "/vital-ai";

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await loadCatalogServices();
        if (!cancelled) setCatalogServices(result.services);
      } catch {
        if (!cancelled) setCatalogServices([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const servicesBackTo = useMemo(() => {
    const params = new URLSearchParams();
    const category = searchParams.get("category");
    const query = searchParams.get("q");
    const open = searchParams.get("open");

    if (category && category !== "all") params.set("category", category);
    if (query) params.set("q", query);
    if (open) params.set("open", open);

    const encoded = params.toString();
    return encoded ? `/services?${encoded}` : "/services";
  }, [searchParams]);
  const bookingPath = useMemo(() => {
    if (!service) return `/book?returnTo=${encodeURIComponent(servicesBackTo)}`;
    const base = primaryCta?.to ?? `/book?interest=${encodeURIComponent(service.slug)}`;
    const joiner = base.includes("?") ? "&" : "?";
    return `${base}${joiner}returnTo=${encodeURIComponent(servicesBackTo)}`;
  }, [primaryCta?.to, service, servicesBackTo]);
  const guidedPath = useMemo(() => {
    const joiner = vitalAiPath.includes("?") ? "&" : "?";
    return `${vitalAiPath}${joiner}returnTo=${encodeURIComponent(servicesBackTo)}`;
  }, [servicesBackTo, vitalAiPath]);
  const resolvedPrice = useMemo(() => {
    if (!service) return null;
    const match = matchCatalogServiceFromInterest({
      interest: service.slug,
      offeringTitle: service.title,
      services: catalogServices,
    });
    return resolvedPublicPriceLabel(match?.service, service.price);
  }, [catalogServices, service]);

  return (
    <PublicSiteLayout
      title={service?.title ?? "Service Detail"}
      subtitle="Review the service, then choose the clearest public next step before scheduling is finalized."
      rightAction={
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link to={servicesBackTo} className="btn btn-secondary">
            Back to Services
          </Link>
          {primaryCta ? (
            <Link to={bookingPath} className="btn btn-primary">
              {primaryCta.label}
            </Link>
          ) : null}
          <Link to={getPublicAccessRoute("login")} className="btn btn-secondary">
            Sign In
          </Link>
        </div>
      }
    >
      {!service ? (
        <div className="card card-pad card-light surface-light public-panel">
          <div className="h2">Service not found</div>
          <div className="surface-light-helper" style={{ marginTop: 6 }}>
            The public service offering may have changed or been removed.
          </div>
        </div>
      ) : (
        <>
          <div className="surface-light-helper" style={{ marginBottom: 12, lineHeight: 1.7 }}>
            <Link to="/services" style={{ color: "inherit" }}>Services</Link>
            {" / "}
            <Link to={servicesBackTo} style={{ color: "inherit" }}>{service.category}</Link>
            {" / "}
            <span>{service.title}</span>
          </div>

          <div className="card card-pad card-light surface-light public-panel">
            <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div>
                <div className="public-mini-title">
                  {service.category}
                </div>
                <div className="h1" style={{ marginTop: 10 }}>
                  {service.title}
                </div>
                <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.7, maxWidth: 760 }}>
                  {service.summary}
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  <div className="v-chip">{service.category}</div>
                  {service.duration ? <div className="v-chip">{service.duration}</div> : null}
                  <div className="v-chip">Medical evaluation may determine eligibility</div>
                </div>
              </div>
              <div className="v-chip">
                <strong>{resolvedPrice}</strong>
              </div>
            </div>

            <div className="space" />

            <div className="card card-pad card-light surface-light public-panel-nested" style={{ marginBottom: 14 }}>
              <div className="h2">Choosing the right next step</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
                Request a visit if you are ready to move forward with this service. Start with Vital AI if you want guided routing first, or contact the clinic if you want help deciding.
              </div>
              <div className="surface-light-helper" style={{ marginTop: 10, lineHeight: 1.7 }}>
                Public requests are reviewed by the clinic before scheduling details, treatment fit, and provider follow-up are finalized.
              </div>
            </div>

            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <Link to={bookingPath} className="btn btn-primary">
                {primaryCta?.label ?? "Request Visit"}
              </Link>
              <Link to={`/contact?serviceId=${encodeURIComponent(service.slug)}`} className="btn btn-secondary">
                Contact Us
              </Link>
              <Link to={guidedPath} className="btn btn-secondary">
                Start with Vital AI
              </Link>
            </div>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 14, flexWrap: "wrap", alignItems: "stretch" }}>
            <div className="card card-pad card-light surface-light public-panel-nested" style={{ flex: "1 1 320px" }}>
              <div className="h2">Overview</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
                {service.overview}
              </div>
            </div>

            <div className="card card-pad card-light surface-light public-panel-nested" style={{ flex: "1 1 320px" }}>
              <div className="h2">Ideal For</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
                {service.idealFor}
              </div>
            </div>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 14, flexWrap: "wrap", alignItems: "stretch" }}>
            <div className="card card-pad card-light surface-light public-panel-nested" style={{ flex: "1 1 320px" }}>
              <div className="h2">Service Details</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
                {service.serviceDetails}
              </div>
            </div>

            <div className="card card-pad card-light surface-light public-panel-nested" style={{ flex: "1 1 320px" }}>
              <div className="h2">What To Expect</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
                {service.whatToExpect}
              </div>
              {service.duration ? <div className="surface-light-helper" style={{ marginTop: 10, fontSize: 13 }}>Typical timing: {service.duration}</div> : null}
            </div>
          </div>

          <div className="space" />

          {service.faqNotes.length ? (
            <>
              <div className="card card-pad card-light surface-light public-panel">
                <div className="h2">FAQ / Notes</div>
                <div className="space" />
                {service.faqNotes.map((note) => (
                  <div key={note} className="surface-light-body" style={{ marginBottom: 10, lineHeight: 1.75 }}>
                    {"-"} {note}
                  </div>
                ))}
              </div>
              <div className="space" />
            </>
          ) : null}

          <div className="card card-pad card-light surface-light public-panel">
            <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div className="h2">Ready to move forward?</div>
                <div className="surface-light-helper" style={{ marginTop: 6 }}>
                  Request a visit, contact the clinic, or begin with guided Vital AI intake if you want help being routed first.
                </div>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                 <Link to={bookingPath} className="btn btn-primary">
                   {primaryCta?.label ?? "Request Visit"}
                 </Link>
                 <Link to={guidedPath} className="btn btn-secondary">
                   Start with Vital AI
                 </Link>
                 <Link to={getPublicAccessRoute("login")} className="btn btn-secondary">
                   Sign In
                 </Link>
                 <Link to={`/contact?serviceId=${encodeURIComponent(service.slug)}`} className="btn btn-secondary">
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
