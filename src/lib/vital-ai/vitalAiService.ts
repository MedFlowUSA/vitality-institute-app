import { generateClinicalInsights } from "./clinicalInsights";
import { generateFollowUps } from "./followupEngine";
import { generateSummary } from "./summaryEngine";
import { detectTreatmentOpportunities } from "./treatmentEngine";
import { generateVisitPreparation } from "./visitPrepEngine";
import type { VitalAiFileRow, VitalAiResponseRow, VitalAiSessionRow } from "../vitalAi/types";

export function generateInsights(session: VitalAiSessionRow, responses: VitalAiResponseRow[], files: VitalAiFileRow[]) {
  const summary = generateSummary(session, responses, files);
  const clinicalInsights = generateClinicalInsights(session, responses, files);
  const followUpPlan = generateFollowUps(session, responses);
  const treatment = detectTreatmentOpportunities(session, responses, files);
  const visitPreparation = generateVisitPreparation(session, responses, files);

  return {
    summary,
    clinicalInsights,
    followUpPlan,
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

const VitalAI = {
  generateInsights,
  generateFollowUpPlan,
  generateVisitPrep,
};

export default VitalAI;
