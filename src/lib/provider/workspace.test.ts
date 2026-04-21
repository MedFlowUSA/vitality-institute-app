import { describe, expect, it } from "vitest";

import {
  formatProviderShortId,
  formatProviderStatusLabel,
  getProviderPatientLabel,
  isInactiveAppointmentStatus,
  isVisitClosedStatus,
  normalizeProviderStatus,
  sortProviderActionableAppointments,
} from "./workspace";

describe("provider workspace helpers", () => {
  it("normalizes provider statuses consistently", () => {
    expect(normalizeProviderStatus(" Completed ")).toBe("completed");
    expect(normalizeProviderStatus(null)).toBe("");
  });

  it("formats status labels for display", () => {
    expect(formatProviderStatusLabel("in_progress")).toBe("In Progress");
    expect(formatProviderStatusLabel("requested")).toBe("Requested");
    expect(formatProviderStatusLabel(null)).toBe("-");
  });

  it("treats completed and closed visits as closed", () => {
    expect(isVisitClosedStatus("closed")).toBe(true);
    expect(isVisitClosedStatus("completed")).toBe(true);
    expect(isVisitClosedStatus("open")).toBe(false);
  });

  it("treats completed or canceled appointments as inactive", () => {
    expect(isInactiveAppointmentStatus("completed")).toBe(true);
    expect(isInactiveAppointmentStatus("canceled")).toBe(true);
    expect(isInactiveAppointmentStatus("requested")).toBe(false);
  });

  it("formats patient labels with a friendly fallback", () => {
    expect(getProviderPatientLabel("patient_123456789", { patient_123456789: "Jane Doe" })).toBe("Jane Doe");
    expect(getProviderPatientLabel("patient_123456789", {})).toBe("Patient 12345678");
    expect(formatProviderShortId("abcdefghijk")).toBe("abcdefgh");
  });

  it("sorts actionable appointments with upcoming first and terminal statuses removed", () => {
    const appointments = [
      { id: "completed", start_time: "2026-04-16T08:00:00.000Z", status: "completed" },
      { id: "future", start_time: "2099-04-16T10:00:00.000Z", status: "confirmed" },
      { id: "near-future", start_time: "2099-04-15T10:00:00.000Z", status: "requested" },
      { id: "recent-past", start_time: "2020-04-15T10:00:00.000Z", status: "confirmed" },
    ];

    expect(sortProviderActionableAppointments(appointments).map((item) => item.id)).toEqual([
      "near-future",
      "future",
      "recent-past",
    ]);
  });
});
