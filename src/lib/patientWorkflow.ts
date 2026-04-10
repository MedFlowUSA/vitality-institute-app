import { buildPatientIntakePath } from "./routeFlow";
import { getGuidedIntakePathwayForService } from "./services/catalog";

type PatientVisitLike = {
  status: string | null;
};

type AppointmentServiceLike = {
  name?: string | null;
  category?: string | null;
  visitType?: string | null;
};

type LabSubmissionArgs = {
  panelId: string;
  labSource: string;
  labSourceOther: string;
  appointmentId: string;
  locationCount: number;
  panelMarkers: Array<{ key: string; label: string }>;
  values: Record<string, unknown>;
};

export function getPatientVisitStatusLabel(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "open" || normalized === "in_progress") return "Active";
  if (normalized === "completed") return "Completed";
  if (normalized === "cancelled") return "Cancelled";
  return status || "Unknown";
}

export function splitPatientVisitsByActivity<T extends PatientVisitLike>(visits: T[]) {
  const currentCareVisits = visits.filter((visit) => {
    const normalized = (visit.status ?? "").toLowerCase();
    return normalized === "open" || normalized === "in_progress";
  });

  const pastVisits = visits.filter((visit) => {
    const normalized = (visit.status ?? "").toLowerCase();
    return normalized !== "open" && normalized !== "in_progress";
  });

  return { currentCareVisits, pastVisits };
}

export function getPatientAppointmentIntakeCtaLabel(status?: string | null) {
  switch ((status ?? "").toLowerCase()) {
    case "":
      return "Start Intake";
    case "needs_info":
      return "Update Intake";
    case "submitted":
      return "Continue Intake Form";
    case "approved":
    case "locked":
      return "View Intake";
    default:
      return "Open Intake";
  }
}

export function getPatientDashboardIntakeAction(sessionStatus?: string | null) {
  if ((sessionStatus ?? "").toLowerCase() === "draft") {
    return {
      title: "Continue Intake",
      description: "Pick up where you left off so the care team has the details they need.",
      ctaLabel: "Continue Intake",
    };
  }

  return {
    title: "Start with Vital AI",
    description: "Complete a guided intake before your next visit.",
    ctaLabel: "Open Intake",
  };
}

export function buildAppointmentIntakePath(args: {
  appointmentId: string;
  service?: AppointmentServiceLike | null;
}) {
  const pathway = args.service
    ? getGuidedIntakePathwayForService({
        name: args.service.name ?? "",
        category: args.service.category ?? null,
        service_group: args.service.visitType ?? null,
      })
    : null;

  return buildPatientIntakePath({
    appointmentId: args.appointmentId,
    pathway,
    autostart: !!pathway,
  });
}

export function resolvePatientLabSourceLabel(labSource: string, labSourceOther: string) {
  if (!labSource) return "-";
  if (labSource === "Other local lab" && labSourceOther.trim()) return labSourceOther.trim();
  return labSource;
}

export function validatePatientLabSubmission(args: LabSubmissionArgs) {
  if (!args.panelId) return "Please select a lab panel.";
  if (!args.labSource) return "Please select the lab source.";
  if (args.labSource === "Other local lab" && !args.labSourceOther.trim()) {
    return "Please enter the lab name.";
  }
  if (!args.appointmentId && args.locationCount === 0) return "No locations found.";

  for (const marker of args.panelMarkers) {
    const value = args.values[marker.key];
    if (value === undefined || value === null || String(value).trim() === "") {
      return `Please complete: ${marker.label}`;
    }
  }

  return null;
}
