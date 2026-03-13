import { supabase } from "../supabase";
import { getVisibleQuestions, getVisibleSteps, normalizeAnswerValue } from "./branching";
import type {
  IntakeQuestion,
  PatientRecord,
  PathwayDefinition,
  ResponseMap,
  VitalAiFileRow,
  VitalAiLeadRow,
  VitalAiPathwayRow,
  VitalAiProfileRow,
  VitalAiResponseRow,
  VitalAiSessionRow,
} from "./types";

export async function resolveCurrentPatient(profileId: string) {
  const { data, error } = await supabase
    .from("patients")
    .select("id,profile_id,first_name,last_name,phone,email,dob")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  return (data as PatientRecord | null) ?? null;
}

export async function createVitalAiSession(args: {
  pathway: VitalAiPathwayRow;
  patient: PatientRecord | null;
  profileId: string;
}) {
  const { pathway, patient, profileId } = args;
  const { data, error } = await supabase
    .from("vital_ai_sessions")
    .insert({
      pathway_id: pathway.id,
      patient_id: patient?.id ?? null,
      profile_id: profileId,
      status: "draft",
      current_step_key: pathway.definition_json.steps[0]?.key ?? null,
      source: "patient_portal",
      created_by: profileId,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as VitalAiSessionRow;
}

export async function loadVitalAiSession(sessionId: string) {
  const { data, error } = await supabase.from("vital_ai_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  return (data as VitalAiSessionRow | null) ?? null;
}

export async function loadVitalAiResponses(sessionId: string) {
  const { data, error } = await supabase
    .from("vital_ai_responses")
    .select("*")
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: true });
  if (error) throw error;
  return (data as VitalAiResponseRow[]) ?? [];
}

export async function loadVitalAiFiles(sessionId: string) {
  const { data, error } = await supabase
    .from("vital_ai_files")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as VitalAiFileRow[]) ?? [];
}

export function responsesToMap(rows: VitalAiResponseRow[]) {
  const next: ResponseMap = {};
  for (const row of rows) next[row.question_key] = row.value_json;
  return next;
}

export async function saveVitalAiResponses(sessionId: string, payload: ResponseMap) {
  const rows = Object.entries(payload).map(([question_key, value_json]) => ({
    session_id: sessionId,
    question_key,
    value_json,
  }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("vital_ai_responses")
    .upsert(rows, { onConflict: "session_id,question_key" });
  if (error) throw error;

  const { error: sessionError } = await supabase
    .from("vital_ai_sessions")
    .update({ last_saved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (sessionError) throw sessionError;
}

export async function updateVitalAiSessionStep(sessionId: string, stepKey: string) {
  const { error } = await supabase
    .from("vital_ai_sessions")
    .update({
      current_step_key: stepKey,
      last_saved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}

export async function uploadVitalAiFile(args: {
  sessionId: string;
  patient: PatientRecord | null;
  profileId: string;
  category: string;
  file: File;
  image?: boolean;
}) {
  const bucket = args.image ? "vital-ai-images" : "vital-ai-files";
  const safeName = args.file.name.replace(/[^\w.-]+/g, "_");
  const path = `profile-${args.profileId}/session-${args.sessionId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, args.file, {
    contentType: args.file.type || undefined,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("vital_ai_files")
    .insert({
      session_id: args.sessionId,
      patient_id: args.patient?.id ?? null,
      profile_id: args.profileId,
      bucket,
      path,
      filename: args.file.name,
      content_type: args.file.type || null,
      category: args.category,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as VitalAiFileRow;
}

function answerLabel(value: unknown) {
  if (value == null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function getFileCountForCategory(files: VitalAiFileRow[], category?: string) {
  if (!category) return 0;
  return files.filter((file) => file.category === category).length;
}

export function validateVisibleQuestions(args: {
  definition: PathwayDefinition;
  answers: ResponseMap;
  files: VitalAiFileRow[];
}) {
  const { definition, answers, files } = args;
  const steps = getVisibleSteps(definition, answers);

  for (const step of steps) {
    const questions = getVisibleQuestions(step, answers);
    for (const question of questions) {
      if (!question.required) continue;
      if ((question.type === "file" || question.type === "image") && question.category) {
        const answerValue = answers[question.key];
        const hasAnswerReference =
          !!answerValue &&
          ((typeof answerValue === "object" && !Array.isArray(answerValue)) ||
            (Array.isArray(answerValue) && answerValue.length > 0));

        if (getFileCountForCategory(files, question.category) === 0 && !hasAnswerReference) {
          return `${question.label} is required.`;
        }
        continue;
      }

      const value = normalizeAnswerValue(question, answers[question.key]);
      if (question.type === "boolean") {
        if (value !== true) return `${question.label} is required.`;
        continue;
      }

      if (value == null || value === "") return `${question.label} is required.`;
    }
  }

  return null;
}

function buildRiskFlags(pathway: string, answers: ResponseMap) {
  const flags: string[] = [];
  if (pathway === "wound-care") {
    if (answers.infection_concern === true) flags.push("infection concern");
    if (Number(answers.pain_level ?? 0) >= 8) flags.push("high pain");
    if (answers.multiple_wounds === true) flags.push("multiple wounds");
  }
  if (pathway === "glp1") {
    if (answers.pancreatitis_history === true) flags.push("pancreatitis history");
    if (answers.thyroid_history === true) flags.push("thyroid history");
    if (answers.gallbladder_history === true) flags.push("gallbladder history");
  }
  if (pathway === "wellness") {
    if (answers.energy_level === "low") flags.push("low energy");
    if (answers.sleep_quality === "poor") flags.push("poor sleep");
    if (answers.stress_level === "high") flags.push("high stress");
  }
  if (pathway === "peptides") {
    if (answers.prior_peptide_use === true) flags.push("prior peptide use");
    if (answers.medication_allergies) flags.push("medication allergy review");
  }
  if (answers.visit_type === "follow-up") flags.push("follow-up visit");
  return flags;
}

function buildTriageLevel(pathway: string, answers: ResponseMap) {
  if (pathway === "wound-care" && answers.infection_concern === true) return "high";
  if (pathway === "wound-care" && Number(answers.pain_level ?? 0) >= 8) return "high";
  if (pathway === "glp1" && (answers.pancreatitis_history === true || answers.thyroid_history === true)) return "high";
  if (pathway === "glp1") return "medium";
  if (pathway === "wellness" || pathway === "peptides") return "standard";
  return pathway === "wound-care" ? "medium" : "standard";
}

function buildProfileSummary(pathway: string, patient: PatientRecord | null, answers: ResponseMap) {
  const name = [answers.first_name, answers.last_name].filter(Boolean).join(" ") || [patient?.first_name, patient?.last_name].filter(Boolean).join(" ");
  if (pathway === "wound-care") {
    return `${name || "Patient"} reported a wound at ${answerLabel(answers.wound_location)} present for ${answerLabel(
      answers.wound_duration
    )}. Pain level ${answerLabel(answers.pain_level)}. Infection concern: ${answerLabel(answers.infection_concern)}.`;
  }

  if (pathway === "glp1") {
    return `${name || "Patient"} requested GLP-1 review at ${answerLabel(answers.current_weight)} lb with goal weight ${answerLabel(
      answers.goal_weight
    )}. Diabetes status: ${answerLabel(answers.diabetes_status)}. Prior GLP-1 use: ${answerLabel(answers.prior_glp1_use)}.`;
  }

  if (pathway === "wellness") {
    return `${name || "Patient"} requested wellness review focused on ${answerLabel(answers.health_goals)}. Energy ${answerLabel(
      answers.energy_level
    )}, sleep ${answerLabel(answers.sleep_quality)}, stress ${answerLabel(answers.stress_level)}.`;
  }

  if (pathway === "peptides") {
    return `${name || "Patient"} requested peptide review for ${answerLabel(answers.peptide_primary_goal)}. Prior peptide use: ${answerLabel(
      answers.prior_peptide_use
    )}. Symptoms: ${answerLabel(answers.relevant_symptoms)}.`;
  }

  return `${name || "Patient"} requested a ${answerLabel(answers.visit_type)} for ${answerLabel(
    answers.primary_concern
  )}. Primary goals: ${answerLabel(answers.goals)}.`;
}

function buildProfileJson(args: {
  pathway: VitalAiPathwayRow;
  patient: PatientRecord | null;
  answers: ResponseMap;
  files: VitalAiFileRow[];
}) {
  const { pathway, patient, answers, files } = args;
  return {
    pathway: pathway.slug,
    patient: {
      patient_id: patient?.id ?? null,
      profile_id: patient?.profile_id ?? null,
      first_name: answers.first_name ?? patient?.first_name ?? null,
      last_name: answers.last_name ?? patient?.last_name ?? null,
      dob: answers.dob ?? patient?.dob ?? null,
      phone: answers.phone ?? patient?.phone ?? null,
      email: answers.email ?? patient?.email ?? null,
    },
    answers,
    files: files.map((file) => ({
      id: file.id,
      filename: file.filename,
      category: file.category,
      bucket: file.bucket,
      path: file.path,
      content_type: file.content_type,
      created_at: file.created_at,
    })),
  };
}

function buildLeadJson(args: {
  pathway: VitalAiPathwayRow;
  patient: PatientRecord | null;
  answers: ResponseMap;
  files: VitalAiFileRow[];
}) {
  const { pathway, patient, answers, files } = args;
  return {
    pathway: pathway.slug,
    name: [answers.first_name, answers.last_name].filter(Boolean).join(" ") || [patient?.first_name, patient?.last_name].filter(Boolean).join(" "),
    contact: {
      phone: answers.phone ?? patient?.phone ?? null,
      email: answers.email ?? patient?.email ?? null,
      preferred_contact: answers.preferred_contact ?? null,
    },
    chief_concern: answers.primary_concern ?? answers.wound_location ?? null,
    service_goal: answers.health_goals ?? answers.peptide_primary_goal ?? answers.goal_weight ?? null,
    goals: answers.goals ?? null,
    infection_concern: answers.infection_concern ?? null,
    attachments_present: files.length > 0,
    follow_up_type: answers.visit_type ?? null,
  };
}

function buildLeadPriority(pathway: string, answers: ResponseMap) {
  if (pathway === "wound-care" && answers.infection_concern === true) return "high";
  if (pathway === "wound-care" && Number(answers.pain_level ?? 0) >= 8) return "high";
  if (pathway === "glp1" && (answers.pancreatitis_history === true || answers.thyroid_history === true)) return "high";
  if (pathway === "glp1") return "normal";
  return "normal";
}

export async function submitVitalAiSession(args: {
  session: VitalAiSessionRow;
  pathway: VitalAiPathwayRow;
  patient: PatientRecord | null;
  answers: ResponseMap;
  files: VitalAiFileRow[];
}) {
  const validationError = validateVisibleQuestions({
    definition: args.pathway.definition_json,
    answers: args.answers,
    files: args.files,
  });
  if (validationError) throw new Error(validationError);

  const submittedAt = new Date().toISOString();
  const riskFlags = buildRiskFlags(args.pathway.slug, args.answers);
  const triageLevel = buildTriageLevel(args.pathway.slug, args.answers);
  const summary = buildProfileSummary(args.pathway.slug, args.patient, args.answers);

  const { error: sessionError } = await supabase
    .from("vital_ai_sessions")
    .update({
      status: "submitted",
      completed_at: submittedAt,
      last_saved_at: submittedAt,
      updated_at: submittedAt,
    })
    .eq("id", args.session.id);
  if (sessionError) throw sessionError;

  const { data: profileData, error: profileError } = await supabase
    .from("vital_ai_profiles")
    .upsert(
      {
        session_id: args.session.id,
        pathway_id: args.pathway.id,
        patient_id: args.patient?.id ?? null,
        profile_id: args.session.profile_id,
        summary,
        profile_json: buildProfileJson(args),
        risk_flags_json: riskFlags,
        triage_level: triageLevel,
        status: "new",
        updated_at: submittedAt,
      },
      { onConflict: "session_id" }
    )
    .select("*")
    .single();
  if (profileError) throw profileError;

  const { data: leadData, error: leadError } = await supabase
    .from("vital_ai_leads")
    .upsert(
      {
        session_id: args.session.id,
        pathway_id: args.pathway.id,
        patient_id: args.patient?.id ?? null,
        profile_id: args.session.profile_id,
        lead_status: "new",
        priority: buildLeadPriority(args.pathway.slug, args.answers),
        next_action_at: submittedAt,
        lead_json: buildLeadJson(args),
        updated_at: submittedAt,
      },
      { onConflict: "session_id" }
    )
    .select("*")
    .single();
  if (leadError) throw leadError;

  const tasks = [
    {
      session_id: args.session.id,
      profile_id: (profileData as VitalAiProfileRow).id,
      lead_id: (leadData as VitalAiLeadRow).id,
      task_type: "staff_follow_up",
      assigned_role: "front_desk",
      status: "open",
      updated_at: submittedAt,
    },
    {
      session_id: args.session.id,
      profile_id: (profileData as VitalAiProfileRow).id,
      lead_id: (leadData as VitalAiLeadRow).id,
      task_type: "provider_review",
      assigned_role: "provider",
      status: "open",
      updated_at: submittedAt,
    },
  ];

  const { error: taskError } = await supabase
    .from("vital_ai_review_tasks")
    .upsert(tasks, { onConflict: "session_id,task_type" });
  if (taskError) {
    const fallbackRows = tasks.map((task) => ({
      session_id: task.session_id,
      profile_id: task.profile_id,
      lead_id: task.lead_id,
      task_type: task.task_type,
      assigned_role: task.assigned_role,
      status: task.status,
    }));
    const { error: fallbackError } = await supabase.from("vital_ai_review_tasks").insert(fallbackRows);
    if (fallbackError) throw fallbackError;
  }

  return {
    profile: profileData as VitalAiProfileRow,
    lead: leadData as VitalAiLeadRow,
  };
}

export function buildAnswerList(definition: PathwayDefinition, answers: ResponseMap) {
  return getVisibleSteps(definition, answers).map((step) => ({
    key: step.key,
    title: step.title,
    items: getVisibleQuestions(step, answers).map((question) => ({
      question,
      value: answers[question.key],
    })),
  }));
}

export function getQuestionValueLabel(question: IntakeQuestion, value: unknown) {
  if ((question.type === "file" || question.type === "image") && value == null) return "Uploaded separately";
  return answerLabel(value);
}
