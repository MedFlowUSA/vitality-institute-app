import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import RouteHeader from "../components/RouteHeader";
import VitalAiAvatarAssistant from "../components/vital-ai/VitalAiAvatarAssistant";
import VitalAI from "../lib/vital-ai/vitalAiService";
import {
  loadVitalAiFiles,
  loadVitalAiResponses,
  loadVitalAiSession,
  responsesToMap,
} from "../lib/vitalAi/submission";
import { loadVitalAiPathwayById } from "../lib/vitalAi/pathways";
import type { ResponseMap, VitalAiPathwayRow, VitalAiSessionRow } from "../lib/vitalAi/types";

type EvaluationKind = "glp1" | "peptides" | "hormone" | "wound" | "general";

type EvaluationContent = {
  eyebrow: string;
  recommendation: string;
  support: string;
  consultationRequired: boolean;
  bookLabel: string;
  continueLabel: string;
  bookingNote: string;
  summaryTitle: string;
  nextSteps: string[];
  consultationNote?: string;
};

function includesToken(value: string | null | undefined, token: string) {
  return (value ?? "").toLowerCase().includes(token.toLowerCase());
}

function formatLabel(value: string) {
  return value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toStringValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => toStringValue(item)).filter(Boolean).join(", ");
  if (typeof value === "object") return "";
  return String(value).trim();
}

function toBooleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = toStringValue(value).toLowerCase();
  return ["yes", "true", "1", "high", "present"].includes(normalized);
}

function toNumberValue(value: unknown): number | null {
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

function readAnswer(answers: ResponseMap, keys: string[]) {
  for (const key of keys) {
    const value = answers[key];
    if (value != null && value !== "") return value;
  }
  return null;
}

function buildWoundEvaluation(answers: ResponseMap): EvaluationContent {
  const infectionConcern = toBooleanValue(readAnswer(answers, ["infection_concern", "signs_of_infection"]));
  const drainageConcern = hasAnyToken(readAnswer(answers, ["drainage_amount", "drainage", "exudate"]), [
    "moderate",
    "heavy",
    "large",
    "significant",
    "yes",
    "present",
  ]);
  const painScore = toNumberValue(readAnswer(answers, ["pain_level", "pain_score", "wound_pain_score"])) ?? 0;
  const durationText = toStringValue(readAnswer(answers, ["wound_duration", "duration", "wound_duration_weeks"]));
  const longerDuration = hasAnyToken(durationText, ["week", "month"]) || (toNumberValue(durationText) ?? 0) >= 14;
  const higherPriority = infectionConcern || drainageConcern || painScore >= 7 || longerDuration;

  if (higherPriority) {
    return {
      eyebrow: "Evaluation Results",
      recommendation: "Your wound may need prompt clinical review.",
      support:
        "Your responses suggest details that may benefit from earlier wound-care follow-up, especially if symptoms change, drainage increases, or discomfort worsens.",
      consultationRequired: true,
      bookLabel: "Start Wound Review",
      continueLabel: "Continue",
      bookingNote: "Vital AI follow-up: higher-priority wound-care evaluation request.",
      summaryTitle: "Prompt wound review may be the right next step",
      nextSteps: [
        "Our team will review your wound details, symptom signals, and any uploaded images as soon as possible.",
        "Earlier outreach may be needed if your responses suggest a more urgent review path.",
        "A licensed provider will determine the safest next step after clinical review.",
      ],
    };
  }

  return {
    eyebrow: "Evaluation Results",
    recommendation: "Your wound may benefit from clinical review.",
    support:
      "Your intake gives the wound-care team a clearer starting point so they can review your symptoms, any images, and the best next step for follow-up.",
    consultationRequired: true,
    bookLabel: "Start Wound Review",
    continueLabel: "Continue",
    bookingNote: "Vital AI follow-up: wound-care evaluation request.",
    summaryTitle: "Wound-care review may be appropriate",
    nextSteps: [
      "Our team will review your wound details and any images you shared.",
      "A coordinator may follow up if more information is needed before scheduling.",
      "A licensed provider will determine the next step for wound evaluation and treatment planning.",
    ],
  };
}

function buildGlp1Evaluation(kind: "glp1" | "peptides", answers: ResponseMap): EvaluationContent {
  if (kind === "peptides") {
    const peptideGoal = toStringValue(readAnswer(answers, ["peptide_primary_goal", "health_goals", "goals"]));
    const priorPeptideUse = toBooleanValue(readAnswer(answers, ["prior_peptide_use"]));

    return {
      eyebrow: "Evaluation Results",
      recommendation: peptideGoal
        ? `Your responses suggest you may benefit from a peptide-support review focused on ${peptideGoal.toLowerCase()}.`
        : "Based on your responses, you may be a candidate for peptide-support evaluation.",
      support: priorPeptideUse
        ? "Your prior peptide use gives the provider more context for reviewing what may be appropriate next."
        : "This guidance is not a diagnosis. A provider will still review your goals, history, and any follow-up information before confirming the best plan.",
      consultationRequired: false,
      bookLabel: "Book Consultation",
      continueLabel: "Continue Without Consultation",
      bookingNote: "Vital AI follow-up: peptide consultation request.",
      summaryTitle: "Peptide-support review may be appropriate",
      nextSteps: [
        "Your intake will be reviewed alongside your goals, history, and symptom patterns.",
        "We may follow up if additional details are needed before scheduling.",
        "A provider will confirm whether this path is appropriate for you.",
      ],
    };
  }

  const priorUse = toBooleanValue(readAnswer(answers, ["prior_glp1_use"]));
  const diabetesStatus = toStringValue(readAnswer(answers, ["diabetes_status"]));
  const hasMetabolicConcern = hasAnyToken(diabetesStatus, ["prediabetes", "pre-diabetes", "diabetes", "insulin"]);
  const currentWeight = toNumberValue(readAnswer(answers, ["current_weight"]));
  const goalWeight = toNumberValue(readAnswer(answers, ["goal_weight"]));
  const hasWeightGoal = currentWeight != null && goalWeight != null && goalWeight < currentWeight;

  let recommendation = "Based on your responses, you may be a candidate for GLP-1 therapy.";
  let support =
    "This guidance helps us route your next step. Final treatment recommendations depend on clinical review, medical history, and any follow-up questions.";
  let summaryTitle = "Metabolic support may be a fit";
  let nextSteps = [
    "Our team will review your intake details and any follow-up needs.",
    "A coordinator may help confirm the best next step for care and scheduling.",
    "A licensed provider makes final treatment decisions after clinical review.",
  ];

  if (hasMetabolicConcern) {
    recommendation = "Your responses suggest a metabolic review may be appropriate, and you may be a candidate for GLP-1 therapy.";
    support =
      "Because you noted a diabetes or prediabetes concern, your profile may benefit from a provider review focused on metabolic history, treatment fit, and safety.";
    summaryTitle = "Metabolic review may be appropriate";
    nextSteps = [
      "Our team will review your metabolic history and intake details.",
      "A coordinator may follow up to confirm the right next scheduling step.",
      "A licensed provider will discuss treatment eligibility and the safest path forward.",
    ];
  } else if (priorUse && hasWeightGoal) {
    recommendation = "Based on your responses, you may be a candidate for GLP-1 therapy with a review of your prior treatment experience.";
    support =
      "Your prior GLP-1 use and current goals give the provider more context for discussing whether another treatment approach or follow-up plan may be appropriate.";
    summaryTitle = "A GLP-1 follow-up review may be appropriate";
    nextSteps = [
      "Our team will review your previous GLP-1 experience and current goals.",
      "We may follow up if additional medical history is needed before scheduling.",
      "A licensed provider will discuss treatment fit, safety, and next-step options.",
    ];
  }

  return {
    eyebrow: "Evaluation Results",
    recommendation,
    support,
    consultationRequired: false,
    bookLabel: "Book Consultation",
    continueLabel: "Continue Without Consultation",
    bookingNote: "Vital AI follow-up: GLP-1 consultation request.",
    summaryTitle,
    nextSteps,
  };
}

function buildHormoneEvaluation(answers: ResponseMap): EvaluationContent {
  const gender = toStringValue(readAnswer(answers, ["patient_gender", "gender"])).toLowerCase();
  const symptomFocus = toStringValue(
    readAnswer(answers, ["symptom_focus", "symptom_focus_other", "symptom_concerns", "relevant_symptoms", "health_goals"])
  ).toLowerCase();
  const malePattern = gender === "male" || hasAnyToken(symptomFocus, ["testosterone", "libido", "erectile", "muscle"]);
  const femalePattern =
    gender === "female" || hasAnyToken(symptomFocus, ["menopause", "cycle", "perimenopause", "hrt", "hot flash", "women"]);
  const fatiguePattern = hasAnyToken(symptomFocus, ["energy", "fatigue", "sleep", "stress"]);

  let recommendation = "Based on your responses, a hormone-focused consultation may be appropriate.";
  let support =
    "Hormone-related concerns usually require a provider visit so we can review symptoms, history, and any appropriate next-step testing before treatment decisions are made.";
  let summaryTitle = "A hormone-focused consultation is likely the right next step";
  let nextSteps = [
    "Your responses will be reviewed for symptom patterns and care goals.",
    "A provider visit helps determine whether hormone-focused treatment discussion is appropriate.",
    "Additional labs or clinical review may be recommended before any treatment plan is finalized.",
  ];

  if (malePattern) {
    recommendation = "Your responses suggest a testosterone-focused hormone evaluation may be appropriate.";
    support =
      "The provider can review symptom patterns, history, and whether hormone or lab follow-up may be appropriate before any treatment decisions are made.";
    summaryTitle = "A testosterone-focused review may be appropriate";
  } else if (femalePattern) {
    recommendation = "Your responses suggest a women’s hormone evaluation may be appropriate.";
    support =
      "A provider can review your symptom pattern, hormone history, and whether consultation or lab review may help clarify the right next step.";
    summaryTitle = "A women’s hormone review may be appropriate";
  } else if (fatiguePattern) {
    recommendation = "Your responses suggest a hormone evaluation may be appropriate as part of a broader symptom review.";
    support =
      "A consultation helps the provider review energy, sleep, stress, and other symptom patterns before deciding whether hormone-focused follow-up makes sense.";
    nextSteps = [
      "Your symptom patterns and goals will be reviewed by the care team.",
      "A provider consultation helps determine whether hormone-focused follow-up is appropriate.",
      "Lab review or other next steps may be recommended before treatment decisions are made.",
    ];
  }

  return {
    eyebrow: "Evaluation Results",
    recommendation,
    support,
    consultationRequired: true,
    bookLabel: "Book Consultation",
    continueLabel: "Continue",
    bookingNote: "Vital AI follow-up: hormone-focused consultation request.",
    summaryTitle,
    nextSteps,
    consultationNote: "Consultation is required before hormone-focused treatment planning.",
  };
}

function resolveEvaluationKind(args: {
  pathwaySlug?: string | null;
  opportunityTypes: string[];
}): EvaluationKind {
  const pathwaySlug = args.pathwaySlug ?? "";

  if (includesToken(pathwaySlug, "glp1")) return "glp1";
  if (includesToken(pathwaySlug, "peptide")) return "peptides";
  if (includesToken(pathwaySlug, "wound")) return "wound";
  if (args.opportunityTypes.includes("hormone_review_candidate")) return "hormone";
  return "general";
}

function getEvaluationContent(kind: EvaluationKind, answers: ResponseMap): EvaluationContent {
  if (kind === "glp1" || kind === "peptides") return buildGlp1Evaluation(kind, answers);
  if (kind === "hormone") return buildHormoneEvaluation(answers);
  if (kind === "wound") return buildWoundEvaluation(answers);

  return {
    eyebrow: "Evaluation Results",
    recommendation: "Based on your responses, a provider-guided consultation may be appropriate.",
    support:
      "Your intake gives the team a starting point for safe routing. Final recommendations depend on clinical review and any follow-up details needed for your visit.",
    consultationRequired: true,
    bookLabel: "Book Consultation",
    continueLabel: "Continue",
    bookingNote: "Vital AI follow-up: consultation request.",
    summaryTitle: "A provider-guided next step may be appropriate",
    nextSteps: [
      "Our team reviews your intake to route you appropriately.",
      "A coordinator may contact you if more information is needed.",
      "Final treatment recommendations are made by a licensed provider.",
    ],
  };
}

export default function VitalAiSessionComplete() {
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<VitalAiSessionRow | null>(null);
  const [pathway, setPathway] = useState<VitalAiPathwayRow | null>(null);
  const [guidance, setGuidance] = useState<ReturnType<typeof VitalAI.generatePatientGuidance> | null>(null);
  const [insights, setInsights] = useState<ReturnType<typeof VitalAI.generateInsights> | null>(null);
  const [answers, setAnswers] = useState<ResponseMap>({});

  useEffect(() => {
    const load = async () => {
      if (!sessionId) return;
      try {
        const nextSession = await loadVitalAiSession(sessionId);
        if (!nextSession) return;
        const [nextPathway, nextResponses, nextFiles] = await Promise.all([
          loadVitalAiPathwayById(nextSession.pathway_id),
          loadVitalAiResponses(sessionId),
          loadVitalAiFiles(sessionId),
        ]);
        const sessionWithPathway = {
          ...nextSession,
          current_step_key: nextPathway?.slug ?? nextSession.current_step_key,
        };

        setSession(nextSession);
        setPathway(nextPathway);
        setAnswers(responsesToMap(nextResponses));
        setGuidance(VitalAI.generatePatientGuidance(sessionWithPathway, nextResponses));
        setInsights(VitalAI.generateInsights(sessionWithPathway, nextResponses, nextFiles));
      } catch {
        // keep completion screen resilient even if enrichment data fails to load
      }
    };

    load();
  }, [sessionId]);

  const opportunityTypes = useMemo(() => {
    return insights?.treatmentOpportunitySignals.opportunities.map((item) => item.type) ?? [];
  }, [insights]);

  const evaluationKind = useMemo(() => {
    return resolveEvaluationKind({
      pathwaySlug: pathway?.slug ?? session?.current_step_key,
      opportunityTypes,
    });
  }, [opportunityTypes, pathway?.slug, session?.current_step_key]);

  const evaluation = useMemo(() => getEvaluationContent(evaluationKind, answers), [answers, evaluationKind]);

  const handleBookConsultation = () => {
    const params = new URLSearchParams();
    params.set("notes", evaluation.bookingNote);
    navigate(`/patient/book?${params.toString()}`);
  };

  const handleContinueWithoutConsult = () => {
    navigate("/patient/services");
  };

  const handleRequestVisit = () => {
    navigate("/patient/book");
  };

  const handleCallClinic = () => {
    window.location.href = "tel:+19095004572";
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <RouteHeader
          title="Your Care Summary"
          subtitle="Your intake was submitted successfully."
          backTo="/intake"
          homeTo="/patient"
        />

        <div className="space" />

        <VitalityHero
          title="Your Care Summary"
          subtitle="Here is a clear summary of your intake and the next step that may fit best."
          secondaryCta={{ label: "Back to Patient Home", to: "/patient" }}
          showKpis={false}
        />

        <div className="space" />

        <VitalAiAvatarAssistant stepKey="complete" isComplete pathwaySlug={pathway?.slug} answers={undefined} />

        <div className="space" />

        <div
          className="card card-pad"
          style={{ background: "rgba(8,15,28,0.98)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 14px 34px rgba(0,0,0,0.22)" }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "rgba(226,232,240,0.74)" }}>
            {evaluation.eyebrow}
          </div>
          <div className="h2" style={{ color: "#F8FAFC", marginTop: 8 }}>
            {evaluation.summaryTitle}
          </div>
          <div className="muted" style={{ marginTop: 10, lineHeight: 1.7, color: "rgba(226,232,240,0.84)" }}>
            {evaluation.recommendation}
          </div>
          <div className="muted" style={{ marginTop: 10, lineHeight: 1.7, color: "rgba(226,232,240,0.78)" }}>
            {evaluation.support}
          </div>
          {session?.completed_at ? (
            <div className="muted" style={{ marginTop: 12, color: "rgba(226,232,240,0.7)" }}>
              Submitted {new Date(session.completed_at).toLocaleString()}
            </div>
          ) : null}
        </div>

        <div className="space" />

        <div className="card card-pad card-light">
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#5B4E86" }}>
            What Happens Next
          </div>
          <ul style={{ marginTop: 12, paddingLeft: 18, color: "#3E355C", lineHeight: 1.8 }}>
            {evaluation.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>

          <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            {evaluationKind === "wound" ? (
              <>
                <button className="btn btn-primary" type="button" onClick={handleBookConsultation}>
                  {evaluation.bookLabel}
                </button>
                <button className="btn btn-secondary" type="button" onClick={handleCallClinic}>
                  Call the Clinic
                </button>
              </>
            ) : evaluationKind === "general" ? (
              <>
                <button className="btn btn-primary" type="button" onClick={handleRequestVisit}>
                  Request Visit
                </button>
                <button className="btn btn-secondary" type="button" onClick={handleCallClinic}>
                  Contact the Clinic
                </button>
              </>
            ) : !evaluation.consultationRequired ? (
              <>
                <button className="btn btn-secondary" type="button" onClick={handleContinueWithoutConsult}>
                  {evaluation.continueLabel}
                </button>
                <button className="btn btn-primary" type="button" onClick={handleBookConsultation}>
                  {evaluation.bookLabel}
                </button>
              </>
            ) : (
              <button className="btn btn-primary" type="button" onClick={handleBookConsultation}>
                {evaluation.bookLabel}
              </button>
            )}
          </div>

          {evaluation.consultationNote ? (
            <div className="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, color: "#5B4E86" }}>
              {evaluation.consultationNote}
            </div>
          ) : null}

          <div className="muted" style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6, color: "#5B4E86" }}>
            This is not a diagnosis. Final treatment decisions are made by a licensed provider.
          </div>
        </div>

        {(insights || guidance || pathway || session) ? (
          <>
            <div className="space" />
            <details className="card card-pad card-light">
              <summary
                style={{
                  cursor: "pointer",
                  listStyle: "none",
                  fontWeight: 800,
                  color: "#241B3D",
                }}
              >
                View your submission details
              </summary>
              <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
                {insights ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Pathway</div>
                      <div style={{ fontWeight: 700, color: "#241B3D" }}>{pathway?.name ?? formatLabel(evaluationKind)}</div>
                    </div>
                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Primary focus</div>
                      <div style={{ fontWeight: 700, color: "#241B3D" }}>{insights.summary.concern}</div>
                    </div>
                    {insights.summary.duration ? (
                      <div>
                        <div className="muted" style={{ fontSize: 12 }}>Key detail</div>
                        <div style={{ color: "#3E355C" }}>{insights.summary.duration}</div>
                      </div>
                    ) : null}
                    {insights.summary.indicators.length ? (
                      <div>
                        <div className="muted" style={{ fontSize: 12 }}>Noted factors</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                          {insights.summary.indicators.map((item) => (
                            <span
                              key={item}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "rgba(122,92,255,0.08)",
                                border: "1px solid rgba(122,92,255,0.14)",
                                color: "#4B3C78",
                                fontSize: 13,
                                fontWeight: 700,
                              }}
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {insights.summary.fileCount > 0 ? (
                      <div>
                        <div className="muted" style={{ fontSize: 12 }}>Files shared</div>
                        <div style={{ color: "#3E355C" }}>
                          {insights.summary.fileCount} upload{insights.summary.fileCount === 1 ? "" : "s"} attached to your intake
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {guidance ? (
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Guidance summary</div>
                    <div style={{ marginTop: 6, fontWeight: 700, color: "#241B3D" }}>{guidance.title}</div>
                    <div style={{ marginTop: 8, lineHeight: 1.7, color: "#3E355C" }}>{guidance.body}</div>
                  </div>
                ) : null}

                {session?.completed_at ? (
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Submitted</div>
                    <div style={{ color: "#3E355C" }}>{new Date(session.completed_at).toLocaleString()}</div>
                  </div>
                ) : null}
              </div>
            </details>
          </>
        ) : null}
      </div>
    </div>
  );
}
