export type PaymentProvider = "paypal";

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "completed"
  | "failed"
  | "refunded"
  | "disputed"
  | "canceled";

export type CheckoutStatus =
  | "pending"
  | "order_created"
  | "approved"
  | "completed"
  | "failed"
  | "canceled"
  | "expired";

export type PayoutStatus =
  | "pending"
  | "approved"
  | "paid"
  | "held"
  | "refunded"
  | "disputed"
  | "canceled";

export type RevenueSplitRuleRow = {
  id: string;
  provider_id: string | null;
  clinic_id: string | null;
  service_id: string | null;
  service_category: string | null;
  physician_percentage: number;
  vitality_percentage: number;
  active: boolean;
  effective_start_date: string;
  effective_end_date: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

export type RevenueSplitResolutionSource =
  | "provider_service"
  | "provider_service_category"
  | "clinic_service"
  | "clinic_service_category"
  | "provider_default"
  | "clinic_default"
  | "global_service"
  | "global_service_category"
  | "global_default"
  | "fallback_default";

export type ResolvedRevenueSplitRule = {
  ruleId: string | null;
  physicianPercentage: number;
  vitalityPercentage: number;
  source: RevenueSplitResolutionSource;
  notes: string | null;
};

export type PaymentTransactionRow = {
  id: string;
  patient_id: string | null;
  appointment_id: string | null;
  service_id: string | null;
  provider_id: string | null;
  clinic_id: string | null;
  location_id: string | null;
  payment_provider: PaymentProvider;
  provider_transaction_id: string | null;
  gross_amount_cents: number;
  platform_fee_cents: number;
  processing_fee_cents: number;
  net_amount_cents: number;
  currency: string;
  payment_status: PaymentStatus | string;
  checkout_status: CheckoutStatus | string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProviderPayoutLedgerRow = {
  id: string;
  payment_transaction_id: string;
  provider_id: string;
  clinic_id: string | null;
  service_id: string | null;
  gross_amount_cents: number;
  net_amount_cents: number;
  physician_percentage: number;
  vitality_percentage: number;
  physician_share_cents: number;
  vitality_share_cents: number;
  payout_status: PayoutStatus | string;
  payout_method: string | null;
  payout_reference: string | null;
  paid_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentEventRow = {
  id: string;
  payment_transaction_id: string | null;
  event_type: string;
  event_payload: Record<string, unknown>;
  actor_user_id: string | null;
  created_at: string;
};
