import { Link } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";
import {
  LAW_ENFORCEMENT_DISCOUNT_CODE,
  LAW_ENFORCEMENT_DISCOUNT_PERCENT,
  buildLawEnforcementDiscountLabel,
} from "../lib/lawEnforcementDiscount";

const guideSteps = [
  {
    title: "Begin on the public site",
    body:
      "Start on the home page and choose the path that best matches your needs: review services, begin guided intake with Vital AI, or proceed directly to booking.",
  },
  {
    title: "Choose the correct starting point",
    body:
      "Use Services if you already know which consultation, treatment, or program you want. Use Vital AI if you would like help identifying the right next step before booking.",
  },
  {
    title: "Enter your visit request",
    body:
      "Select your preferred location, service, and timing. Add notes if you would like the clinic to review your goals or concerns before confirming the next step.",
  },
  {
    title: "Apply the law enforcement discount",
    body: `Enter ${LAW_ENFORCEMENT_DISCOUNT_CODE} during booking or at checkout to request ${LAW_ENFORCEMENT_DISCOUNT_PERCENT}% off eligible services.`,
  },
  {
    title: "Complete account setup",
    body:
      "If you are new to the clinic, create your patient account after your request is saved. If you already have an account, sign in and continue.",
  },
  {
    title: "Finish guided intake",
    body:
      "Complete the guided intake questions so the clinic can review your goals, symptoms, and supporting details before your visit is finalized.",
  },
  {
    title: "Use the patient dashboard",
    body:
      "After signing in, use Patient Home to review upcoming visits, continue intake, send messages to the clinic, check lab updates, and review treatment instructions.",
  },
  {
    title: "Follow the app's next-step prompts",
    body:
      "The app will guide you to booking, intake, messages, labs, or treatment details based on where you are in your care journey.",
  },
];

const dashboardAreas = [
  "Patient Home for alerts, next steps, and upcoming visits",
  "Book Visit for scheduling a new request or follow-up",
  "Vital AI / Intake for guided clinical questions before review",
  "Messages for conversations with the clinic",
  "Labs for posted results and updates",
  "Treatments for patient instructions and follow-up plans",
];

export default function PublicAppGuide() {
  return (
    <PublicSiteLayout
      title="How To Use The App"
      subtitle="Step-by-step guidance for operating the full Vitality Institute patient experience."
      backFallbackTo="/"
      preferFallbackBack
    >
      <div className="card card-pad card-light surface-light public-panel">
        <div className="h2">Vitality Institute Law Enforcement Guide</div>
        <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
          This guide explains how law enforcement clients can use the full app experience, from choosing services and
          submitting a request to completing intake, using the patient dashboard, and reviewing follow-up information.
        </div>
        <div className="surface-light-helper" style={{ marginTop: 12, lineHeight: 1.7 }}>
          Discount reminder: use <strong>{buildLawEnforcementDiscountLabel()}</strong> during booking or at checkout.
          Verification may be requested at the time of service.
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-panel">
        <div className="h2">Step-By-Step Instructions</div>
        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {guideSteps.map((step, index) => (
            <div
              key={step.title}
              className="card card-pad card-light surface-light public-panel-nested"
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: "var(--v-helper-dark)",
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                }}
              >
                Step {index + 1}
              </div>
              <div className="h2" style={{ marginTop: 10 }}>
                {step.title}
              </div>
              <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
                {step.body}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-panel">
        <div className="h2">Main Areas Patients Use</div>
        <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
          Once signed in, these are the main areas patients will use most often:
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {dashboardAreas.map((item) => (
            <div
              key={item}
              className="card card-pad card-light surface-light public-panel-nested"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-panel">
        <div className="h2">Quick Links</div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <Link to="/book" className="btn btn-primary">
            Start Booking
          </Link>
          <Link to="/vital-ai" className="btn btn-secondary">
            Start Guided Intake
          </Link>
          <Link to="/access" className="btn btn-secondary">
            Sign In Or Create Account
          </Link>
        </div>
      </div>
    </PublicSiteLayout>
  );
}
