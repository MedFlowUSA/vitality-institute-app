import type { VitalAiPathwayRow } from "./types";

export type IntakeGender = "Male" | "Female" | "Prefer not to say";

const STORAGE_KEY = "vital_ai_intake_gender";

function normalizeGender(value: unknown): IntakeGender | "" {
  if (value === "Male" || value === "Female" || value === "Prefer not to say") return value;
  return "";
}

function includesToken(value: string | null | undefined, tokens: string[]) {
  const normalized = (value ?? "").toLowerCase();
  return tokens.some((token) => normalized.includes(token));
}

function isFemaleHormonePathway(pathway: VitalAiPathwayRow) {
  return (
    includesToken(pathway.slug, ["women", "female", "hrt"]) ||
    includesToken(pathway.name, ["women", "female", "hrt"])
  );
}

function isMaleHormonePathway(pathway: VitalAiPathwayRow) {
  return (
    includesToken(pathway.slug, ["testosterone", "male", "men", "trt"]) ||
    includesToken(pathway.name, ["testosterone", "male", "men", "trt"])
  );
}

function priorityScore(pathway: VitalAiPathwayRow, gender: IntakeGender | "") {
  const slug = pathway.slug.toLowerCase();
  if (slug.includes("wound")) return -10;
  if (!gender || gender === "Prefer not to say") return 0;
  if (gender === "Male") {
    if (isMaleHormonePathway(pathway)) return -4;
    if (isFemaleHormonePathway(pathway)) return 6;
  }
  if (gender === "Female") {
    if (isFemaleHormonePathway(pathway)) return -4;
    if (isMaleHormonePathway(pathway)) return 6;
  }
  return 0;
}

export function getGenderPathwayGuidance(gender: IntakeGender | "") {
  if (gender === "Male") {
    return "Testosterone-related hormone pathways are prioritized while female-specific hormone options are hidden.";
  }
  if (gender === "Female") {
    return "Women's hormone balance pathways are prioritized while testosterone-specific options are hidden.";
  }
  return "All intake pathways remain visible until you choose a preference.";
}

export function readStoredIntakeGender() {
  if (typeof window === "undefined") return "";
  try {
    return normalizeGender(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return "";
  }
}

export function saveStoredIntakeGender(value: IntakeGender | "") {
  if (typeof window === "undefined") return;
  try {
    if (!value) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore storage failures
  }
}

export function personalizePathwaysByGender(pathways: VitalAiPathwayRow[], gender: IntakeGender | "") {
  const filtered =
    gender === "Male"
      ? pathways.filter((pathway) => !isFemaleHormonePathway(pathway))
      : gender === "Female"
        ? pathways.filter((pathway) => !isMaleHormonePathway(pathway))
        : pathways;

  const source = filtered.length > 0 ? filtered : pathways;
  return [...source].sort((a, b) => {
    const score = priorityScore(a, gender) - priorityScore(b, gender);
    if (score !== 0) return score;
    return a.name.localeCompare(b.name);
  });
}
