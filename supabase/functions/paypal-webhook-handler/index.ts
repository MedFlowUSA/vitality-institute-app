import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  createServiceClient,
  insertPaymentEvent,
  jsonResponse,
  verifyPayPalWebhookSignature,
} from "../_shared/payments.ts";

function deriveProviderTransactionId(eventType: string, eventBody: Record<string, unknown>) {
  const resource = (eventBody.resource ?? {}) as Record<string, unknown>;

  if (eventType === "PAYMENT.CAPTURE.REFUNDED") {
    return String(resource.sale_id ?? resource.capture_id ?? "");
  }

  if (eventType.startsWith("CUSTOMER.DISPUTE.")) {
    const disputedTransaction = ((resource.disputed_transactions as Record<string, unknown>[] | undefined) ?? [])[0] ?? {};
    return String(
      disputedTransaction.seller_transaction_id ??
      disputedTransaction.capture_id ??
      resource.disputed_transaction_id ??
      ""
    );
  }

  return String(resource.id ?? "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const rawBody = await req.text();
    const { eventBody, verified } = await verifyPayPalWebhookSignature(rawBody, req);
    if (!verified) {
      return jsonResponse({ error: "Webhook signature verification failed." }, 400);
    }

    const supabase = createServiceClient();
    const eventType = String(eventBody.event_type ?? "paypal_webhook_received");
    const providerTransactionId = deriveProviderTransactionId(eventType, eventBody);

    if (!providerTransactionId) {
      await insertPaymentEvent(supabase, {
        paymentTransactionId: null,
        eventType: "paypal_webhook_unmatched",
        actorUserId: null,
        eventPayload: {
          paypal_event_type: eventType,
          provider_transaction_id: null,
          raw_event: eventBody,
        },
      });
      return jsonResponse({ ok: true, matched: false });
    }

    const { data: paymentTransaction, error: transactionError } = await supabase
      .from("payment_transactions")
      .select("id,payment_status,checkout_status,metadata")
      .eq("payment_provider", "paypal")
      .eq("provider_transaction_id", providerTransactionId)
      .maybeSingle();

    if (transactionError) throw transactionError;
    if (!paymentTransaction?.id) {
      await insertPaymentEvent(supabase, {
        paymentTransactionId: null,
        eventType: "paypal_webhook_unmatched",
        actorUserId: null,
        eventPayload: {
          paypal_event_type: eventType,
          provider_transaction_id: providerTransactionId,
          raw_event: eventBody,
        },
      });
      return jsonResponse({ ok: true, matched: false });
    }

    const nextMetadata = {
      ...((paymentTransaction.metadata as Record<string, unknown> | null) ?? {}),
      last_paypal_webhook_event_type: eventType,
      last_paypal_webhook_received_at: new Date().toISOString(),
    };

    let nextPaymentStatus = paymentTransaction.payment_status;
    let nextCheckoutStatus = paymentTransaction.checkout_status;
    let nextPayoutStatus: string | null = null;

    switch (eventType) {
      case "PAYMENT.CAPTURE.REFUNDED":
        nextPaymentStatus = "refunded";
        nextCheckoutStatus = "completed";
        nextPayoutStatus = "refunded";
        break;
      case "CUSTOMER.DISPUTE.CREATED":
        nextPaymentStatus = "disputed";
        nextCheckoutStatus = "completed";
        nextPayoutStatus = "disputed";
        break;
      case "CUSTOMER.DISPUTE.RESOLVED":
        nextPaymentStatus = "completed";
        nextCheckoutStatus = "completed";
        nextPayoutStatus = "approved";
        break;
      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.DECLINED":
        nextPaymentStatus = "failed";
        nextCheckoutStatus = "failed";
        nextPayoutStatus = "held";
        break;
      default:
        nextPaymentStatus = paymentTransaction.payment_status;
        nextCheckoutStatus = paymentTransaction.checkout_status;
        break;
    }

    const { error: paymentUpdateError } = await supabase
      .from("payment_transactions")
      .update({
        payment_status: nextPaymentStatus,
        checkout_status: nextCheckoutStatus,
        metadata: nextMetadata,
      })
      .eq("id", paymentTransaction.id);

    if (paymentUpdateError) throw paymentUpdateError;

    if (nextPayoutStatus) {
      const { error: payoutUpdateError } = await supabase
        .from("provider_payout_ledger")
        .update({
          payout_status: nextPayoutStatus,
        })
        .eq("payment_transaction_id", paymentTransaction.id);
      if (payoutUpdateError) throw payoutUpdateError;
    }

    await insertPaymentEvent(supabase, {
      paymentTransactionId: paymentTransaction.id,
      eventType: "paypal_webhook_processed",
      actorUserId: null,
      eventPayload: {
        paypal_event_type: eventType,
        provider_transaction_id: providerTransactionId,
        payout_status: nextPayoutStatus,
        raw_event: eventBody,
      },
    });

    return jsonResponse({ ok: true, matched: true, paymentTransactionId: paymentTransaction.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process PayPal webhook.";
    return jsonResponse({ error: message }, 400);
  }
});
