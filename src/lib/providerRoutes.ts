export const PROVIDER_ROUTES = {
  home: "/provider",
  dashboardLegacy: "/provider/dashboard",
  command: "/provider/command",
  commandLegacy: "/provider/command-center",
  queue: "/provider/queue",
  intakes: "/provider/intakes",
  intakeLegacy: "/provider/intake",
  intakeQueueLegacy: "/provider/intake-queue",
  messages: "/provider/chat",
  messagesLegacy: "/provider/messages",
  labs: "/provider/labs",
  ai: "/provider/ai",
  vitalAi: "/provider/vital-ai",
  referrals: "/provider/referrals",
  patients: "/provider/patients",
  patientCenterLegacy: "/provider/patient-center",
  virtualVisitsHash: "/provider#virtual-visits",
  virtualVisitsLegacy: "/provider/virtual-visits",
} as const;

export function providerPatientCenterPath(patientId?: string | null) {
  return patientId ? `${PROVIDER_ROUTES.patients}/${patientId}` : PROVIDER_ROUTES.patients;
}

export function providerPatientCenterLegacyPath(patientId?: string | null) {
  return patientId ? `${PROVIDER_ROUTES.patientCenterLegacy}/${patientId}` : PROVIDER_ROUTES.patientCenterLegacy;
}

export function providerVisitChartPath(visitId: string) {
  return `/provider/visits/${visitId}`;
}

export function providerVisitBuilderPath(patientId?: string | null) {
  return patientId ? `/provider/visit-builder/${patientId}` : "/provider/visit-builder";
}

export function providerVisitBuilderAppointmentPath(appointmentId: string) {
  return `/provider/visit-builder?appointmentId=${encodeURIComponent(appointmentId)}`;
}

export function providerMessagesPath(conversationId?: string | null) {
  return conversationId
    ? `${PROVIDER_ROUTES.messages}?conversationId=${encodeURIComponent(conversationId)}`
    : PROVIDER_ROUTES.messages;
}

export function providerVitalAiProfilePath(profileId: string) {
  return `${PROVIDER_ROUTES.vitalAi}/profile/${profileId}`;
}

export function providerWoundTimelinePath(patientId: string) {
  return `/provider/wound-timeline/${patientId}`;
}

export function providerIvrPrintPath(visitId: string) {
  return `/provider/ivr/print/${visitId}`;
}
