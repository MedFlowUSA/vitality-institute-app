import { useEffect, useMemo, useRef, useState } from "react";
import { capturePayPalOrder, createPayPalOrder } from "../../lib/payments/client";

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: {
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onError: (error: unknown) => void;
        onCancel?: () => void;
        style?: Record<string, unknown>;
      }) => {
        render: (selector: HTMLElement) => Promise<void> | void;
        close?: () => void;
      };
    };
  }
}

type Props = {
  clientId?: string | null;
  disabled?: boolean;
  serviceId: string;
  appointmentId?: string | null;
  providerId?: string | null;
  clinicId?: string | null;
  locationId?: string | null;
  promoCode?: string | null;
  amountLabel: string;
  serviceName: string;
  onSuccess: (result: {
    paymentTransactionId: string;
    payoutLedgerId: string | null;
    amountCents: number;
    currency: string;
    serviceName: string;
    discountAmountCents?: number;
    promoCode?: string | null;
  }) => void;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "PayPal checkout could not be completed.";
}

export default function PayPalCheckoutCard(props: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonsRef = useRef<{ close?: () => void } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const clientId = props.clientId?.trim() ?? "";

  const orderContext = useMemo(
    () => ({
      serviceId: props.serviceId,
        appointmentId: props.appointmentId ?? null,
        providerId: props.providerId ?? null,
        clinicId: props.clinicId ?? null,
        locationId: props.locationId ?? null,
        promoCode: props.promoCode ?? null,
      }),
    [props.appointmentId, props.clinicId, props.locationId, props.promoCode, props.providerId, props.serviceId]
  );

  useEffect(() => {
    if (!clientId || props.disabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-paypal-sdk="vitality"]');

    const boot = async () => {
      try {
        if (!window.paypal) {
          if (!existingScript) {
            const script = document.createElement("script");
            script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`;
            script.async = true;
            script.dataset.paypalSdk = "vitality";
            document.body.appendChild(script);
            await new Promise<void>((resolve, reject) => {
              script.onload = () => resolve();
              script.onerror = () => reject(new Error("PayPal SDK failed to load."));
            });
          } else {
            await new Promise<void>((resolve, reject) => {
              if (window.paypal) {
                resolve();
                return;
              }
              existingScript.addEventListener("load", () => resolve(), { once: true });
              existingScript.addEventListener("error", () => reject(new Error("PayPal SDK failed to load.")), { once: true });
            });
          }
        }

        if (cancelled || !containerRef.current || !window.paypal?.Buttons) return;
        containerRef.current.innerHTML = "";

        const buttons = window.paypal.Buttons({
          style: {
            color: "gold",
            shape: "rect",
            label: "paypal",
            layout: "vertical",
          },
          createOrder: async () => {
            const created = await createPayPalOrder(orderContext);
            return created.orderId;
          },
          onApprove: async (data) => {
            const captured = await capturePayPalOrder({
              ...orderContext,
              orderId: data.orderID,
            });
            props.onSuccess(captured);
          },
          onError: (paypalError) => {
            setError(getErrorMessage(paypalError));
          },
          onCancel: () => {
            setError("PayPal checkout was canceled before payment was captured.");
          },
        });

        buttonsRef.current = buttons;
        await buttons.render(containerRef.current);
      } catch (sdkError) {
        if (!cancelled) setError(getErrorMessage(sdkError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void boot();

    return () => {
      cancelled = true;
      buttonsRef.current?.close?.();
      buttonsRef.current = null;
    };
  }, [clientId, orderContext, props.disabled, props.onSuccess]);

  if (!clientId) {
    return (
      <div className="card card-pad card-light surface-light">
        <div className="h2">PayPal is not configured yet.</div>
        <div className="surface-light-helper" style={{ marginTop: 8, lineHeight: 1.6 }}>
          Add <code>VITE_PAYPAL_CLIENT_ID</code> to the frontend environment before enabling live checkout.
        </div>
      </div>
    );
  }

  return (
    <div className="card card-pad card-light surface-light">
      <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div className="h2">Pay With PayPal</div>
          <div className="surface-light-helper" style={{ marginTop: 6, lineHeight: 1.6 }}>
            Vitality will receive the full payment now. Physician earnings are tracked internally in the payout ledger after capture.
          </div>
        </div>
        <div className="v-chip">{props.amountLabel}</div>
      </div>

      <div className="space" />

      {props.disabled ? (
        <div className="muted" style={{ lineHeight: 1.6 }}>
          Complete the service selection and checkout requirements before payment can start for {props.serviceName}.
        </div>
      ) : null}

      {loading && !props.disabled ? <div className="muted">Loading PayPal checkout...</div> : null}
      {error ? <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div> : null}

      {!props.disabled ? <div ref={containerRef} /> : null}
    </div>
  );
}
