export type PatientNoticeTone = "info" | "warning" | "success";

export type PatientNoticeState = {
  patientNotice: string;
  patientNoticeTone?: PatientNoticeTone;
};

export function buildPatientNoticeState(
  patientNotice: string,
  patientNoticeTone: PatientNoticeTone = "success"
): PatientNoticeState {
  return {
    patientNotice,
    patientNoticeTone,
  };
}

export function readPatientNoticeState(
  state: unknown,
  fallbackTone: PatientNoticeTone = "success"
): { message: string; tone: PatientNoticeTone } | null {
  if (!state || typeof state !== "object") return null;

  const rawState = state as {
    patientNotice?: unknown;
    patientNoticeTone?: unknown;
  };

  if (typeof rawState.patientNotice !== "string" || !rawState.patientNotice.trim()) {
    return null;
  }

  const tone =
    rawState.patientNoticeTone === "info" ||
    rawState.patientNoticeTone === "warning" ||
    rawState.patientNoticeTone === "success"
      ? rawState.patientNoticeTone
      : fallbackTone;

  return {
    message: rawState.patientNotice.trim(),
    tone,
  };
}
