import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  createServiceClient,
  insertPaymentEvent,
  jsonResponse,
  loadCheckoutContext,
  paypalFetch,
  requireUser,
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

    const invoiceId = crypto.randomUUID();
    const order = await paypalFetch("/v2/checkout/orders", {
      method: "POST",
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: context.serviceId ?? context.appointmentId ?? invoiceId,
            invoice_id: invoiceId,
            custom_id: [context.patientId, context.appointmentId ?? "no-appointment", context.serviceId ?? "no-service"].join("|"),
            description: context.serviceName,
            amount: {
              currency_code: context.currency,
              value: (context.amountCents / 100).toFixed(2),
            },
          },
        ],
      }),
    });

    await insertPaymentEvent(supabase, {
      paymentTransactionId: null,
      eventType: "paypal_order_created",
      actorUserId: user.id,
        eventPayload: {
          paypal_order_id: order.id ?? null,
          invoice_id: invoiceId,
        service_id: context.serviceId,
        appointment_id: context.appointmentId,
        provider_id: context.providerId,
        clinic_id: context.clinicId,
          location_id: context.locationId,
          original_amount_cents: context.originalAmountCents,
          amount_cents: context.amountCents,
          discount_amount_cents: context.discountAmountCents,
          promo_code: context.promoCode,
          currency: context.currency,
        },
      });

    return jsonResponse({
      orderId: order.id,
      status: order.status,
      amountCents: context.amountCents,
      discountAmountCents: context.discountAmountCents,
      promoCode: context.promoCode,
      currency: context.currency,
      serviceName: context.serviceName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create PayPal order.";
    return jsonResponse({ error: message }, 400);
  }
});
