import type { IntakeQuestion, IntakeStep, PathwayDefinition, ResponseMap, VisibilityCondition } from "./types";

function evaluateCondition(condition: VisibilityCondition, answers: ResponseMap) {
  const actual = answers[condition.key];
  const operator = condition.operator ?? "equals";

  if (operator === "truthy") return !!actual;
  if (operator === "falsy") return !actual;
  if (operator === "not_equals") return actual !== condition.value;
  if (operator === "includes") return Array.isArray(actual) && actual.includes(condition.value);
  return actual === condition.value;
}

export function isVisible(conditions: VisibilityCondition[] | undefined, answers: ResponseMap) {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((condition) => evaluateCondition(condition, answers));
}

export function getVisibleQuestions(step: IntakeStep, answers: ResponseMap) {
  return step.questions.filter((question) => isVisible(question.visibleWhen, answers));
}

export function getVisibleSteps(definition: PathwayDefinition, answers: ResponseMap) {
  return definition.steps.filter((step) => {
    if (!isVisible(step.visibleWhen, answers)) return false;
    return getVisibleQuestions(step, answers).length > 0;
  });
}

export function findStep(definition: PathwayDefinition, stepKey: string | null | undefined) {
  if (!stepKey) return null;
  return definition.steps.find((step) => step.key === stepKey) ?? null;
}

export function getStepIndex(steps: IntakeStep[], stepKey: string | null | undefined) {
  if (!stepKey) return 0;
  const index = steps.findIndex((step) => step.key === stepKey);
  return index >= 0 ? index : 0;
}

export function getRequiredQuestions(questions: IntakeQuestion[]) {
  return questions.filter((question) => question.required);
}

export function normalizeAnswerValue(question: IntakeQuestion, rawValue: unknown) {
  if (question.type === "number") {
    if (rawValue === "" || rawValue == null) return null;
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (question.type === "boolean") {
    return rawValue === true;
  }

  if (typeof rawValue === "string") return rawValue.trim();
  return rawValue;
}
