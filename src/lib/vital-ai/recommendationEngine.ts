import type { ResponseMap, VitalAiResponseRow, VitalAiSessionRow } from "../vitalAi/types";

export type VitalAiPatientGuidance = {
  title: string;
  body: string;
};

export type VitalAiProviderRecommendations = {
  patientConcern: string;
  riskIndicators: string[];
  suggestedPriority: "low" | "moderate" | "high";
  treatmentConsiderations: string[];
  likelyServiceFit: string[];
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

function includesToken(value: string, token: string) {
  return value.toLowerCase().includes(token.toLowerCase());
}

function inferPathway(pathwaySlug: string | null | undefined, answers: ResponseMap) {
  if (pathwaySlug) return pathwaySlug;
  if (firstText(answers, ["wound_location", "wound_duration", "drainage_amount", "exudate"])) return "wound-care";
  if (firstText(answers, ["current_weight", "goal_weight", "prior_glp1_use", "diabetes_status"])) return "glp1";
  if (firstText(answers, ["peptide_primary_goal", "prior_peptide_use", "relevant_symptoms"])) return "peptides";
  if (firstText(answers, ["energy_level", "sleep_quality", "stress_level", "health_goals"])) return "wellness";
  return "general-consult";
}

export function generatePatientSafeGuidance(session: VitalAiSessionRow, responses: VitalAiResponseRow[]): VitalAiPatientGuidance {
  const answers = responsesToMap(responses);
  const pathway = inferPathway(session.current_step_key ?? null, answers);

  if (includesToken(pathway, "wound")) {
    return {
      title: "What happens next",
      body: "Your provider may review wound-care treatment options after evaluating your symptoms, wound details, and any uploaded images. If anything urgent needs closer review, the team will guide the next step.",
    };
  }

  if (includesToken(pathway, "glp1")) {
    return {
      title: "What happens next",
      body: "Your provider may review metabolic or weight-management options based on your goals, history, and intake details. The next discussion will focus on safe, appropriate options for you.",
    };
  }

  if (includesToken(pathway, "wellness")) {
    return {
      title: "What happens next",
      body: "Your provider may review wellness optimization options based on your symptoms, lifestyle baseline, and goals. The visit will help identify the most relevant next-step discussion for your care plan.",
    };
  }

  if (includesToken(pathway, "peptide")) {
    return {
      title: "What happens next",
      body: "Your provider may review peptide-support options depending on your goals, history, symptoms, and provider approval. The care team will help determine what discussions are most appropriate for your visit.",
    };
  }

  return {
    title: "What happens next",
    body: "Your provider will review your intake and determine the best next-step discussion based on your concerns, history, and any supporting information you shared.",
  };
}

export function generateProviderRecommendations(args: {
  session: VitalAiSessionRow;
  responses: VitalAiResponseRow[];
  patientConcern: string;
  riskIndicators: string[];
  suggestedPriority: "low" | "moderate" | "high";
  treatmentConsiderations: string[];
}): VitalAiProviderRecommendations {
  const answers = responsesToMap(args.responses);
  const pathway = inferPathway(args.session.current_step_key ?? null, answers);
  const likelyServiceFit: string[] = [];

  if (includesToken(pathway, "wound")) {
    likelyServiceFit.push("wound evaluation");
    if (args.treatmentConsiderations.some((item) => includesToken(item, "hyperbaric"))) likelyServiceFit.push("hyperbaric review");
    if (args.treatmentConsiderations.some((item) => includesToken(item, "graft"))) likelyServiceFit.push("advanced wound therapy review");
  } else if (includesToken(pathway, "glp1")) {
    likelyServiceFit.push("weight-management consultation");
    if (firstText(answers, ["diabetes_status"]) && !includesToken(firstText(answers, ["diabetes_status"]), "none")) {
      likelyServiceFit.push("metabolic review");
    }
  } else if (includesToken(pathway, "wellness")) {
    likelyServiceFit.push("wellness optimization consultation");
    if (firstText(answers, ["prior_labs_available"]).includes("yes")) likelyServiceFit.push("lab-guided wellness review");
  } else if (includesToken(pathway, "peptide")) {
    likelyServiceFit.push("peptide candidacy review");
    likelyServiceFit.push("goal-focused wellness consultation");
  } else {
    likelyServiceFit.push("general consultation");
  }

  return {
    patientConcern: args.patientConcern,
    riskIndicators: args.riskIndicators,
    suggestedPriority: args.suggestedPriority,
    treatmentConsiderations: args.treatmentConsiderations,
    likelyServiceFit: Array.from(new Set(likelyServiceFit)),
  };
}
