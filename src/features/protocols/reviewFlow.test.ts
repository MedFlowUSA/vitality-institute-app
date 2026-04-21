import { describe, expect, it } from "vitest";
import {
  buildFinalProtocolSuggestion,
  buildProviderReviewedProtocolSuggestion,
  getProtocolWorkflowOutcome,
  hasProtocolSuggestionEdits,
  isProtocolAssessmentReviewable,
} from "./reviewFlow";
import type { StructuredProtocolSuggestion } from "./types";

const baseSuggestion: StructuredProtocolSuggestion = {
  recommendation_type: "candidate_review",
  service_line: "glp1",
  suggested_program: "Physician-reviewed GLP-1 metabolic program",
  suggested_medications: ["GLP-1 candidacy review"],
  suggested_dosage: "Start-low escalation if approved by physician",
  suggested_frequency: "Weekly if approved",
  suggested_duration: "12-week starter review",
  rationale_summary: "Structured summary",
  risk_flags: [],
  contraindications: [],
  missing_required_labs: [],
  followup_recommendations: ["Review with physician"],
  provider_review_required: true,
  confidence_notes: "Rule-based output",
  advisory_note: "AI-assisted only.",
};

describe("reviewFlow", () => {
  it("treats only generated, unrevewed assessments as reviewable", () => {
    expect(isProtocolAssessmentReviewable({ providerReviewRequired: true, assessmentStatus: "generated", hasExistingReview: false })).toBe(true);
    expect(isProtocolAssessmentReviewable({ providerReviewRequired: true, assessmentStatus: "reviewed", hasExistingReview: false })).toBe(false);
    expect(isProtocolAssessmentReviewable({ providerReviewRequired: true, assessmentStatus: "generated", hasExistingReview: true })).toBe(false);
    expect(isProtocolAssessmentReviewable({ providerReviewRequired: false, assessmentStatus: "generated", hasExistingReview: false })).toBe(false);
  });

  it("builds a final protocol suggestion without mutating the raw AI assessment shape", () => {
    const result = buildFinalProtocolSuggestion({
      source: baseSuggestion,
      suggestedProgram: " Modified program ",
      suggestedMedications: ["Medication A", "Medication B"],
      suggestedDosage: " 10 units ",
      suggestedFrequency: " weekly ",
      suggestedDuration: " 8 weeks ",
      providerNotes: " Reviewed and adjusted ",
      reviewerId: "provider_1",
      reviewedAt: "2026-04-17T20:00:00.000Z",
    });

    expect(baseSuggestion.suggested_program).toBe("Physician-reviewed GLP-1 metabolic program");
    expect(result.suggested_program).toBe("Modified program");
    expect(result.suggested_medications).toEqual(["Medication A", "Medication B"]);
    expect(result.provider_notes).toBe("Reviewed and adjusted");
    expect(result.reviewed_by).toBe("provider_1");
    expect(result.reviewed_at).toBe("2026-04-17T20:00:00.000Z");
  });

  it("detects when the provider draft changes the AI recommendation", () => {
    expect(
      hasProtocolSuggestionEdits({
        source: baseSuggestion,
        draft: {
          suggestedProgram: "Physician-reviewed GLP-1 metabolic program",
          suggestedMedications: ["GLP-1 candidacy review"],
          suggestedDosage: "Start-low escalation if approved by physician",
          suggestedFrequency: "Weekly if approved",
          suggestedDuration: "12-week starter review",
        },
      })
    ).toBe(false);

    expect(
      hasProtocolSuggestionEdits({
        source: baseSuggestion,
        draft: {
          suggestedProgram: "Modified program",
          suggestedMedications: ["GLP-1 candidacy review", "Adjunct support"],
          suggestedDosage: "10 units",
          suggestedFrequency: "Weekly",
          suggestedDuration: "8 weeks",
        },
      })
    ).toBe(true);
  });

  it("preserves the AI recommendation for approve and reject, and only saves edits for modify", () => {
    const approved = buildProviderReviewedProtocolSuggestion({
      decision: "approved",
      source: baseSuggestion,
      draft: {
        suggestedProgram: "Modified program",
        suggestedMedications: ["Medication A"],
        suggestedDosage: "10 units",
        suggestedFrequency: "weekly",
        suggestedDuration: "8 weeks",
      },
      providerNotes: "Approved as generated",
      reviewerId: "provider_1",
      reviewedAt: "2026-04-17T20:00:00.000Z",
    });

    const modified = buildProviderReviewedProtocolSuggestion({
      decision: "modified",
      source: baseSuggestion,
      draft: {
        suggestedProgram: "Modified program",
        suggestedMedications: ["Medication A"],
        suggestedDosage: "10 units",
        suggestedFrequency: "weekly",
        suggestedDuration: "8 weeks",
      },
      providerNotes: "Adjusted after physician review",
      reviewerId: "provider_1",
      reviewedAt: "2026-04-17T20:00:00.000Z",
    });

    const rejected = buildProviderReviewedProtocolSuggestion({
      decision: "rejected",
      source: baseSuggestion,
      draft: {
        suggestedProgram: "Modified program",
        suggestedMedications: ["Medication A"],
        suggestedDosage: "10 units",
        suggestedFrequency: "weekly",
        suggestedDuration: "8 weeks",
      },
      providerNotes: "Rejected due to contraindications",
      reviewerId: "provider_1",
      reviewedAt: "2026-04-17T20:00:00.000Z",
    });

    expect(approved.suggested_program).toBe(baseSuggestion.suggested_program);
    expect(approved.suggested_medications).toEqual(baseSuggestion.suggested_medications);
    expect(approved.provider_notes).toBe("Approved as generated");

    expect(modified.suggested_program).toBe("Modified program");
    expect(modified.suggested_medications).toEqual(["Medication A"]);
    expect(modified.provider_notes).toBe("Adjusted after physician review");

    expect(rejected.suggested_program).toBe(baseSuggestion.suggested_program);
    expect(rejected.suggested_medications).toEqual(baseSuggestion.suggested_medications);
    expect(rejected.provider_notes).toBe("Rejected due to contraindications");
  });

  it("returns the correct workflow transitions for approve, modify, and reject", () => {
    expect(getProtocolWorkflowOutcome("approved")).toEqual({
      assessmentStatus: "reviewed",
      profileStatus: "provider_reviewed",
      leadStatus: null,
      closeTaskTypes: ["provider_review"],
    });

    expect(getProtocolWorkflowOutcome("modified")).toEqual({
      assessmentStatus: "reviewed",
      profileStatus: "provider_modified",
      leadStatus: null,
      closeTaskTypes: ["provider_review"],
    });

    expect(getProtocolWorkflowOutcome("rejected")).toEqual({
      assessmentStatus: "reviewed",
      profileStatus: "rejected",
      leadStatus: "closed",
      closeTaskTypes: ["provider_review", "staff_follow_up"],
    });
  });
});
