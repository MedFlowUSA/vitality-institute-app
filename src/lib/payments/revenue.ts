import type { ResolvedRevenueSplitRule, RevenueSplitResolutionSource, RevenueSplitRuleRow } from "./types";

type ResolveArgs = {
  rules: RevenueSplitRuleRow[];
  providerId?: string | null;
  clinicId?: string | null;
  serviceId?: string | null;
  serviceCategory?: string | null;
  effectiveDate?: string | Date | null;
};

type AllocationArgs = {
  grossAmountCents: number;
  processingFeeCents?: number | null;
  platformFeeCents?: number | null;
  netAmountCents?: number | null;
  physicianPercentage: number;
  vitalityPercentage: number;
};

type RankedRule = {
  rule: RevenueSplitRuleRow;
  priority: number;
  source: RevenueSplitResolutionSource;
};

const DEFAULT_RULE: ResolvedRevenueSplitRule = {
  ruleId: null,
  physicianPercentage: 0,
  vitalityPercentage: 100,
  source: "fallback_default",
  notes: "No active revenue split rule matched. Defaulted to 0% physician and 100% Vitality.",
};

function normalizeDateOnly(value?: string | Date | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function normalizeCategory(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function matchesDateWindow(rule: RevenueSplitRuleRow, effectiveDate: string) {
  if (!rule.active) return false;
  if (rule.effective_start_date > effectiveDate) return false;
  if (rule.effective_end_date && rule.effective_end_date < effectiveDate) return false;
  return true;
}

function getRuleRank(args: {
  rule: RevenueSplitRuleRow;
  providerId?: string | null;
  clinicId?: string | null;
  serviceId?: string | null;
  serviceCategory?: string | null;
}): RankedRule | null {
  const { rule, providerId = null, clinicId = null, serviceId = null } = args;
  const serviceCategory = normalizeCategory(args.serviceCategory);
  const ruleCategory = normalizeCategory(rule.service_category);

  const providerMatches = rule.provider_id === null || rule.provider_id === providerId;
  const clinicMatches = rule.clinic_id === null || rule.clinic_id === clinicId;
  const serviceMatches = rule.service_id === null || rule.service_id === serviceId;
  const categoryMatches = !ruleCategory || ruleCategory === serviceCategory;

  if (!providerMatches || !clinicMatches || !serviceMatches || !categoryMatches) return null;

  if (rule.provider_id === providerId && rule.service_id === serviceId && serviceId) {
    return { rule, priority: 600, source: "provider_service" };
  }
  if (rule.provider_id === providerId && !rule.service_id && ruleCategory) {
    return { rule, priority: 550, source: "provider_service_category" };
  }
  if (!rule.provider_id && rule.clinic_id === clinicId && rule.service_id === serviceId && serviceId) {
    return { rule, priority: 500, source: "clinic_service" };
  }
  if (!rule.provider_id && rule.clinic_id === clinicId && !rule.service_id && ruleCategory) {
    return { rule, priority: 450, source: "clinic_service_category" };
  }
  if (rule.provider_id === providerId && !rule.service_id && !ruleCategory) {
    return { rule, priority: 400, source: "provider_default" };
  }
  if (!rule.provider_id && rule.clinic_id === clinicId && !rule.service_id && !ruleCategory) {
    return { rule, priority: 300, source: "clinic_default" };
  }
  if (!rule.provider_id && !rule.clinic_id && rule.service_id === serviceId && serviceId) {
    return { rule, priority: 250, source: "global_service" };
  }
  if (!rule.provider_id && !rule.clinic_id && !rule.service_id && ruleCategory) {
    return { rule, priority: 200, source: "global_service_category" };
  }
  if (!rule.provider_id && !rule.clinic_id && !rule.service_id && !ruleCategory) {
    return { rule, priority: 100, source: "global_default" };
  }

  return null;
}

export function resolveRevenueSplitRule(args: ResolveArgs): ResolvedRevenueSplitRule {
  const effectiveDate = normalizeDateOnly(args.effectiveDate);

  const rankedRules = args.rules
    .filter((rule) => matchesDateWindow(rule, effectiveDate))
    .map((rule) =>
      getRuleRank({
        rule,
        providerId: args.providerId,
        clinicId: args.clinicId,
        serviceId: args.serviceId,
        serviceCategory: args.serviceCategory,
      })
    )
    .filter((rule): rule is RankedRule => Boolean(rule))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (b.rule.effective_start_date !== a.rule.effective_start_date) {
        return b.rule.effective_start_date.localeCompare(a.rule.effective_start_date);
      }
      return (b.rule.updated_at ?? b.rule.created_at ?? "").localeCompare(a.rule.updated_at ?? a.rule.created_at ?? "");
    });

  const match = rankedRules[0];
  if (!match) return DEFAULT_RULE;

  return {
    ruleId: match.rule.id,
    physicianPercentage: Number(match.rule.physician_percentage),
    vitalityPercentage: Number(match.rule.vitality_percentage),
    source: match.source,
    notes: match.rule.notes,
  };
}

export function calculateRevenueShares(args: AllocationArgs) {
  const grossAmountCents = Math.max(0, Math.round(args.grossAmountCents));
  const processingFeeCents = Math.max(0, Math.round(args.processingFeeCents ?? 0));
  const platformFeeCents = Math.max(0, Math.round(args.platformFeeCents ?? 0));
  const derivedNet = Math.max(0, grossAmountCents - processingFeeCents);
  const netAmountCents = Math.max(0, Math.round(args.netAmountCents ?? derivedNet));
  const physicianPercentage = Number(args.physicianPercentage);
  const vitalityPercentage = Number(args.vitalityPercentage);

  const physicianShareCents = Math.round((netAmountCents * physicianPercentage) / 100);
  const vitalityShareCents = Math.max(0, netAmountCents - physicianShareCents);

  return {
    grossAmountCents,
    processingFeeCents,
    platformFeeCents,
    netAmountCents,
    physicianPercentage,
    vitalityPercentage,
    physicianShareCents,
    vitalityShareCents,
  };
}

export function formatPaymentCurrency(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function getProviderEarningsPatientLabel(patientFirstName?: string | null, patientLastName?: string | null, fallbackId?: string | null) {
  const firstInitial = patientFirstName?.trim()?.[0]?.toUpperCase() ?? "P";
  const lastInitial = patientLastName?.trim()?.[0]?.toUpperCase() ?? "";
  if (firstInitial || lastInitial) return `${firstInitial}${lastInitial ? `. ${lastInitial}.` : "."}`;
  if (!fallbackId) return "Patient";
  return `Patient ${fallbackId.slice(0, 6).toUpperCase()}`;
}
