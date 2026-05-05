import { supabase } from "../supabase";
import type { ProviderPayoutLedgerRow, RevenueSplitRuleRow } from "./types";

type PayPalOrderRequest = {
  serviceId: string;
  appointmentId?: string | null;
  providerId?: string | null;
  clinicId?: string | null;
  locationId?: string | null;
};

type PayoutUpdateInput = {
  payout_status?: string;
  payout_method?: string | null;
  payout_reference?: string | null;
  paid_at?: string | null;
  admin_notes?: string | null;
};

export async function createPayPalOrder(input: PayPalOrderRequest) {
  const { data, error } = await supabase.functions.invoke("create-paypal-order", {
    body: input,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { orderId: string; status: string; amountCents: number; currency: string; serviceName: string };
}

export async function capturePayPalOrder(input: PayPalOrderRequest & { orderId: string }) {
  const { data, error } = await supabase.functions.invoke("capture-paypal-order", {
    body: input,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as {
    paymentTransactionId: string;
    payoutLedgerId: string | null;
    amountCents: number;
    currency: string;
    serviceName: string;
    alreadyCaptured?: boolean;
  };
}

export async function loadRevenueSplitRules() {
  const { data, error } = await supabase
    .from("provider_revenue_split_rules")
    .select("id,provider_id,clinic_id,service_id,service_category,physician_percentage,vitality_percentage,active,effective_start_date,effective_end_date,notes,created_at,updated_at")
    .order("effective_start_date", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return ((data as RevenueSplitRuleRow[] | null) ?? []);
}

export async function saveRevenueSplitRule(input: Partial<RevenueSplitRuleRow> & {
  clinic_id?: string | null;
  provider_id?: string | null;
  service_id?: string | null;
  service_category?: string | null;
  physician_percentage: number;
  vitality_percentage: number;
  active?: boolean;
  effective_start_date?: string;
  effective_end_date?: string | null;
  notes?: string | null;
}) {
  const payload = {
    id: input.id ?? undefined,
    provider_id: input.provider_id ?? null,
    clinic_id: input.clinic_id ?? null,
    service_id: input.service_id ?? null,
    service_category: input.service_category?.trim() || null,
    physician_percentage: input.physician_percentage,
    vitality_percentage: input.vitality_percentage,
    active: input.active ?? true,
    effective_start_date: input.effective_start_date ?? new Date().toISOString().slice(0, 10),
    effective_end_date: input.effective_end_date ?? null,
    notes: input.notes?.trim() || null,
  };

  const { data, error } = await supabase
    .from("provider_revenue_split_rules")
    .upsert(payload)
    .select("id,provider_id,clinic_id,service_id,service_category,physician_percentage,vitality_percentage,active,effective_start_date,effective_end_date,notes,created_at,updated_at")
    .single();

  if (error) throw error;
  return data as RevenueSplitRuleRow;
}

export async function updateProviderPayoutLedger(id: string, input: PayoutUpdateInput) {
  const { data, error } = await supabase
    .from("provider_payout_ledger")
    .update(input)
    .eq("id", id)
    .select("id,payment_transaction_id,provider_id,clinic_id,service_id,gross_amount_cents,net_amount_cents,physician_percentage,vitality_percentage,physician_share_cents,vitality_share_cents,payout_status,payout_method,payout_reference,paid_at,admin_notes,created_at,updated_at")
    .single();

  if (error) throw error;
  return data as ProviderPayoutLedgerRow;
}
