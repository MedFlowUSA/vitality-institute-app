import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth, type AppRole } from "../auth/AuthProvider";
import { trackFunnelEvent } from "../lib/analytics";
import PublicFlowStatusCard from "../components/public/PublicFlowStatusCard";
import { preparePublicVitalAiOutboundPayload } from "../lib/outboundMessagePrep";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import {
  buildPublicVitalAiSummary,
  getPathwayQuestions,
  getPublicVitalAiPathway,
  PUBLIC_VITAL_AI_PATHWAYS,
  type PublicVitalAiAnswers,
  type PublicVitalAiPathway,
} from "../lib/publicVitalAiLite";
import { buildFollowUpMessage } from "../lib/publicFollowUpEngine";
import { readPublicBookingDraft } from "../lib/publicBookingDraft";
import { submitPublicVitalAiRequest } from "../lib/publicVitalAiSubmission";
import { formatCatalogLocationDetails, formatCatalogLocationLabel, loadCatalogLocations, type CatalogLocation } from "../lib/services/catalog";
import { scoreConversionLead } from "../lib/vitalAi/conversionEngine";
import { buildAuthRoute, buildOnboardingRoute, buildPatientIntakePath, sanitizeInternalPath } from "../lib/routeFlow";

type StepKey = "pathway" | "questions" | "contact" | "review" | "success";

const CONTACT_METHODS = [
  { value: "email", label: "Prefer email" },
  { value: "phone", label: "Prefer phone" },
  { value: "either", label: "Either is fine" },
] as const;

function getHomeRouteForRole(role: AppRole | null) {
  if (role === "super_admin" || role === "location_admin") return "/admin";
  if (role && role !== "patient") return "/provider";
  return "/patient/home";
}

export default function PublicVitalAiLite() {
  const { user, role } = useAuth();
  const [searchParams] = useSearchParams();
  const returnTo = sanitizeInternalPath(searchParams.get("returnTo"), "/");
  const [step, setStep] = useState<StepKey>("pathway");
  const bookingDraft = useMemo(() => readPublicBookingDraft(), []);
  const [pathway, setPathway] = useState<PublicVitalAiPathway>(() => {
    const requestedPathway = searchParams.get("pathway");
    if (requestedPathway === "wound_care" || requestedPathway === "glp1_weight_loss" || requestedPathway === "general_consult") {
      return requestedPathway;
    }
    const serviceLabel = `${bookingDraft?.serviceName ?? ""} ${bookingDraft?.notes ?? ""}`.toLowerCase();
    if (serviceLabel.includes("wound")) return "wound_care";
    if (serviceLabel.includes("glp") || serviceLabel.includes("weight")) return "glp1_weight_loss";
    return "wound_care";
  });
  const [answers, setAnswers] = useState<PublicVitalAiAnswers>({});
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] = useState<"phone" | "email" | "either">("email");
  const [preferredLocationId, setPreferredLocationId] = useState(bookingDraft?.locationId ?? "");
  const [locations, setLocations] = useState<CatalogLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const trackedStartRef = useRef(false);

  const pathwayDef = useMemo(() => getPublicVitalAiPathway(pathway), [pathway]);
  const questions = useMemo(() => getPathwayQuestions(pathway), [pathway]);
  const leadMetadata = useMemo(() => scoreConversionLead({ pathway, answers }), [answers, pathway]);
  const fullIntakePath = useMemo(() => buildPatientIntakePath({ pathway, autostart: true }), [pathway]);
  const guestPortalPath = useMemo(() => buildOnboardingRoute({ next: fullIntakePath, handoff: "vital_ai_lite" }), [fullIntakePath]);
  const guestSignupPath = useMemo(() => buildAuthRoute({ mode: "signup", next: guestPortalPath, handoff: "vital_ai_lite" }), [guestPortalPath]);
  const guestLoginPath = useMemo(() => buildAuthRoute({ mode: "login", next: guestPortalPath, handoff: "vital_ai_lite" }), [guestPortalPath]);
  const fullPortalAction = useMemo(() => {
    if (!user?.id) {
      return { label: "Create Account for Full Intake", to: guestSignupPath, variant: "ghost" as const };
    }

    if (role === "patient") {
      return { label: "Open Full Intake", to: fullIntakePath, variant: "ghost" as const };
    }

    return { label: "Return to Dashboard", to: getHomeRouteForRole(role), variant: "ghost" as const };
  }, [fullIntakePath, guestSignupPath, role, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (!email && user.email) {
      setEmail(user.email);
    }

    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const first = typeof metadata.first_name === "string" ? metadata.first_name : "";
    const last = typeof metadata.last_name === "string" ? metadata.last_name : "";
    const full = typeof metadata.full_name === "string" ? metadata.full_name : "";
    const phoneNumber = typeof metadata.phone === "string" ? metadata.phone : "";

    if (!firstName && first) {
      setFirstName(first);
    }
    if (!lastName && last) {
      setLastName(last);
    }
    if ((!firstName || !lastName) && full) {
      const parts = full.trim().split(/\s+/);
      if (!firstName && parts[0]) {
        setFirstName(parts[0]);
      }
      if (!lastName && parts.length > 1) {
        setLastName(parts.slice(1).join(" "));
      }
    }
    if (!phone && phoneNumber) {
      setPhone(phoneNumber);
    }
  }, [email, firstName, lastName, phone, user?.email, user?.id, user?.user_metadata]);
  const followUp = useMemo(
    () => buildFollowUpMessage(leadMetadata.leadType, leadMetadata.urgencyLevel),
    [leadMetadata.leadType, leadMetadata.urgencyLevel]
  );

  useEffect(() => {
    if (trackedStartRef.current) return;
    trackedStartRef.current = true;
    void trackFunnelEvent({
      eventName: "vital_ai_started",
      pathway,
      leadType: leadMetadata.leadType,
      urgencyLevel: leadMetadata.urgencyLevel,
      valueLevel: leadMetadata.valueLevel,
      metadata: {
        bookingRequestId: bookingDraft?.requestId ?? null,
        serviceId: bookingDraft?.serviceId ?? null,
      },
    });
  }, [bookingDraft?.requestId, bookingDraft?.serviceId, leadMetadata.leadType, leadMetadata.urgencyLevel, leadMetadata.valueLevel, pathway]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const rows = await loadCatalogLocations();
        if (cancelled) return;
        setLocations(rows);
        if (!preferredLocationId && (bookingDraft?.locationId || rows[0]?.id)) {
          setPreferredLocationId(bookingDraft?.locationId ?? rows[0].id);
        }
      } finally {
        if (!cancelled) setLoadingLocations(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookingDraft?.locationId, preferredLocationId]);

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
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
    if (!preferredLocationId.trim() && locations.length > 0) return "Select the clinic location you prefer.";
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
      const data = await submitPublicVitalAiRequest({
        pathway,
        answers,
        firstName,
        lastName,
        phone,
        email,
        preferredContactMethod,
        preferredLocationId,
        summary,
      });
      const outboundPayload = preparePublicVitalAiOutboundPayload({
        submissionId: data.id ?? null,
        pathway,
        answers,
        summary,
        firstName,
        lastName,
        phone,
        email,
        preferredContactMethod,
        preferredLocationId,
        bookingRequestId: bookingDraft?.requestId ?? null,
        serviceId: bookingDraft?.serviceId ?? null,
        notes: bookingDraft?.notes ?? null,
        source: "public_vital_ai_lite",
      });
      console.info("[Public follow-up]", {
        type: "public_vital_ai_submission",
        submissionId: data.id ?? null,
        leadType: leadMetadata.leadType,
        urgencyLevel: leadMetadata.urgencyLevel,
        patientMessage: followUp.patientMessage,
        staffNote: followUp.staffNote,
        outboundPayload,
      });
      void trackFunnelEvent({
        eventName: "vital_ai_submitted",
        pathway,
        leadType: leadMetadata.leadType,
        urgencyLevel: leadMetadata.urgencyLevel,
        valueLevel: leadMetadata.valueLevel,
        metadata: {
          submissionId: data.id ?? null,
          bookingRequestId: bookingDraft?.requestId ?? null,
        },
      });
      setSubmissionId(data.id ?? null);
      setStep("success");
    } catch (e: unknown) {
      console.error("[Public Vital AI] submit failed", {
        pathway,
        bookingRequestId: bookingDraft?.requestId ?? null,
        error: e,
      });
      setSubmitError(e instanceof Error && e.message ? e.message : "We couldn't send your request right now. Please try again or contact the clinic for help.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicSiteLayout
      title="Start with Vital AI"
      subtitle="Use a short guided pre-intake so the clinic can review your concern and help route the right next step."
      backFallbackTo={returnTo || "/"}
      preferFallbackBack
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

      {user?.id ? (
        <>
          <PublicFlowStatusCard
            eyebrow="Signed In"
            title={role === "patient" ? "Prefer the full guided intake?" : "You are already signed in"}
            body={
              role === "patient"
                ? "Your full Vital AI intake is available in the patient portal if you want the richer workflow with saved sessions, uploads, and provider review routing."
                : "This public page is meant for patient intake. You can still submit the lightweight request here, or return to your dashboard."
            }
            detail={
              role === "patient"
                ? "This public version is still useful for a lightweight request, but the full portal experience keeps more of your progress and care context together."
                : "If you are helping a patient begin intake, it is usually better to route them through the public or patient flow directly."
            }
            actions={[fullPortalAction]}
          />
          <div className="space" />
        </>
      ) : (
        <>
          <PublicFlowStatusCard
            eyebrow="Guest Friendly"
            title="You can complete this guided request without an account"
            body="This public version is designed for a lightweight start. You can answer the questions now and the clinic can still review your request."
            detail="If you later need the full portal intake, uploads, or saved session flow, we will route you there clearly."
            actions={[fullPortalAction, { label: "Already Have an Account?", to: guestLoginPath, variant: "ghost" }]}
          />
          <div className="space" />
        </>
      )}

      {bookingDraft?.requestId || bookingDraft?.serviceId || bookingDraft?.locationId ? (
        <>
          <PublicFlowStatusCard
            eyebrow="Saved Visit Context"
            title="Your request details will stay connected"
            body={`${bookingDraft?.serviceName || "Your selected service"} at ${bookingDraft?.locationName || "your preferred location"}${bookingDraft?.startTimeLocal ? ` with a preferred time of ${new Date(bookingDraft.startTimeLocal).toLocaleString()}` : ""} will be included with this request.`}
            detail={bookingDraft?.notes ? `Visit note: ${bookingDraft.notes}` : "This helps our team review the request and coordinate the right next step."}
          />
          <div className="space" />
        </>
      ) : null}

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
            {!user?.id ? (
              <div className="surface-light-helper" style={{ marginTop: 12, lineHeight: 1.7 }}>
                You can submit this as a guest now, sign in if you already have an account, or create your account first if you want the fuller saved-intake experience.
              </div>
            ) : null}

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
              <Link to={returnTo || "/book"} className="btn btn-ghost">
                Book Instead
              </Link>
              {!user?.id ? (
                <Link to={guestSignupPath} className="btn btn-ghost">
                  Create Account First
                </Link>
              ) : null}
              {!user?.id ? (
                <Link to={guestLoginPath} className="btn btn-ghost">
                  Sign In Instead
                </Link>
              ) : null}
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
          {!user?.id ? (
            <div className="surface-light-helper" style={{ marginTop: 10, lineHeight: 1.7 }}>
              You can finish this request as a guest. If you want the fuller saved-intake experience afterward, we will carry you into account setup cleanly.
            </div>
          ) : null}
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
                    {formatCatalogLocationLabel(location)}
                  </option>
                ))}
              </select>
              {preferredLocationId ? (
                <div className="surface-light-helper" style={{ fontSize: 12, marginTop: 6 }}>
                  {formatCatalogLocationDetails(
                    locations.find((location) => location.id === preferredLocationId) ?? { id: preferredLocationId, name: preferredLocationId }
                  )}
                </div>
              ) : null}
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
            Review the basics before submitting. The clinic will use this for intake guidance, follow-up, and provider prep.
          </div>
          {!user?.id ? (
            <div className="surface-light-helper" style={{ marginTop: 10, lineHeight: 1.7 }}>
              After you submit, you can still create your account and continue into the fuller portal intake without losing the care direction you selected here.
            </div>
          ) : null}
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
              {bookingDraft?.requestId ? (
                <div className="surface-light-helper" style={{ marginTop: 6 }}>
                  Linked to visit request {bookingDraft.requestId}.
                </div>
              ) : null}
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
        <PublicFlowStatusCard
          tone="success"
          eyebrow="Request Received"
          title="Thank you - our team will review your request"
          body={`${followUp.patientMessage} ${pathwayDef.successNote}`}
          detail={`${followUp.supportingLine} A coordinator may follow up by ${preferredContactMethod === "either" ? "phone or email" : preferredContactMethod} to confirm scheduling and next steps.${bookingDraft?.requestId ? ` Linked visit request: ${bookingDraft.requestId}.` : ""} Reference: ${submissionId ?? "submitted"}. Final recommendations and treatment decisions are always determined by medical evaluation.`}
          actions={[
            { label: "Explore Services", to: "/services" },
            { label: "Request Booking", to: returnTo && returnTo !== "/" ? `/book?returnTo=${encodeURIComponent(returnTo)}` : "/book", variant: "ghost" },
            { label: "Contact the Clinic", to: "/contact", variant: "ghost" },
            fullPortalAction,
            ...(!user?.id ? [{ label: "Already Have an Account?", to: guestLoginPath, variant: "ghost" as const }] : []),
            {
              label: "Start Another",
              variant: "ghost",
              onClick: () => {
                setAnswers({});
                setFirstName("");
                setLastName("");
                setPhone("");
                setEmail("");
                setPreferredContactMethod("email");
                setStep("pathway");
                setSubmissionId(null);
                setSubmitError(null);
              },
            },
          ]}
        />
      ) : null}

      <div className="space" />

      <PublicFlowStatusCard
        title="What Happens Next"
        body="Once you send your request, our team will review it and follow up with the right next step."
        detail={pathway === "wound_care"
          ? "Depending on your concern, we may help you schedule first or have a provider review your information before confirming your visit. For wound-care concerns, your answers also help us understand urgency and whether faster follow-up is needed."
          : "Depending on your concern, we may help you schedule first or have a provider review your information before confirming your visit."}
      />
    </PublicSiteLayout>
  );
}
