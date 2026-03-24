// src/pages/PatientHome.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getCanonicalPatientIntakeServiceType, getCanonicalServiceTypeKey } from "../lib/canonicalOfferRegistry";
import { getGuidedIntakePathwayForService } from "../lib/services/catalog";
import { supabase } from "../lib/supabase";
import { uploadPatientFile, getSignedUrl } from "../lib/patientFiles";
import VitalAiAvatarAssistant from "../components/vital-ai/VitalAiAvatarAssistant";
import VirtualVisitBadge from "../components/VirtualVisitBadge";
import JoinVirtualVisitButton from "../components/JoinVirtualVisitButton";
import { countLegacyOpenThreadsForPatient, ensureLegacyAppointmentThread } from "../lib/messaging/legacyChat";
import { getErrorMessage, getPatientRecordIdForProfile, isDatabaseErrorWithCode } from "../lib/patientRecords";
import { getVirtualVisitState } from "../lib/virtualVisits";

type LocationRow = { id: string; name: string; city: string | null; state: string | null };
type ServiceRow = {
  id: string;
  name: string;
  location_id: string;
  category: string | null;
  visit_type: string | null;
  description?: string | null;
  price_marketing_cents?: number | null;
  price_regular_cents?: number | null;
};

type LocationHoursRow = {
  location_id: string;
  day_of_week: number; // 0=Sun..6=Sat
  open_time: string; // "09:00:00"
  close_time: string; // "17:00:00"
  slot_minutes: number;
  is_closed: boolean;
};

type ApptRow = {
  id: string;
  location_id: string;
  start_time: string;
  status: string;
  service_id: string | null;
  notes: string | null;
  visit_type: string | null;
  telehealth_enabled: boolean | null;
  meeting_url: string | null;
  meeting_provider: string | null;
  meeting_status: string | null;
  join_window_opens_at: string | null;
  virtual_instructions: string | null;
  provider_user_id?: string | null;
};

type LatestWoundIntake = {
  id: string;
  status: "submitted" | "needs_info" | "approved" | "locked" | string;
  created_at: string;
  locked_at: string | null;
};

type VitalAiSessionRow = {
  id: string;
  status: "draft" | "submitted" | string;
  updated_at: string;
  completed_at: string | null;
  created_at: string;
};

type AppointmentIntakeStatusRow = {
  id: string;
  status: string | null;
  service_type: string | null;
  created_at: string;
  locked_at: string | null;
};

type AppointmentVisitRow = {
  id: string;
  appointment_id: string | null;
  visit_date: string | null;
  created_at: string;
  status: string | null;
};

type LatestTreatmentPlanRow = {
  id: string;
  visit_id: string;
  created_at: string;
  status: string | null;
  summary: string | null;
  patient_instructions: string | null;
};

type PatientSafeTreatmentPlan = {
  id: string;
  visit_id: string;
  created_at: string;
  updated_at?: string | null;
  signed_at?: string | null;
  status: string | null;
  summary: string | null;
  patient_instructions: string | null;
  plan: TreatmentPlanPayload | null;
};

type TreatmentPlanPayload = {
  follow_up_days?: number | string | null;
  [key: string]: unknown;
};

type PatientLabRow = {
  id: string;
  created_at: string;
  patient_id: string;
  lab_name: string | null;
  result_summary: string | null;
  status: string | null;
  collected_at: string | null;
};

type PatientAlertItem = {
  id: string;
  tone: "info" | "warning" | "success";
  title: string;
  message: string;
  ctaLabel?: string;
  ctaAction?: () => void;
};

type TimelineItem = {
  id: string;
  date: string;
  title: string;
  detail: string;
  tone: "info" | "warning" | "success";
};

type NextStepItem = {
  title: string;
  message: string;
  ctaLabel: string;
  ctaAction: () => void;
  tone: "info" | "warning" | "success";
};

type AppointmentFileRow = {
  id: string;
  created_at: string;
  appointment_id: string | null;
  filename: string;
  category: string | null;
  bucket: string;
  path: string;
  content_type: string | null;
  size_bytes: number | null;
};

type PatientFileRow = {
  id: string;
  created_at: string | null;
  filename: string;
  category: string | null;
  bucket: string;
  path: string;
  content_type: string | null;
  size_bytes: number | null;
};

type VisitIdRow = { id: string };

function toLocalTimeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusBadge(status: string) {
  const s = (status || "").toLowerCase();
  const base = {
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid rgba(255,255,255,.25)",
    background: "rgba(255,255,255,.08)",
  } as const;

  if (s === "locked")
    return { ...base, background: "rgba(34,197,94,.18)", border: "1px solid rgba(34,197,94,.35)" };
  if (s === "approved")
    return { ...base, background: "rgba(59,130,246,.18)", border: "1px solid rgba(59,130,246,.35)" };
  if (s === "needs_info")
    return { ...base, background: "rgba(245,158,11,.18)", border: "1px solid rgba(245,158,11,.35)" };
  if (s === "submitted")
    return { ...base, background: "rgba(148,163,184,.18)", border: "1px solid rgba(148,163,184,.35)" };

  return base;
}

function appointmentStatusBadge(status: string) {
  const s = (status || "").toLowerCase();

  const base = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.06)",
  } as const;

  if (s === "requested") {
    return {
      ...base,
      background: "rgba(148,163,184,.18)",
      border: "1px solid rgba(148,163,184,.35)",
    };
  }

  if (s === "approved" || s === "confirmed") {
    return {
      ...base,
      background: "rgba(59,130,246,.18)",
      border: "1px solid rgba(59,130,246,.35)",
    };
  }

  if (s === "in_progress") {
    return {
      ...base,
      background: "rgba(168,85,247,.18)",
      border: "1px solid rgba(168,85,247,.35)",
    };
  }

  if (s === "completed") {
    return {
      ...base,
      background: "rgba(34,197,94,.18)",
      border: "1px solid rgba(34,197,94,.35)",
    };
  }

  if (s === "cancelled") {
    return {
      ...base,
      background: "rgba(239,68,68,.18)",
      border: "1px solid rgba(239,68,68,.35)",
    };
  }

  return base;
}

function intakeStatusBadge(status: string | null) {
  const s = (status || "").toLowerCase();

  const base = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.06)",
  } as const;

  if (s === "submitted") {
    return {
      ...base,
      background: "rgba(148,163,184,.18)",
      border: "1px solid rgba(148,163,184,.35)",
    };
  }

  if (s === "needs_info") {
    return {
      ...base,
      background: "rgba(245,158,11,.18)",
      border: "1px solid rgba(245,158,11,.35)",
    };
  }

  if (s === "approved") {
    return {
      ...base,
      background: "rgba(59,130,246,.18)",
      border: "1px solid rgba(59,130,246,.35)",
    };
  }

  if (s === "locked") {
    return {
      ...base,
      background: "rgba(34,197,94,.18)",
      border: "1px solid rgba(34,197,94,.35)",
    };
  }

  return base;
}

function visitStatusBadge(status: string | null) {
  const s = (status || "").toLowerCase();

  const base = {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.06)",
  };

  if (s === "open")
    return {
      ...base,
      background: "rgba(59,130,246,.18)",
      border: "1px solid rgba(59,130,246,.35)",
    };

  if (s === "completed")
    return {
      ...base,
      background: "rgba(34,197,94,.18)",
      border: "1px solid rgba(34,197,94,.35)",
    };

  return base;
}

function fmtMoneyFromCentsString(v: string) {
  if (!v) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return `$${(n / 100).toFixed(2)}`;
}

function fmtMoney(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return null;
  const n = Number(cents);
  if (Number.isNaN(n)) return null;
  return `$${(n / 100).toFixed(2)}`;
}

function prettyCategory(v: string | null) {
  if (!v) return "Service";
  return v.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function readableStatus(v: string | null | undefined) {
  return (v || "unknown").replaceAll("_", " ");
}

function compactDescription(value: string | null | undefined, maxLength = 120) {
  const text = (value ?? "").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function getFollowUpDaysFromPlan(plan: TreatmentPlanPayload | null | undefined): number | null {
  const v = plan?.follow_up_days;
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getFollowUpDate(plan: TreatmentPlanPayload | null | undefined, referenceDate: string) {
  const days = Number(plan?.follow_up_days);

  if (!Number.isFinite(days)) return null;

  const base = new Date(referenceDate);
  const next = new Date(base);

  next.setDate(base.getDate() + days);

  return next;
}

function documentDisplayTitle(file: PatientFileRow) {
  const dateLabel = file.created_at
    ? new Date(file.created_at).toLocaleDateString()
    : "";

  if (file.category === "visit_packet_patient_copy") {
    return dateLabel ? `Visit Summary - ${dateLabel}` : "Visit Summary";
  }

  if (file.category === "wound_photo") {
    return dateLabel ? `Wound Photo - ${dateLabel}` : "Wound Photo";
  }

  if (file.category === "appointment_attachment") {
    return dateLabel ? `Appointment Attachment - ${dateLabel}` : "Appointment Attachment";
  }

  return file.filename || "Document";
}

function documentDisplaySubtitle(file: PatientFileRow) {
  if (file.category === "visit_packet_patient_copy") {
    return "Patient-safe PDF summary from your provider visit.";
  }

  if (file.category === "wound_photo") {
    return "Uploaded image for clinical review.";
  }

  if (file.category === "appointment_attachment") {
    return "Attachment linked to an appointment.";
  }

  return file.category ? file.category.replaceAll("_", " ") : "Document";
}

function isImageFileName(name: string, contentType?: string | null) {
  return (contentType ?? "").startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name);
}

function alertCardStyle(tone: "info" | "warning" | "success") {
  if (tone === "warning") {
    return {
      background: "rgba(245,158,11,.12)",
      border: "1px solid rgba(245,158,11,.28)",
      color: "#1f1633",
    };
  }

  if (tone === "success") {
    return {
      background: "rgba(34,197,94,.12)",
      border: "1px solid rgba(34,197,94,.28)",
      color: "#1f1633",
    };
  }

  return {
    background: "rgba(59,130,246,.12)",
    border: "1px solid rgba(59,130,246,.28)",
    color: "#1f1633",
  };
}

function timelineDotStyle(tone: "info" | "warning" | "success") {
  if (tone === "warning") return { background: "rgba(245,158,11,1)" };
  if (tone === "success") return { background: "rgba(34,197,94,1)" };
  return { background: "rgba(59,130,246,1)" };
}

function nextStepCardStyle(tone: "info" | "warning" | "success") {
  if (tone === "warning") {
    return {
      background: "linear-gradient(135deg, rgba(245,158,11,.16), rgba(245,158,11,.08))",
      border: "1px solid rgba(245,158,11,.28)",
      color: "#1f1633",
    };
  }

  if (tone === "success") {
    return {
      background: "linear-gradient(135deg, rgba(34,197,94,.16), rgba(34,197,94,.08))",
      border: "1px solid rgba(34,197,94,.28)",
      color: "#1f1633",
    };
  }

  return {
    background: "linear-gradient(135deg, rgba(59,130,246,.16), rgba(59,130,246,.08))",
    border: "1px solid rgba(59,130,246,.28)",
    color: "#1f1633",
  };
}

export default function PatientHome() {
  const { user, resumeKey } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillServiceId = searchParams.get("serviceId") ?? "";
  const prefillServiceName = searchParams.get("serviceName") ?? "";
  const prefillCategory = searchParams.get("category") ?? "";
  const prefillConsult = searchParams.get("consult") ?? "";
  const prefillPrice = searchParams.get("price") ?? "";

  // ONBOARDING GATE
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [locationId, setLocationId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [date, setDate] = useState<string>(""); // YYYY-MM-DD
  const [notes, setNotes] = useState<string>("");
  const [woundPhotos, setWoundPhotos] = useState<File[]>([]);
  const [uploadingApptFiles, setUploadingApptFiles] = useState(false);

  const [hours, setHours] = useState<LocationHoursRow | null>(null);
  const [taken, setTaken] = useState<Set<string>>(new Set()); // ISO strings
  const [selectedSlotIso, setSelectedSlotIso] = useState<string>("");

  // patient appointment list
  const [myAppointments, setMyAppointments] = useState<ApptRow[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<ApptRow | null>(null);
  const [appointmentDrawerFiles, setAppointmentDrawerFiles] = useState<File[]>([]);
  const [uploadingDrawerFiles, setUploadingDrawerFiles] = useState(false);
  const [appointmentFiles, setAppointmentFiles] = useState<AppointmentFileRow[]>([]);
  const [appointmentFileUrls, setAppointmentFileUrls] = useState<Record<string, string>>({});
  const [loadingAppointmentFiles, setLoadingAppointmentFiles] = useState(false);
  const [appointmentIntakeStatus, setAppointmentIntakeStatus] = useState<AppointmentIntakeStatusRow | null>(null);
  const [loadingAppointmentIntakeStatus, setLoadingAppointmentIntakeStatus] = useState(false);
  const [appointmentVisit, setAppointmentVisit] = useState<AppointmentVisitRow | null>(null);
  const [loadingAppointmentVisit, setLoadingAppointmentVisit] = useState(false);
  const [nextAppointment, setNextAppointment] = useState<ApptRow | null>(null);
  const [unreadThreads, setUnreadThreads] = useState<number>(0);
  const [latestTreatmentPlan, setLatestTreatmentPlan] = useState<LatestTreatmentPlanRow | null>(null);
  const [patientSafePlan, setPatientSafePlan] = useState<PatientSafeTreatmentPlan | null>(null);
  const [loadingPatientSafePlan, setLoadingPatientSafePlan] = useState(false);
  const [recentLabs, setRecentLabs] = useState<PatientLabRow[]>([]);
  const [loadingLabsPreview, setLoadingLabsPreview] = useState(false);
  const [patientFiles, setPatientFiles] = useState<PatientFileRow[]>([]);
  const [latestVitalAiSession, setLatestVitalAiSession] = useState<VitalAiSessionRow | null>(null);

  // latest wound intake status
  const [latestWoundIntake, setLatestWoundIntake] = useState<LatestWoundIntake | null>(null);
  const [loadingWound, setLoadingWound] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<{
    appointmentId: string;
    locationName: string;
    serviceName: string;
    slotIso: string;
  } | null>(null);

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === locationId) ?? null,
    [locations, locationId]
  );

  const filteredServices = useMemo(
    () => services.filter((s) => s.location_id === locationId),
    [services, locationId]
  );

  const locName = useMemo(() => {
    const m = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string) => m.get(id) ?? id;
  }, [locations]);

  const svcName = useMemo(() => {
    const m = new Map(services.map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? m.get(id) ?? "-" : "-");
  }, [services]);

  const serviceById = useMemo(() => {
    const m = new Map(services.map((s) => [s.id, s]));
    return (id: string | null) => (id ? m.get(id) ?? null : null);
  }, [services]);

  const featuredServices = useMemo(() => {
    return services.slice(0, 6);
  }, [services]);

  const getPatientAppointmentIds = async () => {
    if (!user?.id) return [] as string[];

    const ids = new Set<string>([user.id]);
    const patientId = await getPatientRecordIdForProfile(user.id);
    if (patientId) ids.add(patientId);
    return Array.from(ids);
  };

  const nextFollowUpDate = useMemo(() => {
    if (!patientSafePlan) return null;

    const ref =
      patientSafePlan.signed_at ??
      patientSafePlan.updated_at ??
      patientSafePlan.created_at;

    return getFollowUpDate(patientSafePlan.plan, ref);
  }, [patientSafePlan]);

  const dayOfWeek = useMemo(() => {
    if (!date) return null;
    const [y, m, d] = date.split("-").map((x) => Number(x));
    const local = new Date(y, m - 1, d);
    return local.getDay(); // 0..6
  }, [date]);

  const selectedServiceSummary = useMemo(() => {
    if (!prefillServiceId) return null;

    const matched = services.find((s) => s.id === prefillServiceId);

    return {
      id: prefillServiceId,
      name: prefillServiceName || matched?.name || "Selected Service",
      category: prettyCategory(prefillCategory || matched?.category || ""),
      consult: prefillConsult === "1",
      price: fmtMoneyFromCentsString(prefillPrice),
    };
  }, [prefillServiceId, prefillServiceName, prefillCategory, prefillConsult, prefillPrice, services]);

  const patientAlerts = useMemo<PatientAlertItem[]>(() => {
    const items: PatientAlertItem[] = [];

    if (latestWoundIntake?.status === "needs_info") {
      items.push({
        id: "intake-needs-info",
        tone: "warning",
        title: "Your intake needs an update",
        message: "The clinic requested additional information before moving forward.",
        ctaLabel: "Update Intake",
        ctaAction: () => navigate("/intake?pathway=wound-care&autostart=1"),
      });
    }

    if (nextAppointment) {
      items.push({
        id: "next-appointment",
        tone: "info",
        title: "Upcoming appointment",
        message: `${new Date(nextAppointment.start_time).toLocaleString()} • ${svcName(nextAppointment.service_id)}`,
        ctaLabel: "View Appointments",
        ctaAction: () => {
          const el = document.getElementById("my-appointments");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      });
    } else {
      items.push({
        id: "no-upcoming-appointment",
        tone: "info",
        title: "No upcoming appointment",
        message: "You can book your next visit directly from the portal.",
        ctaLabel: "Book Now",
        ctaAction: () => {
          const el = document.getElementById("book-appointment");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      });
    }

    if (latestTreatmentPlan) {
      items.push({
        id: "care-plan-available",
        tone: "success",
        title: "Care plan available",
        message: latestTreatmentPlan.summary || "Your provider has added a treatment plan.",
        ctaLabel: "View Treatments",
        ctaAction: () => navigate("/patient/treatments"),
      });
    }

    if (recentLabs.length > 0) {
      items.push({
        id: "labs-available",
        tone: "success",
        title: "Recent lab activity",
        message: recentLabs[0]?.lab_name
          ? `${recentLabs[0].lab_name} is available in your labs section.`
          : "New lab information is available.",
        ctaLabel: "Open Labs",
        ctaAction: () => navigate("/patient/labs"),
      });
    }

    return items.slice(0, 4);
  }, [
    latestWoundIntake,
    nextAppointment,
    latestTreatmentPlan,
    recentLabs,
    navigate,
    svcName,
  ]);

  const patientTimeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    if (latestWoundIntake?.created_at) {
      items.push({
        id: `intake-${latestWoundIntake.id}`,
        date: latestWoundIntake.created_at,
        title: "Wound Intake Submitted",
        detail: `Status: ${(latestWoundIntake.status || "unknown").replaceAll("_", " ")}`,
        tone:
          latestWoundIntake.status === "needs_info"
            ? "warning"
            : latestWoundIntake.status === "locked" || latestWoundIntake.status === "approved"
            ? "success"
            : "info",
      });
    }

    myAppointments.slice(0, 3).forEach((a) => {
      items.push({
        id: `appt-${a.id}`,
        date: a.start_time,
        title: "Appointment Activity",
        detail: `${svcName(a.service_id)} • ${(a.status || "unknown").replaceAll("_", " ")}`,
        tone:
          a.status === "completed"
            ? "success"
            : a.status === "cancelled"
            ? "warning"
            : "info",
      });
    });

    if (latestTreatmentPlan?.created_at) {
      items.push({
        id: `plan-${latestTreatmentPlan.id}`,
        date: latestTreatmentPlan.created_at,
        title: "Treatment Plan Updated",
        detail: latestTreatmentPlan.summary || "A care plan was added to your chart.",
        tone: "success",
      });
    }

    recentLabs.forEach((lab) => {
      items.push({
        id: `lab-${lab.id}`,
        date: lab.collected_at ?? lab.created_at,
        title: "Lab Result Available",
        detail: lab.lab_name || "Lab result posted",
        tone: "info",
      });
    });

    return items
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [latestWoundIntake, myAppointments, latestTreatmentPlan, recentLabs, svcName]);

  const recommendedNextStep = useMemo<NextStepItem | null>(() => {
    if (latestWoundIntake?.status === "needs_info") {
      return {
        title: "Update Your Intake",
        message: "The clinic requested additional information before continuing your care review.",
        ctaLabel: "Update Intake",
        ctaAction: () => navigate("/intake?pathway=wound-care&autostart=1"),
        tone: "warning",
      };
    }

    if (nextAppointment) {
      return {
        title: "Prepare for Your Upcoming Appointment",
        message: `${new Date(nextAppointment.start_time).toLocaleString()} • ${svcName(nextAppointment.service_id)}`,
        ctaLabel: "View Appointments",
        ctaAction: () => {
          const el = document.getElementById("my-appointments");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        },
        tone: "info",
      };
    }

    if (latestTreatmentPlan) {
      return {
        title: "Review Your Care Plan",
        message: latestTreatmentPlan.summary || "Your provider has added a treatment plan to your chart.",
        ctaLabel: "View Treatments",
        ctaAction: () => navigate("/patient/treatments"),
        tone: "success",
      };
    }

    if (recentLabs.length > 0) {
      return {
        title: "Review Recent Lab Results",
        message: recentLabs[0]?.lab_name || "New lab information is available in your chart.",
        ctaLabel: "Open Labs",
        ctaAction: () => navigate("/patient/labs"),
        tone: "success",
      };
    }

    return {
      title: "Book Your Next Appointment",
      message: "You do not have an upcoming appointment scheduled right now.",
      ctaLabel: "Book Now",
      ctaAction: () => {
        const el = document.getElementById("book-appointment");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      tone: "info",
    };
  }, [latestWoundIntake, nextAppointment, latestTreatmentPlan, recentLabs, navigate, svcName]);

  const todayAtAGlance = useMemo(() => {
    return {
      nextAppointmentText: nextAppointment
        ? `${new Date(nextAppointment.start_time).toLocaleString()} • ${svcName(nextAppointment.service_id)}`
        : "No upcoming appointment scheduled",
      intakeText: latestWoundIntake
        ? readableStatus(latestWoundIntake.status)
        : "No intake on file",
      carePlanText: latestTreatmentPlan?.status
        ? readableStatus(latestTreatmentPlan.status)
        : latestTreatmentPlan
        ? "available"
        : "No care plan yet",
      messagesText:
        unreadThreads > 0
          ? `${unreadThreads} active conversation${unreadThreads === 1 ? "" : "s"}`
          : "No active conversations",
    };
  }, [
    nextAppointment,
    latestWoundIntake,
    latestTreatmentPlan,
      unreadThreads,
      svcName,
  ]);

  const nextVirtualVisitState = useMemo(() => {
    if (!nextAppointment) return null;
    const state = getVirtualVisitState(nextAppointment);
    return state.isVirtual ? state : null;
  }, [nextAppointment]);

  const supportedVitalAiAppointment = useMemo(() => {
    return myAppointments.find((appt) => {
      if (!appt?.start_time || new Date(appt.start_time).getTime() < Date.now()) return false;
      if ((appt.status || "").toLowerCase() === "cancelled") return false;

      const svc = serviceById(appt.service_id);
      const typeKey = getCanonicalServiceTypeKey({
        name: svc?.name ?? null,
        category: svc?.category ?? null,
      });
      return typeKey === "general" || typeKey === "wound_care";
    }) ?? null;
  }, [myAppointments, serviceById]);

  const vitalAiHeroState = useMemo(() => {
    const dashboardAction = {
      label: "Continue to Dashboard",
      onClick: () => {
        const el = document.getElementById("patient-portal-content");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      },
    };

    if (latestVitalAiSession?.status === "draft") {
      return {
        eyebrow: "Continue Your Intake",
        title: "Hi, I'm Vital AI - your intake assistant. I'll guide you through a few steps so our team can prepare for your visit.",
        guidance:
          "Start or resume your intake so our care team can prepare for your visit with the right information ahead of time.",
        statusLabel: "Draft intake saved",
        statusTone: "rgba(59,130,246,.18)",
        primary: {
          label: "Continue Intake Form",
          onClick: () => navigate(`/intake/session/${latestVitalAiSession.id}`),
        },
        secondary: dashboardAction,
      };
    }

    if (latestVitalAiSession?.status === "submitted") {
      return {
        eyebrow: "Intake Submitted",
        title: "Hi, I'm Vital AI - your intake assistant. I'll guide you through a few steps so our team can prepare for your visit.",
        guidance:
          "Your intake has been submitted successfully. Our clinical team is reviewing your information now, and you can continue using the rest of your portal below.",
        statusLabel: "Under review",
        statusTone: "rgba(34,197,94,.18)",
        primary: {
          label: "View Appointments",
          onClick: () => {
            const el = document.getElementById("my-appointments");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          },
        },
        secondary: dashboardAction,
      };
    }

    if (supportedVitalAiAppointment) {
      const svc = serviceById(supportedVitalAiAppointment.service_id);
      return {
        eyebrow: "Start with Vital AI",
        title: "Hi, I'm Vital AI - your intake assistant. I'll guide you through a few steps so our team can prepare for your visit.",
        guidance: `Start or resume your intake so our care team can prepare for your ${svc?.name ?? "visit"} with the right information ahead of time.`,
        statusLabel: "Recommended before your visit",
        statusTone: "rgba(139,124,255,.20)",
        primary: {
          label: "Start Intake",
          onClick: () => navigate(`/intake?appointmentId=${supportedVitalAiAppointment.id}`),
        },
        secondary: dashboardAction,
      };
    }

    return {
      eyebrow: "Start with Vital AI",
      title: "Hi, I'm Vital AI - your intake assistant. I'll guide you through a few steps so our team can prepare for your visit.",
      guidance: "Start or resume your intake so our care team can prepare for your visit with the right information ahead of time.",
      statusLabel: "General consult and wound care",
      statusTone: "rgba(139,124,255,.20)",
      primary: {
        label: "Start Intake",
        onClick: () => navigate("/intake"),
      },
      secondary: dashboardAction,
    };
  }, [latestVitalAiSession, navigate, serviceById, supportedVitalAiAppointment]);

  const scrollToBooking = () => {
    const el = document.getElementById("book-appointment");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToAppointments = () => {
    const el = document.getElementById("my-appointments");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const vitalAiHeroActions = useMemo(() => {
    const actions = [
      {
        key: "primary",
        label: vitalAiHeroState.primary.label,
        onClick: vitalAiHeroState.primary.onClick,
        className: "btn btn-primary",
      },
      {
        key: "secondary",
        label: vitalAiHeroState.secondary.label,
        onClick: vitalAiHeroState.secondary.onClick,
        className: "btn btn-secondary",
      },
    ];

    return actions.filter((action, index, list) => list.findIndex((item) => item.label === action.label) === index);
  }, [vitalAiHeroState]);

  useEffect(() => {
    if (!prefillServiceId) return;
    setServiceId(prefillServiceId);
  }, [prefillServiceId]);

  useEffect(() => {
    let cancelled = false;

    const loadAppointmentFiles = async () => {
      if (!selectedAppointment?.id) {
        setAppointmentFiles([]);
        setAppointmentFileUrls({});
        return;
      }

      setLoadingAppointmentFiles(true);

      try {
        const { data, error } = await supabase
          .from("patient_files")
          .select("id,created_at,appointment_id,filename,category,bucket,path,content_type,size_bytes")
          .eq("appointment_id", selectedAppointment.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const rows = (data as AppointmentFileRow[]) ?? [];
        if (cancelled) return;

        setAppointmentFiles(rows);

        const out: Record<string, string> = {};
        for (const f of rows) {
          try {
            const url = await getSignedUrl(f.bucket, f.path);
            out[f.id] = url;
          } catch {
            // ignore URL failures
          }
        }

        if (!cancelled) setAppointmentFileUrls(out);
      } catch (e: unknown) {
        if (!cancelled) setErr(getErrorMessage(e, "Failed to load appointment files."));
      } finally {
        if (!cancelled) setLoadingAppointmentFiles(false);
      }
    };

    loadAppointmentFiles();

    return () => {
      cancelled = true;
    };
  }, [selectedAppointment?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadAppointmentIntakeStatus = async () => {
      if (!selectedAppointment?.id || !user?.id) {
        setAppointmentIntakeStatus(null);
        return;
      }

      setLoadingAppointmentIntakeStatus(true);

      try {
        const patientId = await getPatientRecordIdForProfile(user.id);
        if (!patientId) {
          setAppointmentIntakeStatus(null);
          return;
        }

        const svc = serviceById(selectedAppointment.service_id);
        const serviceType = getCanonicalPatientIntakeServiceType({
          name: svc?.name ?? null,
          category: svc?.category ?? null,
        });

        const { data, error } = await supabase
          .from("patient_intakes")
          .select("id,status,service_type,created_at,locked_at")
          .eq("patient_id", patientId)
          .eq("service_type", serviceType)
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) throw error;

        if (!cancelled) {
          setAppointmentIntakeStatus((data?.[0] as AppointmentIntakeStatusRow) ?? null);
        }
      } catch (e: unknown) {
        if (!cancelled) setErr(getErrorMessage(e, "Failed to load intake status."));
      } finally {
        if (!cancelled) setLoadingAppointmentIntakeStatus(false);
      }
    };

    loadAppointmentIntakeStatus();

    return () => {
      cancelled = true;
    };
  }, [selectedAppointment?.id, user?.id, serviceById]);

  useEffect(() => {
    let cancelled = false;

    const loadAppointmentVisit = async () => {
      if (!selectedAppointment?.id) {
        setAppointmentVisit(null);
        return;
      }

      setLoadingAppointmentVisit(true);

      try {
        const { data, error } = await supabase
          .from("patient_visits")
          .select("id,appointment_id,visit_date,created_at,status")
          .eq("appointment_id", selectedAppointment.id)
          .maybeSingle();

        if (error) throw error;

        if (!cancelled) {
          setAppointmentVisit((data as AppointmentVisitRow) ?? null);
        }
      } catch (e: unknown) {
        if (!cancelled) setErr(getErrorMessage(e, "Failed to load visit info."));
      } finally {
        if (!cancelled) setLoadingAppointmentVisit(false);
      }
    };

    loadAppointmentVisit();

    return () => {
      cancelled = true;
    };
  }, [selectedAppointment?.id]);

  useEffect(() => {
    if (!prefillServiceId || !services.length) return;
    if (locationId) return;

    const matched = services.find((s) => s.id === prefillServiceId);
    if (matched?.location_id) {
      setLocationId(matched.location_id);
    } else if (!locationId && locations.length === 1) {
      setLocationId(locations[0].id);
    }
  }, [prefillServiceId, services, locationId, locations]);

  useEffect(() => {
    if (!prefillServiceId) return;

    const el = document.getElementById("book-appointment");
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [prefillServiceId]);

  const loadMyAppointments = async () => {
    if (!user) return;
    setLoadingMine(true);

    const patientIds = await getPatientAppointmentIds();
    const { data, error } = await supabase
      .from("appointments")
      .select(
        "id,location_id,start_time,status,service_id,notes,visit_type,telehealth_enabled,meeting_url,meeting_provider,meeting_status,join_window_opens_at,virtual_instructions,provider_user_id"
      )
      .in("patient_id", patientIds)
      .order("start_time", { ascending: false })
      .limit(25);

    setLoadingMine(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setMyAppointments((data as ApptRow[]) ?? []);
  };

  const loadDashboard = async () => {
    if (!user?.id) return;

    try {
      const patientIds = await getPatientAppointmentIds();
      // NEXT APPOINTMENT
      const { data: nextAppt } = await supabase
        .from("appointments")
        .select(
          "id,start_time,location_id,status,service_id,notes,visit_type,telehealth_enabled,meeting_url,meeting_provider,meeting_status,join_window_opens_at,virtual_instructions,provider_user_id"
        )
        .in("patient_id", patientIds)
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle();

      setNextAppointment((nextAppt as ApptRow) ?? null);

      // UNREAD MESSAGES
      setUnreadThreads(await countLegacyOpenThreadsForPatient(user.id));

    } catch (e) {
      console.error("Dashboard load error", e);
    }
  };

  const loadLatestTreatmentPlan = async () => {
    if (!user?.id) return;

    try {
        const { data: visits, error: vErr } = await supabase
          .from("patient_visits")
          .select("id")
          .eq("patient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (vErr) throw vErr;

        const visitIds = ((visits as VisitIdRow[] | null) ?? []).map((v) => v.id);
      if (visitIds.length === 0) {
        setLatestTreatmentPlan(null);
        return;
      }

      const { data, error } = await supabase
        .from("patient_treatment_plans")
        .select("id,visit_id,created_at,status,summary,patient_instructions")
        .in("visit_id", visitIds)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      setLatestTreatmentPlan((data?.[0] as LatestTreatmentPlanRow) ?? null);
    } catch (e) {
      console.error("Treatment plan load failed:", e);
      setLatestTreatmentPlan(null);
    }
  };

  const loadPatientSafePlan = async () => {
    if (!user?.id) return;
    setLoadingPatientSafePlan(true);

    try {
        const { data: visits, error: vErr } = await supabase
          .from("patient_visits")
          .select("id")
          .eq("patient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(15);

      if (vErr) throw vErr;

        const visitIds = ((visits as VisitIdRow[] | null) ?? []).map((v) => v.id);
      if (visitIds.length === 0) {
        setPatientSafePlan(null);
        return;
      }

      const { data, error } = await supabase
        .from("patient_treatment_plans")
        .select("id,visit_id,created_at,updated_at,signed_at,status,summary,patient_instructions,plan")
        .in("visit_id", visitIds)
        .in("status", ["active", "signed", "completed"])
        .order("signed_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      setPatientSafePlan((data?.[0] as PatientSafeTreatmentPlan) ?? null);
    } catch (e) {
      console.error("Patient-safe treatment plan load failed:", e);
      setPatientSafePlan(null);
    } finally {
      setLoadingPatientSafePlan(false);
    }
  };

  const loadRecentLabsPreview = async () => {
    if (!user?.id) return;
    setLoadingLabsPreview(true);

    try {
        const patientId = await getPatientRecordIdForProfile(user.id);
        if (!patientId) {
          setRecentLabs([]);
          return;
      }

      const { data, error } = await supabase
        .from("patient_labs")
        .select("id,created_at,patient_id,lab_name,result_summary,status,collected_at")
        .eq("patient_id", patientId)
        .order("colected_at", { ascending: false })
        .limit(3);

      if (error) {
        const fallback = await supabase
          .from("patient_labs")
          .select("id,created_at,patient_id,lab_name,result_summary,status,collected_at")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false })
          .limit(3);

        if (fallback.error) throw fallback.error;
        setRecentLabs((fallback.data as PatientLabRow[]) ?? []);
        return;
      }

      setRecentLabs((data as PatientLabRow[]) ?? []);
    } catch (e) {
      console.error("Labs preview load failed:", e);
      setRecentLabs([]);
    } finally {
      setLoadingLabsPreview(false);
    }
  };

  const loadPatientFiles = async () => {
    if (!user?.id) return;

    try {
        const patientId = await getPatientRecordIdForProfile(user.id);
        if (!patientId) {
          setPatientFiles([]);
          return;
      }

        const { data: files } = await supabase
          .from("patient_files")
          .select("*")
          .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(10);

        if (files) setPatientFiles((files as PatientFileRow[]) ?? []);
    } catch (e) {
      console.error("Patient files load failed:", e);
      setPatientFiles([]);
    }
  };

  const loadLatestWoundIntake = async () => {
    if (!user?.id) return;
    setLoadingWound(true);

    try {
      // patient_id in patient_intakes references patients.id, so we need patients.id first
        const patientId = await getPatientRecordIdForProfile(user.id);
        if (!patientId) {
          setLatestWoundIntake(null);
          return;
      }

      const { data, error } = await supabase
        .from("patient_intakes")
        .select("id,status,created_at,locked_at")
        .eq("patient_id", patientId)
        .eq("service_type", "wound_care")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      const latest = (data?.[0] ?? null) as LatestWoundIntake | null;
      setLatestWoundIntake(latest);
    } catch {
      setLatestWoundIntake(null);
    } finally {
      setLoadingWound(false);
    }
  };

  const loadLatestVitalAiSession = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("vital_ai_sessions")
        .select("id,status,updated_at,completed_at,created_at")
        .eq("profile_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      setLatestVitalAiSession((data as VitalAiSessionRow | null) ?? null);
    } catch {
      setLatestVitalAiSession(null);
    }
  };

  // ONBOARDING GATE EFFECT (runs first)
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!user?.id) return;

      try {
        setCheckingOnboarding(true);

        const { data, error } = await supabase
          .from("patients")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (!cancelled && !data?.id) {
          navigate("/patient/onboarding", { replace: true });
          return;
        }
      } catch (e) {
        console.error("Patient onboarding gate failed:", e);
        // Don't lock the user out if something temporary fails.
      } finally {
        if (!cancelled) setCheckingOnboarding(false);
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [navigate, resumeKey, user?.id]);

  // Prevent running the heavy portal loaders until onboarding is confirmed
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setErr(null);
      setLoading(true);

      try {
        const { data: locs, error: locErr } = await supabase
          .from("locations")
          .select("id,name,city,state")
          .order("name");
        if (locErr) throw locErr;

        const { data: svcs, error: svcErr } = await supabase
          .from("services")
          .select("id,name,location_id,category,visit_type,description,price_marketing_cents,price_regular_cents")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("name");
        if (svcErr) throw svcErr;

        if (cancelled) return;

        setLocations(locs ?? []);
        setServices(svcs ?? []);

        await loadMyAppointments();
        await loadLatestVitalAiSession();
        await loadLatestWoundIntake();
        await loadDashboard();
        await loadLatestTreatmentPlan();
        await loadPatientSafePlan();
        await loadRecentLabsPreview();
        await loadPatientFiles();
      } catch (e: unknown) {
        if (!cancelled) setErr(getErrorMessage(e, "Failed to load patient portal."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (user?.id && !checkingOnboarding) load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeKey, user?.id, checkingOnboarding]);

  useEffect(() => {
    let cancelled = false;

    const loadSlots = async () => {
      setErr(null);
      setHours(null);
      setTaken(new Set());
      setSelectedSlotIso("");

      if (!locationId || !date || dayOfWeek === null) return;

      const { data: hrs, error: hrsErr } = await supabase
        .from("location_hours")
        .select("location_id,day_of_week,open_time,close_time,slot_minutes,is_closed")
        .eq("location_id", locationId)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle();

      if (hrsErr) {
        if (!cancelled) setErr(hrsErr.message);
        return;
      }

      if (!hrs) {
        if (!cancelled) setErr("No business hours set for this location/day yet.");
        return;
      }

      if (cancelled) return;

      setHours(hrs);
      if (hrs.is_closed) return;

      const [y, m, d] = date.split("-").map((x) => Number(x));
      const startLocal = new Date(y, m - 1, d, 0, 0, 0);
      const endLocal = new Date(y, m - 1, d, 23, 59, 59);

      const { data: appts, error: apptErr } = await supabase
        .from("appointments")
        .select("start_time")
        .eq("location_id", locationId)
        .gte("start_time", startLocal.toISOString())
        .lte("start_time", endLocal.toISOString());

      if (apptErr) {
        if (!cancelled) setErr(apptErr.message);
        return;
      }

      const set = new Set<string>();
      (appts as { start_time: string }[] | null)?.forEach((a) => set.add(a.start_time));
      if (!cancelled) setTaken(set);
    };

    loadSlots();

    return () => {
      cancelled = true;
    };
  }, [locationId, date, dayOfWeek]);

  const slots = useMemo(() => {
    if (!hours || !locationId || !date) return [];
    if (hours.is_closed) return [];

    const slotMinutes = hours.slot_minutes || 30;

    const [y, m, d] = date.split("-").map((x) => Number(x));
    const [oh, om] = hours.open_time.split(":").map((x) => Number(x));
    const [ch, cm] = hours.close_time.split(":").map((x) => Number(x));

    const open = new Date(y, m - 1, d, oh, om, 0);
    const close = new Date(y, m - 1, d, ch, cm, 0);

    const out: { iso: string; label: string; isTaken: boolean }[] = [];

    for (let t = new Date(open); t < close; t = new Date(t.getTime() + slotMinutes * 60000)) {
      const iso = t.toISOString();
      const isTaken = taken.has(iso);
      out.push({ iso, label: toLocalTimeLabel(iso), isTaken });
    }

    return out;
  }, [hours, locationId, date, taken]);

  const submit = async () => {
    setErr(null);

    if (!user) return;
    if (!locationId) return setErr("Please select a location.");
    if (!date) return setErr("Please select a date.");
    if (!selectedSlotIso) return setErr("Please choose an available time slot.");

    try {
      const { data: created, error: apptErr } = await supabase
        .from("appointments")
        .insert([
          {
            patient_id: user.id,
            location_id: locationId,
            service_id: serviceId || null,
            start_time: selectedSlotIso,
            status: "requested",
            visit_type: "in_person",
            telehealth_enabled: false,
            notes: notes || null,
          },
        ])
        .select("id")
        .maybeSingle();

      if (apptErr) {
        if (isDatabaseErrorWithCode(apptErr, "23505")) {
          setErr("That time just got booked — please choose a different slot.");
          return;
        }
        setErr(apptErr.message);
        return;
      }

      const appointmentId = created?.id as string | undefined;
      if (!appointmentId) {
        setErr("Appointment created but no ID returned.");
        return;
      }

      if (woundPhotos.length > 0) {
        setUploadingApptFiles(true);

        const patientId = await getPatientRecordIdForProfile(user.id);
        if (!patientId) throw new Error("Patient record not found for file uploads.");

        for (const f of woundPhotos) {
          await uploadPatientFile({
            patientId,
            locationId,
            visitId: null,
            appointmentId,
            category: "wound_photo",
            file: f,
          });
        }
      }

      const chosenSlot = selectedSlotIso;

      setBookingSuccess({
        appointmentId,
        locationName: selectedLocation?.name ?? "Selected location",
        serviceName: serviceId ? svcName(serviceId) : "Requested service",
        slotIso: chosenSlot,
      });

      await loadMyAppointments();

      // refresh availability grid
      setTaken((prev) => new Set(prev).add(chosenSlot));

      setNotes("");
      setWoundPhotos([]);
      setSelectedSlotIso("");
    } catch (e: unknown) {
      console.error(e);
      setErr(getErrorMessage(e, "Failed to submit appointment request."));
    } finally {
      setUploadingApptFiles(false);
    }
  };
  const messageFromAppointment = async (appt: ApptRow) => {
    if (!user) return;
    try {
      const threadId = await ensureLegacyAppointmentThread({
        appointmentId: appt.id,
        patientCandidateId: user.id,
        locationId: appt.location_id,
        title: `Appointment - ${new Date(appt.start_time).toLocaleString()}`,
      });
      navigate(`/patient/chat?threadId=${threadId}`);
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Failed to open conversation."));
    }
  };

  const uploadFilesToAppointment = async (appt: ApptRow) => {
    if (!user?.id) return;
    if (appointmentDrawerFiles.length === 0) {
      setErr("Please choose one or more files first.");
      return;
    }

    setErr(null);
    setUploadingDrawerFiles(true);

    try {
        const patientId = await getPatientRecordIdForProfile(user.id);
        if (!patientId) throw new Error("Patient record not found for file uploads.");

      for (const file of appointmentDrawerFiles) {
        await uploadPatientFile({
          patientId,
          locationId: appt.location_id,
          visitId: null,
          appointmentId: appt.id,
          category: "appointment_attachment",
          file,
        });
      }

      setAppointmentDrawerFiles([]);
      const { data, error } = await supabase
        .from("patient_files")
        .select("id,created_at,appointment_id,filename,category,bucket,path,content_type,size_bytes")
        .eq("appointment_id", appt.id)
        .order("created_at", { ascending: false });

      if (!error) {
        const rows = (data as AppointmentFileRow[]) ?? [];
        setAppointmentFiles(rows);

        const out: Record<string, string> = {};
        for (const f of rows) {
          try {
            const url = await getSignedUrl(f.bucket, f.path);
            out[f.id] = url;
          } catch {
            // ignore URL failures
          }
        }
        setAppointmentFileUrls(out);
      }
      alert("Files uploaded to appointment successfully.");
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Failed to upload files to appointment."));
    } finally {
      setUploadingDrawerFiles(false);
    }
  };

  const startIntakeFromAppointment = (appt: ApptRow) => {
    const svc = serviceById(appt.service_id);
    const nextPathway = svc
      ? getGuidedIntakePathwayForService({
          name: svc.name ?? "",
          category: svc.category,
          service_group: svc.visit_type,
        })
      : null;

    if (!nextPathway) {
      navigate(`/intake?appointmentId=${encodeURIComponent(appt.id)}`);
      return;
    }

    navigate(
      `/intake?appointmentId=${encodeURIComponent(appt.id)}&pathway=${encodeURIComponent(nextPathway)}&autostart=1`
    );
  };

  async function openPatientFile(file: PatientFileRow) {
    const { data } = await supabase.storage
      .from(file.bucket || "patient-files")
      .createSignedUrl(file.path, 60);

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  }

  const quickBtnProps = {
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    type: "button" as const,
  };

  const lightSurfaceCardStyle = {
    background: "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(245,241,255,0.94))",
    border: "1px solid rgba(184,164,255,0.22)",
    color: "#1F1633",
    boxShadow: "0 16px 36px rgba(16,24,40,0.08)",
  };

  const glanceCardStyle = {
    flex: "1 1 220px",
    textAlign: "left" as const,
    minHeight: 148,
    background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,245,255,0.92))",
    border: "1px solid rgba(184,164,255,0.22)",
    color: "#1F1633",
    boxShadow: "0 10px 28px rgba(16,24,40,0.08)",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-between",
    cursor: "pointer",
  };

  const sectionEyebrowStyle = {
    fontSize: 12,
    fontWeight: 800,
    color: "#5B4E86",
    textTransform: "uppercase" as const,
    letterSpacing: ".08em",
  };

  const sectionBodyStyle = {
    marginTop: 4,
    color: "#4B5563",
    lineHeight: 1.65,
  };

  const primaryActionCardStyle = {
    ...lightSurfaceCardStyle,
    padding: 18,
    borderRadius: 18,
    display: "grid",
    gap: 10,
    alignContent: "space-between",
    flex: "1 1 220px",
    minHeight: 170,
  };

  // Gate loading UI (keeps your full page intact, but prevents rendering before gate check)
  if (checkingOnboarding) {
    return (
      <div className="app-bg">
        <div className="shell">
          <div className="card card-pad">
            <div className="muted">Loading patient profile...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg">
      <div className="shell">
        <div
          className="card card-pad"
          style={{
            background: "linear-gradient(135deg, rgba(27,20,49,.96), rgba(35,26,61,.94))",
            border: "1px solid rgba(184,164,255,.26)",
            boxShadow: "0 24px 70px rgba(10,8,24,.34)",
          }}
        >
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(216,204,255,.88)", textTransform: "uppercase", letterSpacing: ".08em" }}>
                Vital AI
              </div>
              <div style={{ marginTop: 8, fontSize: 26, fontWeight: 900, color: "#FAF7FF", lineHeight: 1.08 }}>
                Your guided intake assistant.
              </div>
              <div style={{ marginTop: 8, maxWidth: 700, color: "rgba(233,226,255,.78)", lineHeight: 1.7 }}>
                Start or resume your intake so our care team can prepare for your visit with the right information ahead of time.
              </div>
            </div>

            <div
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(216,204,255,.20)",
                background: vitalAiHeroState.statusTone,
                color: "#F7F3FF",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {vitalAiHeroState.statusLabel}
            </div>
          </div>

          <div className="space" />

          <VitalAiAvatarAssistant
            title={vitalAiHeroState.title}
            eyebrow={vitalAiHeroState.eyebrow}
            guidanceOverride={vitalAiHeroState.guidance}
            avatarSize={80}
            avatarCircular
          >
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              {vitalAiHeroActions.map((action) => (
                <button key={action.key} className={action.className} type="button" onClick={action.onClick}>
                  {action.label}
                </button>
              ))}
              <button className="btn btn-secondary" type="button" onClick={scrollToBooking}>
                Book Visit
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => navigate("/patient/chat")}>
                Messages
              </button>
            </div>
          </VitalAiAvatarAssistant>
        </div>

        <div className="space" />

        {nextAppointment && nextVirtualVisitState ? (
          <>
            <div
              className="card card-pad"
              style={{
                ...lightSurfaceCardStyle,
              }}
            >
              <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ flex: "1 1 360px" }}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", color: "#6D5F97", fontWeight: 800 }}>
                    Upcoming Virtual Visit
                  </div>
                  <div className="h2" style={{ marginTop: 8, color: "#1F1633" }}>
                    {new Date(nextAppointment.start_time).toLocaleString()}
                  </div>
                  <div style={{ marginTop: 6, lineHeight: 1.7, color: "#4B5563" }}>
                    {svcName(nextAppointment.service_id)} • {locName(nextAppointment.location_id)}
                  </div>
                  {nextAppointment.virtual_instructions ? (
                    <div style={{ marginTop: 8, lineHeight: 1.7, color: "#475569" }}>
                      {nextAppointment.virtual_instructions}
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "grid", gap: 10, justifyItems: "end" }}>
                  <VirtualVisitBadge appointment={nextAppointment} />
                  <JoinVirtualVisitButton appointment={nextAppointment} />
                </div>
              </div>
            </div>

            <div className="space" />
          </>
        ) : null}

        {patientAlerts.length > 0 && (
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            {patientAlerts.map((alert) => (
              <div
                key={alert.id}
                className="card card-pad"
                style={{
                  flex: "1 1 260px",
                  ...alertCardStyle(alert.tone),
                }}
              >
                <div style={{ fontWeight: 800, color: "#140f24" }}>{alert.title}</div>

                <div className="muted" style={{ marginTop: 8, lineHeight: 1.6, color: "#475569" }}>
                  {alert.message}
                </div>

                {alert.ctaLabel && alert.ctaAction ? (
                  <>
                    <div className="space" />
                    <button className="btn btn-secondary" type="button" onClick={alert.ctaAction}>
                      {alert.ctaLabel}
                    </button>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div className="space" />

        {recommendedNextStep ? (
          <div
            className="card card-pad"
            style={nextStepCardStyle(recommendedNextStep.tone)}
          >
            <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Recommended Next Step
                </div>
                <div className="h2" style={{ color: "#140f24" }}>{recommendedNextStep.title}</div>
                <div className="muted" style={{ marginTop: 8, lineHeight: 1.7, color: "#475569" }}>
                  {recommendedNextStep.message}
                </div>
              </div>

              <div>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={recommendedNextStep.ctaAction}
                >
                  {recommendedNextStep.ctaLabel}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space" />

        <div
          id="patient-portal-content"
          className="card card-pad"
          style={{
            ...lightSurfaceCardStyle,
          }}
        >
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={sectionEyebrowStyle}>Dashboard Overview</div>
              <div className="h2" style={{ color: "#1F1633", marginTop: 8 }}>Today at a Glance</div>
              <div style={sectionBodyStyle}>
                Open the areas that matter most right now without hunting through the portal.
              </div>
            </div>

            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => navigate("/patient/treatments")}
            >
              Open My Chart
            </button>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <button
              className="card card-pad"
              type="button"
              style={glanceCardStyle}
              onClick={() => {
                if (nextAppointment) {
                  setAppointmentDrawerFiles([]);
                  setSelectedAppointment(nextAppointment);
                  return;
                }
                scrollToBooking();
              }}
            >
              <div>
                <div style={{ color: "#6D5F97", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Next Appointment
                </div>
                <div style={{ fontWeight: 800, marginTop: 10, lineHeight: 1.6, color: "#1F2937" }}>
                  {todayAtAGlance.nextAppointmentText}
                </div>
              </div>
              <div style={{ color: "#7C3AED", fontSize: 13, fontWeight: 800 }}>
                {nextAppointment ? "Open appointment details" : "Book an appointment"}
              </div>
            </button>

            <button
              className="card card-pad"
              type="button"
              style={glanceCardStyle}
              onClick={() => navigate("/intake")}
            >
              <div>
                <div style={{ color: "#6D5F97", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Intake Status
                </div>
                <div style={{ fontWeight: 800, marginTop: 10, lineHeight: 1.6, color: "#1F2937" }}>
                  {todayAtAGlance.intakeText}
                </div>
              </div>
              <div style={{ color: "#7C3AED", fontSize: 13, fontWeight: 800 }}>
                {latestVitalAiSession?.status === "draft" ? "Continue Intake Form" : "Open Vital AI intake"}
              </div>
            </button>

            <button
              className="card card-pad"
              type="button"
              style={glanceCardStyle}
              onClick={() => navigate("/patient/treatments")}
            >
              <div>
                <div style={{ color: "#6D5F97", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Care Plan
                </div>
                <div style={{ fontWeight: 800, marginTop: 10, lineHeight: 1.6, color: "#1F2937" }}>
                  {todayAtAGlance.carePlanText}
                </div>
              </div>
              <div style={{ color: "#7C3AED", fontSize: 13, fontWeight: 800 }}>
                Review treatment instructions
              </div>
            </button>

            <button
              className="card card-pad"
              type="button"
              style={glanceCardStyle}
              onClick={() => navigate("/patient/chat")}
            >
              <div>
                <div style={{ color: "#6D5F97", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Messages
                </div>
                <div style={{ fontWeight: 800, marginTop: 10, lineHeight: 1.6, color: "#1F2937" }}>
                  {todayAtAGlance.messagesText}
                </div>
              </div>
              <div style={{ color: "#7C3AED", fontSize: 13, fontWeight: 800 }}>
                Open secure messages
              </div>
            </button>
          </div>
        </div>

        <div id="my-appointments" className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ ...sectionEyebrowStyle, color: "#D8CCFF" }}>Quick Access</div>
              <div className="h1">Choose Your Next Step</div>
              <div className="muted" style={{ marginTop: 6, color: "rgba(226,232,240,0.8)" }}>
                Use the main actions below to keep your care moving without extra clicks.
              </div>
            </div>
          </div>

          <div className="space" />

          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div
              style={{
                ...primaryActionCardStyle,
                background: "linear-gradient(135deg, rgba(84,60,158,0.96), rgba(54,36,112,0.98))",
                border: "1px solid rgba(216,204,255,0.22)",
                color: "#F8FAFC",
              }}
            >
              <div style={{ ...sectionEyebrowStyle, color: "rgba(232,224,255,0.86)" }}>Primary Action</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#F8FAFC" }}>Book Visit</div>
                <div style={{ marginTop: 8, color: "rgba(226,232,240,0.82)", lineHeight: 1.6 }}>
                  Reserve your next visit or follow-up without leaving the dashboard.
                </div>
              </div>
              <div>
                <button className="btn btn-primary" {...quickBtnProps} onClick={scrollToBooking}>
                  Book Visit
                </button>
              </div>
            </div>

            <div style={primaryActionCardStyle}>
              <div style={sectionEyebrowStyle}>Intake</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#241B3D" }}>
                  {latestVitalAiSession?.status === "draft" ? "Continue Intake" : "Start with Vital AI"}
                </div>
                <div style={{ marginTop: 8, color: "#4B5563", lineHeight: 1.6 }}>
                  {latestVitalAiSession?.status === "draft"
                    ? "Pick up where you left off so the care team has the details they need."
                    : "Complete a guided intake before your next visit."}
                </div>
              </div>
              <div>
                <button className="btn btn-secondary" {...quickBtnProps} onClick={() => navigate("/intake")}>
                  {latestVitalAiSession?.status === "draft" ? "Continue Intake" : "Open Intake"}
                </button>
              </div>
            </div>

            <div style={primaryActionCardStyle}>
              <div style={sectionEyebrowStyle}>Messages</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#241B3D" }}>Message Clinic</div>
                <div style={{ marginTop: 8, color: "#4B5563", lineHeight: 1.6 }}>
                  Review updates, reply to your care team, and keep care coordination moving.
                </div>
              </div>
              <div>
                <button className="btn btn-secondary" {...quickBtnProps} onClick={() => navigate("/patient/chat")}>
                  Open Messages
                </button>
              </div>
            </div>
          </div>

          <div className="space" />

          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div className="muted" style={{ color: "rgba(226,232,240,0.78)" }}>Latest wound-care intake:</div>
              {loadingWound ? (
                <span className="muted">Loading...</span>
              ) : latestWoundIntake ? (
                <span style={statusBadge(latestWoundIntake.status)}>{latestWoundIntake.status.toUpperCase()}</span>
              ) : (
                <span className="muted" style={{ color: "rgba(226,232,240,0.72)" }}>Not submitted</span>
              )}
              {latestWoundIntake?.created_at ? (
                <span className="muted" style={{ fontSize: 12, color: "rgba(226,232,240,0.72)" }}>
                  Updated {new Date(latestWoundIntake.created_at).toLocaleDateString()}
                </span>
              ) : null}
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-secondary" {...quickBtnProps} onClick={scrollToAppointments}>
                My Appointments
              </button>
              <button className="btn btn-secondary" {...quickBtnProps} onClick={() => navigate("/patient/treatments")}>
                Open My Chart
              </button>
              <button className="btn btn-secondary" {...quickBtnProps} onClick={() => navigate("/patient/services")}>
                Browse Services
              </button>
            </div>
          </div>
        </div>

        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ ...sectionEyebrowStyle, color: "#D8CCFF" }}>Explore Treatments</div>
              <div className="h2" style={{ marginTop: 8 }}>Browse Care Options</div>
              <div className="muted" style={{ marginTop: 4, color: "rgba(226,232,240,0.78)" }}>
                Review a few highlighted services, then open the full catalog when you want more detail.
              </div>
            </div>

            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => navigate("/patient/services")}
            >
              View All Services
            </button>
          </div>

          <div className="space" />

          {featuredServices.length === 0 ? (
            <div className="muted">No services available yet.</div>
          ) : (
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              {featuredServices.map((service) => {
                const price =
                  fmtMoney(service.price_marketing_cents) ??
                  fmtMoney(service.price_regular_cents);

                return (
                    <div
                      key={service.id}
                      className="card card-pad"
                      role="button"
                    tabIndex={0}
                    style={{
                      flex: "1 1 300px",
                      minWidth: 280,
                      background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,241,255,0.95))",
                      border: "1px solid rgba(184,164,255,0.22)",
                      boxShadow: "0 16px 32px rgba(16,24,40,0.10)",
                      cursor: "pointer",
                    }}
                    onClick={() => navigate("/patient/services")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate("/patient/services");
                      }
                    }}
                    >
                      <div style={{ fontSize: 12, color: "#5B4E86", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
                        {prettyCategory(service.category)}
                      </div>

                      <div className="h2" style={{ marginTop: 8, color: "#1F1633" }}>
                        {service.name}
                      </div>

                      {service.description ? (
                        <div className="muted" style={{ marginTop: 8, lineHeight: 1.6, color: "#4B5563" }}>
                          {compactDescription(service.description)}
                        </div>
                      ) : null}

                    <div className="space" />

                    {price ? (
                        <div style={{ fontSize: 24, fontWeight: 900, color: "#241B3D" }}>
                          {price}
                        </div>
                      ) : (
                        <div className="muted" style={{ color: "#4B5563" }}>Consultation based pricing</div>
                      )}

                    <div className="space" />

                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(
                            `/patient?serviceId=${service.id}` +
                              `&serviceName=${encodeURIComponent(service.name)}` +
                              `&category=${encodeURIComponent(service.category ?? "")}` +
                              `&price=${service.price_marketing_cents ?? service.price_regular_cents ?? ""}`
                          );
                        }}
                      >
                        Book Visit
                      </button>

                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate("/patient/services");
                        }}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space" />

        <div id="book-appointment" className="card card-pad" style={lightSurfaceCardStyle}>
          <div style={sectionEyebrowStyle}>Book Visit</div>
          <div className="h2" style={{ color: "#1F1633", marginTop: 8 }}>Request Your Next Visit</div>
          <div className="muted" style={{ marginTop: 4, color: "#4B5563" }}>
            Choose your location, service, date, and an available time slot.
          </div>

          <div className="space" />

          {selectedServiceSummary ? (
            <div
              className="card card-pad card-light"
              style={{
                marginBottom: 16,
              }}
            >
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                Selected Service
              </div>

              <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div className="h2">{selectedServiceSummary.name}</div>
                  <div className="muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
                    Complete the appointment request below to reserve your consultation or treatment slot.
                  </div>
                </div>

                <div style={{ minWidth: 180 }}>
                  {selectedServiceSummary.price ? (
                    <>
                      <div className="muted" style={{ fontSize: 12 }}>Starting Price</div>
                      <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>
                        {selectedServiceSummary.price}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="muted" style={{ fontSize: 12 }}>Pricing</div>
                      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                        Consultation Based
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {selectedServiceSummary.category ? (
                  <div className="v-chip">{selectedServiceSummary.category}</div>
                ) : null}

                <div className="v-chip">
                  {selectedServiceSummary.consult ? "Provider Review Required" : "Bookable Online"}
                </div>
              </div>
            </div>
          ) : null}

          {loading && <div className="muted">Loading...</div>}
          {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

          {!loading && (
            <>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <select
                  className="input"
                  style={{ flex: "1 1 260px" }}
                  value={locationId}
                  onChange={(e) => {
                    const nextLocationId = e.target.value;
                    setLocationId(nextLocationId);
                    setSelectedSlotIso("");

                    if (serviceId) {
                      const stillValid = services.some(
                        (s) => s.id === serviceId && s.location_id === nextLocationId
                      );

                      if (!stillValid) {
                        setServiceId("");
                      }
                    }
                  }}
                >
                  <option value="">Select Location</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.city ? ` - ${l.city}` : ""}
                    </option>
                  ))}
                </select>

                <select
                  className="input"
                  style={{ flex: "1 1 260px" }}
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  disabled={!locationId}
                >
                  <option value="">Select Service</option>
                  {filteredServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  className="input"
                  style={{ flex: "1 1 200px" }}
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSelectedSlotIso("");
                  }}
                />

                {hours && hours.is_closed && <div className="muted">This location is closed on that day.</div>}

                {hours && !hours.is_closed && (
                  <div className="muted" style={{ fontSize: 12 }}>
                    Slots every {hours.slot_minutes} min - Hours {hours.open_time.slice(0, 5)}-{hours.close_time.slice(0, 5)}
                  </div>
                )}
              </div>

              <div className="space" />

              {locationId && date && hours && !hours.is_closed && (
                <div className="card card-pad card-light surface-light" style={{ marginBottom: 16 }}>
                  <div className="h2" style={{ color: "#1F1633" }}>Available Times</div>
                  <div className="space" />

                  {slots.length === 0 ? (
                    <div className="muted">No slots available (or hours not set).</div>
                  ) : (
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      {slots.map((s) => {
                        const active = selectedSlotIso === s.iso;
                        const disabled = s.isTaken;

                        return (
                          <button
                            key={s.iso}
                            className={active ? "btn btn-primary" : "btn btn-secondary"}
                            onClick={() => setSelectedSlotIso(s.iso)}
                            disabled={disabled}
                            title={disabled ? "Already booked" : "Select"}
                            type="button"
                            style={{
                              minWidth: 96,
                              fontWeight: 800,
                              letterSpacing: 0.2,
                              opacity: disabled ? 0.45 : 1,
                            }}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedSlotIso && (
                    <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                      Selected time: {toLocalTimeLabel(selectedSlotIso)}
                    </div>
                  )}
                </div>
              )}

              <textarea
                className="input"
                style={{ width: "100%", minHeight: 90 }}
                placeholder="Notes (optional) - what are you coming in for?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <div className="space" />

              <div className="card card-pad card-light">
                <div className="h2">Optional: Upload Wound Photos</div>
                <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                  These will be attached to your appointment request so the clinical team can review before your visit.
                </div>

                <div className="space" />

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setWoundPhotos(files);
                  }}
                />

                {woundPhotos.length > 0 && (
                  <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                    Selected: {woundPhotos.length} photo{woundPhotos.length === 1 ? "" : "s"}
                  </div>
                )}
              </div>

              <div className="space" />

              <div className="card card-pad card-light">
                <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>Ready to request your appointment?</div>
                    <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                      Review your selected location, service, date, and time before submitting.
                    </div>

                    {selectedLocation && (
                      <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                        Location: {selectedLocation.name}
                        {selectedLocation.city ? ` (${selectedLocation.city}, ${selectedLocation.state ?? ""})` : ""}
                      </div>
                    )}

                    {serviceId ? (
                      <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                        Service: {svcName(serviceId)}
                      </div>
                    ) : null}

                    {selectedSlotIso ? (
                      <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                        Time: {toLocalTimeLabel(selectedSlotIso)}
                      </div>
                    ) : null}
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={submit}
                    type="button"
                    disabled={uploadingApptFiles}
                  >
                    {uploadingApptFiles ? "Uploading photos..." : "Request Appointment"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space" />

        <div className="card card-pad" style={lightSurfaceCardStyle}>
          <div style={sectionEyebrowStyle}>Appointments</div>
          <div className="h2" style={{ color: "#1F1633", marginTop: 8 }}>My Appointments</div>
          <div className="muted" style={{ marginTop: 4, color: "#4B5563" }}>
            Review your appointment history, track status updates, and message the clinic for follow-up.
          </div>

          <div className="space" />

          {loadingMine && <div className="muted">Loading...</div>}
          {!loadingMine && myAppointments.length === 0 && <div className="muted">No appointments yet.</div>}

          {!loadingMine &&
            myAppointments.map((a) => (
              <div
                key={a.id}
                className="card card-pad"
                style={{
                  marginBottom: 12,
                  ...lightSurfaceCardStyle,
                  cursor: "pointer",
                }}
                onClick={() => {
                  setAppointmentDrawerFiles([]);
                  setSelectedAppointment(a);
                }}
              >
                <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div className="h2">{new Date(a.start_time).toLocaleString()}</div>
                      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                        <div className="muted" style={{ fontSize: 13, color: "#4B5563" }}>
                          Location: {locName(a.location_id)} {" - "} Service: {svcName(a.service_id)}
                        </div>
                        <VirtualVisitBadge appointment={a} />
                      </div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                      <div className="muted" style={{ fontSize: 12, color: "#5B4E86" }}>
                        Status:
                      </div>
                      <span style={appointmentStatusBadge(a.status)}>
                        {(a.status || "unknown").replaceAll("_", " ").toUpperCase()}
                      </span>
                    </div>
                    {a.notes && (
                      <div className="muted" style={{ fontSize: 13, marginTop: 8, color: "#4B5563" }}>
                        Notes: {a.notes}
                      </div>
                    )}
                    <div className="muted" style={{ fontSize: 12, marginTop: 8, color: "#6B7280" }}>
                      Appointment ID: {a.id}
                    </div>
                  </div>

                  <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <JoinVirtualVisitButton
                      appointment={a}
                      className="btn btn-secondary"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        messageFromAppointment(a);
                      }}
                    >
                      Message Clinic
                    </button>

                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/patient/treatments");
                      }}
                    >
                      View Treatments
                    </button>

                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/patient/services");
                      }}
                    >
                      Book Another Service
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>

        <div className="space" />

        <div className="card card-pad" style={lightSurfaceCardStyle}>
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={sectionEyebrowStyle}>Care Instructions</div>
              <div className="h2" style={{ color: "#1F1633", marginTop: 8 }}>Your Current Care Instructions</div>
              <div className="muted" style={{ marginTop: 4, color: "#4B5563" }}>
                Your latest provider-approved guidance and next steps.
              </div>
            </div>

            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => navigate("/patient/treatments")}
            >
              Open Treatments
            </button>
          </div>

          <div className="space" />

          {loadingPatientSafePlan ? (
            <div className="muted">Loading care instructions...</div>
          ) : !patientSafePlan ? (
            <div className="muted">
              No current patient instructions are available yet.
            </div>
          ) : (
            <>
              <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <div className="v-chip">{readableStatus(patientSafePlan.status)}</div>
                <div className="v-chip">
                  Updated{" "}
                  {new Date(
                    patientSafePlan.signed_at ??
                    patientSafePlan.updated_at ??
                    patientSafePlan.created_at
                  ).toLocaleDateString()}
                </div>
                {getFollowUpDaysFromPlan(patientSafePlan.plan) != null ? (
                  <div className="v-chip">
                    Follow-up in {getFollowUpDaysFromPlan(patientSafePlan.plan)} days
                  </div>
                ) : null}
              </div>

              <div className="card card-pad card-light">
                <div className="muted">Summary</div>
                <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7 }}>
                  {patientSafePlan.summary || "Your provider has created a care plan for you."}
                </div>

                <div className="space" />

                <div className="muted">Instructions</div>
                <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {patientSafePlan.patient_instructions ||
                    "Your provider has not added patient instructions yet."}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space" />

        <div className="card card-pad">
          <div className="h2">
            Recommended Follow-Up
          </div>

          <div className="space" />

          {!nextFollowUpDate ? (
            <div className="muted">
              Your provider has not specified a follow-up schedule yet.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 16, lineHeight: 1.6 }}>
                Your provider recommends a follow-up visit around:
              </div>

              <div
                style={{
                  fontWeight: 800,
                  fontSize: 22,
                  marginTop: 10,
                }}
              >
                {nextFollowUpDate.toLocaleDateString()}
              </div>

              <div className="space" />

              <button
                className="btn btn-primary"
                type="button"
                onClick={() => navigate("/patient/book")}
              >
                Schedule Appointment
              </button>
            </>
          )}
        </div>

        <div className="space" />

        <div className="card card-pad" style={lightSurfaceCardStyle}>
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={sectionEyebrowStyle}>Labs</div>
              <div className="h2" style={{ color: "#1F1633", marginTop: 8 }}>Recent Labs</div>
              <div className="muted" style={{ marginTop: 4, color: "#4B5563" }}>
                A quick look at your most recent lab activity and results.
              </div>
            </div>

            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => navigate("/patient/labs")}
            >
              Open Labs
            </button>
          </div>

          <div className="space" />

          {loadingLabsPreview ? (
            <div className="muted">Loading labs...</div>
          ) : recentLabs.length === 0 ? (
            <div className="muted">
              No lab results are available yet.
            </div>
          ) : (
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <div className="card card-pad card-light" style={{ flex: "1 1 220px" }}>
                <div className="muted">Recent Results</div>
                <div style={{ fontWeight: 900, fontSize: 28, marginTop: 6, color: "#140F24" }}>
                  {recentLabs.length}
                </div>
              </div>

              <div className="card card-pad card-light" style={{ flex: "2 1 420px" }}>
                <div className="muted">Latest Result</div>
                <div style={{ fontWeight: 800, marginTop: 8, color: "#140F24" }}>
                  {recentLabs[0]?.lab_name ?? "Lab Result"}
                </div>
                <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                  {new Date(recentLabs[0]?.collected_at ?? recentLabs[0]?.created_at).toLocaleString()}
                </div>
                <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.7 }}>
                  {recentLabs[0]?.result_summary ?? "Result summary available in the Labs section."}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space" />

        <div className="card card-pad" style={lightSurfaceCardStyle}>
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={sectionEyebrowStyle}>Timeline</div>
              <div className="h2" style={{ color: "#1F1633", marginTop: 8 }}>Your Timeline</div>
              <div className="muted" style={{ marginTop: 4, color: "#4B5563" }}>
                A quick look at your most recent care activity across appointments, treatments, and labs.
              </div>
            </div>

            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => navigate("/patient/treatments")}
            >
              View Treatments
            </button>
          </div>

          <div className="space" />

          {patientTimeline.length === 0 ? (
            <div className="muted">No recent activity yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {patientTimeline.map((item, index) => (
                <div key={item.id} className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 20 }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 999,
                        marginTop: 4,
                        ...timelineDotStyle(item.tone),
                      }}
                    />
                    {index < patientTimeline.length - 1 ? (
                      <div
                        style={{
                          width: 2,
                          flex: 1,
                          minHeight: 42,
                          background: "rgba(255,255,255,.10)",
                          marginTop: 6,
                        }}
                      />
                    ) : null}
                  </div>

                  <div className="card card-pad card-light" style={{ flex: 1 }}>
                    <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, color: "#140F24" }}>{item.title}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {new Date(item.date).toLocaleString()}
                      </div>
                    </div>

                    <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.6 }}>
                      {item.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space" />

        <div className="card card-pad" style={lightSurfaceCardStyle}>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={sectionEyebrowStyle}>Documents</div>
              <div className="h2" style={{ color: "#1F1633", marginTop: 8 }}>Documents</div>
              <div className="muted" style={{ color: "#4B5563" }}>
                Files shared with you by your provider.
              </div>
            </div>
          </div>

          <div className="space" />

          {patientFiles.length === 0 ? (
            <div className="muted">No documents available yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {patientFiles.map((file) => (
                <div
                  key={file.id}
                  className="card card-pad card-light"
                >
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "#140F24" }}>
                          {documentDisplayTitle(file)}
                        </div>

                        <div className="muted" style={{ fontSize: 12 }}>
                          {documentDisplaySubtitle(file)}
                        </div>
                      </div>

                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => openPatientFile(file)}
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedAppointment ? (
          <>
            <div
              onClick={() => {
                setAppointmentDrawerFiles([]);
                setSelectedAppointment(null);
              }}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.45)",
                backdropFilter: "blur(4px)",
                zIndex: 80,
              }}
            />

            <div
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                width: "min(520px, 92vw)",
                height: "100vh",
                background: "linear-gradient(180deg, rgba(18,14,32,0.98), rgba(14,11,25,0.98))",
                borderLeft: "1px solid rgba(255,255,255,.10)",
                boxShadow: "-20px 0 50px rgba(0,0,0,0.35)",
                zIndex: 81,
                overflowY: "auto",
                padding: 24,
              }}
            >
              <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <div className="h2">Appointment Details</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Review your scheduled request and available next actions.
                  </div>
                </div>

                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => {
                    setAppointmentDrawerFiles([]);
                    setSelectedAppointment(null);
                  }}
                >
                  Close
                </button>
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <span style={appointmentStatusBadge(selectedAppointment.status)}>
                  {(selectedAppointment.status || "unknown").replaceAll("_", " ").toUpperCase()}
                </span>
              </div>

              <div className="space" />

              <div className="card card-pad card-light surface-light">
                <div className="muted">Service</div>
                <div style={{ fontWeight: 800, marginTop: 6, color: "#140F24" }}>
                  {svcName(selectedAppointment.service_id)}
                </div>
              </div>

              <div className="space" />

              <div className="card card-pad card-light surface-light">
                <div className="muted">Location</div>
                <div style={{ fontWeight: 800, marginTop: 6, color: "#140F24" }}>
                  {locName(selectedAppointment.location_id)}
                </div>
              </div>

              <div className="space" />

              <div className="card card-pad card-light surface-light">
                <div className="muted">Date & Time</div>
                <div style={{ fontWeight: 800, marginTop: 6, color: "#140F24" }}>
                  {new Date(selectedAppointment.start_time).toLocaleString()}
                </div>
              </div>

              <div className="space" />

              <div className="card card-pad card-light surface-light">
                <div className="muted">Visit Type</div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
                  <div style={{ fontWeight: 800, color: "#140F24" }}>
                    {getVirtualVisitState(selectedAppointment).isVirtual ? "Virtual" : "In Person"}
                  </div>
                  <VirtualVisitBadge appointment={selectedAppointment} />
                </div>
                {selectedAppointment.virtual_instructions ? (
                  <div className="muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
                    {selectedAppointment.virtual_instructions}
                  </div>
                ) : null}
                {selectedAppointment.provider_user_id ? (
                  <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                    Provider assigned by clinic
                  </div>
                ) : null}
                {getVirtualVisitState(selectedAppointment).isVirtual ? (
                  <>
                    <div className="space" />
                    <JoinVirtualVisitButton appointment={selectedAppointment} />
                  </>
                ) : null}
              </div>

              <div className="space" />

              <div className="card card-pad card-light surface-light">
                <div className="muted">Intake Guidance</div>
                <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7 }}>
                  {(() => {
                    const svc = serviceById(selectedAppointment.service_id);
                    const key = getCanonicalServiceTypeKey({
                      name: svc?.name ?? null,
                      category: svc?.category ?? null,
                    });

                    if (key === "wound_care") {
                      return "This appointment supports wound care. You can complete or update your wound intake directly from this drawer.";
                    }

                    return "You can start a related intake or message the clinic if additional information is needed before your visit.";
                  })()}
                </div>
              </div>

              <div className="space" />

              <div className="card card-pad card-light surface-light">
                <div className="muted">Notes</div>
                <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7 }}>
                  {selectedAppointment.notes || "No appointment notes were added."}
                </div>
              </div>

              <div className="space" />

              <div className="card card-pad card-light surface-light">
                <div className="h2">Intake Status</div>
                <div className="space" />

                {loadingAppointmentIntakeStatus ? (
                  <div className="muted">Loading intake status...</div>
                ) : appointmentIntakeStatus ? (
                  <>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={intakeStatusBadge(appointmentIntakeStatus.status)}>
                        {(appointmentIntakeStatus.status || "unknown").replaceAll("_", " ").toUpperCase()}
                      </span>
                    </div>

                    <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
                      Last updated: {new Date(appointmentIntakeStatus.created_at).toLocaleString()}
                    </div>

                    {appointmentIntakeStatus.locked_at ? (
                      <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                        Locked: {new Date(appointmentIntakeStatus.locked_at).toLocaleString()}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="muted">No intake has been started yet for this appointment type.</div>
                )}
              </div>

              <div className="space" />

              <div className="card card-pad card-light surface-light">
                <div className="h2">Visit Record</div>
                <div className="space" />

                {loadingAppointmentVisit ? (
                  <div className="muted">Loading visit record...</div>
                ) : appointmentVisit ? (
                  <>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={visitStatusBadge(appointmentVisit.status)}>
                        {(appointmentVisit.status || "unknown").replaceAll("_", " ").toUpperCase()}
                      </span>
                    </div>

                    <div className="muted" style={{ marginTop: 10 }}>
                      Visit Date:{" "}
                      <strong>
                        {new Date(
                          appointmentVisit.visit_date ?? appointmentVisit.created_at
                        ).toLocaleString()}
                      </strong>
                    </div>

                    <div className="space" />

                    <button
                      className="btn btn-primary"
                      onClick={() => navigate(`/patient/treatments?visitId=${appointmentVisit.id}`)}
                      type="button"
                    >
                      View Treatment Record
                    </button>
                  </>
                ) : (
                  <div className="muted">
                    A treatment visit will appear here after your appointment is completed by the clinic.
                  </div>
                )}
              </div>

              <div className="space" />

              <div className="card card-pad card-light surface-light">
                <div style={{ fontWeight: 800 }}>What can you do next?</div>
                <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7 }}>
                  You can message the clinic about this appointment, review your treatments, or continue browsing services.
                </div>
              </div>

              <div className="space" />

              <div className="card card-pad card-light surface-light">
                <div className="h2">Upload Additional Files</div>
                <div className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
                  Add wound photos or supporting images to this appointment so the clinic can review them before or after follow-up.
                </div>

                <div className="space" />

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setAppointmentDrawerFiles(files);
                  }}
                />

                {appointmentDrawerFiles.length > 0 ? (
                  <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                    Selected: {appointmentDrawerFiles.length} file{appointmentDrawerFiles.length === 1 ? "" : "s"}
                  </div>
                ) : null}

                <div className="space" />

                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={uploadingDrawerFiles || appointmentDrawerFiles.length === 0}
                  onClick={() => uploadFilesToAppointment(selectedAppointment)}
                >
                  {uploadingDrawerFiles ? "Uploading..." : "Upload Files"}
                </button>
              </div>

              <div className="space" />

              <div className="card card-pad card-light">
                <div className="h2">Attached Files</div>
                <div className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
                  Review images and files already attached to this appointment.
                </div>

                <div className="space" />

                {loadingAppointmentFiles ? (
                  <div className="muted">Loading files...</div>
                ) : appointmentFiles.length === 0 ? (
                  <div className="muted">No files attached yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {appointmentFiles.map((file) => {
                      const url = appointmentFileUrls[file.id];
                      const isImage = isImageFileName(file.filename, file.content_type);

                      return (
                        <div
                          key={file.id}
                          className="card card-pad card-light surface-light"
                        >
                          {isImage && url ? (
                            <img
                              src={url}
                              alt={file.filename}
                              style={{
                                width: "100%",
                                height: 200,
                                objectFit: "cover",
                                borderRadius: 12,
                                marginBottom: 12,
                                border: "1px solid rgba(255,255,255,.10)",
                              }}
                            />
                          ) : null}

                          <div style={{ fontWeight: 800, color: "#140F24" }}>{file.filename}</div>

                          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                            {file.category ?? "file"} • {new Date(file.created_at).toLocaleString()}
                          </div>

                          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                            {file.content_type ?? "unknown type"}
                            {file.size_bytes ? ` • ${Math.round(file.size_bytes / 1024)} KB` : ""}
                          </div>

                          <div className="space" />

                          {url ? (
                            <a className="btn btn-secondary" href={url} target="_blank" rel="noreferrer">
                              Open File
                            </a>
                          ) : (
                            <div className="muted" style={{ fontSize: 12 }}>
                              Preview unavailable
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => messageFromAppointment(selectedAppointment)}
                >
                  Message Clinic
                </button>

                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => startIntakeFromAppointment(selectedAppointment)}
                >
                  {!appointmentIntakeStatus
                    ? "Start Intake"
                    : appointmentIntakeStatus.status === "needs_info"
                    ? "Update Intake"
                    : appointmentIntakeStatus.status === "submitted"
                    ? "Continue Intake Form"
                    : appointmentIntakeStatus.status === "approved" || appointmentIntakeStatus.status === "locked"
                    ? "View Intake"
                    : "Open Intake"}
                </button>

                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => navigate("/patient/treatments")}
                >
                  View Treatments
                </button>

                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => navigate("/patient/services")}
                >
                  Browse Services
                </button>
              </div>

              <div className="space" />

              <div className="muted" style={{ fontSize: 12 }}>
                Appointment ID: {selectedAppointment.id}
              </div>
            </div>
          </>
        ) : null}

        {bookingSuccess ? (
          <>
            <div
              onClick={() => setBookingSuccess(null)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.45)",
                backdropFilter: "blur(4px)",
                zIndex: 80,
              }}
            />

            <div
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "min(560px, 92vw)",
                background: "rgba(20,20,28,0.97)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.40)",
                borderRadius: 20,
                zIndex: 81,
                padding: 24,
              }}
            >
              <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 28, lineHeight: 1 }}>✅</div>
                  <div className="h2" style={{ marginTop: 10 }}>
                    Appointment Request Submitted
                  </div>
                  <div className="muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
                    Your request has been sent to the clinic. The care team can now review your appointment details and follow up if needed.
                  </div>
                </div>

                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setBookingSuccess(null)}
                >
                  Close
                </button>
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                <div className="card card-pad card-light" style={{ flex: "1 1 220px" }}>
                  <div className="muted">Service</div>
                  <div style={{ fontWeight: 800, marginTop: 6, color: "#140F24" }}>{bookingSuccess.serviceName}</div>
                </div>

                <div className="card card-pad card-light" style={{ flex: "1 1 220px" }}>
                  <div className="muted">Location</div>
                  <div style={{ fontWeight: 800, marginTop: 6, color: "#140F24" }}>{bookingSuccess.locationName}</div>
                </div>

                <div className="card card-pad card-light" style={{ flex: "1 1 220px" }}>
                  <div className="muted">Requested Time</div>
                  <div style={{ fontWeight: 800, marginTop: 6, color: "#140F24" }}>
                    {new Date(bookingSuccess.slotIso).toLocaleString()}
                  </div>
                </div>

                <div className="card card-pad card-light" style={{ flex: "1 1 220px" }}>
                  <div className="muted">Appointment ID</div>
                  <div style={{ fontWeight: 800, marginTop: 6, color: "#140F24" }}>{bookingSuccess.appointmentId}</div>
                </div>
              </div>

              <div className="space" />

              <div className="card card-pad card-light">
                <div style={{ fontWeight: 800 }}>What happens next?</div>
                <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.7 }}>
                  Your request is now in the clinic queue. You can message the clinic through the portal, review your appointments below, or continue browsing services.
                </div>
              </div>

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => {
                    setBookingSuccess(null);
                    navigate("/patient/chat");
                  }}
                >
                  Message Clinic
                </button>

                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => {
                    setBookingSuccess(null);
                    const el = document.getElementById("my-appointments");
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  View My Appointments
                </button>

                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => {
                    setBookingSuccess(null);
                    navigate("/patient/services");
                  }}
                >
                  Browse More Services
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
