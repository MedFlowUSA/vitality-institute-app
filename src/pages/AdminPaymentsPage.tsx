import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import type { PaymentTransactionRow } from "../lib/payments/types";
import { formatPaymentCurrency } from "../lib/payments/revenue";

type ProviderRow = { id: string; first_name: string | null; last_name: string | null };
type ClinicRow = { id: string; name: string; brand_name: string | null };
type LocationRow = { id: string; name: string; city: string | null; state: string | null };
type ServiceRow = { id: string; name: string; category: string | null };

function providerLabel(provider: ProviderRow | null) {
  if (!provider) return "Unassigned";
  return [provider.first_name, provider.last_name].filter(Boolean).join(" ").trim() || provider.id;
}

function locationLabel(location: LocationRow | null) {
  if (!location) return "Unknown location";
  const place = [location.city, location.state].filter(Boolean).join(", ");
  return place ? `${location.name} - ${place}` : location.name;
}

function paymentTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "completed") return { bg: "rgba(34,197,94,0.12)", color: "#166534" };
  if (normalized === "refunded" || normalized === "disputed") return { bg: "rgba(239,68,68,0.12)", color: "#991b1b" };
  if (normalized === "failed" || normalized === "denied") return { bg: "rgba(245,158,11,0.15)", color: "#92400e" };
  return { bg: "rgba(91,78,134,0.12)", color: "#5B4E86" };
}

export default function AdminPaymentsPage() {
  const { signOut } = useAuth();
  const [payments, setPayments] = useState<PaymentTransactionRow[]>([]);
  const [providers, setProviders] = useState<Record<string, ProviderRow>>({});
  const [clinics, setClinics] = useState<Record<string, ClinicRow>>({});
  const [locations, setLocations] = useState<Record<string, LocationRow>>({});
  const [services, setServices] = useState<Record<string, ServiceRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providerFilter, setProviderFilter] = useState("");
  const [clinicFilter, setClinicFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [checkoutStatusFilter, setCheckoutStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: paymentRows, error: paymentError } = await supabase
          .from("payment_transactions")
          .select("id,patient_id,appointment_id,service_id,provider_id,clinic_id,location_id,payment_provider,provider_transaction_id,gross_amount_cents,platform_fee_cents,processing_fee_cents,net_amount_cents,currency,payment_status,checkout_status,metadata,created_at,updated_at")
          .order("created_at", { ascending: false })
          .limit(250);

        if (paymentError) throw paymentError;

        const nextPayments = (paymentRows as PaymentTransactionRow[] | null) ?? [];
        setPayments(nextPayments);

        const providerIds = Array.from(new Set(nextPayments.map((row) => row.provider_id).filter(Boolean))) as string[];
        const clinicIds = Array.from(new Set(nextPayments.map((row) => row.clinic_id).filter(Boolean))) as string[];
        const locationIds = Array.from(new Set(nextPayments.map((row) => row.location_id).filter(Boolean))) as string[];
        const serviceIds = Array.from(new Set(nextPayments.map((row) => row.service_id).filter(Boolean))) as string[];

        const [
          { data: providerRows, error: providerError },
          { data: clinicRows, error: clinicError },
          { data: locationRows, error: locationError },
          { data: serviceRows, error: serviceError },
        ] = await Promise.all([
          providerIds.length
            ? supabase.from("profiles").select("id,first_name,last_name").in("id", providerIds)
            : Promise.resolve({ data: [], error: null }),
          clinicIds.length
            ? supabase.from("clinics").select("id,name,brand_name").in("id", clinicIds)
            : Promise.resolve({ data: [], error: null }),
          locationIds.length
            ? supabase.from("locations").select("id,name,city,state").in("id", locationIds)
            : Promise.resolve({ data: [], error: null }),
          serviceIds.length
            ? supabase.from("services").select("id,name,category").in("id", serviceIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (providerError) throw providerError;
        if (clinicError) throw clinicError;
        if (locationError) throw locationError;
        if (serviceError) throw serviceError;

        setProviders(
          Object.fromEntries((((providerRows as ProviderRow[] | null) ?? []).map((row) => [row.id, row])))
        );
        setClinics(
          Object.fromEntries((((clinicRows as ClinicRow[] | null) ?? []).map((row) => [row.id, row])))
        );
        setLocations(
          Object.fromEntries((((locationRows as LocationRow[] | null) ?? []).map((row) => [row.id, row])))
        );
        setServices(
          Object.fromEntries((((serviceRows as ServiceRow[] | null) ?? []).map((row) => [row.id, row])))
        );
      } catch (loadError: unknown) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load payments.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      if (providerFilter && payment.provider_id !== providerFilter) return false;
      if (clinicFilter && payment.clinic_id !== clinicFilter) return false;
      if (paymentStatusFilter && payment.payment_status !== paymentStatusFilter) return false;
      if (checkoutStatusFilter && payment.checkout_status !== checkoutStatusFilter) return false;
      if (dateFrom && payment.created_at.slice(0, 10) < dateFrom) return false;
      if (dateTo && payment.created_at.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [checkoutStatusFilter, clinicFilter, dateFrom, dateTo, paymentStatusFilter, payments, providerFilter]);

  const totals = useMemo(() => {
    return filteredPayments.reduce(
      (acc, payment) => {
        acc.gross += payment.gross_amount_cents;
        acc.net += payment.net_amount_cents;
        return acc;
      },
      { gross: 0, net: 0 }
    );
  }, [filteredPayments]);

  const providerOptions = useMemo(
    () =>
      Object.values(providers).sort((a, b) => providerLabel(a).localeCompare(providerLabel(b))),
    [providers]
  );
  const clinicOptions = useMemo(
    () => Object.values(clinics).sort((a, b) => (a.brand_name ?? a.name).localeCompare(b.brand_name ?? b.name)),
    [clinics]
  );

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Admin Payments"
          subtitle="Review captured Vitality checkout transactions before payout review and reconciliation."
          secondaryCta={{ label: "Back To Admin", to: "/admin" }}
          rightActions={
            <>
              <Link className="btn btn-secondary" to="/admin/payouts">
                Payout Ledger
              </Link>
              <Link className="btn btn-secondary" to="/admin/revenue-splits">
                Split Rules
              </Link>
              <button className="btn btn-secondary" type="button" onClick={signOut}>
                Sign out
              </button>
            </>
          }
          showKpis={false}
        />

        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <div style={{ flex: "1 1 180px" }}>
              <div className="muted" style={{ fontSize: 12 }}>Provider</div>
              <select className="input" value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
                <option value="">All providers</option>
                {providerOptions.map((provider) => (
                  <option key={provider.id} value={provider.id}>{providerLabel(provider)}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: "1 1 180px" }}>
              <div className="muted" style={{ fontSize: 12 }}>Clinic</div>
              <select className="input" value={clinicFilter} onChange={(event) => setClinicFilter(event.target.value)}>
                <option value="">All clinics</option>
                {clinicOptions.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>{clinic.brand_name ?? clinic.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <div className="muted" style={{ fontSize: 12 }}>Payment status</div>
              <select className="input" value={paymentStatusFilter} onChange={(event) => setPaymentStatusFilter(event.target.value)}>
                <option value="">All payment states</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
                <option value="disputed">Disputed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <div className="muted" style={{ fontSize: 12 }}>Checkout status</div>
              <select className="input" value={checkoutStatusFilter} onChange={(event) => setCheckoutStatusFilter(event.target.value)}>
                <option value="">All checkout states</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
                <option value="disputed">Disputed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <div className="muted" style={{ fontSize: 12 }}>From</div>
              <input className="input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <div className="muted" style={{ fontSize: 12 }}>To</div>
              <input className="input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>
          </div>
        </div>

        <div className="space" />

        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <div className="card card-pad card-light surface-light" style={{ flex: "1 1 220px" }}>
            <div className="muted" style={{ fontSize: 12 }}>Transactions</div>
            <div className="h1" style={{ marginTop: 8 }}>{filteredPayments.length}</div>
          </div>
          <div className="card card-pad card-light surface-light" style={{ flex: "1 1 220px" }}>
            <div className="muted" style={{ fontSize: 12 }}>Gross captured</div>
            <div className="h1" style={{ marginTop: 8 }}>{formatPaymentCurrency(totals.gross)}</div>
          </div>
          <div className="card card-pad card-light surface-light" style={{ flex: "1 1 220px" }}>
            <div className="muted" style={{ fontSize: 12 }}>Net ledger basis</div>
            <div className="h1" style={{ marginTop: 8 }}>{formatPaymentCurrency(totals.net)}</div>
          </div>
        </div>

        <div className="space" />

        <div className="card card-pad">
          {loading ? <div className="muted">Loading payments...</div> : null}
          {error ? <div style={{ color: "crimson" }}>{error}</div> : null}

          {!loading && !error && filteredPayments.length === 0 ? (
            <div className="muted">No payments match the current filters.</div>
          ) : null}

          {!loading && !error && filteredPayments.length > 0 ? (
            <div style={{ display: "grid", gap: 12 }}>
              {filteredPayments.map((payment) => {
                const statusStyles = paymentTone(payment.payment_status);
                const provider = payment.provider_id ? providers[payment.provider_id] ?? null : null;
                const clinic = payment.clinic_id ? clinics[payment.clinic_id] ?? null : null;
                const location = payment.location_id ? locations[payment.location_id] ?? null : null;
                const service = payment.service_id ? services[payment.service_id] ?? null : null;

                return (
                  <div key={payment.id} className="card card-pad card-light surface-light">
                    <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
                      <div style={{ flex: "1 1 360px" }}>
                        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <div className="h2" style={{ margin: 0 }}>{service?.name ?? "Vitality service"}</div>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: 999,
                              background: statusStyles.bg,
                              color: statusStyles.color,
                              fontSize: 12,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              letterSpacing: ".06em",
                            }}
                          >
                            {payment.payment_status}
                          </span>
                          <span className="v-chip">{payment.checkout_status}</span>
                        </div>

                        <div className="muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
                          Provider: <strong>{providerLabel(provider)}</strong>
                          <br />
                          Clinic: <strong>{clinic ? clinic.brand_name ?? clinic.name : "Pending clinic resolution"}</strong>
                          <br />
                          Location: <strong>{locationLabel(location)}</strong>
                          <br />
                          Captured: <strong>{new Date(payment.created_at).toLocaleString()}</strong>
                        </div>
                      </div>

                      <div style={{ minWidth: 220 }}>
                        <div className="muted" style={{ fontSize: 12 }}>Gross</div>
                        <div className="h2" style={{ marginTop: 4 }}>{formatPaymentCurrency(payment.gross_amount_cents, payment.currency)}</div>
                        <div className="muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
                          Processing fee: {formatPaymentCurrency(payment.processing_fee_cents, payment.currency)}
                          <br />
                          Net: {formatPaymentCurrency(payment.net_amount_cents, payment.currency)}
                          <br />
                          PayPal capture: {payment.provider_transaction_id ?? "Pending"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
