import { describe, expect, it } from "vitest";
import { calculateRevenueShares, resolveRevenueSplitRule } from "./revenue";
import type { RevenueSplitRuleRow } from "./types";

function buildRule(overrides: Partial<RevenueSplitRuleRow>): RevenueSplitRuleRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    provider_id: overrides.provider_id ?? null,
    clinic_id: overrides.clinic_id ?? null,
    service_id: overrides.service_id ?? null,
    service_category: overrides.service_category ?? null,
    physician_percentage: overrides.physician_percentage ?? 0,
    vitality_percentage: overrides.vitality_percentage ?? 100,
    active: overrides.active ?? true,
    effective_start_date: overrides.effective_start_date ?? "2026-01-01",
    effective_end_date: overrides.effective_end_date ?? null,
    notes: overrides.notes ?? null,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00Z",
    updated_at: overrides.updated_at ?? "2026-01-01T00:00:00Z",
  };
}

describe("resolveRevenueSplitRule", () => {
  it("prefers service-specific clinic rule over provider default", () => {
    const rules = [
      buildRule({
        id: "provider-default",
        provider_id: "provider-1",
        clinic_id: "clinic-1",
        physician_percentage: 60,
        vitality_percentage: 40,
      }),
      buildRule({
        id: "clinic-service",
        clinic_id: "clinic-1",
        service_id: "service-1",
        physician_percentage: 25,
        vitality_percentage: 75,
      }),
    ];

    const resolved = resolveRevenueSplitRule({
      rules,
      providerId: "provider-1",
      clinicId: "clinic-1",
      serviceId: "service-1",
    });

    expect(resolved.ruleId).toBe("clinic-service");
    expect(resolved.physicianPercentage).toBe(25);
    expect(resolved.source).toBe("clinic_service");
  });

  it("prefers provider-specific service rule over clinic service rule", () => {
    const rules = [
      buildRule({
        id: "clinic-service",
        clinic_id: "clinic-1",
        service_id: "service-1",
        physician_percentage: 35,
        vitality_percentage: 65,
      }),
      buildRule({
        id: "provider-service",
        clinic_id: "clinic-1",
        provider_id: "provider-1",
        service_id: "service-1",
        physician_percentage: 70,
        vitality_percentage: 30,
      }),
    ];

    const resolved = resolveRevenueSplitRule({
      rules,
      providerId: "provider-1",
      clinicId: "clinic-1",
      serviceId: "service-1",
    });

    expect(resolved.ruleId).toBe("provider-service");
    expect(resolved.source).toBe("provider_service");
  });

  it("falls back to 0/100 when nothing matches", () => {
    const resolved = resolveRevenueSplitRule({
      rules: [],
      providerId: "provider-1",
      clinicId: "clinic-1",
      serviceId: "service-1",
    });

    expect(resolved.physicianPercentage).toBe(0);
    expect(resolved.vitalityPercentage).toBe(100);
    expect(resolved.source).toBe("fallback_default");
  });
});

describe("calculateRevenueShares", () => {
  it("uses net after processing fees when provided", () => {
    const result = calculateRevenueShares({
      grossAmountCents: 50000,
      processingFeeCents: 1500,
      physicianPercentage: 60,
      vitalityPercentage: 40,
    });

    expect(result.netAmountCents).toBe(48500);
    expect(result.physicianShareCents).toBe(29100);
    expect(result.vitalityShareCents).toBe(19400);
  });
});
