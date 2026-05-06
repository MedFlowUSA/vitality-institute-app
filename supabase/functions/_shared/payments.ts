import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

type CheckoutContextArgs = {
  user: User;
  serviceId?: string | null;
  appointmentId?: string | null;
  providerId?: string | null;
  clinicId?: string | null;
  locationId?: string | null;
  promoCode?: string | null;
};

type CaptureBreakdown = {
  orderId: string;
  providerTransactionId: string;
  grossAmountCents: number;
  processingFeeCents: number;
  netAmountCents: number;
  currency: string;
  rawCapture: JsonRecord;
};

type CheckoutContext = {
  patientId: string;
  serviceId: string | null;
  serviceName: string;
  serviceCategory: string | null;
  appointmentId: string | null;
  providerId: string | null;
  clinicId: string | null;
  locationId: string | null;
  amountCents: number;
  originalAmountCents: number;
  discountAmountCents: number;
  currency: string;
  requiresConsult: boolean;
  blockedReason: string | null;
  promoCode: string | null;
};

const FIRST_RESPONDER_PROMO = {
  code: "RESPONDERS40",
  percentOff: 40,
  label: "First responder discount",
} as const;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, paypal-auth-algo, paypal-cert-url, paypal-transmission-id, paypal-transmission-sig, paypal-transmission-time",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function createServiceClient() {
  return createClient(getRequiredEnv("SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

export async function requireUser(supabase: SupabaseClient, req: Request) {
  const authorization = req.headers.get("Authorization");
  const jwt = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw new Error("Missing Authorization header.");

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(jwt);

  if (error || !user) throw new Error("You must be signed in to continue checkout.");
  return user;
}

function getPayPalBaseUrl() {
  const env = (Deno.env.get("PAYPAL_ENV") ?? "live").trim().toLowerCase();
  return env === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}

function getPayPalClientId() {
  return Deno.env.get("PAYPAL_CLIENT_ID")?.trim() || Deno.env.get("VITE_PAYPAL_CLIENT_ID")?.trim() || "";
}

export async function getPayPalAccessToken() {
  const clientId = getPayPalClientId();
  const clientSecret = getRequiredEnv("PAYPAL_CLIENT_SECRET");
  if (!clientId) throw new Error("Missing PAYPAL_CLIENT_ID for PayPal server access.");

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const payload = await response.json();
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || payload?.error || "Failed to authenticate with PayPal.");
  }

  return payload.access_token as string;
}

export async function paypalFetch(path: string, init: RequestInit = {}) {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const issue = payload?.details?.[0]?.issue || payload?.message || payload?.name;
    throw new Error(typeof issue === "string" && issue.trim() ? issue : "PayPal request failed.");
  }

  return payload;
}

function centsFromPayPalAmount(value: unknown) {
  const asNumber = Number(value ?? 0);
  if (!Number.isFinite(asNumber)) return 0;
  return Math.round(asNumber * 100);
}

function normalizePromoCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function resolvePromoDiscount(amountCents: number, promoCode: string | null | undefined) {
  const normalizedCode = normalizePromoCode(promoCode);
  const baseAmountCents = Math.max(0, Math.round(Number(amountCents) || 0));

  if (!normalizedCode) {
    return {
      normalizedCode: null,
      discountAmountCents: 0,
      finalAmountCents: baseAmountCents,
    };
  }

  if (normalizedCode !== FIRST_RESPONDER_PROMO.code) {
    throw new Error("The promo code could not be applied. Please confirm it with the clinic.");
  }

  const discountAmountCents = Math.round((baseAmountCents * FIRST_RESPONDER_PROMO.percentOff) / 100);

  return {
    normalizedCode,
    discountAmountCents,
    finalAmountCents: Math.max(0, baseAmountCents - discountAmountCents),
  };
}

export function calculateRevenueShares(args: {
  grossAmountCents: number;
  processingFeeCents?: number;
  netAmountCents?: number;
  physicianPercentage: number;
  vitalityPercentage: number;
}) {
  const grossAmountCents = Math.max(0, Math.round(args.grossAmountCents));
  const processingFeeCents = Math.max(0, Math.round(args.processingFeeCents ?? 0));
  const netAmountCents = Math.max(0, Math.round(args.netAmountCents ?? grossAmountCents - processingFeeCents));
  const physicianShareCents = Math.round((netAmountCents * Number(args.physicianPercentage)) / 100);
  const vitalityShareCents = Math.max(0, netAmountCents - physicianShareCents);

  return {
    grossAmountCents,
    processingFeeCents,
    netAmountCents,
    physicianPercentage: Number(args.physicianPercentage),
    vitalityPercentage: Number(args.vitalityPercentage),
    physicianShareCents,
    vitalityShareCents,
  };
}

async function resolveClinicIdForLocation(supabase: SupabaseClient, locationId: string | null) {
  if (!locationId) return null;
  const { data, error } = await supabase.rpc("resolve_clinic_id_from_location", { target_location_id: locationId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function loadCheckoutContext(supabase: SupabaseClient, args: CheckoutContextArgs): Promise<CheckoutContext> {
  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id")
    .eq("profile_id", args.user.id)
    .maybeSingle();

  if (patientError) throw patientError;
  if (!patient?.id) throw new Error("No patient record is linked to this login.");

  let appointmentRow:
    | {
        id: string;
        patient_id: string;
        service_id: string | null;
        provider_user_id: string | null;
        location_id: string | null;
        status: string | null;
      }
    | null = null;

  if (args.appointmentId) {
    const { data, error } = await supabase
      .from("appointments")
      .select("id,patient_id,service_id,provider_user_id,location_id,status")
      .eq("id", args.appointmentId)
      .maybeSingle();
    if (error) throw error;
    appointmentRow = data;
    if (!appointmentRow?.id || appointmentRow.patient_id !== patient.id) {
      throw new Error("The selected appointment is not available for this patient.");
    }
  }

  const resolvedServiceId = args.serviceId ?? appointmentRow?.service_id ?? null;
  if (!resolvedServiceId) {
    throw new Error("A service must be selected before checkout.");
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id,name,category,service_group,location_id,requires_consult,price_marketing_cents,price_regular_cents,is_active")
    .eq("id", resolvedServiceId)
    .maybeSingle();

  if (serviceError) throw serviceError;
  if (!service?.id || service.is_active === false) {
    throw new Error("This service is not available for checkout.");
  }

  if (appointmentRow?.service_id && appointmentRow.service_id !== service.id) {
    throw new Error("The appointment and selected service do not match.");
  }

  const originalAmountCents = Number(service.price_marketing_cents ?? service.price_regular_cents ?? 0);
  if (!Number.isFinite(originalAmountCents) || originalAmountCents <= 0) {
    throw new Error("This service is not priced for self-checkout yet.");
  }

  const promoPricing = resolvePromoDiscount(originalAmountCents, args.promoCode ?? null);

  const locationId = appointmentRow?.location_id ?? args.locationId ?? service.location_id ?? null;
  const clinicId = args.clinicId ?? (await resolveClinicIdForLocation(supabase, locationId));
  const providerId = appointmentRow?.provider_user_id ?? args.providerId ?? null;
  const requiresConsult = Boolean(service.requires_consult);
  const blockedReason = requiresConsult && !appointmentRow?.id
    ? "This service requires clinical review or physician approval before checkout. Please wait for your appointment or care-team confirmation."
    : null;

  return {
    patientId: patient.id,
    serviceId: service.id,
    serviceName: service.name ?? "Vitality service",
    serviceCategory: service.category ?? service.service_group ?? null,
    appointmentId: appointmentRow?.id ?? null,
    providerId,
    clinicId,
    locationId,
    amountCents: promoPricing.finalAmountCents,
    originalAmountCents,
    discountAmountCents: promoPricing.discountAmountCents,
    currency: "USD",
    requiresConsult,
    blockedReason,
    promoCode: promoPricing.normalizedCode,
  };
}

export async function resolveRevenueSplitFromRpc(
  supabase: SupabaseClient,
  args: {
    providerId?: string | null;
    clinicId?: string | null;
    serviceId?: string | null;
    serviceCategory?: string | null;
  }
) {
  const { data, error } = await supabase.rpc("resolve_provider_revenue_split_rule", {
    target_provider_id: args.providerId ?? null,
    target_clinic_id: args.clinicId ?? null,
    target_service_id: args.serviceId ?? null,
    target_service_category: args.serviceCategory ?? null,
  });

  if (error) throw error;
  const rule = Array.isArray(data) ? data[0] : data;

  if (!rule) {
    return {
      ruleId: null,
      physicianPercentage: 0,
      vitalityPercentage: 100,
      resolutionSource: "fallback_default",
      notes: "No active revenue split rule matched. Defaulted to 0% physician and 100% Vitality.",
    };
  }

  return {
    ruleId: (rule.rule_id as string | null) ?? null,
    physicianPercentage: Number(rule.physician_percentage ?? 0),
    vitalityPercentage: Number(rule.vitality_percentage ?? 100),
    resolutionSource: (rule.resolution_source as string | null) ?? "fallback_default",
    notes: (rule.notes as string | null) ?? null,
  };
}

export async function insertPaymentEvent(
  supabase: SupabaseClient,
  args: {
    paymentTransactionId?: string | null;
    eventType: string;
    eventPayload?: JsonRecord;
    actorUserId?: string | null;
  }
) {
  const { error } = await supabase.from("payment_events").insert({
    payment_transaction_id: args.paymentTransactionId ?? null,
    event_type: args.eventType,
    event_payload: args.eventPayload ?? {},
    actor_user_id: args.actorUserId ?? null,
  });

  if (error) throw error;
}

export function getPayPalOrderBreakdown(orderPayload: JsonRecord): CaptureBreakdown {
  const purchaseUnit = (orderPayload.purchase_units as JsonRecord[] | undefined)?.[0] ?? {};
  const capture = ((purchaseUnit.payments as JsonRecord | undefined)?.captures as JsonRecord[] | undefined)?.[0] ?? {};
  const captureAmount = (capture.amount as JsonRecord | undefined) ?? {};
  const breakdown = (capture.seller_receivable_breakdown as JsonRecord | undefined) ?? {};
  const grossAmount = (captureAmount.value as string | number | undefined) ?? (purchaseUnit.amount as JsonRecord | undefined)?.["value"];
  const currency = String(captureAmount.currency_code ?? (purchaseUnit.amount as JsonRecord | undefined)?.["currency_code"] ?? "USD");

  return {
    orderId: String(orderPayload.id ?? ""),
    providerTransactionId: String(capture.id ?? ""),
    grossAmountCents: centsFromPayPalAmount(grossAmount),
    processingFeeCents: centsFromPayPalAmount((breakdown.paypal_fee as JsonRecord | undefined)?.value),
    netAmountCents: centsFromPayPalAmount((breakdown.net_amount as JsonRecord | undefined)?.value),
    currency,
    rawCapture: capture,
  };
}

export async function verifyPayPalWebhookSignature(rawBody: string, req: Request) {
  const webhookId = getRequiredEnv("PAYPAL_WEBHOOK_ID");
  const authAlgo = req.headers.get("paypal-auth-algo");
  const certUrl = req.headers.get("paypal-cert-url");
  const transmissionId = req.headers.get("paypal-transmission-id");
  const transmissionSig = req.headers.get("paypal-transmission-sig");
  const transmissionTime = req.headers.get("paypal-transmission-time");

  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    throw new Error("Missing PayPal webhook signature headers.");
  }

  const eventBody = JSON.parse(rawBody);
  const verification = await paypalFetch("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: eventBody,
    }),
  });

  return {
    eventBody,
    verified: verification.verification_status === "SUCCESS",
  };
}
