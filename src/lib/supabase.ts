import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function getAppBaseUrl() {
  const envBaseUrl =
    (import.meta.env.VITE_APP_URL as string | undefined) ||
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined);

  if (envBaseUrl?.trim()) return normalizeBaseUrl(envBaseUrl);

  if (typeof window === "undefined") {
    throw new Error("Missing VITE_APP_URL for auth redirects.");
  }

  const origin = normalizeBaseUrl(window.location.origin);
  const isLocalhost = /localhost|127\.0\.0\.1/i.test(window.location.hostname);

  if (import.meta.env.DEV || !isLocalhost) return origin;

  throw new Error("Missing VITE_APP_URL for auth redirects.");
}

export function getAuthRedirectUrl(path = "/auth/callback", searchParams?: URLSearchParams) {
  const baseUrl = getAppBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const suffix = searchParams?.toString() ? `?${searchParams.toString()}` : "";
  return `${baseUrl}${normalizedPath}${suffix}`;
}
