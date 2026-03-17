import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";

export default function PublicContact() {
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get("serviceId");

  const bookingLink = useMemo(() => {
    return serviceId ? `/book?serviceId=${encodeURIComponent(serviceId)}` : "/book";
  }, [serviceId]);

  return (
    <PublicSiteLayout title="Contact the Clinic" subtitle="Reach the Vitality team for service questions, scheduling help, or next-step guidance.">
      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
        <div className="card card-pad card-light surface-light" style={{ flex: "1 1 340px" }}>
          <div className="h2">Clinic Contact</div>
          <div className="surface-light-body" style={{ marginTop: 12, lineHeight: 1.8 }}>
            Phone: (555) 555-0147
            <br />
            Email: hello@vitalityinstitute.com
            <br />
            Hours: Monday to Friday, 8:00 AM to 5:00 PM
          </div>
        </div>

        <div className="card card-pad" style={{ flex: "1 1 420px" }}>
          <div className="h2">Need help deciding?</div>
          <div className="muted" style={{ marginTop: 10, lineHeight: 1.7 }}>
            If you are not sure which service fits best, start a booking request or contact the clinic. The team can help route you to the right consultation, wellness service, or follow-up step.
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link to={bookingLink} className="btn btn-primary">
              Start Booking
            </Link>
            <Link to="/services" className="btn btn-ghost">
              Browse Services
            </Link>
          </div>
        </div>
      </div>
    </PublicSiteLayout>
  );
}
