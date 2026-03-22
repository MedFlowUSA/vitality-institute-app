import type { PublicVitalAiAnswers, PublicVitalAiPathway } from "../publicVitalAiLite";
import type { ResponseMap } from "./types";

export type ConversionPathway = "wound" | "glp1" | "peptides" | "hormone" | "general";
export type ConversionUrgencyLevel = "low" | "medium" | "high";
export type ConversionValueLevel = "low" | "medium" | "high";

export type ConversionLeadMetadata = {
  leadScore: number;
  leadType: ConversionPathway;
  urgencyLevel: ConversionUrgencyLevel;
  valueLevel: ConversionValueLevel;
  outcomeLabel: string;
};

type ConversionAnswerMap = ResponseMap | PublicVitalAiAnswers | Record<string, unknown>;

function readAnswer(answers: ConversionAnswerMap, keys: string[]) {
  const source = answers as Record<string, unknown>;
  for (const key of keys) {
    const value = source[key];
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

function toBooleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = toStringValue(value).toLowerCase();
  return ["yes", "true", "1", "high", "present", "moderate", "heavy", "large", "significant"].includes(normalized);
}

function toNumberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = toStringValue(value);
  if (!text) return null;
  const match = text.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const next = Number(match[0]);
  return Number.isFinite(next) ? next : null;
}

function hasAnyToken(value: unknown, tokens: string[]) {
  const normalized = toStringValue(value).toLowerCase();
  return tokens.some((token) => normalized.includes(token.toLowerCase()));
}

export function normalizeConversionPathway(pathway: string | null | undefined): ConversionPathway {
  const normalized = (pathway ?? "").toLowerCase();
  if (normalized.includes("wound")) return "wound";
  if (normalized.includes("glp1")) return "glp1";
  if (normalized.includes("peptide")) return "peptides";
  if (normalized.includes("hormone") || normalized.includes("wellness") || normalized.includes("hrt") || normalized.includes("trt")) {
    return "hormone";
  }
  return "general";
}

export function normalizePublicPathway(pathway: PublicVitalAiPathway): ConversionPathway {
  if (pathway === "wound_care") return "wound";
  if (pathway === "glp1_weight_loss") return "glp1";
  return "general";
}

function outcomeLabelForUrgency(urgencyLevel: ConversionUrgencyLevel) {
  if (urgencyLevel === "high") return "Prompt attention recommended";
  if (urgencyLevel === "medium") return "Provider review recommended";
  return "Recommended next step";
}

export function outcomeBadgeStyle(urgencyLevel: ConversionUrgencyLevel) {
  if (urgencyLevel === "high") {
    return {
      background: "rgba(248,113,113,0.16)",
      border: "1px solid rgba(248,113,113,0.34)",
      color: "#FECACA",
    };
  }

  if (urgencyLevel === "medium") {
    return {
      background: "rgba(250,204,21,0.14)",
      border: "1px solid rgba(250,204,21,0.28)",
      color: "#FDE68A",
    };
  }

  return {
    background: "rgba(167,139,250,0.16)",
    border: "1px solid rgba(167,139,250,0.3)",
    color: "#E9D5FF",
  };
}

export function scoreConversionLead(args: {
  pathway: ConversionPathway | PublicVitalAiPathway | string | null | undefined;
  answers: ConversionAnswerMap;
}): ConversionLeadMetadata {
  const leadType =
    args.pathway === "wound_care" || args.pathway === "glp1_weight_loss" || args.pathway === "general_consult"
      ? normalizePublicPathway(args.pathway)
      : normalizeConversionPathway(args.pathway);

  if (leadType === "wound") {
    const infectionConcern = toBooleanValue(readAnswer(args.answers, ["infection_concern", "signs_of_infection", "infection_or_drainage_concern"]));
    const drainageConcern = hasAnyToken(readAnswer(args.answers, ["drainage_amount", "drainage", "exudate", "infection_or_drainage_concern"]), [
      "moderate",
      "heavy",
      "large",
      "significant",
      "yes",
      "present",
    ]);
    const painScore = toNumberValue(readAnswer(args.answers, ["pain_level", "pain_score", "wound_pain_score"])) ?? 0;
    const durationText = toStringValue(readAnswer(args.answers, ["wound_duration", "duration", "wound_duration_weeks"]));
    const longerDuration =
      hasAnyToken(durationText, ["more_than_4_weeks", "week", "month"]) || (toNumberValue(durationText) ?? 0) >= 14;
    const urgent = infectionConcern || drainageConcern || painScore >= 7 || longerDuration;

    return {
      leadScore: urgent ? 92 : 74,
      leadType,
      urgencyLevel: urgent ? "high" : "medium",
      valueLevel: urgent ? "high" : "medium",
      outcomeLabel: outcomeLabelForUrgency(urgent ? "high" : "medium"),
    };
  }

  if (leadType === "glp1") {
    const currentWeight = toNumberValue(readAnswer(args.answers, ["current_weight"]));
    const goalWeight = toNumberValue(readAnswer(args.answers, ["goal_weight"]));
    const hasWeightGoal = currentWeight != null && goalWeight != null && goalWeight < currentWeight;
    const metabolicSignal = toBooleanValue(readAnswer(args.answers, ["diabetes_or_prediabetes", "diabetes_status"]));
    const medicationConcern = toBooleanValue(readAnswer(args.answers, ["medication_review_flag", "thyroid_history", "pancreatitis_history", "gallbladder_history"]));
    const valueLevel: ConversionValueLevel = hasWeightGoal || metabolicSignal ? "high" : "medium";
    const urgencyLevel: ConversionUrgencyLevel = metabolicSignal || medicationConcern ? "medium" : "low";

    return {
      leadScore: valueLevel === "high" ? 84 : 66,
      leadType,
      urgencyLevel,
      valueLevel,
      outcomeLabel: outcomeLabelForUrgency(urgencyLevel),
    };
  }

  if (leadType === "hormone") {
    return {
      leadScore: 68,
      leadType,
      urgencyLevel: "medium",
      valueLevel: "medium",
      outcomeLabel: outcomeLabelForUrgency("medium"),
    };
  }

  if (leadType === "peptides") {
    return {
      leadScore: 58,
      leadType,
      urgencyLevel: "low",
      valueLevel: "medium",
      outcomeLabel: outcomeLabelForUrgency("low"),
    };
  }

  return {
    leadScore: 32,
    leadType: "general",
    urgencyLevel: "low",
    valueLevel: "low",
    outcomeLabel: outcomeLabelForUrgency("low"),
  };
}
