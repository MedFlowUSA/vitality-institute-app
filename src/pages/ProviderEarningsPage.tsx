import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import ProviderWorkspaceNav from "../components/provider/ProviderWorkspaceNav";
import { useAuth } from "../auth/AuthProvider";
import { formatPaymentCurrency, getProviderEarningsPatientLabel } from "../lib/payments/revenue";
import type { PaymentTransactionRow, ProviderPayoutLedgerRow } from "../lib/payments/types";
import { PROVIDER_ROUTES } from "../lib/providerRoutes";
import { supabase } from "../lib/supabase";

type PatientRow = { id: string; first_name: string | null; last_name: string | null };
type ServiceRow = { id: string; name: string };

export default function ProviderEarningsPage() {
  const { signOut } = useAuth();
  const [ledgerRows, setLedgerRows] = useState<ProviderPayoutLedgerRow[]>([]);
  const [payments, setPayments] = useState<Record<string, PaymentTransactionRow>>({});
  const [patients, setPatients] = useState<Record<string, PatientRow>>({});
  const [services, setServices] = useState<Record<string, ServiceRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: rows, error: ledgerError } = await supabase
          .from("provider_payout_ledger")
          .select("id,payment_transaction_id,provider_id,clinic_id,service_id,gross_amount_cents,net_amount_cents,physician_percentage,vitality_percentage,physician_share_cents,vitality_share_cents,payout_status,payout_method,payout_reference,paid_at,admin_notes,created_at,updated_at")
          .order("created_at", { ascending: false })
          .limit(250);

        if (ledgerError) throw ledgerError;

        const nextRows = (rows as ProviderPayoutLedgerRow[] | null) ?? [];
        setLedgerRows(nextRows);

        const paymentIds = Array.from(new Set(nextRows.map((row) => row.payment_transaction_id).filter(Boolean))) as string[];
        const serviceIds = Array.from(new Set(nextRows.map((row) => row.service_id).filter(Boolean))) as string[];

        const [{ data: paymentRows, error: paymentError }, { data: serviceRows, error: serviceError }] = await Promise.all([
          paymentIds.length
            ? supabase
                .from("payment_transactions")
                .select("id,patient_id,appointment_id,service_id,provider_id,clinic_id,location_id,payment_provider,provider_transaction_id,gross_amount_cents,platform_fee_cents,processing_fee_cents,net_amount_cents,currency,payment_status,checkout_status,metadata,created_at,updated_at")
                .in("id", paymentIds)
            : Promise.resolve({ data: [], error: null }),
          serviceIds.length
            ? supabase.from("services").select("id,name").in("id", serviceIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (paymentError) throw paymentError;
        if (serviceError) throw serviceError;

        const paymentMap = Object.fromEntries((((paymentRows as PaymentTransactionRow[] | null) ?? []).map((row) => [row.id, row])));
        setPayments(paymentMap);
        setServices(Object.fromEntries((((serviceRows as ServiceRow[] | null) ?? []).map((row) => [row.id, row]))));

        const patientIds = Array.from(
          new Set(
            (((paymentRows as PaymentTransactionRow[] | null) ?? [])
              .map((row) => row.patient_id)
              .filter(Boolean))
          )
        ) as string[];

        if (patientIds.length) {
          const { data: patientRows, error: patientError } = await supabase
            .from("patients")
            .select("id,first_name,last_name")
            .in("id", patientIds);
          if (patientError) throw patientError;
          setPatients(Object.fromEntries((((patientRows as PatientRow[] | null) ?? []).map((row) => [row.id, row]))));
        } else {
          setPatients({});
        }
      } catch (loadError: unknown) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load earnings.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filteredRows = useMemo(() => {
    return ledgerRows.filter((row) => (statusFilter ? row.payout_status === statusFilter : true));
  }, [ledgerRows, statusFilter]);

  const pendingTotal = useMemo(
    () => filteredRows.filter((row) => row.payout_status === "pending" || row.payout_status === "approved").reduce((sum, row) => sum + row.physician_share_cents, 0),
    [filteredRows]
  );
  const paidTotal = useMemo(
    () => filteredRows.filter((row) => row.payout_status === "paid").reduce((sum, row) => sum + row.physician_share_cents, 0),
    [filteredRows]
  );

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Provider Earnings"
          subtitle="Track your pending and paid Vitality payout ledger entries without exposing platform-wide finance data."
          secondaryCta={{ label: "Back To Dashboard", to: PROVIDER_ROUTES.home }}
          rightActions={
            <>
              <Link className="btn btn-secondary" to="/how-to-use-the-app">
                User Guide
              </Link>
              <button className="btn btn-secondary" type="button" onClick={signOut}>
                Sign out
              </button>
            </>
          }
          showKpis={false}
        />

        <div className="space" />

        <ProviderWorkspaceNav compact />

        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <div style={{ flex: "1 1 220px" }}>
              <div className="muted" style={{ fontSize: 12 }}>Status</div>
              <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="held">Held</option>
                <option value="refunded">Refunded</option>
                <option value="disputed">Disputed</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space" />

        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <div className="card card-pad card-light surface-light" style={{ flex: "1 1 220px" }}>
            <div className="muted" style={{ fontSize: 12 }}>Visible earnings rows</div>
            <div className="h1" style={{ marginTop: 8 }}>{filteredRows.length}</div>
          </div>
          <div className="card card-pad card-light surface-light" style={{ flex: "1 1 220px" }}>
            <div className="muted" style={{ fontSize: 12 }}>Pending / approved</div>
            <div className="h1" style={{ marginTop: 8 }}>{formatPaymentCurrency(pendingTotal)}</div>
          </div>
          <div className="card card-pad card-light surface-light" style={{ flex: "1 1 220px" }}>
            <div className="muted" style={{ fontSize: 12 }}>Paid</div>
            <div className="h1" style={{ marginTop: 8 }}>{formatPaymentCurrency(paidTotal)}</div>
          </div>
        </div>

        <div className="space" />

        <div className="card card-pad">
          {loading ? <div className="muted">Loading earnings...</div> : null}
          {error ? <div style={{ color: "crimson" }}>{error}</div> : null}

          {!loading && !error && filteredRows.length === 0 ? <div className="muted">No earnings rows are available for the selected status.</div> : null}

          {!loading && !error && filteredRows.length > 0 ? (
            <div style={{ display: "grid", gap: 12 }}>
              {filteredRows.map((row) => {
                const payment = payments[row.payment_transaction_id] ?? null;
                const patient = payment?.patient_id ? patients[payment.patient_id] ?? null : null;
                const service = row.service_id ? services[row.service_id] ?? null : payment?.service_id ? services[payment.service_id] ?? null : null;

                return (
                  <div key={row.id} className="card card-pad card-light surface-light">
                    <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 320px" }}>
                        <div className="h2" style={{ margin: 0 }}>{service?.name ?? "Vitality service"}</div>
                        <div className="muted" style={{ marginTop: 6, lineHeight: 1.8 }}>
                          Patient: <strong>{getProviderEarningsPatientLabel(patient?.first_name, patient?.last_name, payment?.patient_id ?? row.payment_transaction_id)}</strong>
                          <br />
                          Earned: <strong>{new Date(row.created_at).toLocaleDateString()}</strong>
                          <br />
                          Status: <strong>{row.payout_status}</strong>
                        </div>
                      </div>

                      <div style={{ minWidth: 220 }}>
                        <div className="muted" style={{ fontSize: 12 }}>Amount owed</div>
                        <div className="h2" style={{ marginTop: 4 }}>{formatPaymentCurrency(row.physician_share_cents, payment?.currency ?? "USD")}</div>
                        <div className="muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
                          Split: {row.physician_percentage}% physician / {row.vitality_percentage}% Vitality
                          <br />
                          Net basis: {formatPaymentCurrency(row.net_amount_cents, payment?.currency ?? "USD")}
                          <br />
                          {row.paid_at ? `Paid at: ${new Date(row.paid_at).toLocaleString()}` : "Awaiting payout release"}
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
