import { getStepIndex, getVisibleQuestions, getVisibleSteps } from "../vitalAi/branching";
import type { IntakeStep, PathwayDefinition, ResponseMap } from "../vitalAi/types";

export function getVisibleIntakeSteps(pathway: PathwayDefinition, answers: ResponseMap): IntakeStep[] {
  return getVisibleSteps(pathway, answers);
}

export function getActiveIntakeStep(pathway: PathwayDefinition, answers: ResponseMap, currentStepKey?: string | null): IntakeStep | null {
  const steps = getVisibleSteps(pathway, answers);
  const index = getStepIndex(steps, currentStepKey);
  return steps[index] ?? null;
}

export function getNextStep(pathway: PathwayDefinition, answers: ResponseMap, currentStepKey?: string | null): IntakeStep | null {
  const steps = getVisibleSteps(pathway, answers);
  const index = getStepIndex(steps, currentStepKey);
  return steps[index + 1] ?? null;
}

export function getRenderedQuestions(step: IntakeStep, answers: ResponseMap) {
  return getVisibleQuestions(step, answers);
}
