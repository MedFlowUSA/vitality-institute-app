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
