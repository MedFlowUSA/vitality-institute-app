import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";

export default function PublicContact() {
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get("serviceId");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(serviceId ? "service_question" : "booking_help");
  const [message, setMessage] = useState("");

  const bookingLink = useMemo(() => {
    return serviceId ? `/book?interest=${encodeURIComponent(serviceId)}` : "/book";
  }, [serviceId]);

  return (
    <PublicSiteLayout title="Contact the Clinic" subtitle="Reach the Vitality team for service questions, scheduling help, or next-step guidance.">
      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
        <div className="card card-pad card-light surface-light" style={{ flex: "1 1 340px" }}>
          <div className="h2">Clinic Contact</div>
          <div className="surface-light-body" style={{ marginTop: 12, lineHeight: 1.8 }}>
            Vitality Institute of Redlands
            <br />
            Phone: 909-500-4572
            <br />
            Email: hello@vitalityinstitute.com
            <br />
            Address: 1250 Vitality Avenue, Suite 200, Redlands, CA 92373
            <br />
            Hours: Monday to Friday, 10:00 AM to 4:00 PM
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

      <div className="space" />

      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
        <div className="card card-pad" style={{ flex: "1 1 460px" }}>
          <div className="h2">Inquiry Form</div>
          <div className="muted" style={{ marginTop: 6 }}>
            This lightweight form is a placeholder for a future secure inquiry workflow. For now, use it to organize your question before calling or emailing the clinic.
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <input className="input" style={{ flex: "1 1 220px" }} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input" style={{ flex: "1 1 260px" }} placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="space" />

          <select className="input" value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="booking_help">Booking help</option>
            <option value="service_question">Service question</option>
            <option value="general_contact">General contact</option>
          </select>

          <div className="space" />

          <textarea
            className="input"
            style={{ width: "100%", minHeight: 120 }}
            placeholder="How can the clinic help?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <div className="space" />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <a
              className="btn btn-primary"
              href={`mailto:hello@vitalityinstitute.com?subject=${encodeURIComponent(
                `Vitality Inquiry: ${topic.replaceAll("_", " ")}`
              )}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`)}`}
            >
              Email the Clinic
            </a>
            <a className="btn btn-ghost" href="tel:+19095004572">
              Call the Clinic
            </a>
          </div>
        </div>

        <div className="card card-pad card-light surface-light" style={{ flex: "1 1 320px" }}>
          <div className="h2">Location Blocks</div>
          <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.8 }}>
            Redlands
            <br />
            1250 Vitality Avenue, Suite 200
            <br />
            Monday to Friday, 10:00 AM to 4:00 PM
          </div>
          <div className="surface-light-helper" style={{ marginTop: 12 }}>
            More locations can be added here later without changing the public funnel structure.
          </div>
        </div>
      </div>
    </PublicSiteLayout>
  );
}
