import type { ResponseMap, VitalAiFileRow, VitalAiResponseRow, VitalAiSessionRow } from "../vitalAi/types";

export type VitalAiTreatmentOpportunitySignal = {
  type: string;
  label: string;
  confidence: "low" | "moderate" | "high";
  reason: string;
};

export type VitalAiTreatmentOpportunityResult = {
  opportunities: VitalAiTreatmentOpportunitySignal[];
};

function responsesToMap(rows: VitalAiResponseRow[]): ResponseMap {
  const next: ResponseMap = {};
  for (const row of rows) next[row.question_key] = row.value_json;
  return next;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asText(record.label ?? record.value ?? "");
  }
  return "";
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "yes" || normalized === "true" || normalized === "y";
  }
  return false;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value.replace(/[^\d.-]/g, "");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstText(answers: ResponseMap, keys: string[]): string {
  for (const key of keys) {
    const value = asText(answers[key]);
    if (value) return value;
  }
  return "";
}

function firstBool(answers: ResponseMap, keys: string[]): boolean {
  for (const key of keys) {
    if (asBool(answers[key])) return true;
  }
  return false;
}

function firstNumber(answers: ResponseMap, keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumber(answers[key]);
    if (value != null) return value;
  }
  return null;
}

function includesToken(value: string, token: string) {
  return value.toLowerCase().includes(token.toLowerCase());
}

function durationDays(durationText: string): number | null {
  const normalized = durationText.toLowerCase();
  const numberMatch = normalized.match(/(\d+(\.\d+)?)/);
  const amount = numberMatch ? Number(numberMatch[1]) : null;
  if (amount == null) return null;
  if (normalized.includes("month")) return amount * 30;
  if (normalized.includes("week")) return amount * 7;
  if (normalized.includes("year")) return amount * 365;
  return amount;
}

function inferPathway(pathwaySlug: string | null | undefined, answers: ResponseMap) {
  if (pathwaySlug) return pathwaySlug;
  if (firstText(answers, ["wound_location", "wound_duration", "wound_length_cm", "wound_width_cm"])) return "wound-care";
  if (firstText(answers, ["current_weight", "goal_weight", "prior_glp1_use", "diabetes_status"])) return "glp1";
  if (firstText(answers, ["peptide_primary_goal", "prior_peptide_use", "relevant_symptom_focus"])) return "peptides";
  if (firstText(answers, ["health_goal_primary", "energy_level", "sleep_quality", "stress_level"])) return "wellness";
  return "general-consult";
}

function pushOpportunity(
  items: VitalAiTreatmentOpportunitySignal[],
  signal: VitalAiTreatmentOpportunitySignal
) {
  if (!items.some((item) => item.type === signal.type)) items.push(signal);
}

export function detectTreatmentOpportunitySignals(
  session: VitalAiSessionRow,
  responses: VitalAiResponseRow[],
  files: VitalAiFileRow[]
): VitalAiTreatmentOpportunityResult {
  const answers = responsesToMap(responses);
  const pathway = inferPathway(session.current_step_key ?? null, answers);
  const opportunities: VitalAiTreatmentOpportunitySignal[] = [];

  if (includesToken(pathway, "wound")) {
    const duration = durationDays(firstText(answers, ["wound_duration", "duration", "wound_duration_weeks"]));
    const drainagePresent =
      firstBool(answers, ["drainage_present"]) || Boolean(firstText(answers, ["drainage_description", "drainage_amount", "drainage", "exudate"]));
    const infectionConcern =
      firstBool(answers, ["infection_concern", "signs_of_infection"]) || Boolean(firstText(answers, ["infection_symptoms"]));
    const priorTreatments = firstText(answers, ["prior_treatments", "prior_treatments_other"]);
    const diabetes = firstBool(answers, ["has_diabetes", "diabetes", "diabetes_reported"]);
    const hasImages = files.some((file) => (file.content_type ?? "").startsWith("image/") || file.category.toLowerCase().includes("image"));

    if (duration != null && duration > 28) {
      pushOpportunity(opportunities, {
        type: "chronic_wound",
        label: "Chronic wound signal",
        confidence: "high",
        reason: "Wound duration is greater than 4 weeks.",
      });
      pushOpportunity(opportunities, {
        type: "advanced_wound_care",
        label: "Advanced wound care candidate",
        confidence: "moderate",
        reason: "Chronic wound duration suggests higher-acuity wound-care review.",
      });
    }

    if (drainagePresent && infectionConcern) {
      pushOpportunity(opportunities, {
        type: "infection_risk",
        label: "Possible infection risk",
        confidence: "high",
        reason: "Drainage and infection concern were both reported in intake responses.",
      });
    }

    if (drainagePresent || (duration != null && duration > 14)) {
      pushOpportunity(opportunities, {
        type: "debridement_candidate",
        label: "Debridement review candidate",
        confidence: duration != null && duration > 28 ? "moderate" : "low",
        reason: drainagePresent ? "Drainage was reported and wound-bed review may be needed." : "Persistent wound duration suggests debridement review may be relevant.",
      });
    }

    if (priorTreatments && duration != null && duration > 28) {
      pushOpportunity(opportunities, {
        type: "skin_substitute_candidate",
        label: "Skin substitute review candidate",
        confidence: "low",
        reason: "Prior treatments were reported with an ongoing wound duration greater than 4 weeks.",
      });
    }

    if (diabetes || hasImages || duration != null && duration > 14) {
      pushOpportunity(opportunities, {
        type: "advanced_wound_consult",
        label: "Advanced wound consult signal",
        confidence: diabetes || duration != null && duration > 28 ? "moderate" : "low",
        reason: diabetes
          ? "Diabetes was reported alongside wound intake details."
          : hasImages
          ? "Wound images are available to support advanced wound-care review."
          : "Wound duration suggests a more detailed wound-care consult may be useful.",
      });
    }
  }

  if (includesToken(pathway, "glp1")) {
    const currentWeight = firstNumber(answers, ["current_weight"]);
    const heightInches = firstNumber(answers, ["height_inches"]);
    const bmi =
      currentWeight != null && heightInches != null && heightInches > 0
        ? Number((((currentWeight / (heightInches * heightInches)) * 703)).toFixed(1))
        : null;
    const diabetesStatus = firstText(answers, ["diabetes_status"]);
    const labsAvailable = firstBool(answers, ["labs_available"]) || files.some((file) => file.category === "recent_labs");

    if (bmi != null && bmi > 30) {
      pushOpportunity(opportunities, {
        type: "weight_management_candidate",
        label: "Weight-management candidate",
        confidence: bmi >= 35 ? "high" : "moderate",
        reason: `Calculated BMI is ${bmi}.`,
      });
    }

    if (diabetesStatus && !includesToken(diabetesStatus, "none")) {
      pushOpportunity(opportunities, {
        type: "metabolic_optimization",
        label: "Metabolic optimization review",
        confidence: "moderate",
        reason: `${diabetesStatus} history was reported in intake.`,
      });
    }

    if (labsAvailable || diabetesStatus && !includesToken(diabetesStatus, "none")) {
      pushOpportunity(opportunities, {
        type: "lab_review_recommended",
        label: "Lab review recommended",
        confidence: labsAvailable ? "moderate" : "low",
        reason: labsAvailable ? "Recent labs are available for review." : "Metabolic history suggests lab review may be useful.",
      });
    }
  }

  if (includesToken(pathway, "wellness")) {
    const energy = firstText(answers, ["energy_level", "symptom_focus"]);
    const sleep = firstText(answers, ["sleep_quality"]);
    const stress = firstText(answers, ["stress_level"]);
    const symptomFocus = firstText(answers, ["symptom_focus", "symptom_focus_other", "symptom_concerns"]);
    const exercise = firstText(answers, ["exercise_frequency"]);
    const hydration = firstText(answers, ["hydration_level"]);

    if (includesToken(energy, "low") || includesToken(symptomFocus, "fatigue")) {
      pushOpportunity(opportunities, {
        type: "fatigue_energy_evaluation",
        label: "Fatigue / energy evaluation",
        confidence: "moderate",
        reason: "Low energy or fatigue-related concerns were reported.",
      });
    }

    if (includesToken(symptomFocus, "hormone")) {
      pushOpportunity(opportunities, {
        type: "hormone_review_candidate",
        label: "Hormone review candidate",
        confidence: "low",
        reason: "Hormone-related wellness concerns were selected.",
      });
    }

    if (includesToken(stress, "high")) {
      pushOpportunity(opportunities, {
        type: "stress_management_pathway",
        label: "Stress-management pathway",
        confidence: "moderate",
        reason: "High stress was reported in the wellness intake.",
      });
    }

    if (includesToken(sleep, "poor") || includesToken(exercise, "rarely") || includesToken(hydration, "dehydrated")) {
      pushOpportunity(opportunities, {
        type: "lifestyle_optimization",
        label: "Lifestyle optimization signal",
        confidence: "moderate",
        reason: "Sleep, activity, or hydration responses suggest lifestyle optimization may be relevant.",
      });
    }
  }

  if (includesToken(pathway, "peptide")) {
    const primaryGoal = firstText(answers, ["peptide_primary_goal", "peptide_primary_goal_other"]);
    const symptomFocus = firstText(answers, ["relevant_symptom_focus", "relevant_symptom_focus_other", "relevant_symptoms"]);

    if (includesToken(primaryGoal, "recovery") || includesToken(symptomFocus, "slow recovery")) {
      pushOpportunity(opportunities, {
        type: "recovery_peptide_candidate",
        label: "Recovery peptide support signal",
        confidence: "moderate",
        reason: "Recovery-focused goals or slow-recovery symptoms were reported.",
      });
    }

    if (includesToken(primaryGoal, "inflammation") || includesToken(symptomFocus, "joint pain")) {
      pushOpportunity(opportunities, {
        type: "anti_inflammatory_peptide_support",
        label: "Anti-inflammatory peptide support signal",
        confidence: "moderate",
        reason: "Inflammation-related goals or joint-pain symptoms were reported.",
      });
    }

    if (includesToken(primaryGoal, "performance") || includesToken(symptomFocus, "performance")) {
      pushOpportunity(opportunities, {
        type: "performance_peptide_support",
        label: "Performance peptide support signal",
        confidence: "moderate",
        reason: "Performance-oriented goals were selected in the intake.",
      });
    }
  }

  return { opportunities };
}
