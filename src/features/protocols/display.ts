import type { ProviderProtocolDecision, ProtocolRecommendationType, ProtocolServiceLine, StructuredProtocolSuggestion } from "./types";

export function formatProtocolServiceLineLabel(serviceLine: ProtocolServiceLine) {
  if (serviceLine === "glp1") return "GLP-1";
  if (serviceLine === "trt") return "TRT / hormone optimization";
  if (serviceLine === "general_consult") return "General consultation";
  return serviceLine.replaceAll("_", " ");
}

export function formatProtocolRecommendationTypeLabel(recommendationType: ProtocolRecommendationType) {
  if (recommendationType === "candidate_review") return "Ready for physician review";
  if (recommendationType === "missing_information") return "Missing information";
  return "Follow-up needed";
}

export function formatProviderProtocolDecisionLabel(decision: ProviderProtocolDecision) {
  if (decision === "approved") return "Approved";
  if (decision === "modified") return "Modified";
  return "Rejected";
}

export function buildProtocolMedicationText(suggestion: StructuredProtocolSuggestion) {
  return suggestion.suggested_medications.join(", ");
}

export function parseProtocolMedicationText(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
