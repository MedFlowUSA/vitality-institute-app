import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  calculateRevenueShares,
  corsHeaders,
  createServiceClient,
  getPayPalOrderBreakdown,
  insertPaymentEvent,
  jsonResponse,
  loadCheckoutContext,
  paypalFetch,
  requireUser,
  resolveRevenueSplitFromRpc,
} from "../_shared/payments.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const supabase = createServiceClient();
    const user = await requireUser(supabase, req);
    const body = await req.json();
    const orderId = String(body?.orderId ?? "").trim();

    if (!orderId) {
      return jsonResponse({ error: "Missing PayPal order ID." }, 400);
    }

    const context = await loadCheckoutContext(supabase, {
      user,
      serviceId: body?.serviceId ?? null,
      appointmentId: body?.appointmentId ?? null,
      providerId: body?.providerId ?? null,
      clinicId: body?.clinicId ?? null,
      locationId: body?.locationId ?? null,
      promoCode: body?.promoCode ?? null,
    });

    if (context.blockedReason) {
      return jsonResponse({ error: context.blockedReason }, 400);
    }

    const capturedOrder = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    const breakdown = getPayPalOrderBreakdown(capturedOrder);
    if (!breakdown.providerTransactionId) {
      throw new Error("PayPal capture did not return a provider transaction ID.");
    }

    const { data: existingTransaction, error: existingTransactionError } = await supabase
      .from("payment_transactions")
      .select("id")
      .eq("payment_provider", "paypal")
      .eq("provider_transaction_id", breakdown.providerTransactionId)
      .maybeSingle();

    if (existingTransactionError) throw existingTransactionError;

    if (existingTransaction?.id) {
      return jsonResponse({
        paymentTransactionId: existingTransaction.id,
        alreadyCaptured: true,
      });
    }

    const split = await resolveRevenueSplitFromRpc(supabase, {
      providerId: context.providerId,
      clinicId: context.clinicId,
      serviceId: context.serviceId,
      serviceCategory: context.serviceCategory,
    });

    const share = calculateRevenueShares({
      grossAmountCents: breakdown.grossAmountCents || context.amountCents,
      processingFeeCents: breakdown.processingFeeCents,
      netAmountCents: breakdown.netAmountCents || undefined,
      physicianPercentage: split.physicianPercentage,
      vitalityPercentage: split.vitalityPercentage,
    });

    const transactionInsert = {
      patient_id: context.patientId,
      appointment_id: context.appointmentId,
      service_id: context.serviceId,
      provider_id: context.providerId,
      clinic_id: context.clinicId,
      location_id: context.locationId,
      payment_provider: "paypal",
      provider_transaction_id: breakdown.providerTransactionId,
      gross_amount_cents: share.grossAmountCents,
      platform_fee_cents: 0,
      processing_fee_cents: share.processingFeeCents,
      net_amount_cents: share.netAmountCents,
      currency: breakdown.currency || context.currency,
      payment_status: "completed",
      checkout_status: "completed",
        metadata: {
          paypal_order_id: breakdown.orderId,
          paypal_capture_id: breakdown.providerTransactionId,
          split_rule_id: split.ruleId,
          split_resolution_source: split.resolutionSource,
          service_category: context.serviceCategory,
          original_amount_cents: context.originalAmountCents,
          discount_amount_cents: context.discountAmountCents,
          promo_code: context.promoCode,
          raw_capture: breakdown.rawCapture,
        },
      };

    const { data: paymentTransaction, error: paymentTransactionError } = await supabase
      .from("payment_transactions")
      .insert(transactionInsert)
      .select("id")
      .single();

    if (paymentTransactionError) throw paymentTransactionError;

    let payoutLedgerId: string | null = null;

    if (context.providerId) {
      const { data: payoutLedger, error: payoutLedgerError } = await supabase
        .from("provider_payout_ledger")
        .insert({
          payment_transaction_id: paymentTransaction.id,
          provider_id: context.providerId,
          clinic_id: context.clinicId,
          service_id: context.serviceId,
          gross_amount_cents: share.grossAmountCents,
          net_amount_cents: share.netAmountCents,
          physician_percentage: share.physicianPercentage,
          vitality_percentage: share.vitalityPercentage,
          physician_share_cents: share.physicianShareCents,
          vitality_share_cents: share.vitalityShareCents,
          payout_status: "pending",
          payout_method: null,
          payout_reference: null,
          admin_notes: split.notes,
        })
        .select("id")
        .single();

      if (payoutLedgerError) throw payoutLedgerError;
      payoutLedgerId = payoutLedger.id;
    }

    await insertPaymentEvent(supabase, {
      paymentTransactionId: paymentTransaction.id,
      eventType: "paypal_capture_succeeded",
      actorUserId: user.id,
      eventPayload: {
        paypal_order_id: breakdown.orderId,
        paypal_capture_id: breakdown.providerTransactionId,
        service_id: context.serviceId,
        appointment_id: context.appointmentId,
        provider_id: context.providerId,
        clinic_id: context.clinicId,
        location_id: context.locationId,
        split_rule_id: split.ruleId,
        split_resolution_source: split.resolutionSource,
        original_amount_cents: context.originalAmountCents,
        gross_amount_cents: share.grossAmountCents,
        discount_amount_cents: context.discountAmountCents,
        promo_code: context.promoCode,
        processing_fee_cents: share.processingFeeCents,
        net_amount_cents: share.netAmountCents,
        physician_share_cents: share.physicianShareCents,
        vitality_share_cents: share.vitalityShareCents,
        payout_ledger_id: payoutLedgerId,
      },
    });

    return jsonResponse({
      paymentTransactionId: paymentTransaction.id,
      payoutLedgerId,
      amountCents: share.grossAmountCents,
      discountAmountCents: context.discountAmountCents,
      promoCode: context.promoCode,
      currency: breakdown.currency || context.currency,
      serviceName: context.serviceName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to capture PayPal order.";
    return jsonResponse({ error: message }, 400);
  }
});
