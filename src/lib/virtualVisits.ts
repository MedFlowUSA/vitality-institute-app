export type AppointmentVirtualFields = {
  start_time: string;
  visit_type?: string | null;
  telehealth_enabled?: boolean | null;
  meeting_url?: string | null;
  meeting_provider?: string | null;
  meeting_status?: string | null;
  join_window_opens_at?: string | null;
  virtual_instructions?: string | null;
};

export type VirtualVisitState = {
  isVirtual: boolean;
  hasMeetingUrl: boolean;
  canJoin: boolean;
  joinWindowOpen: boolean;
  needsSetup: boolean;
  joinWindowOpensAt: string | null;
  joinWindowLabel: string | null;
  meetingStatus: string;
  badgeLabel: string;
  badgeTone: "neutral" | "ready" | "active" | "success" | "warning";
};

const DEFAULT_JOIN_WINDOW_MINUTES = 15;

export function isVirtualVisit(appointment: Partial<AppointmentVirtualFields> | null | undefined) {
  if (!appointment) return false;
  return appointment.visit_type === "virtual" || appointment.telehealth_enabled === true;
}

export function getDefaultJoinWindowOpensAt(startTime: string, minutesBefore = DEFAULT_JOIN_WINDOW_MINUTES) {
  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() - minutesBefore * 60 * 1000).toISOString();
}

export function toDateTimeLocalValue(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export function fromDateTimeLocalValue(localValue: string | null | undefined) {
  if (!localValue) return null;
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function getVirtualVisitState(
  appointment: Partial<AppointmentVirtualFields> | null | undefined,
  now = new Date()
): VirtualVisitState {
  const isVirtual = isVirtualVisit(appointment);
  const meetingStatus = (appointment?.meeting_status || "not_started").toLowerCase();
  const joinWindowOpensAt =
    appointment?.join_window_opens_at ||
    (appointment?.start_time ? getDefaultJoinWindowOpensAt(appointment.start_time) : null);
  const joinDate = joinWindowOpensAt ? new Date(joinWindowOpensAt) : null;
  const joinWindowOpen = !!joinDate && !Number.isNaN(joinDate.getTime()) && now.getTime() >= joinDate.getTime();
  const hasMeetingUrl = !!appointment?.meeting_url;
  const canJoin = isVirtual && hasMeetingUrl && joinWindowOpen;
  const needsSetup = isVirtual && !hasMeetingUrl;

  if (!isVirtual) {
    return {
      isVirtual,
      hasMeetingUrl,
      canJoin: false,
      joinWindowOpen: false,
      needsSetup: false,
      joinWindowOpensAt,
      joinWindowLabel: null,
      meetingStatus,
      badgeLabel: "In Person",
      badgeTone: "neutral",
    };
  }

  let badgeLabel = "Virtual Visit";
  let badgeTone: VirtualVisitState["badgeTone"] = "neutral";

  if (needsSetup) {
    badgeLabel = "Virtual Setup Needed";
    badgeTone = "warning";
  } else if (meetingStatus === "completed") {
    badgeLabel = "Virtual Completed";
    badgeTone = "success";
  } else if (meetingStatus === "missed") {
    badgeLabel = "Virtual Missed";
    badgeTone = "warning";
  } else if (meetingStatus === "in_progress") {
    badgeLabel = "Virtual In Progress";
    badgeTone = "active";
  } else if (canJoin || meetingStatus === "ready") {
    badgeLabel = "Virtual Ready";
    badgeTone = "ready";
  }

  return {
    isVirtual,
    hasMeetingUrl,
    canJoin,
    joinWindowOpen,
    needsSetup,
    joinWindowOpensAt,
    joinWindowLabel: joinDate && !Number.isNaN(joinDate.getTime()) ? joinDate.toLocaleString() : null,
    meetingStatus,
    badgeLabel,
    badgeTone,
  };
}

export function virtualVisitBadgeStyle(tone: VirtualVisitState["badgeTone"]) {
  if (tone === "ready") {
    return {
      background: "rgba(59,130,246,.14)",
      color: "#1d4ed8",
      border: "1px solid rgba(59,130,246,.24)",
    };
  }

  if (tone === "active") {
    return {
      background: "rgba(139,92,246,.14)",
      color: "#6d28d9",
      border: "1px solid rgba(139,92,246,.24)",
    };
  }

  if (tone === "success") {
    return {
      background: "rgba(34,197,94,.14)",
      color: "#15803d",
      border: "1px solid rgba(34,197,94,.24)",
    };
  }

  if (tone === "warning") {
    return {
      background: "rgba(245,158,11,.14)",
      color: "#b45309",
      border: "1px solid rgba(245,158,11,.24)",
    };
  }

  return {
    background: "rgba(148,163,184,.14)",
    color: "#475569",
    border: "1px solid rgba(148,163,184,.24)",
  };
}
