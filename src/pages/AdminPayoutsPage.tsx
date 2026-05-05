import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import { useAuth } from "../auth/AuthProvider";
import { updateProviderPayoutLedger } from "../lib/payments/client";
import { formatPaymentCurrency } from "../lib/payments/revenue";
import type { PaymentTransactionRow, ProviderPayoutLedgerRow } from "../lib/payments/types";
import { supabase } from "../lib/supabase";

type ProviderRow = { id: string; first_name: string | null; last_name: string | null };
type ServiceRow = { id: string; name: string };

type EditableState = {
  payout_status: string;
  payout_method: string;
  payout_reference: string;
  admin_notes: string;
};

function providerLabel(provider: ProviderRow | null) {
  if (!provider) return "Unassigned provider";
  return [provider.first_name, provider.last_name].filter(Boolean).join(" ").trim() || provider.id;
}

export default function AdminPayoutsPage() {
  const { signOut } = useAuth();
  const [ledgerRows, setLedgerRows] = useState<ProviderPayoutLedgerRow[]>([]);
  const [providers, setProviders] = useState<Record<string, ProviderRow>>({});
  const [services, setServices] = useState<Record<string, ServiceRow>>({});
  const [transactions, setTransactions] = useState<Record<string, PaymentTransactionRow>>({});
  const [drafts, setDrafts] = useState<Record<string, EditableState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");

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

        const nextLedgerRows = (rows as ProviderPayoutLedgerRow[] | null) ?? [];
        setLedgerRows(nextLedgerRows);
        setDrafts(
          Object.fromEntries(
            nextLedgerRows.map((row) => [
              row.id,
              {
                payout_status: row.payout_status,
                payout_method: row.payout_method ?? "",
                payout_reference: row.payout_reference ?? "",
                admin_notes: row.admin_notes ?? "",
              },
            ])
          )
        );

        const providerIds = Array.from(new Set(nextLedgerRows.map((row) => row.provider_id).filter(Boolean))) as string[];
        const serviceIds = Array.from(new Set(nextLedgerRows.map((row) => row.service_id).filter(Boolean))) as string[];
        const transactionIds = Array.from(new Set(nextLedgerRows.map((row) => row.payment_transaction_id).filter(Boolean))) as string[];

        const [
          { data: providerRows, error: providerError },
          { data: serviceRows, error: serviceError },
          { data: paymentRows, error: paymentError },
        ] = await Promise.all([
          providerIds.length
            ? supabase.from("profiles").select("id,first_name,last_name").in("id", providerIds)
            : Promise.resolve({ data: [], error: null }),
          serviceIds.length
            ? supabase.from("services").select("id,name").in("id", serviceIds)
            : Promise.resolve({ data: [], error: null }),
          transactionIds.length
            ? supabase
                .from("payment_transactions")
                .select("id,patient_id,appointment_id,service_id,provider_id,clinic_id,location_id,payment_provider,provider_transaction_id,gross_amount_cents,platform_fee_cents,processing_fee_cents,net_amount_cents,currency,payment_status,checkout_status,metadata,created_at,updated_at")
                .in("id", transactionIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (providerError) throw providerError;
        if (serviceError) throw serviceError;
        if (paymentError) throw paymentError;

        setProviders(Object.fromEntries((((providerRows as ProviderRow[] | null) ?? []).map((row) => [row.id, row]))));
        setServices(Object.fromEntries((((serviceRows as ServiceRow[] | null) ?? []).map((row) => [row.id, row]))));
        setTransactions(
          Object.fromEntries((((paymentRows as PaymentTransactionRow[] | null) ?? []).map((row) => [row.id, row])))
        );
      } catch (loadError: unknown) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load payout ledger.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filteredRows = useMemo(() => {
    return ledgerRows.filter((row) => {
      if (statusFilter && row.payout_status !== statusFilter) return false;
      if (providerFilter && row.provider_id !== providerFilter) return false;
      return true;
    });
  }, [ledgerRows, providerFilter, statusFilter]);

  const providerOptions = useMemo(
    () => Object.values(providers).sort((a, b) => providerLabel(a).localeCompare(providerLabel(b))),
    [providers]
  );

  const pendingTotal = useMemo(
    () => filteredRows.filter((row) => row.payout_status === "pending" || row.payout_status === "approved").reduce((sum, row) => sum + row.physician_share_cents, 0),
    [filteredRows]
  );

  const paidTotal = useMemo(
    () => filteredRows.filter((row) => row.payout_status === "paid").reduce((sum, row) => sum + row.physician_share_cents, 0),
    [filteredRows]
  );

  async function saveRow(row: ProviderPayoutLedgerRow) {
    const draft = drafts[row.id];
    if (!draft) return;

    setSavingId(row.id);
    setError(null);

    try {
      const paidAt = draft.payout_status === "paid" ? row.paid_at ?? new Date().toISOString() : null;
      const updated = await updateProviderPayoutLedger(row.id, {
        payout_status: draft.payout_status,
        payout_method: draft.payout_method || null,
        payout_reference: draft.payout_reference || null,
        admin_notes: draft.admin_notes || null,
        paid_at: paidAt,
      });

      setLedgerRows((current) => current.map((item) => (item.id === row.id ? updated : item)));
      setDrafts((current) => ({
        ...current,
        [row.id]: {
          payout_status: updated.payout_status,
          payout_method: updated.payout_method ?? "",
          payout_reference: updated.payout_reference ?? "",
          admin_notes: updated.admin_notes ?? "",
        },
      }));
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update payout ledger.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Admin Payout Ledger"
          subtitle="Approve, hold, and mark physician revenue-share payouts after Vitality receives the full PayPal payment."
          secondaryCta={{ label: "Back To Admin", to: "/admin" }}
          rightActions={
            <>
              <Link className="btn btn-secondary" to="/admin/payments">
                Payments
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
            <div style={{ flex: "1 1 200px" }}>
              <div className="muted" style={{ fontSize: 12 }}>Provider</div>
              <select className="input" value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
                <option value="">All providers</option>
                {providerOptions.map((provider) => (
                  <option key={provider.id} value={provider.id}>{providerLabel(provider)}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <div className="muted" style={{ fontSize: 12 }}>Payout status</div>
              <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All payout states</option>
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
            <div className="muted" style={{ fontSize: 12 }}>Ledger rows</div>
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
          {loading ? <div className="muted">Loading payout ledger...</div> : null}
          {error ? <div style={{ color: "crimson" }}>{error}</div> : null}

          {!loading && !error && filteredRows.length === 0 ? <div className="muted">No payout rows match the current filters.</div> : null}

          {!loading && !error && filteredRows.length > 0 ? (
            <div style={{ display: "grid", gap: 12 }}>
              {filteredRows.map((row) => {
                const payment = transactions[row.payment_transaction_id] ?? null;
                const provider = providers[row.provider_id] ?? null;
                const service = row.service_id ? services[row.service_id] ?? null : payment?.service_id ? services[payment.service_id] ?? null : null;
                const draft = drafts[row.id];

                return (
                  <div key={row.id} className="card card-pad card-light surface-light">
                    <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 320px" }}>
                        <div className="h2" style={{ margin: 0 }}>{providerLabel(provider)}</div>
                        <div className="muted" style={{ marginTop: 6, lineHeight: 1.8 }}>
                          Service: <strong>{service?.name ?? "Vitality service"}</strong>
                          <br />
                          Payment: <strong>{payment?.provider_transaction_id ?? row.payment_transaction_id}</strong>
                          <br />
                          Created: <strong>{new Date(row.created_at).toLocaleString()}</strong>
                        </div>

                        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                          <span className="v-chip">Physician share {formatPaymentCurrency(row.physician_share_cents)}</span>
                          <span className="v-chip">Vitality share {formatPaymentCurrency(row.vitality_share_cents)}</span>
                          <span className="v-chip">{row.physician_percentage}% / {row.vitality_percentage}%</span>
                        </div>
                      </div>

                      <div style={{ flex: "1 1 320px", minWidth: 280 }}>
                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          <select
                            className="input"
                            style={{ flex: "1 1 160px" }}
                            value={draft?.payout_status ?? row.payout_status}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [row.id]: {
                                  ...(current[row.id] ?? {
                                    payout_status: row.payout_status,
                                    payout_method: row.payout_method ?? "",
                                    payout_reference: row.payout_reference ?? "",
                                    admin_notes: row.admin_notes ?? "",
                                  }),
                                  payout_status: event.target.value,
                                },
                              }))
                            }
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="paid">Paid</option>
                            <option value="held">Held</option>
                            <option value="refunded">Refunded</option>
                            <option value="disputed">Disputed</option>
                            <option value="canceled">Canceled</option>
                          </select>
                          <input
                            className="input"
                            style={{ flex: "1 1 140px" }}
                            placeholder="Payout method"
                            value={draft?.payout_method ?? ""}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [row.id]: { ...current[row.id], payout_method: event.target.value },
                              }))
                            }
                          />
                          <input
                            className="input"
                            style={{ flex: "1 1 160px" }}
                            placeholder="Reference"
                            value={draft?.payout_reference ?? ""}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [row.id]: { ...current[row.id], payout_reference: event.target.value },
                              }))
                            }
                          />
                        </div>

                        <div className="space" />

                        <textarea
                          className="input"
                          rows={3}
                          placeholder="Admin notes"
                          value={draft?.admin_notes ?? ""}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [row.id]: { ...current[row.id], admin_notes: event.target.value },
                            }))
                          }
                        />

                        <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                          <div className="muted" style={{ fontSize: 12 }}>
                            Paid at: {row.paid_at ? new Date(row.paid_at).toLocaleString() : "Not marked paid"}
                          </div>
                          <button className="btn btn-primary" type="button" disabled={savingId === row.id} onClick={() => void saveRow(row)}>
                            {savingId === row.id ? "Saving..." : "Save payout update"}
                          </button>
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
