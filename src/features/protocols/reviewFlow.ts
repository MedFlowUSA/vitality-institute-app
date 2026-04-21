import type { ProviderProtocolDecision, StructuredProtocolSuggestion } from "./types";

type ProtocolSuggestionDraft = {
  suggestedProgram: string;
  suggestedMedications: string[];
  suggestedDosage: string;
  suggestedFrequency: string;
  suggestedDuration: string;
};

export function isProtocolAssessmentReviewable(args: {
  providerReviewRequired: boolean;
  assessmentStatus: string;
  hasExistingReview: boolean;
}) {
  return args.providerReviewRequired && args.assessmentStatus === "generated" && !args.hasExistingReview;
}

export function buildFinalProtocolSuggestion(args: {
  source: StructuredProtocolSuggestion;
  suggestedProgram: string;
  suggestedMedications: string[];
  suggestedDosage: string;
  suggestedFrequency: string;
  suggestedDuration: string;
  providerNotes: string;
  reviewerId: string;
  reviewedAt: string;
}) {
  return {
    ...args.source,
    suggested_program: args.suggestedProgram.trim() || null,
    suggested_medications: args.suggestedMedications,
    suggested_dosage: args.suggestedDosage.trim() || null,
    suggested_frequency: args.suggestedFrequency.trim() || null,
    suggested_duration: args.suggestedDuration.trim() || null,
    provider_notes: args.providerNotes.trim() || null,
    reviewed_by: args.reviewerId,
    reviewed_at: args.reviewedAt,
  };
}

function normalizeText(value: string | null | undefined) {
  const next = value?.trim() ?? "";
  return next || null;
}

function normalizeMedications(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function hasProtocolSuggestionEdits(args: {
  source: StructuredProtocolSuggestion;
  draft: ProtocolSuggestionDraft;
}) {
  const normalizedDraftMeds = normalizeMedications(args.draft.suggestedMedications);
  if (normalizeText(args.draft.suggestedProgram) !== normalizeText(args.source.suggested_program)) return true;
  if (normalizeText(args.draft.suggestedDosage) !== normalizeText(args.source.suggested_dosage)) return true;
  if (normalizeText(args.draft.suggestedFrequency) !== normalizeText(args.source.suggested_frequency)) return true;
  if (normalizeText(args.draft.suggestedDuration) !== normalizeText(args.source.suggested_duration)) return true;
  if (normalizedDraftMeds.length !== args.source.suggested_medications.length) return true;

  return normalizedDraftMeds.some((value, index) => value !== args.source.suggested_medications[index]);
}

export function buildProviderReviewedProtocolSuggestion(args: {
  decision: ProviderProtocolDecision;
  source: StructuredProtocolSuggestion;
  draft: ProtocolSuggestionDraft;
  providerNotes: string;
  reviewerId: string;
  reviewedAt: string;
}) {
  if (args.decision !== "modified") {
    return {
      ...args.source,
      provider_notes: normalizeText(args.providerNotes),
      reviewed_by: args.reviewerId,
      reviewed_at: args.reviewedAt,
    };
  }

  return buildFinalProtocolSuggestion({
    source: args.source,
    suggestedProgram: args.draft.suggestedProgram,
    suggestedMedications: normalizeMedications(args.draft.suggestedMedications),
    suggestedDosage: args.draft.suggestedDosage,
    suggestedFrequency: args.draft.suggestedFrequency,
    suggestedDuration: args.draft.suggestedDuration,
    providerNotes: args.providerNotes,
    reviewerId: args.reviewerId,
    reviewedAt: args.reviewedAt,
  });
}

export function getProtocolWorkflowOutcome(decision: ProviderProtocolDecision) {
  return {
    assessmentStatus: "reviewed" as const,
    profileStatus:
      decision === "rejected"
        ? "rejected"
        : decision === "modified"
        ? "provider_modified"
        : "provider_reviewed",
    leadStatus: decision === "rejected" ? "closed" : null,
    closeTaskTypes: decision === "rejected" ? ["provider_review", "staff_follow_up"] : ["provider_review"],
  };
}
