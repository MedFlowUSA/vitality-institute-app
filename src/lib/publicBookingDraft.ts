export type PublicBookingDraft = {
  locationId: string;
  serviceId: string;
  startTimeLocal: string;
  notes: string;
  savedAt: number;
};

const STORAGE_KEY = "vitality_public_booking_draft";
const MAX_AGE_MS = 1000 * 60 * 60 * 12;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function savePublicBookingDraft(input: Omit<PublicBookingDraft, "savedAt">) {
  if (!canUseStorage()) return;
  const payload: PublicBookingDraft = { ...input, savedAt: Date.now() };
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function readPublicBookingDraft() {
  if (!canUseStorage()) return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PublicBookingDraft;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearPublicBookingDraft() {
  if (!canUseStorage()) return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
