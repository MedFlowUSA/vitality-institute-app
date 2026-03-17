export type PublicVitalAiPathway = "wound_care" | "glp1_weight_loss" | "general_consult";
export type PublicVitalAiStatus = "new" | "reviewed" | "contacted" | "scheduled" | "closed";

export type PublicVitalAiAnswers = {
  wound_location?: string;
  wound_duration?: string;
  pain_level?: string;
  infection_or_drainage_concern?: string;
  callback_needed?: string;
  current_weight?: string;
  goal_weight?: string;
  prior_glp1_use?: string;
  diabetes_or_prediabetes?: string;
  medication_review_flag?: string;
  main_concern?: string;
  concern_duration?: string;
  help_goal?: string;
};

type QuestionDef = {
  key: keyof PublicVitalAiAnswers;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  helper?: string;
};

type PathwayDef = {
  key: PublicVitalAiPathway;
  title: string;
  subtitle: string;
  purpose: string;
  questions: QuestionDef[];
  successNote: string;
};

export const PUBLIC_VITAL_AI_PATHWAYS: PathwayDef[] = [
  {
    key: "wound_care",
    title: "Wound care guidance",
    subtitle: "Share the basics so the clinic can review your concern and help route the right next step.",
    purpose: "This is a lightweight intake guidance form. It does not provide diagnosis or treatment decisions.",
    questions: [
      { key: "wound_location", label: "Wound location", type: "text", required: true, placeholder: "For example: left foot, lower leg, heel" },
      {
        key: "wound_duration",
        label: "How long has it been present?",
        type: "select",
        required: true,
        options: [
          { value: "less_than_2_weeks", label: "Less than 2 weeks" },
          { value: "2_to_4_weeks", label: "2 to 4 weeks" },
          { value: "more_than_4_weeks", label: "More than 4 weeks" },
          { value: "unsure", label: "Not sure" },
        ],
      },
      { key: "pain_level", label: "Pain level (0 to 10)", type: "number", required: true, placeholder: "0 to 10" },
      {
        key: "infection_or_drainage_concern",
        label: "Any drainage or infection concern?",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          { value: "unsure", label: "Not sure" },
        ],
      },
      {
        key: "callback_needed",
        label: "Would you like a callback from the clinic?",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
        helper: "Photo upload can be added in a later step if the clinic needs it.",
      },
    ],
    successNote: "Your wound-care intake guidance was sent to the clinic for review.",
  },
  {
    key: "glp1_weight_loss",
    title: "GLP-1 and weight-loss guidance",
    subtitle: "Answer a few screening questions so the clinic can prepare the best next conversation.",
    purpose: "This is a screening and routing step only. Final eligibility is determined by medical evaluation.",
    questions: [
      { key: "current_weight", label: "Current weight", type: "number", required: true, placeholder: "Current weight" },
      { key: "goal_weight", label: "Goal weight", type: "number", required: true, placeholder: "Goal weight" },
      {
        key: "prior_glp1_use",
        label: "Have you used a GLP-1 before?",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        key: "diabetes_or_prediabetes",
        label: "Have you been told you have diabetes or prediabetes?",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          { value: "unsure", label: "Not sure" },
        ],
      },
      {
        key: "medication_review_flag",
        label: "Do you have any medication or medical-history concerns you want the clinic to review before discussing GLP-1 options?",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        key: "callback_needed",
        label: "Would you like a callback from the clinic?",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
    successNote: "Your GLP-1 guidance request was sent to the clinic for review.",
  },
  {
    key: "general_consult",
    title: "General consult guidance",
    subtitle: "Tell the clinic what you want help with so they can guide the right next step.",
    purpose: "This short intake helps the clinic prepare for a consultation conversation.",
    questions: [
      { key: "main_concern", label: "Main concern", type: "textarea", required: true, placeholder: "What brings you in?" },
      {
        key: "concern_duration",
        label: "How long has this been going on?",
        type: "select",
        required: true,
        options: [
          { value: "recent", label: "Recently" },
          { value: "few_weeks", label: "A few weeks" },
          { value: "months_or_more", label: "Months or longer" },
          { value: "unsure", label: "Not sure" },
        ],
      },
      {
        key: "help_goal",
        label: "What are you hoping we can help with?",
        type: "textarea",
        required: true,
        placeholder: "Share the kind of support or outcome you are looking for.",
      },
      {
        key: "callback_needed",
        label: "Would you like a callback from the clinic?",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
    successNote: "Your general consult guidance request was sent to the clinic for review.",
  },
];

export function getPublicVitalAiPathway(pathway: PublicVitalAiPathway) {
  return PUBLIC_VITAL_AI_PATHWAYS.find((item) => item.key === pathway) ?? PUBLIC_VITAL_AI_PATHWAYS[0];
}

export function getPathwayQuestions(pathway: PublicVitalAiPathway) {
  return getPublicVitalAiPathway(pathway).questions;
}

export function getPathwayLabel(pathway: PublicVitalAiPathway) {
  return getPublicVitalAiPathway(pathway).title;
}

export function buildPublicVitalAiSummary(pathway: PublicVitalAiPathway, answers: PublicVitalAiAnswers) {
  if (pathway === "wound_care") {
    return `Public wound-care guidance request for ${answers.wound_location || "unspecified location"} with duration ${humanizeAnswer(answers.wound_duration)} and pain level ${answers.pain_level || "not provided"}.`;
  }
  if (pathway === "glp1_weight_loss") {
    return `Public GLP-1 guidance request. Current weight ${answers.current_weight || "not provided"}, goal weight ${answers.goal_weight || "not provided"}, prior GLP-1 use ${humanizeAnswer(answers.prior_glp1_use)}.`;
  }
  return `Public general consult guidance request regarding ${answers.main_concern || "a general concern"} with duration ${humanizeAnswer(answers.concern_duration)}.`;
}

export function humanizeAnswer(value?: string) {
  if (!value) return "not provided";
  return value.replaceAll("_", " ");
}

export function formatAnswerValue(question: QuestionDef, value?: string) {
  if (!value) return "Not provided";
  if (question.options) {
    return question.options.find((option) => option.value === value)?.label ?? value;
  }
  return value;
}
