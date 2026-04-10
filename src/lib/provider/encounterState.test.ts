import { describe, expect, it } from "vitest";
import { deriveEncounterState } from "./encounterState";

describe("deriveEncounterState", () => {
  it("returns no_visit when no visit exists", () => {
    const state = deriveEncounterState({
      visit: null,
      soap: null,
      plan: null,
    });

    expect(state).toMatchObject({
      state: "no_visit",
      nextActionLabel: "Start Visit",
      nextActionTab: "overview",
      canComplete: false,
      requiresPlanBypass: false,
    });
  });

  it("returns visit_open when a visit exists but SOAP has not started", () => {
    const state = deriveEncounterState({
      visit: {
        id: "visit_1",
        status: "open",
        visit_date: "2026-04-10T10:00:00.000Z",
        summary: null,
      },
      soap: null,
      plan: null,
    });

    expect(state).toMatchObject({
      state: "visit_open",
      soapLabel: "None",
      nextActionLabel: "Continue SOAP",
      nextActionTab: "soap",
      canComplete: false,
    });
  });

  it("returns soap_draft when the SOAP exists but is not finalized", () => {
    const state = deriveEncounterState({
      visit: {
        id: "visit_2",
        status: "open",
        visit_date: "2026-04-10T10:00:00.000Z",
        summary: null,
      },
      soap: {
        id: "soap_1",
        visit_id: "visit_2",
        is_signed: false,
        is_locked: false,
        signed_at: null,
      },
      plan: null,
    });

    expect(state).toMatchObject({
      state: "soap_draft",
      soapLabel: "Draft",
      nextActionLabel: "Continue SOAP",
      nextActionTab: "soap",
      canComplete: false,
      requiresPlanBypass: false,
    });
  });

  it("returns soap_signed when SOAP is finalized but no plan exists yet", () => {
    const state = deriveEncounterState({
      visit: {
        id: "visit_3",
        status: "open",
        visit_date: "2026-04-10T10:00:00.000Z",
        summary: null,
      },
      soap: {
        id: "soap_2",
        visit_id: "visit_3",
        is_signed: true,
        is_locked: true,
        signed_at: "2026-04-10T10:15:00.000Z",
      },
      plan: null,
    });

    expect(state).toMatchObject({
      state: "soap_signed",
      soapLabel: "Signed",
      planLabel: "None",
      nextActionLabel: "Continue Plan",
      nextActionTab: "plan",
      canComplete: false,
      requiresPlanBypass: true,
    });
  });

  it("returns plan_draft when a plan exists but is not finalized", () => {
    const state = deriveEncounterState({
      visit: {
        id: "visit_4",
        status: "open",
        visit_date: "2026-04-10T10:00:00.000Z",
        summary: null,
      },
      soap: {
        id: "soap_3",
        visit_id: "visit_4",
        is_signed: true,
        is_locked: true,
        signed_at: "2026-04-10T10:15:00.000Z",
      },
      plan: {
        id: "plan_1",
        visit_id: "visit_4",
        status: "draft",
        is_locked: false,
        signed_at: null,
      },
    });

    expect(state).toMatchObject({
      state: "plan_draft",
      planLabel: "Draft",
      nextActionLabel: "Continue Plan",
      nextActionTab: "plan",
      canComplete: false,
      requiresPlanBypass: true,
    });
  });

  it("returns ready_to_complete when SOAP and plan are finalized", () => {
    const state = deriveEncounterState({
      visit: {
        id: "visit_5",
        status: "open",
        visit_date: "2026-04-10T10:00:00.000Z",
        summary: null,
      },
      soap: {
        id: "soap_4",
        visit_id: "visit_5",
        is_signed: true,
        is_locked: true,
        signed_at: "2026-04-10T10:15:00.000Z",
      },
      plan: {
        id: "plan_2",
        visit_id: "visit_5",
        status: "completed",
        is_locked: true,
        signed_at: "2026-04-10T10:20:00.000Z",
      },
    });

    expect(state).toMatchObject({
      state: "ready_to_complete",
      soapLabel: "Signed",
      planLabel: "Signed",
      nextActionLabel: "Complete Visit",
      nextActionTab: "overview",
      canComplete: true,
      requiresPlanBypass: false,
    });
  });

  it("returns completed when the visit status is already closed or completed", () => {
    const state = deriveEncounterState({
      visit: {
        id: "visit_6",
        status: "closed",
        visit_date: "2026-04-10T10:00:00.000Z",
        summary: "Done",
      },
      soap: {
        id: "soap_5",
        visit_id: "visit_6",
        is_signed: true,
        is_locked: true,
        signed_at: "2026-04-10T10:15:00.000Z",
      },
      plan: {
        id: "plan_3",
        visit_id: "visit_6",
        status: "completed",
        is_locked: true,
        signed_at: "2026-04-10T10:20:00.000Z",
      },
    });

    expect(state).toMatchObject({
      state: "completed",
      nextActionLabel: "Review Completed Encounter",
      nextActionTab: "overview",
      canComplete: false,
      requiresPlanBypass: false,
    });
  });
});
