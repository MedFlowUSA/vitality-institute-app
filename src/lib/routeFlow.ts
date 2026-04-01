type AuthMode = "login" | "signup" | "magic";

const AUTH_PATHS = new Set(["/access", "/patient/auth", "/login", "/auth/callback"]);

function safeUrl(path: string) {
  return new URL(path, "http://vitality.local");
}

export function sanitizeInternalPath(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function normalizeRedirectTarget(value: string | null | undefined, fallback = "/") {
  let current = sanitizeInternalPath(value, fallback);

  for (let i = 0; i < 5; i += 1) {
    const url = safeUrl(current);
    if (!AUTH_PATHS.has(url.pathname)) return `${url.pathname}${url.search}${url.hash}`;

    const nestedNext = url.searchParams.get("next");
    if (!nestedNext) return fallback;

    const normalizedNested = sanitizeInternalPath(nestedNext, fallback);
    if (normalizedNested === current) return fallback;
    current = normalizedNested;
  }

  return fallback;
}

export function buildAuthRoute(input: { mode: AuthMode; next?: string | null; handoff?: string | null }) {
  const params = new URLSearchParams();
  params.set("mode", input.mode);

  const next = normalizeRedirectTarget(input.next ?? "/", "/");
  if (next !== "/") {
    params.set("next", next);
  }

  if (input.handoff) {
    params.set("handoff", input.handoff);
  }

  return `/access?${params.toString()}`;
}

export function buildOnboardingRoute(input: { next?: string | null; handoff?: string | null }) {
  const params = new URLSearchParams();
  const next = normalizeRedirectTarget(input.next ?? "/patient/home", "/patient/home");

  if (next !== "/patient/home") {
    params.set("next", next);
  }

  if (input.handoff) {
    params.set("handoff", input.handoff);
  }

  const query = params.toString();
  return `/patient/onboarding${query ? `?${query}` : ""}`;
}

export function buildCurrentPath(pathname: string, search = "") {
  const normalizedPath = sanitizeInternalPath(pathname, "/");
  return `${normalizedPath}${search || ""}`;
}

export function buildPatientIntakePath(input?: {
  pathway?: string | null;
  appointmentId?: string | null;
  autostart?: boolean;
}) {
  const params = new URLSearchParams();

  if (input?.appointmentId) {
    params.set("appointmentId", input.appointmentId);
  }

  if (input?.pathway) {
    params.set("pathway", input.pathway);
  }

  if (input?.autostart) {
    params.set("autostart", "1");
  }

  const query = params.toString();
  return `/intake${query ? `?${query}` : ""}`;
}
