import { describe, expect, it } from "vitest";
import { buildStructuredProtocolSuggestion, inferProtocolServiceLine, isClinicServiceLineEnabled } from "./ProtocolEngineService";
import type { ProtocolAssessmentInput } from "./types";

function makeInput(overrides?: Partial<ProtocolAssessmentInput>): ProtocolAssessmentInput {
  return {
    session: {
      id: "sess_1",
      pathway_id: "path_glp1",
      clinic_id: "clinic_1",
      location_id: "loc_1",
      patient_id: "pat_1",
      profile_id: "profile_1",
      status: "submitted",
      current_step_key: "glp1",
      source: "patient_portal",
      started_at: "2026-04-17T10:00:00.000Z",
      completed_at: "2026-04-17T10:10:00.000Z",
      last_saved_at: "2026-04-17T10:10:00.000Z",
      created_by: "profile_1",
      created_at: "2026-04-17T10:00:00.000Z",
      updated_at: "2026-04-17T10:10:00.000Z",
    },
    pathway: {
      id: "path_glp1",
      slug: "glp1",
      name: "GLP-1 Intake",
      description: null,
      is_active: true,
      version: 1,
      definition_json: { pathwayKey: "glp1", title: "GLP-1", steps: [] },
      created_at: "2026-04-17T10:00:00.000Z",
      updated_at: "2026-04-17T10:00:00.000Z",
    },
    profile: {
      id: "profile_row_1",
      session_id: "sess_1",
      pathway_id: "path_glp1",
      clinic_id: "clinic_1",
      location_id: "loc_1",
      patient_id: "pat_1",
      profile_id: "profile_1",
      summary: "Patient wants metabolic support.",
      profile_json: {},
      risk_flags_json: ["existing obesity"],
      triage_level: "medium",
      status: "new",
      created_at: "2026-04-17T10:00:00.000Z",
      updated_at: "2026-04-17T10:10:00.000Z",
    },
    patient: {
      id: "pat_1",
      profile_id: "profile_1",
      clinic_id: "clinic_1",
      location_id: "loc_1",
      first_name: "Jamie",
      last_name: "Lee",
      phone: null,
      email: null,
      dob: null,
    },
    answers: {
      current_weight: "220",
      goal_weight: "180",
      diabetes_status: "prediabetes",
      pancreatitis_history: false,
    },
    files: [],
    ...overrides,
  };
}

describe("ProtocolEngineService", () => {
  it("infers TRT from general consult hormone signals", () => {
    const serviceLine = inferProtocolServiceLine({
      pathwaySlug: "general-consult",
      answers: {
        primary_concern: "Low testosterone, libido changes, and fatigue",
      },
    });

    expect(serviceLine).toBe("trt");
  });

  it("treats explicit disabled clinic override as not enabled", () => {
    expect(
      isClinicServiceLineEnabled("glp1", [
        { service_key: "glp1-weight-loss", is_enabled: false },
      ])
    ).toBe(false);
  });

  it("builds a missing-information GLP-1 suggestion when baseline labs are absent", () => {
    const input = makeInput();
    const suggestion = buildStructuredProtocolSuggestion(input, [], null);

    expect(suggestion.service_line).toBe("glp1");
    expect(suggestion.recommendation_type).toBe("missing_information");
    expect(suggestion.provider_review_required).toBe(true);
    expect(suggestion.missing_required_labs).toContain("A1c");
    expect(suggestion.risk_flags).toContain("existing obesity");
    expect(suggestion.advisory_note).toContain("Provider approval required");
  });

  it("falls back to follow-up-needed when clinic override disables the inferred service line", () => {
    const input = makeInput({
      pathway: {
        id: "path_peptides",
        slug: "peptides",
        name: "Peptides",
        description: null,
        is_active: true,
        version: 1,
        definition_json: { pathwayKey: "peptides", title: "Peptides", steps: [] },
        created_at: "2026-04-17T10:00:00.000Z",
        updated_at: "2026-04-17T10:00:00.000Z",
      },
      session: {
        ...makeInput().session,
        pathway_id: "path_peptides",
        current_step_key: "peptides",
      },
      answers: {
        peptide_primary_goal: "Recovery support",
      },
    });

    const suggestion = buildStructuredProtocolSuggestion(
      input,
      [{ service_key: "peptides-support", is_enabled: false }],
      null
    );

    expect(suggestion.service_line).toBe("peptides");
    expect(suggestion.recommendation_type).toBe("follow_up_needed");
    expect(suggestion.suggested_program).toContain("activation");
  });
});
