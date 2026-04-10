import { describe, expect, it } from "vitest";
import {
  buildAuthRoute,
  buildCurrentPath,
  buildOnboardingRoute,
  buildPatientIntakePath,
  normalizeRedirectTarget,
  sanitizeInternalPath,
} from "./routeFlow";

describe("routeFlow", () => {
  it("sanitizes internal paths", () => {
    expect(sanitizeInternalPath("/patient/home")).toBe("/patient/home");
    expect(sanitizeInternalPath("https://example.com", "/patient/home")).toBe("/patient/home");
    expect(sanitizeInternalPath("//malicious", "/patient/home")).toBe("/patient/home");
    expect(sanitizeInternalPath(undefined, "/patient/home")).toBe("/patient/home");
  });

  it("normalizes nested auth redirects back to a real app path", () => {
    expect(normalizeRedirectTarget("/access?next=/patient/home")).toBe("/patient/home");
    expect(normalizeRedirectTarget("/patient/auth?next=/login?next=/patient/labs")).toBe("/patient/labs");
  });

  it("falls back when nested auth redirects loop", () => {
    expect(normalizeRedirectTarget("/access?next=/access?next=/access")).toBe("/");
  });

  it("builds auth routes with sanitized next paths", () => {
    expect(buildAuthRoute({ mode: "login", next: "/patient/treatments", handoff: "book" })).toBe(
      "/access?mode=login&next=%2Fpatient%2Ftreatments&handoff=book"
    );
    expect(buildAuthRoute({ mode: "signup", next: "https://example.com" })).toBe("/access?mode=signup");
  });

  it("builds onboarding and intake routes deterministically", () => {
    expect(buildOnboardingRoute({ next: "/patient/labs", handoff: "welcome" })).toBe(
      "/patient/onboarding?next=%2Fpatient%2Flabs&handoff=welcome"
    );
    expect(buildCurrentPath("/patient/home", "?tab=today")).toBe("/patient/home?tab=today");
    expect(buildPatientIntakePath({ appointmentId: "appt_123", pathway: "glp1", autostart: true })).toBe(
      "/intake?appointmentId=appt_123&pathway=glp1&autostart=1"
    );
  });
});
