export const FIRST_RESPONDER_PROMO = {
  code: "RESPONDERS40",
  percentOff: 40,
  label: "First responder discount",
} as const;

export function normalizePromoCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

export function resolvePromoDiscount(amountCents: number, promoCode: string | null | undefined) {
  const normalizedCode = normalizePromoCode(promoCode);
  const baseAmountCents = Math.max(0, Math.round(Number(amountCents) || 0));

  if (!normalizedCode) {
    return {
      normalizedCode: "",
      valid: false,
      discountLabel: null,
      discountAmountCents: 0,
      finalAmountCents: baseAmountCents,
    };
  }

  if (normalizedCode !== FIRST_RESPONDER_PROMO.code) {
    return {
      normalizedCode,
      valid: false,
      discountLabel: null,
      discountAmountCents: 0,
      finalAmountCents: baseAmountCents,
    };
  }

  const discountAmountCents = Math.round((baseAmountCents * FIRST_RESPONDER_PROMO.percentOff) / 100);
  const finalAmountCents = Math.max(0, baseAmountCents - discountAmountCents);

  return {
    normalizedCode,
    valid: true,
    discountLabel: FIRST_RESPONDER_PROMO.label,
    discountAmountCents,
    finalAmountCents,
  };
}
