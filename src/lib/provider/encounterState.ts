export type EncounterVisitSummary = {
  id: string;
  status: string | null;
  visit_date: string;
  summary: string | null;
};

export type EncounterSoapSummary = {
  id: string;
  visit_id: string;
  is_signed: boolean | null;
  is_locked: boolean | null;
  signed_at: string | null;
};

export type EncounterPlanSummary = {
  id: string;
  visit_id: string;
  status: string | null;
  is_locked: boolean | null;
  signed_at: string | null;
};

export type EncounterState =
  | "no_visit"
  | "visit_open"
  | "soap_draft"
  | "soap_signed"
  | "plan_draft"
  | "ready_to_complete"
  | "completed";

export type DerivedEncounterState = {
  state: EncounterState;
  visitLabel: string;
  soapLabel: string;
  planLabel: string;
  nextActionLabel: string;
  nextActionTab: "overview" | "soap" | "plan";
  summary: string;
  canComplete: boolean;
  requiresPlanBypass: boolean;
};

function normalizeStatus(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function isVisitCompleted(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  return normalized === "completed" || normalized === "closed";
}

function isSoapFinalized(soap: EncounterSoapSummary | null) {
  return !!soap && (!!soap.is_signed || !!soap.is_locked || !!soap.signed_at);
}

function isPlanFinalized(plan: EncounterPlanSummary | null) {
  const normalized = normalizeStatus(plan?.status);
  return !!plan && (!!plan.is_locked || !!plan.signed_at || normalized === "signed" || normalized === "completed");
}

function getSoapLabel(soap: EncounterSoapSummary | null) {
  if (!soap) return "None";
  return isSoapFinalized(soap) ? "Signed" : "Draft";
}

function getPlanLabel(plan: EncounterPlanSummary | null) {
  if (!plan) return "None";
  return isPlanFinalized(plan) ? "Signed" : "Draft";
}

export function deriveEncounterState(input: {
  visit: EncounterVisitSummary | null;
  soap: EncounterSoapSummary | null;
  plan: EncounterPlanSummary | null;
}): DerivedEncounterState {
  const { visit, soap, plan } = input;

  if (!visit) {
    return {
      state: "no_visit",
      visitLabel: "No active visit",
      soapLabel: "None",
      planLabel: "None",
      nextActionLabel: "Start Visit",
      nextActionTab: "overview",
      summary: "No encounter has been started for this patient yet.",
      canComplete: false,
      requiresPlanBypass: false,
    };
  }

  const soapLabel = getSoapLabel(soap);
  const planLabel = getPlanLabel(plan);
  const soapFinalized = isSoapFinalized(soap);
  const planFinalized = isPlanFinalized(plan);

  if (isVisitCompleted(visit.status)) {
    return {
      state: "completed",
      visitLabel: "Completed",
      soapLabel,
      planLabel,
      nextActionLabel: "Review Completed Encounter",
      nextActionTab: "overview",
      summary: "This visit is complete. SOAP, plan, labs, notes, and files remain available for follow-up.",
      canComplete: false,
      requiresPlanBypass: false,
    };
  }

  if (!soap) {
    return {
      state: "visit_open",
      visitLabel: "Open",
      soapLabel,
      planLabel,
      nextActionLabel: "Continue SOAP",
      nextActionTab: "soap",
      summary: "The visit is open. Start the SOAP note to move the encounter into clinical documentation.",
      canComplete: false,
      requiresPlanBypass: false,
    };
  }

  if (!soapFinalized) {
    return {
      state: "soap_draft",
      visitLabel: "Open",
      soapLabel,
      planLabel,
      nextActionLabel: "Continue SOAP",
      nextActionTab: "soap",
      summary: "SOAP is in draft. Sign or lock the note before the encounter can be completed.",
      canComplete: false,
      requiresPlanBypass: false,
    };
  }

  if (!plan) {
    return {
      state: "soap_signed",
      visitLabel: "Open",
      soapLabel,
      planLabel,
      nextActionLabel: "Continue Plan",
      nextActionTab: "plan",
      summary: "SOAP is finalized. Add and finalize the treatment plan, or complete with a documented bypass reason.",
      canComplete: false,
      requiresPlanBypass: true,
    };
  }

  if (!planFinalized) {
    return {
      state: "plan_draft",
      visitLabel: "Open",
      soapLabel,
      planLabel,
      nextActionLabel: "Continue Plan",
      nextActionTab: "plan",
      summary: "The treatment plan exists but is still in draft. Finalize it before completion, or complete with a documented bypass reason.",
      canComplete: false,
      requiresPlanBypass: true,
    };
  }

  return {
    state: "ready_to_complete",
    visitLabel: "Open",
    soapLabel,
    planLabel,
    nextActionLabel: "Complete Visit",
    nextActionTab: "overview",
    summary: "SOAP and plan are finalized. This encounter is ready to be marked completed.",
    canComplete: true,
    requiresPlanBypass: false,
  };
}
