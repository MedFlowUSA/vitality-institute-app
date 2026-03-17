import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";

const START_OPTIONS = [
  {
    key: "weight",
    label: "Weight and metabolic support",
    summary: "Explore GLP-1 or broader metabolic support options.",
    bookTo: "/book?interest=glp1-weight-optimization-consultation",
  },
  {
    key: "hormones",
    label: "Hormone optimization",
    summary: "Start with men’s or women’s hormone support guidance.",
    bookTo: "/book?interest=testosterone-optimization-consultation",
  },
  {
    key: "aesthetics",
    label: "Aesthetics or Botox",
    summary: "Explore cosmetic consultations and treatment planning.",
    bookTo: "/book?interest=botox-consultation",
  },
  {
    key: "unsure",
    label: "I am not sure where to start",
    summary: "Use guided routing to choose between booking, contact, or intake.",
    bookTo: "/contact",
  },
];

export default function PublicVitalAiStart() {
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState<string>("weight");

  const selected = useMemo(() => START_OPTIONS.find((option) => option.key === selectedKey) ?? START_OPTIONS[0], [selectedKey]);

  return (
    <PublicSiteLayout
      title="Start with Vital AI"
      subtitle="Not sure where to start? Use a lightweight guided entry point to choose the best next step."
      backFallbackTo="/"
    >
      <div className="card card-pad">
        <div style={{ fontSize: 12, fontWeight: 900, color: "#C8B6FF", letterSpacing: ".12em", textTransform: "uppercase" }}>
          Guided Start
        </div>
        <div className="h1" style={{ marginTop: 10 }}>
          A simple way to begin without guessing
        </div>
        <div style={{ marginTop: 10, color: "rgba(255,255,255,0.92)", lineHeight: 1.75, maxWidth: 760 }}>
          Vital AI can help route you toward booking, contacting the clinic, or starting a guided intake path. This step is informational and does not provide diagnosis or treatment decisions.
        </div>
      </div>

      <div className="space" />

      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
        <div className="card card-pad" style={{ flex: "1 1 380px" }}>
          <div className="h2">What are you mainly looking for?</div>
          <div className="space" />
          <div style={{ display: "grid", gap: 10 }}>
            {START_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={selectedKey === option.key ? "btn btn-primary" : "btn btn-ghost"}
                style={{ justifyContent: "flex-start", minHeight: 56 }}
                onClick={() => setSelectedKey(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card card-pad card-light surface-light" style={{ flex: "1 1 360px" }}>
          <div className="h2">{selected.label}</div>
          <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.8 }}>
            {selected.summary}
          </div>
          <div className="surface-light-helper" style={{ marginTop: 12 }}>
            You can still change direction after you speak with the clinic or complete a consultation.
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={() => navigate(selected.bookTo)}>
              Continue
            </button>
            <Link to="/services" className="btn btn-ghost">
              Explore Services
            </Link>
            <Link to="/contact" className="btn btn-ghost">
              Contact Us
            </Link>
          </div>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light">
        <div className="h2">What happens next?</div>
        <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.8 }}>
          1. Choose the general care direction that fits best.
          <br />
          2. Move into booking, contact, or account-based intake when you are ready.
          <br />
          3. Final treatment eligibility and recommendations are always determined by medical evaluation.
        </div>
      </div>
    </PublicSiteLayout>
  );
}
