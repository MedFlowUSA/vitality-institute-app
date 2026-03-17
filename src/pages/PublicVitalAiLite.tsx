import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import {
  buildPublicVitalAiSummary,
  getPathwayQuestions,
  getPublicVitalAiPathway,
  PUBLIC_VITAL_AI_PATHWAYS,
  type PublicVitalAiAnswers,
  type PublicVitalAiPathway,
} from "../lib/publicVitalAiLite";
import { supabase } from "../lib/supabase";
import { loadCatalogLocations, type CatalogLocation } from "../lib/services/catalog";

type StepKey = "pathway" | "questions" | "contact" | "review" | "success";

const CONTACT_METHODS = [
  { value: "email", label: "Prefer email" },
  { value: "phone", label: "Prefer phone" },
  { value: "either", label: "Either is fine" },
] as const;

export default function PublicVitalAiLite() {
  const [step, setStep] = useState<StepKey>("pathway");
  const [pathway, setPathway] = useState<PublicVitalAiPathway>("wound_care");
  const [answers, setAnswers] = useState<PublicVitalAiAnswers>({});
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] = useState<"phone" | "email" | "either">("email");
  const [preferredLocationId, setPreferredLocationId] = useState("");
  const [locations, setLocations] = useState<CatalogLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const pathwayDef = useMemo(() => getPublicVitalAiPathway(pathway), [pathway]);
  const questions = useMemo(() => getPathwayQuestions(pathway), [pathway]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const rows = await loadCatalogLocations();
        if (cancelled) return;
        setLocations(rows);
        if (!preferredLocationId && rows[0]?.id) setPreferredLocationId(rows[0].id);
      } finally {
        if (!cancelled) setLoadingLocations(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [preferredLocationId]);

  function updateAnswer(key: keyof PublicVitalAiAnswers, value: string) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function validateQuestions() {
    for (const question of questions) {
      if (!question.required) continue;
      const value = answers[question.key];
      if (!value || !String(value).trim()) {
        setSubmitError(`Please answer: ${question.label}`);
        return false;
      }
    }
    return true;
  }

  function validateContact() {
    if (!firstName.trim()) return "Enter a first name.";
    if (!lastName.trim()) return "Enter a last name.";
    if (!email.trim() && !phone.trim()) return "Enter an email or phone number so the clinic can reach you.";
    return null;
  }

  async function submitLiteIntake() {
    const contactError = validateContact();
    if (!validateQuestions()) return;
    if (contactError) {
      setSubmitError(contactError);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const summary = buildPublicVitalAiSummary(pathway, answers);
      const { data, error } = await supabase
        .from("public_vital_ai_submissions")
        .insert([
          {
            pathway,
            status: "new",
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: phone.trim() || null,
            email: email.trim() || null,
            preferred_contact_method: preferredContactMethod,
            preferred_location_id: preferredLocationId || null,
            answers_json: answers,
            summary,
            source: "public_vital_ai_lite",
          },
        ])
        .select("id")
        .single();

      if (error) throw error;
      setSubmissionId((data as { id: string } | null)?.id ?? null);
      setStep("success");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Unable to submit Vital AI right now.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicSiteLayout
      title="Start with Vital AI"
      subtitle="Use a short guided pre-intake so the clinic can review your concern and help route the right next step."
      backFallbackTo="/"
    >
      <div className="card card-pad card-light surface-light">
        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: "var(--v-helper-dark)",
            letterSpacing: ".12em",
            textTransform: "uppercase",
          }}
        >
          Vital AI Lite
        </div>
        <div className="h1" style={{ marginTop: 10 }}>
          A lightweight way to begin with real clinic follow-up
        </div>
        <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75, maxWidth: 760 }}>
          This short pre-intake helps Vitality Institute understand what you need before a callback, booking step, or deeper intake.
          It is informational only and does not provide diagnosis or treatment decisions.
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light">
        <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div className="h2" style={{ margin: 0 }}>
            Step progress
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {[
              ["pathway", "Pathway"],
              ["questions", "Questions"],
              ["contact", "Contact"],
              ["review", "Review"],
              ["success", "Done"],
            ].map(([key, label]) => (
              <div
                key={key}
                className="v-chip"
                style={{
                  opacity: step === key ? 1 : 0.72,
                  background: step === key ? "rgba(124,58,237,0.14)" : undefined,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space" />

      {submitError ? (
        <>
          <div className="card card-pad card-light surface-light" style={{ color: "#991b1b" }}>
            {submitError}
          </div>
          <div className="space" />
        </>
      ) : null}

      {step === "pathway" ? (
        <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
          <div className="card card-pad card-light surface-light" style={{ flex: "1 1 380px" }}>
            <div className="h2">Choose a care direction</div>
            <div className="surface-light-helper" style={{ marginTop: 6 }}>
              Start with the option that best matches what you want help with.
            </div>
            <div className="space" />
            <div style={{ display: "grid", gap: 10 }}>
              {PUBLIC_VITAL_AI_PATHWAYS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={pathway === option.key ? "btn btn-primary" : "btn btn-ghost"}
                  style={{ justifyContent: "flex-start", minHeight: 56 }}
                  onClick={() => setPathway(option.key)}
                >
                  {option.title}
                </button>
              ))}
            </div>
          </div>

          <div className="card card-pad card-light surface-light" style={{ flex: "1 1 360px" }}>
            <div className="h2">{pathwayDef.title}</div>
            <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.8 }}>
              {pathwayDef.subtitle}
            </div>
            <div className="surface-light-helper" style={{ marginTop: 12 }}>
              {pathwayDef.purpose}
            </div>

            <div className="space" />

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setSubmitError(null);
                  setStep("questions");
                }}
              >
                Continue
              </button>
              <Link to="/book" className="btn btn-ghost">
                Book Instead
              </Link>
              <Link to="/contact" className="btn btn-ghost">
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {step === "questions" ? (
        <div className="card card-pad card-light surface-light">
          <div className="h2">{pathwayDef.title}</div>
          <div className="surface-light-helper" style={{ marginTop: 6 }}>
            Keep this brief. The clinic can ask for more detail later if needed.
          </div>
          <div className="space" />
          <div style={{ display: "grid", gap: 14 }}>
            {questions.map((question) => (
              <div key={question.key}>
                <div className="surface-light-helper" style={{ fontSize: 12, marginBottom: 6 }}>
                  {question.label}
                </div>
                {question.type === "textarea" ? (
                  <textarea
                    className="input"
                    style={{ width: "100%", minHeight: 110 }}
                    value={answers[question.key] ?? ""}
                    onChange={(e) => updateAnswer(question.key, e.target.value)}
                    placeholder={question.placeholder}
                  />
                ) : question.type === "select" ? (
                  <select className="input" value={answers[question.key] ?? ""} onChange={(e) => updateAnswer(question.key, e.target.value)}>
                    <option value="">Select...</option>
                    {question.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    type={question.type === "number" ? "number" : "text"}
                    value={answers[question.key] ?? ""}
                    onChange={(e) => updateAnswer(question.key, e.target.value)}
                    placeholder={question.placeholder}
                  />
                )}
                {question.helper ? (
                  <div className="surface-light-helper" style={{ marginTop: 6 }}>
                    {question.helper}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="space" />
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-ghost" onClick={() => setStep("pathway")}>
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setSubmitError(null);
                if (!validateQuestions()) return;
                setStep("contact");
              }}
            >
              Continue to Contact Info
            </button>
          </div>
        </div>
      ) : null}

      {step === "contact" ? (
        <div className="card card-pad card-light surface-light">
          <div className="h2">Contact details</div>
          <div className="surface-light-helper" style={{ marginTop: 6 }}>
            The clinic will use this to follow up on your request.
          </div>
          <div className="space" />
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <input className="input" style={{ flex: "1 1 220px" }} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <input className="input" style={{ flex: "1 1 220px" }} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <input className="input" style={{ flex: "1 1 220px" }} placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="input" style={{ flex: "1 1 260px" }} placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space" />
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px" }}>
              <div className="surface-light-helper" style={{ fontSize: 12, marginBottom: 6 }}>
                Preferred contact method
              </div>
              <select className="input" value={preferredContactMethod} onChange={(e) => setPreferredContactMethod(e.target.value as "phone" | "email" | "either")}>
                {CONTACT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: "1 1 240px" }}>
              <div className="surface-light-helper" style={{ fontSize: 12, marginBottom: 6 }}>
                Preferred location
              </div>
              <select className="input" value={preferredLocationId} onChange={(e) => setPreferredLocationId(e.target.value)} disabled={loadingLocations}>
                <option value="">Select...</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name ?? location.id}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space" />
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-ghost" onClick={() => setStep("questions")}>
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setSubmitError(null);
                const error = validateContact();
                if (error) {
                  setSubmitError(error);
                  return;
                }
                setStep("review");
              }}
            >
              Continue to Review
            </button>
          </div>
        </div>
      ) : null}

      {step === "review" ? (
        <div className="card card-pad card-light surface-light">
          <div className="h2">Review your Vital AI Lite request</div>
          <div className="surface-light-helper" style={{ marginTop: 6 }}>
            Review the basics before submitting. The clinic will use this for intake guidance and provider prep.
          </div>
          <div className="space" />
          <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
            <div className="card card-pad" style={{ flex: "1 1 320px" }}>
              <div className="h2">Pathway</div>
              <div className="space" />
              <div>{pathwayDef.title}</div>
              <div className="surface-light-helper" style={{ marginTop: 6 }}>{pathwayDef.subtitle}</div>
            </div>
            <div className="card card-pad" style={{ flex: "1 1 320px" }}>
              <div className="h2">Contact</div>
              <div className="space" />
              <div>{firstName} {lastName}</div>
              <div>{email || "-"}</div>
              <div>{phone || "-"}</div>
              <div className="surface-light-helper" style={{ marginTop: 6 }}>
                Contact by {preferredContactMethod}. Location: {locations.find((location) => location.id === preferredLocationId)?.name ?? "Not provided"}.
              </div>
            </div>
          </div>
          <div className="space" />
          <div className="card card-pad">
            <div className="h2">Your answers</div>
            <div className="space" />
            <div style={{ display: "grid", gap: 12 }}>
              {questions.map((question) => (
                <div key={question.key}>
                  <div className="surface-light-helper" style={{ fontSize: 12 }}>{question.label}</div>
                  <div style={{ marginTop: 4, lineHeight: 1.7 }}>
                    {question.options?.find((option) => option.value === answers[question.key])?.label ?? answers[question.key] ?? "Not answered"}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space" />
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-ghost" onClick={() => setStep("contact")}>
              Back
            </button>
            <button type="button" className="btn btn-primary" onClick={submitLiteIntake} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Vital AI Lite"}
            </button>
          </div>
        </div>
      ) : null}

      {step === "success" ? (
        <div className="card card-pad card-light surface-light">
          <div className="h2">Request received</div>
          <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.8 }}>
            {pathwayDef.successNote} A team member can follow up by {preferredContactMethod === "either" ? "phone or email" : preferredContactMethod}.
          </div>
          <div className="surface-light-helper" style={{ marginTop: 12 }}>
            Reference: {submissionId ?? "submitted"}. Final recommendations and treatment decisions are always determined by medical evaluation.
          </div>
          <div className="space" />
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Link to="/book" className="btn btn-primary">
              Continue to Booking
            </Link>
            <Link to="/contact" className="btn btn-ghost">
              Contact the Clinic
            </Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setAnswers({});
                setFirstName("");
                setLastName("");
                setPhone("");
                setEmail("");
                setPreferredContactMethod("email");
                setStep("pathway");
                setSubmissionId(null);
                setSubmitError(null);
              }}
            >
              Start Another
            </button>
          </div>
        </div>
      ) : null}

      <div className="space" />

      <div className="card card-pad card-light surface-light">
        <div className="h2">What happens next?</div>
        <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.8 }}>
          1. Choose a care direction and answer a few short questions.
          <br />
          2. Send your contact details so the clinic can review your request.
          <br />
          3. The team can follow up, help with booking, or guide the next intake step based on clinical review.
        </div>
      </div>
    </PublicSiteLayout>
  );
}
