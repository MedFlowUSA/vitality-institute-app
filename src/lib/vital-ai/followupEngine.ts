import type { ResponseMap, VitalAiResponseRow, VitalAiSessionRow } from "../vitalAi/types";

export type VitalAiFollowUp = {
  type: "photo_check" | "symptom_check" | "healing_progress_check";
  dayOffset: number;
  message: string;
};

export type VitalAiFollowUpPlan = {
  followUps: VitalAiFollowUp[];
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
  return "";
}

function firstText(answers: ResponseMap, keys: string[]) {
  for (const key of keys) {
    const value = asText(answers[key]);
    if (value) return value;
  }
  return "";
}

function inferPathway(pathwaySlug: string | null | undefined, answers: ResponseMap) {
  if (pathwaySlug) return pathwaySlug;
  if (firstText(answers, ["wound_location", "wound_duration", "drainage_amount", "exudate"])) return "wound-care";
  if (firstText(answers, ["current_weight", "goal_weight", "prior_glp1_use", "diabetes_status"])) return "glp1";
  if (firstText(answers, ["peptide_primary_goal", "prior_peptide_use", "relevant_symptoms"])) return "peptides";
  if (firstText(answers, ["energy_level", "sleep_quality", "stress_level", "health_goals"])) return "wellness";
  return "general-consult";
}

export function generateFollowUps(session: VitalAiSessionRow, responses: VitalAiResponseRow[]): VitalAiFollowUpPlan {
  const answers = responsesToMap(responses);
  const pathway = inferPathway(session.current_step_key ?? null, answers);

  if (pathway.includes("wound")) {
    return {
      followUps: [
        {
          type: "symptom_check",
          dayOffset: 3,
          message: "How is your wound healing? Are you experiencing increased pain, swelling, or drainage?",
        },
        {
          type: "photo_check",
          dayOffset: 7,
          message: "Please upload a new photo of your wound so we can track healing.",
        },
        {
          type: "healing_progress_check",
          dayOffset: 14,
          message: "Please share how your wound is healing and let us know about any increased pain, swelling, or drainage.",
        },
      ],
    };
  }

  if (pathway.includes("glp1")) {
    return {
      followUps: [
        {
          type: "symptom_check",
          dayOffset: 3,
          message: "How are you feeling since your GLP-1 intake? Let us know about any nausea, GI changes, or medication concerns.",
        },
        {
          type: "healing_progress_check",
          dayOffset: 14,
          message: "Please share any appetite, weight, or side-effect changes so the care team can review your progress.",
        },
      ],
    };
  }

  if (pathway.includes("wellness")) {
    return {
      followUps: [
        {
          type: "symptom_check",
          dayOffset: 7,
          message: "How are your energy, sleep, and stress levels doing since you completed your wellness intake?",
        },
        {
          type: "healing_progress_check",
          dayOffset: 14,
          message: "Let us know about any changes in your routine, symptoms, or health goals so your provider can stay aligned.",
        },
      ],
    };
  }

  if (pathway.includes("peptide")) {
    return {
      followUps: [
        {
          type: "symptom_check",
          dayOffset: 7,
          message: "How are your symptoms and goals progressing? Let us know about any recovery, inflammation, or performance changes.",
        },
        {
          type: "healing_progress_check",
          dayOffset: 14,
          message: "Please share any updates in your symptoms, medications, or treatment goals for follow-up review.",
        },
      ],
    };
  }

  return {
    followUps: [
      {
        type: "symptom_check",
        dayOffset: 7,
        message: "How are you feeling since your intake? Let us know if any symptoms have changed.",
      },
    ],
  };
}
