import { generateClinicalInsights } from "./clinicalInsights";
import { generateFollowUps } from "./followupEngine";
import { generateProviderVisitSummary } from "./providerVisitSummary";
import { generatePatientSafeGuidance, generateProviderRecommendations } from "./recommendationEngine";
import { generateSummary } from "./summaryEngine";
import { detectTreatmentOpportunities } from "./treatmentEngine";
import { detectTreatmentOpportunitySignals } from "./treatmentOpportunityEngine";
import { generateVisitPreparation } from "./visitPrepEngine";
import { buildWoundProgressSnapshot } from "./woundMetrics";
import type { VitalAiFileRow, VitalAiResponseRow, VitalAiSessionRow } from "../vitalAi/types";

export const supportedVitalAiPathways = ["general-consult", "wound-care", "glp1", "wellness", "peptides"] as const;

export function generateInsights(session: VitalAiSessionRow, responses: VitalAiResponseRow[], files: VitalAiFileRow[]) {
  const summary = generateSummary(session, responses, files);
  const clinicalInsights = generateClinicalInsights(session, responses, files);
  const followUpPlan = generateFollowUps(session, responses);
  const treatment = detectTreatmentOpportunities(session, responses, files);
  const treatmentOpportunitySignals = detectTreatmentOpportunitySignals(session, responses, files);
  const visitPreparation = generateVisitPreparation(session, responses, files);
  const patientGuidance = generatePatientSafeGuidance(session, responses);
  const providerVisitSummary = generateProviderVisitSummary(
    session,
    responses,
    files,
    {
      summary,
      clinicalInsights,
      visitPreparation,
    },
    treatmentOpportunitySignals
  );
  const providerRecommendations = generateProviderRecommendations({
    session,
    responses,
    patientConcern: summary.concern,
    riskIndicators: clinicalInsights.indicators,
    suggestedPriority: clinicalInsights.suggestedPriority,
    treatmentConsiderations: treatment.opportunities,
  });

  return {
    summary,
    clinicalInsights,
    followUpPlan,
    patientGuidance,
    providerRecommendations,
    providerVisitSummary,
    treatmentOpportunitySignals,
    treatmentOpportunities: treatment.opportunities,
    visitPreparation,
  };
}

export function generateVisitPrep(session: VitalAiSessionRow, responses: VitalAiResponseRow[], files: VitalAiFileRow[]) {
  return generateVisitPreparation(session, responses, files);
}

export function generateFollowUpPlan(session: VitalAiSessionRow, responses: VitalAiResponseRow[]) {
  return generateFollowUps(session, responses);
}

export function generatePatientGuidance(session: VitalAiSessionRow, responses: VitalAiResponseRow[]) {
  return generatePatientSafeGuidance(session, responses);
}

export function generateTreatmentOpportunities(session: VitalAiSessionRow, responses: VitalAiResponseRow[], files: VitalAiFileRow[]) {
  return detectTreatmentOpportunitySignals(session, responses, files);
}

export async function generateWoundMetrics(session: VitalAiSessionRow, responses: VitalAiResponseRow[], files: VitalAiFileRow[]) {
  return buildWoundProgressSnapshot(session, responses, files);
}

const VitalAI = {
  generateInsights,
  generateFollowUpPlan,
  generatePatientGuidance,
  generateTreatmentOpportunities,
  generateVisitPrep,
  generateWoundMetrics,
  supportedPathways: supportedVitalAiPathways,
};

export default VitalAI;
