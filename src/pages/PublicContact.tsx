import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PublicLocationCard from "../components/public/PublicLocationCard";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import { PUBLIC_CLINIC_LOCATIONS } from "../lib/publicClinicLocations";
import { supabase } from "../lib/supabase";

export default function PublicContact() {
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get("serviceId");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] = useState("email");
  const [topic, setTopic] = useState(serviceId ? "service_question" : "booking_help");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const bookingLink = useMemo(() => {
    return serviceId ? `/book?interest=${encodeURIComponent(serviceId)}` : "/book";
  }, [serviceId]);
  async function submitInquiry() {
    setSubmitError(null);

    if (!name.trim()) {
      setSubmitError("Enter your name.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setSubmitError("Enter an email or phone number so the clinic can reach you.");
      return;
    }
    if (!message.trim()) {
      setSubmitError("Enter your message.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("contact_inquiries").insert([
        {
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          preferred_contact_method: preferredContactMethod,
          reason_for_inquiry: topic,
          message: message.trim(),
          status: "new",
          source: serviceId ? "public_contact_form_service" : "public_contact_form",
        },
      ]);

      if (error) throw error;

      setSubmitted(true);
      setName("");
      setPhone("");
      setEmail("");
      setMessage("");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Unable to submit your inquiry right now.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicSiteLayout title="Contact the Clinic" subtitle="Reach the Vitality team for service questions, scheduling help, or next-step guidance.">
      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
        <div className="card card-pad card-light surface-light public-panel" style={{ flex: "1 1 340px" }}>
          <div className="h2">Clinic Contact</div>
          <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.8 }}>
            Reach either clinic directly. Use the inquiry form if you want help choosing the right service or location first.
          </div>
          <div className="space" />
          <div style={{ display: "grid", gap: 14 }}>
            {PUBLIC_CLINIC_LOCATIONS.map((location, index) => (
              <PublicLocationCard
                key={location.name}
                location={location}
                eyebrow={index === 0 ? "Primary Location" : "Second Location"}
                compact
              />
            ))}
          </div>
        </div>

        <div className="card card-pad card-light surface-light public-panel" style={{ flex: "1 1 420px" }}>
          <div className="h2">Need help deciding?</div>
          <div className="surface-light-helper" style={{ marginTop: 10, lineHeight: 1.7 }}>
            If you are not sure which service fits best, start a booking request or contact the clinic. The team can help route you to the right consultation, wellness service, or follow-up step.
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link to={bookingLink} className="btn btn-primary">
              Start Booking
            </Link>
            <Link to="/services" className="btn btn-secondary">
              Browse Services
            </Link>
          </div>
        </div>
      </div>

      <div className="space" />

      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
        <div className="card card-pad card-light surface-light public-panel" style={{ flex: "1 1 460px" }}>
          <div className="h2">Inquiry Form</div>
          <div className="surface-light-helper" style={{ marginTop: 6 }}>
            Send a real inquiry to the clinic and we will follow up using your preferred contact method.
          </div>

          <div className="space" />

          {submitted ? (
            <div className="card card-pad card-light surface-light public-panel-nested">
              <div className="h2">Inquiry sent</div>
              <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.75 }}>
                Your message has been sent to the Vitality team. The team can follow up by {preferredContactMethod === "either" ? "phone or email" : preferredContactMethod}.
              </div>
            </div>
          ) : null}

          {submitError ? <div className="public-error-text" style={{ marginBottom: 12 }}>{submitError}</div> : null}

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <input className="input" style={{ flex: "1 1 220px" }} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input" style={{ flex: "1 1 220px" }} placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="input" style={{ flex: "1 1 260px" }} placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="space" />

          <select className="input" value={preferredContactMethod} onChange={(e) => setPreferredContactMethod(e.target.value)}>
            <option value="email">Prefer email</option>
            <option value="phone">Prefer phone</option>
            <option value="either">Either is fine</option>
          </select>

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
            <button className="btn btn-primary" type="button" onClick={submitInquiry} disabled={submitting}>
              {submitting ? "Sending..." : "Send Inquiry"}
            </button>
            <a className="btn btn-secondary" href="tel:+12139126838">
              Call the Clinic
            </a>
          </div>
        </div>

        <div className="card card-pad card-light surface-light public-panel" style={{ flex: "1 1 320px" }}>
          <div className="h2">Locations at a Glance</div>
          <div style={{ display: "grid", gap: 14, marginTop: 10 }}>
            {PUBLIC_CLINIC_LOCATIONS.map((location) => (
              <div key={location.name} className="card card-pad card-light surface-light public-panel-nested">
                <div className="public-mini-title">
                  {location.name}
                </div>
                <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.8 }}>
                  {location.cityStateZip}
                  <br />
                  {location.hoursLabel}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PublicSiteLayout>
  );
}
