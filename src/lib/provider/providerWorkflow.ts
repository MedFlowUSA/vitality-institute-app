export type ProviderWorkflowActionId =
  | "review_intake"
  | "start_visit"
  | "resume_visit"
  | "create_soap"
  | "add_wound_assessment"
  | "create_treatment_plan"
  | "upload_photos"
  | "finalize_visit"
  | "open_patient_center";

export type ProviderWorkflowTab = "overview" | "wound" | "soap" | "plan" | "photos";

export type ProviderWorkflowRecommendation = {
  id: ProviderWorkflowActionId;
  label: string;
  description: string;
  tab: ProviderWorkflowTab;
};

type PatientCenterArgs = {
  profileIsComplete: boolean;
  hasIntakeOnFile: boolean;
  hasActiveVisit: boolean;
  hasSoap: boolean;
  hasWoundAssessment: boolean;
  hasTreatmentPlan: boolean;
  hasPhotos: boolean;
  hasFiles: boolean;
  canFinalizeVisit: boolean;
};

export function getProviderPatientCenterRecommendation(args: PatientCenterArgs): ProviderWorkflowRecommendation {
  if (!args.profileIsComplete) {
    return {
      id: "review_intake",
      label: "Review Intake",
      description: "Confirm the patient profile and missing intake details before documenting the encounter.",
      tab: "overview",
    };
  }

  if (!args.hasIntakeOnFile) {
    return {
      id: "review_intake",
      label: "Review Intake",
      description: "Review the patient intake before moving deeper into visit documentation.",
      tab: "wound",
    };
  }

  if (!args.hasActiveVisit) {
    return {
      id: "start_visit",
      label: "Start Visit",
      description: "Create or resume the visit so the rest of the clinical workflow can proceed.",
      tab: "overview",
    };
  }

  if (!args.hasSoap) {
    return {
      id: "create_soap",
      label: "Create SOAP Note",
      description: "Start the SOAP note first so the encounter has a clinical anchor.",
      tab: "soap",
    };
  }

  if (!args.hasWoundAssessment) {
    return {
      id: "add_wound_assessment",
      label: "Add Wound Assessment",
      description: "Capture wound measurements before building the treatment plan.",
      tab: "wound",
    };
  }

  if (!args.hasTreatmentPlan) {
    return {
      id: "create_treatment_plan",
      label: "Create Treatment Plan",
      description: "Turn the wound assessment into a documented treatment plan for this visit.",
      tab: "plan",
    };
  }

  if (!args.hasPhotos && !args.hasFiles) {
    return {
      id: "upload_photos",
      label: "Upload Photos",
      description: "Add wound photos or supporting files before finalizing the visit.",
      tab: "photos",
    };
  }

  if (args.canFinalizeVisit) {
    return {
      id: "finalize_visit",
      label: "Finalize Visit",
      description: "The required documentation is in place. Review follow-up details and complete the visit.",
      tab: "overview",
    };
  }

  return {
    id: "resume_visit",
    label: "Resume Visit",
    description: "Continue reviewing the encounter and remaining documentation items.",
    tab: "overview",
  };
}

type QueueArgs = {
  hasVisit: boolean;
  hasAppointment: boolean;
  hasSoap: boolean;
  isSoapSigned: boolean;
  isVisitClosed: boolean;
};

export function getProviderQueueRecommendation(args: QueueArgs): ProviderWorkflowRecommendation {
  if (!args.hasVisit && args.hasAppointment) {
    return {
      id: "start_visit",
      label: "Start Visit",
      description: "Launch the visit from the scheduled appointment and move directly into documentation.",
      tab: "overview",
    };
  }

  if (args.hasVisit && (!args.hasSoap || !args.isSoapSigned)) {
    return {
      id: "resume_visit",
      label: "Resume Visit",
      description: "Open the visit and continue the SOAP-driven documentation workflow.",
      tab: "soap",
    };
  }

  if (args.hasVisit && !args.isVisitClosed) {
    return {
      id: "open_patient_center",
      label: "Open Patient Center",
      description: "Review the encounter, attachments, and follow-up tasks from the patient center.",
      tab: "overview",
    };
  }

  return {
    id: "review_intake",
    label: "Review Intake",
    description: "Review patient context and intake history before deciding the next follow-up step.",
    tab: "overview",
  };
}
