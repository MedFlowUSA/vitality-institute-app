import type { DerivedEncounterState } from "./encounterState";

type GuideContent = {
  title: string;
  description: string;
  workflowState?: string;
  nextAction?: string;
};

function formatEncounterWorkflowState(snapshot: DerivedEncounterState) {
  return snapshot.state.replaceAll("_", " ");
}

export function buildProviderHomeGuide(): GuideContent {
  return {
    title: "Provider Dashboard",
    description:
      "This page is the provider overview and launch point for queue work, intake triage, Vital AI requests, messaging, labs, and patient chart work.",
    workflowState: "daily operations",
    nextAction: "Open Queue for active encounters, Command Center for schedule and intake triage, or jump into virtual visits when needed.",
  };
}

export function buildProviderVitalAiQueueGuide(hasSelectedRequest: boolean, hasAppointment: boolean): GuideContent {
  return {
    title: "Vital AI Request Queue",
    description:
      "Review submitted Vital AI requests and convert approved requests into scheduled virtual or in-person care.",
    workflowState: hasAppointment ? "appointment linked" : hasSelectedRequest ? "request selected" : "awaiting request selection",
    nextAction: hasAppointment
      ? "Open the linked appointment setup or patient chart."
      : hasSelectedRequest
      ? "Review the intake and schedule the appropriate visit type."
      : "Select a request to review its intake summary and scheduling options.",
  };
}

export function buildProviderVitalAiProfileGuide(hasInsights: boolean): GuideContent {
  return {
    title: "Vital AI Intake Review",
    description:
      "This page summarizes the submitted intake so you can review clinical context before deciding how the patient should be scheduled or followed up.",
    workflowState: hasInsights ? "insights ready" : "loading intake analysis",
    nextAction: hasInsights
      ? "Review the visit summary and recommendation sections, then return to the request queue to schedule the next step."
      : "Wait for the intake analysis blocks to load, then review the case.",
  };
}

export function buildProviderProtocolQueueGuide(pendingCount: number): GuideContent {
  return {
    title: "Protocol Approval Queue",
    description:
      "Review AI-assisted protocol suggestions, confirm the clinical context, and complete physician-reviewed sign-off before any downstream routing happens.",
    workflowState: pendingCount === 0 ? "all caught up" : `${pendingCount} awaiting review`,
    nextAction:
      pendingCount === 0
        ? "Open a reviewed case for follow-up details or return to Vital AI requests."
        : "Open the next assessment, confirm or modify the recommendation, and sign off as the licensed physician reviewer.",
  };
}

export function buildProviderProtocolReviewGuide(hasExistingDecision: boolean): GuideContent {
  return {
    title: "Protocol Review",
    description:
      "Use this workspace to review the AI-assisted suggestion, edit the final recommendation as needed, and complete physician-reviewed sign-off.",
    workflowState: hasExistingDecision ? "review on file" : "awaiting physician decision",
    nextAction: hasExistingDecision
      ? "Confirm whether the saved decision still stands or update the final protocol before routing the case forward."
      : "Review the case, adjust the recommendation if needed, then approve, modify, or reject it.",
  };
}

export function buildProviderIntakeGuide(hasActiveIntake: boolean): GuideContent {
  return {
    title: "Intake Review",
    description:
      "This page is for provider or staff review of submitted intake packets before they move forward into active care workflows.",
    workflowState: hasActiveIntake ? "intake selected" : "awaiting intake selection",
    nextAction: hasActiveIntake
      ? "Review the selected intake, update status, and move the patient into the next clinical step."
      : "Choose a submission from the list to begin review.",
  };
}

export function buildProviderPatientCenterGuide(snapshot: DerivedEncounterState): GuideContent {
  return {
    title: "Patient Center",
    description:
      "This page manages the active encounter, including visit context, SOAP, treatment planning, supporting records, and completion state.",
    workflowState: formatEncounterWorkflowState(snapshot),
    nextAction: snapshot.nextActionLabel,
  };
}

export function buildProviderVisitBuilderGuide(hasAppointment: boolean, hasVisit: boolean, isVirtual: boolean): GuideContent {
  return {
    title: "Visit Builder",
    description:
      "This page connects appointment setup to visit creation so scheduling and chart activation stay aligned before the provider enters the encounter.",
    workflowState: hasVisit ? "visit created" : hasAppointment ? "appointment loaded" : "manual visit setup",
    nextAction: hasVisit
      ? "Open the visit chart or continue adding wound-specific setup."
      : isVirtual
      ? "Finish virtual visit setup, then create the visit."
      : "Confirm the appointment details, then create the visit.",
  };
}
