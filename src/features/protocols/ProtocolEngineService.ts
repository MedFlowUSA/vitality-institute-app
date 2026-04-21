import { supabase } from "../../lib/supabase";
import type { ResponseMap } from "../../lib/vitalAi/types";
import type {
  AiProtocolAssessmentRow,
  ProtocolAssessmentInput,
  ProtocolRecommendationType,
  ProtocolServiceLine,
  ProtocolTemplateRow,
  StructuredProtocolSuggestion,
} from "./types";

const MODEL_KEY = "vitality-rule-engine";
const MODEL_VERSION = "2026-04-17.phase3";

type BuiltInTemplate = {
  label: string;
  suggestedProgram: string | null;
  suggestedMedications: string[];
  suggestedDosage: string | null;
  suggestedFrequency: string | null;
  suggestedDuration: string | null;
  requiredLabs: string[];
  followUps: string[];
};

const BUILT_IN_TEMPLATES: Record<ProtocolServiceLine, BuiltInTemplate> = {
  glp1: {
    label: "GLP-1 metabolic review",
    suggestedProgram: "Physician-reviewed GLP-1 metabolic program",
    suggestedMedications: ["GLP-1 candidacy review"],
    suggestedDosage: "Start-low escalation if approved by physician",
    suggestedFrequency: "Weekly if approved",
    suggestedDuration: "12-week starter review",
    requiredLabs: ["A1c", "CMP", "baseline weight/BMI"],
    followUps: [
      "Confirm contraindications and medication history.",
      "Obtain or review baseline metabolic labs before final prescribing decisions.",
      "Physician approval required before any order is finalized.",
    ],
  },
  trt: {
    label: "TRT / hormone optimization review",
    suggestedProgram: "Physician-reviewed TRT optimization pathway",
    suggestedMedications: ["Testosterone therapy candidacy review"],
    suggestedDosage: "Conservative starting dose if approved",
    suggestedFrequency: "Weekly or biweekly per physician review",
    suggestedDuration: "8-12 week reassessment cycle",
    requiredLabs: ["Total testosterone", "Free testosterone", "CBC", "CMP", "PSA if clinically indicated"],
    followUps: [
      "Review symptom cluster, prior hormone history, and fertility considerations.",
      "Verify baseline labs before treatment planning.",
      "Clinical decision remains with licensed physician.",
    ],
  },
  wellness: {
    label: "Wellness optimization review",
    suggestedProgram: "Physician-reviewed wellness consultation",
    suggestedMedications: [],
    suggestedDosage: null,
    suggestedFrequency: null,
    suggestedDuration: "Initial consult plus lab-guided follow-up",
    requiredLabs: ["CBC", "CMP", "thyroid panel", "Vitamin D if clinically indicated"],
    followUps: [
      "Review symptoms, stress, sleep, recovery, and relevant lab history.",
      "Clarify whether peptide or hormone pathways are more appropriate after physician review.",
      "Provider approval required before any treatment plan is finalized.",
    ],
  },
  peptides: {
    label: "Peptide-support review",
    suggestedProgram: "Physician-reviewed peptide consult pathway",
    suggestedMedications: ["Peptide therapy candidacy review"],
    suggestedDosage: "Program-specific dosing only after physician review",
    suggestedFrequency: "Varies by peptide and physician plan",
    suggestedDuration: "Initial consult plus program-specific reassessment",
    requiredLabs: ["CBC", "CMP", "goal-specific baseline labs"],
    followUps: [
      "Review intended goal, prior peptide exposure, and medication/allergy history.",
      "Confirm required baseline labs before treatment planning.",
      "Provider approval required before fulfillment or ordering.",
    ],
  },
  general_consult: {
    label: "General physician consultation",
    suggestedProgram: "Physician-reviewed consultation",
    suggestedMedications: [],
    suggestedDosage: null,
    suggestedFrequency: null,
    suggestedDuration: "Initial consult",
    requiredLabs: [],
    followUps: [
      "Route case to physician review for service-line determination.",
      "Request missing clinical history or labs if needed.",
      "Clinical decision remains with licensed physician.",
    ],
  },
  wound_care: {
    label: "Wound-care provider review",
    suggestedProgram: "Provider-side wound-care review",
    suggestedMedications: [],
    suggestedDosage: null,
    suggestedFrequency: null,
    suggestedDuration: "Initial wound evaluation plus reassessment cadence",
    requiredLabs: ["Wound photos", "vascular review if clinically indicated"],
    followUps: [
      "Review wound images, symptom progression, and infection concern.",
      "Escalate urgent concerns for earlier physician review.",
      "Provider approval required before any advanced treatment plan is finalized.",
    ],
  },
};

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.map((item) => asText(item)).filter(Boolean).join(", ");
  return "";
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = asText(value).toLowerCase();
  return ["yes", "true", "1", "present", "high"].includes(normalized);
}

function firstText(answers: ResponseMap, keys: string[]) {
  for (const key of keys) {
    const value = asText(answers[key]);
    if (value) return value;
  }
  return "";
}

function includesAny(value: string, tokens: string[]) {
  const normalized = value.toLowerCase();
  return tokens.some((token) => normalized.includes(token.toLowerCase()));
}

function uniq(items: Array<string | null | undefined>) {
  return Array.from(new Set(items.map((item) => item?.trim()).filter(Boolean) as string[]));
}

function normalizeRiskFlags(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => asText(item)).filter(Boolean);
  return [];
}

function inferFromGeneralConsult(answers: ResponseMap): ProtocolServiceLine {
  const combined = [
    firstText(answers, ["primary_concern", "goals", "health_goals", "symptom_focus", "relevant_symptoms"]),
    firstText(answers, ["current_medications", "medical_history"]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (includesAny(combined, ["weight", "glp-1", "glp1", "semaglutide", "tirzepatide", "obesity"])) return "glp1";
  if (includesAny(combined, ["testosterone", "trt", "libido", "low t", "hormone", "erectile"])) return "trt";
  if (includesAny(combined, ["peptide", "bpc", "tb500", "recovery peptide"])) return "peptides";
  if (includesAny(combined, ["fatigue", "energy", "sleep", "stress", "wellness"])) return "wellness";
  return "general_consult";
}

export function inferProtocolServiceLine(args: { pathwaySlug?: string | null; answers: ResponseMap }): ProtocolServiceLine {
  const slug = (args.pathwaySlug ?? "").toLowerCase();
  if (slug.includes("wound")) return "wound_care";
  if (slug.includes("glp")) return "glp1";
  if (slug.includes("peptide")) return "peptides";
  if (slug.includes("wellness")) return "wellness";
  if (slug.includes("trt") || slug.includes("hormone")) return "trt";
  return inferFromGeneralConsult(args.answers);
}

function serviceLineMatchesToggle(serviceLine: ProtocolServiceLine, serviceKey: string) {
  const normalized = serviceKey.toLowerCase();
  if (serviceLine === "glp1") return includesAny(normalized, ["glp1", "weight", "metabolic"]);
  if (serviceLine === "trt") return includesAny(normalized, ["trt", "testosterone", "hormone"]);
  if (serviceLine === "wellness") return includesAny(normalized, ["wellness"]);
  if (serviceLine === "peptides") return includesAny(normalized, ["peptide"]);
  if (serviceLine === "wound_care") return includesAny(normalized, ["wound"]);
  return includesAny(normalized, ["consult", "general"]);
}

export function isClinicServiceLineEnabled(
  serviceLine: ProtocolServiceLine,
  clinicServiceToggles: Array<{ service_key: string; is_enabled: boolean }>
) {
  const matching = clinicServiceToggles.filter((toggle) => serviceLineMatchesToggle(serviceLine, toggle.service_key));
  if (matching.length === 0) return true;
  return matching.some((toggle) => toggle.is_enabled);
}

function deriveContraindications(serviceLine: ProtocolServiceLine, answers: ResponseMap) {
  const contraindications: string[] = [];

  if (serviceLine === "glp1") {
    if (asBoolean(answers.pancreatitis_history)) contraindications.push("History of pancreatitis");
    if (asBoolean(answers.thyroid_history)) contraindications.push("Thyroid history requires physician review");
    if (asBoolean(answers.gallbladder_history)) contraindications.push("Gallbladder history requires review");
  }

  if (serviceLine === "trt") {
    const history = firstText(answers, ["medical_history", "current_medications", "symptom_focus"]);
    if (includesAny(history, ["fertility", "trying to conceive"])) contraindications.push("Fertility goals require physician counseling");
    if (includesAny(history, ["sleep apnea", "polycythemia"])) contraindications.push("Condition requiring TRT-specific review");
  }

  if (serviceLine === "wound_care" && asBoolean(answers.infection_concern)) {
    contraindications.push("Possible infection concern requires urgent wound review");
  }

  const allergyText = firstText(answers, ["medication_allergies", "allergies"]);
  if (allergyText) contraindications.push(`Medication/allergy review: ${allergyText}`);

  return uniq(contraindications);
}

function deriveMissingLabs(
  serviceLine: ProtocolServiceLine,
  template: BuiltInTemplate,
  answers: ResponseMap,
  files: Array<{ category: string; filename: string }>
) {
  if (template.requiredLabs.length === 0) return [];

  const combined = [
    firstText(answers, ["prior_labs_available", "recent_labs_available", "prior_records_available", "lab_source", "lab_source_other"]),
    files.map((file) => `${file.category} ${file.filename}`).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return template.requiredLabs.filter((lab) => {
    if (serviceLine === "wound_care" && lab.toLowerCase().includes("wound photos")) {
      return !files.some((file) => file.category.includes("wound"));
    }

    return !combined.includes(lab.toLowerCase());
  });
}

function deriveRiskFlags(input: ProtocolAssessmentInput, serviceLine: ProtocolServiceLine) {
  const riskFlags = normalizeRiskFlags(input.profile?.risk_flags_json);
  const answers = input.answers;

  if (serviceLine === "glp1" && asBoolean(answers.diabetes_status)) {
    riskFlags.push("Metabolic history requires physician review");
  }
  if (serviceLine === "trt" && includesAny(firstText(answers, ["symptom_focus", "relevant_symptoms"]), ["libido", "fatigue", "muscle"])) {
    riskFlags.push("Hormone symptom cluster identified");
  }
  if (serviceLine === "wellness" && includesAny(firstText(answers, ["energy_level", "sleep_quality", "stress_level"]), ["low", "poor", "high"])) {
    riskFlags.push("Lifestyle burden may require broader review");
  }
  if (serviceLine === "peptides" && asBoolean(answers.prior_peptide_use)) {
    riskFlags.push("Prior peptide exposure noted");
  }
  if (serviceLine === "wound_care") {
    if (asBoolean(answers.infection_concern)) riskFlags.push("Possible infection concern");
    if (asBoolean(answers.multiple_wounds)) riskFlags.push("Multiple wounds reported");
  }

  return uniq(riskFlags);
}

function buildRationale(args: {
  serviceLine: ProtocolServiceLine;
  summary: string;
  riskFlags: string[];
  missingLabs: string[];
  serviceEnabled: boolean;
}) {
  const parts = [args.summary];
  if (!args.serviceEnabled) parts.push("This service line is not currently enabled for the clinic override set and needs clinic review before routing.");
  if (args.riskFlags.length > 0) parts.push(`Risk flags: ${args.riskFlags.join(", ")}.`);
  if (args.missingLabs.length > 0) parts.push(`Missing baseline items: ${args.missingLabs.join(", ")}.`);
  parts.push("This is an AI-assisted clinical decision support suggestion. Clinical decision remains with licensed physician.");
  return parts.join(" ");
}

function buildBaseSummary(input: ProtocolAssessmentInput, serviceLine: ProtocolServiceLine) {
  const patientName = [input.patient?.first_name, input.patient?.last_name].filter(Boolean).join(" ") || "Patient";
  const concern =
    firstText(input.answers, ["primary_concern", "goals", "health_goals", "wound_location", "peptide_primary_goal"]) ||
    input.profile?.summary ||
    "intake review";

  if (serviceLine === "wound_care") {
    return `${patientName} submitted wound-care intake with concern focused on ${concern}.`;
  }
  if (serviceLine === "glp1") {
    return `${patientName} appears to be requesting metabolic or weight-management review based on intake goals and history.`;
  }
  if (serviceLine === "trt") {
    return `${patientName} appears to be requesting hormone optimization review with possible TRT candidacy questions.`;
  }
  if (serviceLine === "peptides") {
    return `${patientName} appears to be requesting peptide-support review based on reported goals and symptom context.`;
  }
  if (serviceLine === "wellness") {
    return `${patientName} appears to be requesting wellness optimization review based on fatigue, sleep, stress, or general wellness goals.`;
  }
  return `${patientName} requires physician consultation to determine the most appropriate service line from the submitted intake.`;
}

function mergeTemplateConfig(template: BuiltInTemplate, row: ProtocolTemplateRow | null): BuiltInTemplate {
  if (!row?.config_json) return template;
  const config = row.config_json;
  return {
    label: asText(config.label) || template.label,
    suggestedProgram: asText(config.suggested_program) || template.suggestedProgram,
    suggestedMedications: Array.isArray(config.suggested_medications)
      ? (config.suggested_medications as unknown[]).map((item) => asText(item)).filter(Boolean)
      : template.suggestedMedications,
    suggestedDosage: asText(config.suggested_dosage) || template.suggestedDosage,
    suggestedFrequency: asText(config.suggested_frequency) || template.suggestedFrequency,
    suggestedDuration: asText(config.suggested_duration) || template.suggestedDuration,
    requiredLabs: Array.isArray(config.required_labs)
      ? (config.required_labs as unknown[]).map((item) => asText(item)).filter(Boolean)
      : template.requiredLabs,
    followUps: Array.isArray(config.follow_up_recommendations)
      ? (config.follow_up_recommendations as unknown[]).map((item) => asText(item)).filter(Boolean)
      : template.followUps,
  };
}

export function buildStructuredProtocolSuggestion(
  input: ProtocolAssessmentInput,
  clinicServiceToggles: Array<{ service_key: string; is_enabled: boolean }>,
  protocolTemplate: ProtocolTemplateRow | null
): StructuredProtocolSuggestion {
  const serviceLine = inferProtocolServiceLine({
    pathwaySlug: input.pathway.slug,
    answers: input.answers,
  });
  const template = mergeTemplateConfig(BUILT_IN_TEMPLATES[serviceLine], protocolTemplate);
  const serviceEnabled = isClinicServiceLineEnabled(serviceLine, clinicServiceToggles);
  const riskFlags = deriveRiskFlags(input, serviceLine);
  const contraindications = deriveContraindications(serviceLine, input.answers);
  const missingRequiredLabs = deriveMissingLabs(
    serviceLine,
    template,
    input.answers,
    input.files.map((file) => ({ category: file.category, filename: file.filename }))
  );

  let recommendationType: ProtocolRecommendationType = "candidate_review";
  if (!serviceEnabled) recommendationType = "follow_up_needed";
  else if (missingRequiredLabs.length > 0) recommendationType = "missing_information";

  return {
    recommendation_type: recommendationType,
    service_line: serviceLine,
    suggested_program: serviceEnabled ? template.suggestedProgram : "Clinic service activation review required",
    suggested_medications: serviceEnabled ? template.suggestedMedications : [],
    suggested_dosage: serviceEnabled ? template.suggestedDosage : null,
    suggested_frequency: serviceEnabled ? template.suggestedFrequency : null,
    suggested_duration: serviceEnabled ? template.suggestedDuration : null,
    rationale_summary: buildRationale({
      serviceLine,
      summary: buildBaseSummary(input, serviceLine),
      riskFlags,
      missingLabs: missingRequiredLabs,
      serviceEnabled,
    }),
    risk_flags: riskFlags,
    contraindications,
    missing_required_labs: missingRequiredLabs,
    followup_recommendations: serviceEnabled
      ? template.followUps
      : [
          "Confirm the clinic has this service line enabled before routing the case.",
          "Physician review is still required for final clinical decisions.",
        ],
    provider_review_required: true,
    confidence_notes:
      recommendationType === "candidate_review"
        ? "Structured rule-based protocol suggestion generated from intake answers, files, clinic settings, and current service enablement."
        : "Suggestion is provisional and requires missing information review or clinic activation confirmation before physician review.",
    advisory_note:
      "AI-assisted protocol suggestion only. Provider approval required. Clinical decision remains with licensed physician.",
  };
}

async function loadClinicProtocolState(clinicId: string) {
  const [{ data: clinicSettings, error: settingsError }, { data: serviceRows, error: serviceError }] = await Promise.all([
    supabase.from("clinic_settings").select("ai_protocol_enabled").eq("clinic_id", clinicId).maybeSingle(),
    supabase.from("clinic_services").select("service_key,is_enabled").eq("clinic_id", clinicId),
  ]);

  if (settingsError) throw settingsError;
  if (serviceError) throw serviceError;

  return {
    enabled: Boolean((clinicSettings as { ai_protocol_enabled?: boolean } | null)?.ai_protocol_enabled),
    serviceToggles: (serviceRows as Array<{ service_key: string; is_enabled: boolean }> | null) ?? [],
  };
}

async function loadProtocolTemplate(clinicId: string, serviceLine: ProtocolServiceLine) {
  const { data, error } = await supabase
    .from("protocol_templates")
    .select("*")
    .eq("service_line", serviceLine)
    .eq("is_active", true)
    .or(`clinic_id.eq.${clinicId},clinic_id.is.null`)
    .order("clinic_id", { ascending: false })
    .order("template_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as ProtocolTemplateRow | null) ?? null;
}

export async function loadProtocolAssessmentForSession(sessionId: string) {
  const { data, error } = await supabase
    .from("ai_protocol_assessments")
    .select("*")
    .eq("vital_ai_session_id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return (data as AiProtocolAssessmentRow | null) ?? null;
}

function buildProtocolAssessmentInsertPayload(args: {
  input: ProtocolAssessmentInput;
  suggestion: StructuredProtocolSuggestion;
  template: ProtocolTemplateRow | null;
}) {
  const createdAt = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    vital_ai_session_id: args.input.session.id,
    vital_ai_profile_id: args.input.profile?.id ?? null,
    patient_id: args.input.patient?.id ?? args.input.session.patient_id,
    intake_submission_id: null,
    clinic_id: args.input.session.clinic_id,
    location_id: args.input.session.location_id,
    service_line: args.suggestion.service_line,
    recommendation_type: args.suggestion.recommendation_type,
    raw_output_json: {
      pathway_slug: args.input.pathway.slug,
      pathway_name: args.input.pathway.name,
      template_name: args.template?.name ?? BUILT_IN_TEMPLATES[args.suggestion.service_line].label,
      template_version: args.template?.template_version ?? 1,
      answers: args.input.answers,
      file_categories: args.input.files.map((file) => file.category),
      advisory_note: args.suggestion.advisory_note,
    },
    structured_output_json: args.suggestion,
    model_key: MODEL_KEY,
    model_version: MODEL_VERSION,
    status: "generated",
    provider_review_required: true,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

async function createProtocolAssessment(args: {
  input: ProtocolAssessmentInput;
  suggestion: StructuredProtocolSuggestion;
  template: ProtocolTemplateRow | null;
}) {
  const insertPayload = buildProtocolAssessmentInsertPayload(args);

  const { error } = await supabase
    .from("ai_protocol_assessments")
    .insert(insertPayload);

  if (!error) return insertPayload as AiProtocolAssessmentRow;
  if (error.code === "23505") return null;
  throw error;
}

export async function ensureProtocolAssessmentForSession(
  input: ProtocolAssessmentInput,
  options?: { skipReadExisting?: boolean }
) {
  const clinicId = input.session.clinic_id;
  if (!clinicId) {
    return { enabled: false, assessment: null as AiProtocolAssessmentRow | null };
  }

  const existing = options?.skipReadExisting ? null : await loadProtocolAssessmentForSession(input.session.id);
  if (existing) {
    return { enabled: true, assessment: existing };
  }

  const protocolState = await loadClinicProtocolState(clinicId);
  if (!protocolState.enabled) {
    return { enabled: false, assessment: null as AiProtocolAssessmentRow | null };
  }

  const serviceLine = inferProtocolServiceLine({
    pathwaySlug: input.pathway.slug,
    answers: input.answers,
  });
  const template = await loadProtocolTemplate(clinicId, serviceLine);
  const suggestion = buildStructuredProtocolSuggestion(input, protocolState.serviceToggles, template);
  const createdAssessment = await createProtocolAssessment({
    input,
    suggestion,
    template,
  });
  const assessment = createdAssessment ?? null;

  return {
    enabled: true,
    assessment,
  };
}
