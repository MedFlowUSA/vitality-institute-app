export const LAW_ENFORCEMENT_DISCOUNT_CODE = "LAW20";
export const LAW_ENFORCEMENT_DISCOUNT_PERCENT = 40;

export function buildLawEnforcementDiscountLabel() {
  return `${LAW_ENFORCEMENT_DISCOUNT_CODE} for ${LAW_ENFORCEMENT_DISCOUNT_PERCENT}% off`;
}
