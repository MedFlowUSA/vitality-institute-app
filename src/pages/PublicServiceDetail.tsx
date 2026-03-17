import { Link, useParams } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import { getPublicOfferingBySlug } from "../lib/publicMarketingCatalog";

export default function PublicServiceDetail() {
  const { slug } = useParams();
  const service = getPublicOfferingBySlug(slug);

  return (
    <PublicSiteLayout
      title={service?.title ?? "Service Detail"}
      subtitle="Review treatment details, then either start booking or contact the clinic for help."
      rightAction={
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link to="/services" className="btn btn-ghost">
            Back to Services
          </Link>
          {service ? (
            <Link to={`/book?interest=${encodeURIComponent(service.slug)}`} className="btn btn-primary">
              Book Now
            </Link>
          ) : null}
        </div>
      }
    >
      {!service ? (
        <div className="card card-pad">
          <div className="h2">Service not found</div>
          <div className="muted" style={{ marginTop: 6 }}>
            The public service offering may have changed or been removed.
          </div>
        </div>
      ) : (
        <>
          <div
            className="card card-pad"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(245,241,255,0.94))",
            }}
          >
            <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 12, color: "#C8B6FF", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
                  {service.category}
                </div>
                <div className="h1" style={{ marginTop: 10 }}>
                  {service.title}
                </div>
                <div style={{ marginTop: 10, lineHeight: 1.7, maxWidth: 760, color: "#334155" }}>
                  {service.summary}
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  <div className="v-chip">{service.category}</div>
                  {service.duration ? <div className="v-chip">{service.duration}</div> : null}
                  <div className="v-chip">Medical evaluation may determine eligibility</div>
                </div>
              </div>
              <div className="v-chip">
                <strong>{service.price}</strong>
              </div>
            </div>

            <div className="space" />

            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <Link to={`/book?interest=${encodeURIComponent(service.slug)}`} className="btn btn-primary">
                Book Appointment
              </Link>
              <Link to={`/contact?serviceId=${encodeURIComponent(service.slug)}`} className="btn btn-ghost">
                Contact Us
              </Link>
              <Link to="/vital-ai" className="btn btn-ghost">
                Start with Vital AI
              </Link>
            </div>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 14, flexWrap: "wrap", alignItems: "stretch" }}>
            <div className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
              <div className="h2">Overview</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
                {service.overview}
              </div>
            </div>

            <div className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
              <div className="h2">Ideal For</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
                {service.idealFor}
              </div>
            </div>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 14, flexWrap: "wrap", alignItems: "stretch" }}>
            <div className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
              <div className="h2">Service Details</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
                {service.serviceDetails}
              </div>
            </div>

            <div className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
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
              <div className="card card-pad card-light surface-light">
                <div className="h2">FAQ / Notes</div>
                <div className="space" />
                {service.faqNotes.map((note) => (
                  <div key={note} className="surface-light-body" style={{ marginBottom: 10, lineHeight: 1.75 }}>
                    • {note}
                  </div>
                ))}
              </div>
              <div className="space" />
            </>
          ) : null}

          <div className="card card-pad">
            <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div className="h2">Ready to move forward?</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  Start booking now, contact the clinic, or begin with a guided Vital AI intake.
                </div>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <Link to={`/book?interest=${encodeURIComponent(service.slug)}`} className="btn btn-primary">
                  Book Appointment
                </Link>
                <Link to={`/contact?serviceId=${encodeURIComponent(service.slug)}`} className="btn btn-ghost">
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
