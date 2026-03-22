import type { ResponseMap } from "./types";
import type {
  ConversionLeadMetadata,
  ConversionPathway,
} from "./conversionEngine";

export type RevenueActionKey =
  | "start_program"
  | "book_consultation"
  | "start_wound_review"
  | "call_clinic"
  | "request_visit"
  | "explore_iv_therapy";

export type RevenueRecommendation = {
  primaryOffer: string;
  secondaryOffer?: string;
  consultRequired: boolean;
  note?: string;
  primaryAction: RevenueActionKey;
  secondaryAction?: RevenueActionKey;
};

function readAnswer(answers: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = answers[key];
    if (value != null && value !== "") return value;
  }
  return null;
}

function toStringValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => toStringValue(item)).filter(Boolean).join(", ");
  if (typeof value === "object") return "";
  return String(value).trim();
}

function hasAnyToken(value: unknown, tokens: string[]) {
  const normalized = toStringValue(value).toLowerCase();
  return tokens.some((token) => normalized.includes(token.toLowerCase()));
}

export function getRevenueRecommendation(args: {
  lead: ConversionLeadMetadata;
  answers?: ResponseMap | Record<string, unknown>;
}): RevenueRecommendation {
  const answers = (args.answers ?? {}) as Record<string, unknown>;
  const leadType: ConversionPathway = args.lead.leadType;

  if (leadType === "wound") {
    return {
      primaryOffer: "Start Wound Review",
      secondaryOffer: "Call the Clinic",
      consultRequired: true,
      note:
        args.lead.urgencyLevel === "high"
          ? "Prompt review is recommended before the next visit step."
          : "Clinical review helps guide the safest next step.",
      primaryAction: "start_wound_review",
      secondaryAction: "call_clinic",
    };
  }

  if (leadType === "glp1") {
    return {
      primaryOffer: "Start GLP-1 Program",
      secondaryOffer: "Book Consultation",
      consultRequired: false,
      note: "Lab review may be recommended before starting.",
      primaryAction: "start_program",
      secondaryAction: "book_consultation",
    };
  }

  if (leadType === "peptides") {
    return {
      primaryOffer: "Start Peptide Program",
      secondaryOffer: "Book Consultation",
      consultRequired: false,
      note: "A provider may recommend review before the next step is finalized.",
      primaryAction: "start_program",
      secondaryAction: "book_consultation",
    };
  }

  if (leadType === "hormone") {
    return {
      primaryOffer: "Book Hormone Consultation",
      consultRequired: true,
      note: "Lab review is typically part of the next step.",
      primaryAction: "book_consultation",
    };
  }

  const concernText = toStringValue(
    readAnswer(answers, ["main_concern", "help_goal", "health_goals", "relevant_symptoms", "symptom_focus"])
  );
  const fatigueOrWellnessPattern = hasAnyToken(concernText, [
    "fatigue",
    "energy",
    "recovery",
    "hydration",
    "wellness",
    "stress",
    "sleep",
  ]);

  if (fatigueOrWellnessPattern) {
    return {
      primaryOffer: "Request Visit",
      secondaryOffer: "Explore IV Therapy",
      consultRequired: false,
      note: "A provider may guide whether supportive IV options fit your next step.",
      primaryAction: "request_visit",
      secondaryAction: "explore_iv_therapy",
    };
  }

  return {
    primaryOffer: "Request Visit",
    consultRequired: false,
    note: "The team can guide the most appropriate next step after review.",
    primaryAction: "request_visit",
  };
}
