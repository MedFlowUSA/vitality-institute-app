import type { PublicVitalAiPathway, PublicVitalAiStatus } from "./publicVitalAiLite";

export type BookingRequestStatus =
  | "new"
  | "intake_started"
  | "account_created"
  | "reviewed"
  | "scheduled"
  | "closed";

export type BookingRequestCaptureType = "live_booking" | "expansion_interest";
export type PublicVitalAiCaptureType = "standard_intake" | "expansion_interest";

export function getBookingRequestStatusLabel(status: BookingRequestStatus) {
  switch (status) {
    case "new":
      return "Requested";
    case "intake_started":
      return "Intake Started";
    case "account_created":
      return "Account Created";
    case "reviewed":
      return "Needs Follow-up";
    case "scheduled":
      return "Converted to Scheduling";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

export function resolveBookingCaptureType(input: {
  captureType?: BookingRequestCaptureType | null;
  source?: string | null;
}) {
  if (input.captureType === "expansion_interest") return "expansion_interest";
  if (input.captureType === "live_booking") return "live_booking";
  if (input.source?.startsWith("public_expansion_interest:") || input.source === "public_expansion_interest") {
    return "expansion_interest";
  }
  return "live_booking";
}

export function isExpansionBookingRequest(input: {
  captureType?: BookingRequestCaptureType | null;
  source?: string | null;
}) {
  return resolveBookingCaptureType(input) === "expansion_interest";
}

export function getBookingCaptureTypeLabel(captureType: BookingRequestCaptureType) {
  return captureType === "expansion_interest" ? "Expansion waitlist" : "Live booking request";
}

export function resolvePublicVitalAiCaptureType(input: {
  captureType?: PublicVitalAiCaptureType | null;
  preferredLocationIsPlaceholder?: boolean;
}) {
  if (input.captureType === "expansion_interest") return "expansion_interest";
  if (input.captureType === "standard_intake") return "standard_intake";
  if (input.preferredLocationIsPlaceholder) return "expansion_interest";
  return "standard_intake";
}

export function isExpansionPublicVitalAiSubmission(input: {
  captureType?: PublicVitalAiCaptureType | null;
  preferredLocationIsPlaceholder?: boolean;
}) {
  return resolvePublicVitalAiCaptureType(input) === "expansion_interest";
}

export function getPublicVitalAiCaptureTypeLabel(captureType: PublicVitalAiCaptureType) {
  return captureType === "expansion_interest" ? "Expansion market follow-up" : "Standard intake";
}

export function getVitalAiStatusLabel(status: PublicVitalAiStatus) {
  switch (status) {
    case "new":
      return "Requested";
    case "reviewed":
      return "Needs Follow-up";
    case "contacted":
      return "Contacted";
    case "scheduled":
      return "Converted to Scheduling";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

export function describeBookingSource(source?: string | null) {
  if (!source) return "Direct public booking";
  if (source.startsWith("public_booking_interest:")) return "Marketing service interest";
  if (source.startsWith("public_expansion_interest:") || source === "public_expansion_interest") return "Expansion waitlist interest";
  if (source === "public_booking_flow") return "Direct public booking";
  return source.replaceAll("_", " ");
}

export function describeVitalAiSource(source?: string | null) {
  if (!source) return "Vital AI Lite only";
  if (source === "public_vital_ai_lite") return "Vital AI Lite only";
  return source.replaceAll("_", " ");
}

export function describePublicSubmissionOrigin(input: {
  bookingSource?: string | null;
  vitalAiSource?: string | null;
  hasBookingRequest?: boolean;
  hasVitalAiSubmission?: boolean;
}) {
  if (input.hasBookingRequest && input.hasVitalAiSubmission) return "Booking + Vital AI";
  if (input.hasBookingRequest) return describeBookingSource(input.bookingSource);
  return describeVitalAiSource(input.vitalAiSource);
}

export function isWoundRelated(input: {
  pathway?: PublicVitalAiPathway | null;
  serviceName?: string | null;
  notes?: string | null;
}) {
  if (input.pathway === "wound_care") return true;
  const text = `${input.serviceName ?? ""} ${input.notes ?? ""}`.toLowerCase();
  return text.includes("wound") || text.includes("ulcer") || text.includes("drainage") || text.includes("infection");
}

export function getBookingNextStep(input: {
  status: BookingRequestStatus;
  hasVitalAiSubmission: boolean;
  patientLinked: boolean;
  isWound: boolean;
  source?: string | null;
}) {
  if (input.source?.startsWith("public_expansion_interest:") || input.source === "public_expansion_interest") {
    if (input.status === "closed") return "No further action is expected unless the patient re-engages.";
    return "Treat this as expansion demand only. Follow up for waitlist interest or redirect to a live clinic if appropriate.";
  }
  if (input.status === "scheduled") return "Confirm the booked consult and carry the request into the patient workflow.";
  if (input.status === "closed") return "No further action is expected unless the patient re-engages.";
  if (input.isWound && !input.hasVitalAiSubmission) return "Request wound-focused intake details or photos and escalate for review if urgency is unclear.";
  if (!input.hasVitalAiSubmission) return "Send the patient into Vital AI Lite or a guided intake so routing details are captured before scheduling.";
  if (!input.patientLinked) return "Invite account creation or complete staff-assisted registration before final scheduling.";
  if (input.status === "account_created" || input.status === "intake_started") return "Review the linked intake and move toward provider review or scheduling.";
  return "Coordinator outreach and scheduling review are the next best steps.";
}

export function getVitalAiNextStep(input: {
  status: PublicVitalAiStatus;
  pathway: PublicVitalAiPathway;
  hasBookingRequest: boolean;
  patientLinked: boolean;
  isExpansionInterest?: boolean;
}) {
  if (input.isExpansionInterest) {
    if (input.status === "closed") return "Submission has been completed operationally.";
    return "Treat this as expansion-market follow-up. Keep it out of live scheduling unless the patient is redirected to an active clinic.";
  }
  if (input.status === "scheduled") return "Confirm the consult details and transition into the patient scheduling workflow.";
  if (input.status === "closed") return "Submission has been completed operationally.";
  if (input.pathway === "wound_care") return "Review urgency, contact the patient promptly, and request photos or provider review if needed.";
  if (!input.hasBookingRequest) return "Create or confirm the visit-request path before moving toward scheduling.";
  if (!input.patientLinked) return "Use this submission to drive account setup and full intake completion.";
  return "Review the intake context and move toward coordinator follow-up or provider review.";
}
