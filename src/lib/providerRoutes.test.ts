import { describe, expect, it } from "vitest";
import {
  PROVIDER_ROUTES,
  providerIvrPrintPath,
  providerMessagesPath,
  providerProtocolReviewPath,
  providerPatientCenterLegacyPath,
  providerPatientCenterPath,
  providerVisitBuilderAppointmentPath,
  providerVisitBuilderPath,
  providerVisitChartPath,
  providerVitalAiProfilePath,
  providerWoundTimelinePath,
} from "./providerRoutes";

describe("providerRoutes", () => {
  it("returns the canonical provider home route", () => {
    expect(PROVIDER_ROUTES.home).toBe("/provider");
  });

  it("builds patient-center routes deterministically", () => {
    expect(providerPatientCenterPath()).toBe("/provider/patients");
    expect(providerPatientCenterPath("pat_123")).toBe("/provider/patients/pat_123");
    expect(providerPatientCenterLegacyPath("pat_123")).toBe("/provider/patient-center/pat_123");
  });

  it("builds visit and workflow routes deterministically", () => {
    expect(providerVisitChartPath("visit_1")).toBe("/provider/visits/visit_1");
    expect(providerVisitBuilderPath()).toBe("/provider/visit-builder");
    expect(providerVisitBuilderPath("pat_123")).toBe("/provider/visit-builder/pat_123");
    expect(providerIvrPrintPath("visit_1")).toBe("/provider/ivr/print/visit_1");
    expect(providerWoundTimelinePath("pat_123")).toBe("/provider/wound-timeline/pat_123");
  });

  it("encodes query-string based provider routes safely", () => {
    expect(providerVisitBuilderAppointmentPath("appt 123")).toBe("/provider/visit-builder?appointmentId=appt%20123");
    expect(providerMessagesPath()).toBe("/provider/chat");
    expect(providerMessagesPath("conv 42")).toBe("/provider/chat?conversationId=conv%2042");
    expect(providerVitalAiProfilePath("profile_9")).toBe("/provider/vital-ai/profile/profile_9");
    expect(providerProtocolReviewPath("assessment 2")).toBe("/provider/protocol-review/assessment 2");
  });
});
