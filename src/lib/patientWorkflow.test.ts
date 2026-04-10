import { describe, expect, it } from "vitest";
import {
  buildAppointmentIntakePath,
  getPatientAppointmentIntakeCtaLabel,
  getPatientDashboardIntakeAction,
  getPatientVisitStatusLabel,
  resolvePatientLabSourceLabel,
  splitPatientVisitsByActivity,
  validatePatientLabSubmission,
} from "./patientWorkflow";

describe("patientWorkflow", () => {
  it("derives patient visit labels consistently", () => {
    expect(getPatientVisitStatusLabel("open")).toBe("Active");
    expect(getPatientVisitStatusLabel("in_progress")).toBe("Active");
    expect(getPatientVisitStatusLabel("completed")).toBe("Completed");
    expect(getPatientVisitStatusLabel("cancelled")).toBe("Cancelled");
    expect(getPatientVisitStatusLabel("custom_status")).toBe("custom_status");
    expect(getPatientVisitStatusLabel(null)).toBe("Unknown");
  });

  it("splits visits into current care vs past visits deterministically", () => {
    const visits = [
      { id: "v1", status: "open" },
      { id: "v2", status: "in_progress" },
      { id: "v3", status: "completed" },
      { id: "v4", status: "cancelled" },
      { id: "v5", status: null },
    ];

    const result = splitPatientVisitsByActivity(visits);

    expect(result.currentCareVisits.map((visit) => visit.id)).toEqual(["v1", "v2"]);
    expect(result.pastVisits.map((visit) => visit.id)).toEqual(["v3", "v4", "v5"]);
  });

  it("builds appointment intake paths with guided pathway data when available", () => {
    expect(
      buildAppointmentIntakePath({
        appointmentId: "appt_1",
        service: {
          name: "GLP-1 Essential",
          category: "weight_management",
          visitType: "medical_weight_loss",
        },
      })
    ).toBe("/intake?appointmentId=appt_1&pathway=glp1&autostart=1");
  });

  it("falls back to a plain intake route when no guided pathway is detected", () => {
    expect(
      buildAppointmentIntakePath({
        appointmentId: "appt_2",
        service: {
          name: "General Consultation",
          category: "consult",
          visitType: "consult",
        },
      })
    ).toBe("/intake?appointmentId=appt_2");

    expect(buildAppointmentIntakePath({ appointmentId: "appt_3", service: null })).toBe("/intake?appointmentId=appt_3");
  });

  it("derives patient intake CTA labels from appointment intake state", () => {
    expect(getPatientAppointmentIntakeCtaLabel(null)).toBe("Start Intake");
    expect(getPatientAppointmentIntakeCtaLabel("needs_info")).toBe("Update Intake");
    expect(getPatientAppointmentIntakeCtaLabel("submitted")).toBe("Continue Intake Form");
    expect(getPatientAppointmentIntakeCtaLabel("approved")).toBe("View Intake");
    expect(getPatientAppointmentIntakeCtaLabel("locked")).toBe("View Intake");
    expect(getPatientAppointmentIntakeCtaLabel("custom")).toBe("Open Intake");
  });

  it("derives dashboard intake copy from the latest Vital AI session status", () => {
    expect(getPatientDashboardIntakeAction("draft")).toEqual({
      title: "Continue Intake",
      description: "Pick up where you left off so the care team has the details they need.",
      ctaLabel: "Continue Intake",
    });

    expect(getPatientDashboardIntakeAction("submitted")).toEqual({
      title: "Start with Vital AI",
      description: "Complete a guided intake before your next visit.",
      ctaLabel: "Open Intake",
    });
  });

  it("resolves patient lab source labels cleanly", () => {
    expect(resolvePatientLabSourceLabel("", "")).toBe("-");
    expect(resolvePatientLabSourceLabel("Quest", "")).toBe("Quest");
    expect(resolvePatientLabSourceLabel("Other local lab", "Downtown Diagnostics")).toBe("Downtown Diagnostics");
    expect(resolvePatientLabSourceLabel("Other local lab", "   ")).toBe("Other local lab");
  });

  it("validates patient lab submission prerequisites deterministically", () => {
    expect(
      validatePatientLabSubmission({
        panelId: "",
        labSource: "Quest",
        labSourceOther: "",
        appointmentId: "appt_1",
        locationCount: 1,
        panelMarkers: [],
        values: {},
      })
    ).toBe("Please select a lab panel.");

    expect(
      validatePatientLabSubmission({
        panelId: "panel_1",
        labSource: "",
        labSourceOther: "",
        appointmentId: "appt_1",
        locationCount: 1,
        panelMarkers: [],
        values: {},
      })
    ).toBe("Please select the lab source.");

    expect(
      validatePatientLabSubmission({
        panelId: "panel_1",
        labSource: "Other local lab",
        labSourceOther: "",
        appointmentId: "appt_1",
        locationCount: 1,
        panelMarkers: [],
        values: {},
      })
    ).toBe("Please enter the lab name.");

    expect(
      validatePatientLabSubmission({
        panelId: "panel_1",
        labSource: "Quest",
        labSourceOther: "",
        appointmentId: "",
        locationCount: 0,
        panelMarkers: [],
        values: {},
      })
    ).toBe("No locations found.");

    expect(
      validatePatientLabSubmission({
        panelId: "panel_1",
        labSource: "Quest",
        labSourceOther: "",
        appointmentId: "appt_1",
        locationCount: 1,
        panelMarkers: [{ key: "a1c", label: "A1c" }],
        values: {},
      })
    ).toBe("Please complete: A1c");

    expect(
      validatePatientLabSubmission({
        panelId: "panel_1",
        labSource: "Quest",
        labSourceOther: "",
        appointmentId: "appt_1",
        locationCount: 1,
        panelMarkers: [
          { key: "a1c", label: "A1c" },
          { key: "glucose", label: "Glucose" },
        ],
        values: {
          a1c: "5.8",
          glucose: "95",
        },
      })
    ).toBeNull();
  });
});
