import { Link } from "react-router-dom";
import PublicSiteLayout from "../components/public/PublicSiteLayout";

const patientEntryPoints = [
  {
    title: "Services",
    body:
      "Use Services when you want to browse care options, compare treatment categories, and decide what kind of visit or intake path makes the most sense.",
  },
  {
    title: "Book Visit",
    body:
      "Use Book Visit when you are ready to request care and want to move directly into choosing a service, location, and time.",
  },
  {
    title: "Start with Vital AI",
    body:
      "Use Vital AI when you want guided intake first so the clinic can review your goals, symptoms, and supporting details before the next step is finalized.",
  },
];

const patientScenarios = [
  {
    title: "First-time patient starting with booking",
    steps: [
      "Open the public site and choose Book Visit.",
      "Select the service, location, and preferred time.",
      "Submit the request and sign in or create an account if prompted.",
      "Open Patient Home and complete intake if the clinic requests more information.",
    ],
    outcome: "The booking request is saved, the clinic can review it, and the patient can continue from the dashboard.",
  },
  {
    title: "First-time patient starting with Vital AI",
    steps: [
      "Choose Start with Vital AI from the public site.",
      "Complete the guided intake questions and review the summary.",
      "Submit the intake and sign in or create an account if prompted.",
      "Open Patient Home and watch for follow-up or booking guidance.",
    ],
    outcome: "The clinic receives structured intake information and can determine the correct next step.",
  },
  {
    title: "Returning patient checking results or messages",
    steps: [
      "Sign in and open Patient Home.",
      "Use Labs to review posted results or Messages to contact the clinic.",
      "Review dashboard notices for any new tasks or follow-up instructions.",
    ],
    outcome: "The patient stays current on results, messages, and care updates without restarting the intake flow.",
  },
];

const providerAreas = [
  "Provider Dashboard for daily overview and quick launch actions",
  "Command Center for location-aware operational triage",
  "Provider Queue for active encounter work",
  "Patient Center for chart review, notes, and encounter management",
  "Visit Builder for appointment-to-visit setup",
  "Intake Review for submitted intake triage",
  "Messages for secure communication",
  "Labs for clinical review and follow-up",
  "Vital AI Requests for structured intake review",
  "Protocol Approval Queue and Protocol Review for physician sign-off",
];

const providerWorkflows = [
  {
    title: "Reviewing a new intake",
    steps: [
      "Open Intake Review and select the new submission.",
      "Review answers, uploads, and completion status.",
      "Advance the case, hold it, or request the next internal step.",
    ],
  },
  {
    title: "Moving from queue to chart",
    steps: [
      "Open Provider Queue and choose the active encounter.",
      "Open Patient Center from the selected case.",
      "Continue chart work, documentation, and planning from there.",
    ],
  },
  {
    title: "Reviewing a Vital AI-generated case",
    steps: [
      "Open Vital AI Requests and select the submission.",
      "Review the structured intake summary.",
      "Determine whether the patient should be scheduled, followed up, or routed into protocol review.",
    ],
  },
  {
    title: "Handling protocol approval",
    steps: [
      "Open the case from Protocol Approval Queue.",
      "Review the AI suggestion and clinical context.",
      "Approve, Save Modifications, or Reject.",
      "Sign the decision before any downstream workflow advances.",
    ],
  },
];

const routeGroups = [
  {
    title: "Patient Routes",
    items: [
      "/patient/home",
      "/patient/services",
      "/patient/book",
      "/patient/chat",
      "/patient/labs",
      "/patient/treatments",
      "/patient/billing",
      "/intake",
    ],
  },
  {
    title: "Provider Routes",
    items: [
      "/provider",
      "/provider/command",
      "/provider/queue",
      "/provider/patients",
      "/provider/intakes",
      "/provider/chat",
      "/provider/labs",
      "/provider/vital-ai",
      "/provider/protocol-queue",
      "/provider/protocol-review/:assessmentId",
    ],
  },
];

export default function PublicAppGuide() {
  return (
    <PublicSiteLayout
      title="How To Use The App"
      subtitle="A real onboarding guide for patients, providers, clinic staff, and physicians using the Vitality Institute platform."
      backFallbackTo="/"
      preferFallbackBack
    >
      <div className="card card-pad card-light surface-light public-panel">
        <div className="surface-light-helper">Vitality Institute User Guide</div>
        <div className="h2" style={{ marginTop: 10 }}>
          Production Training Guide
        </div>
        <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
          This guide explains how the Vitality Institute app works in live use across the patient journey, provider
          operations, and physician protocol approval. It is written as a support and onboarding document rather than
          a marketing overview.
        </div>
        <div className="surface-light-helper" style={{ marginTop: 12, lineHeight: 1.7 }}>
          Critical workflow rule: <strong>AI suggests -&gt; physician decides -&gt; workflow advances</strong>.
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-panel">
        <div className="h2">Patient Guide</div>
        <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
          Patients usually begin on the public site, then move into account access, booking, intake, messaging, labs,
          and treatment follow-up inside the signed-in experience.
        </div>
        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {patientEntryPoints.map((entry) => (
            <div
              key={entry.title}
              className="card card-pad card-light surface-light public-panel-nested"
            >
              <div className="h2">
                {entry.title}
              </div>
              <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
                {entry.body}
              </div>
            </div>
          ))}
        </div>
        <div className="h2" style={{ marginTop: 18 }}>
          What Patients Do Next
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {patientScenarios.map((scenario) => (
            <div
              key={scenario.title}
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
                Patient Scenario
              </div>
              <div className="h2" style={{ marginTop: 10 }}>
                {scenario.title}
              </div>
              <ol className="surface-light-body" style={{ marginTop: 12, lineHeight: 1.75 }}>
                {scenario.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <div className="surface-light-helper" style={{ marginTop: 12, lineHeight: 1.7 }}>
                Expected outcome: {scenario.outcome}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-panel">
        <div className="h2">Provider Guide</div>
        <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
          Providers, staff, and physicians work inside a location-aware workspace. The active clinic location matters
          for queue visibility, intake review, labs, and protocol work.
        </div>
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {providerAreas.map((area) => (
            <div key={area} className="card card-pad card-light surface-light public-panel-nested">
              {area}
            </div>
          ))}
        </div>
        <div className="h2" style={{ marginTop: 18 }}>
          Required Provider Workflows
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {providerWorkflows.map((workflow) => (
            <div key={workflow.title} className="card card-pad card-light surface-light public-panel-nested">
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: "var(--v-helper-dark)",
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                }}
              >
                Provider Workflow
              </div>
              <div className="h2" style={{ marginTop: 10 }}>
                {workflow.title}
              </div>
              <ol className="surface-light-body" style={{ marginTop: 12, lineHeight: 1.75 }}>
                {workflow.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-panel">
        <div className="h2">Role Distinctions</div>
        <div style={{ marginTop: 14, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <div className="card card-pad card-light surface-light public-panel-nested">
            <div className="surface-light-helper">Staff / General Provider</div>
            <ul className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
              <li>Intake review and triage</li>
              <li>Patient communication</li>
              <li>Documentation support and prep work</li>
              <li>Queue handling and missing-information follow-up</li>
            </ul>
          </div>
          <div className="card card-pad card-light surface-light public-panel-nested">
            <div className="surface-light-helper">Physician Only</div>
            <ul className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
              <li>Protocol approval</li>
              <li>Modification of AI recommendations</li>
              <li>Final sign-off</li>
              <li>Decision to reject protocol-driven advancement</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-panel">
        <div className="h2">Quick Route Summary</div>
        <div style={{ marginTop: 14, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {routeGroups.map((group) => (
            <div key={group.title} className="card card-pad card-light surface-light public-panel-nested">
              <div className="surface-light-helper">{group.title}</div>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {group.items.map((route) => (
                  <div key={route} className="surface-light-body">
                    <code>{route}</code>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-panel">
        <div className="h2">Important Notes</div>
        <ul className="surface-light-body" style={{ marginTop: 12, lineHeight: 1.75 }}>
          <li>Coming-soon markets may appear in public flows, but they are not operational care locations.</li>
          <li>Basket &amp; Payments is placeholder-only and is not a live checkout flow.</li>
          <li>Provider workflows are clinic-aware and location-aware.</li>
          <li>Protocol approval requires physician sign-off before downstream workflow advances.</li>
          <li>Some workflows may continue to evolve as the platform grows.</li>
        </ul>
      </div>

      <div className="space" />

      <div className="card card-pad card-light surface-light public-panel">
        <div className="h2">Quick Links</div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <Link to="/book" className="btn btn-primary">
            Start Booking
          </Link>
          <Link to="/vital-ai" className="btn btn-secondary">
            Start Vital AI
          </Link>
          <Link to="/access" className="btn btn-secondary">
            Sign In
          </Link>
        </div>
      </div>
    </PublicSiteLayout>
  );
}
