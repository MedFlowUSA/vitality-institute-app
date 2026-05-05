import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import { useAuth } from "../auth/AuthProvider";
import { loadRevenueSplitRules, saveRevenueSplitRule } from "../lib/payments/client";
import type { RevenueSplitRuleRow } from "../lib/payments/types";
import { supabase } from "../lib/supabase";

type ProviderRow = { id: string; first_name: string | null; last_name: string | null };
type ClinicRow = { id: string; name: string; brand_name: string | null };
type ServiceRow = { id: string; name: string; category: string | null };

type RuleFormState = {
  id?: string;
  provider_id: string;
  clinic_id: string;
  service_id: string;
  service_category: string;
  physician_percentage: string;
  vitality_percentage: string;
  active: boolean;
  effective_start_date: string;
  effective_end_date: string;
  notes: string;
};

const EMPTY_FORM: RuleFormState = {
  provider_id: "",
  clinic_id: "",
  service_id: "",
  service_category: "",
  physician_percentage: "0",
  vitality_percentage: "100",
  active: true,
  effective_start_date: new Date().toISOString().slice(0, 10),
  effective_end_date: "",
  notes: "",
};

function providerLabel(provider: ProviderRow | null) {
  if (!provider) return "Provider default";
  return [provider.first_name, provider.last_name].filter(Boolean).join(" ").trim() || provider.id;
}

function describeRule(rule: RevenueSplitRuleRow, providers: Record<string, ProviderRow>, clinics: Record<string, ClinicRow>, services: Record<string, ServiceRow>) {
  const parts: string[] = [];
  if (rule.provider_id) parts.push(providerLabel(providers[rule.provider_id] ?? null));
  if (rule.clinic_id) parts.push(clinics[rule.clinic_id] ? clinics[rule.clinic_id].brand_name ?? clinics[rule.clinic_id].name : rule.clinic_id);
  if (rule.service_id) parts.push(services[rule.service_id]?.name ?? rule.service_id);
  if (!rule.service_id && rule.service_category) parts.push(rule.service_category);
  if (parts.length === 0) return "Global default";
  return parts.join(" • ");
}

export default function RevenueSplitSettingsPage() {
  const { signOut } = useAuth();
  const [rules, setRules] = useState<RevenueSplitRuleRow[]>([]);
  const [providers, setProviders] = useState<Record<string, ProviderRow>>({});
  const [clinics, setClinics] = useState<Record<string, ClinicRow>>({});
  const [services, setServices] = useState<Record<string, ServiceRow>>({});
  const [form, setForm] = useState<RuleFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [ruleRows, providerRes, clinicRes, serviceRes] = await Promise.all([
          loadRevenueSplitRules(),
          supabase.from("profiles").select("id,first_name,last_name").in("role", ["provider"]),
          supabase.from("clinics").select("id,name,brand_name").order("name"),
          supabase.from("services").select("id,name,category").eq("is_active", true).order("name"),
        ]);

        if (providerRes.error) throw providerRes.error;
        if (clinicRes.error) throw clinicRes.error;
        if (serviceRes.error) throw serviceRes.error;

        setRules(ruleRows);
        setProviders(Object.fromEntries((((providerRes.data as ProviderRow[] | null) ?? []).map((row) => [row.id, row]))));
        setClinics(Object.fromEntries((((clinicRes.data as ClinicRow[] | null) ?? []).map((row) => [row.id, row]))));
        setServices(Object.fromEntries((((serviceRes.data as ServiceRow[] | null) ?? []).map((row) => [row.id, row]))));
      } catch (loadError: unknown) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load revenue split settings.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => `${describeRule(a, providers, clinics, services)}`.localeCompare(describeRule(b, providers, clinics, services))),
    [rules, providers, clinics, services]
  );

  async function submitRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const physician = Number(form.physician_percentage);
      const vitality = Number(form.vitality_percentage);

      if (Number.isNaN(physician) || Number.isNaN(vitality)) {
        throw new Error("Enter numeric percentage values for both sides of the split.");
      }

      if (Math.round((physician + vitality) * 100) !== 10000) {
        throw new Error("Physician and Vitality percentages must add up to 100%.");
      }

      const saved = await saveRevenueSplitRule({
        id: form.id,
        provider_id: form.provider_id || null,
        clinic_id: form.clinic_id || null,
        service_id: form.service_id || null,
        service_category: form.service_category || null,
        physician_percentage: physician,
        vitality_percentage: vitality,
        active: form.active,
        effective_start_date: form.effective_start_date,
        effective_end_date: form.effective_end_date || null,
        notes: form.notes || null,
      });

      setRules((current) => {
        const withoutCurrent = current.filter((row) => row.id !== saved.id);
        return [saved, ...withoutCurrent];
      });
      setForm(EMPTY_FORM);
      setSuccess("Revenue split rule saved.");
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save split rule.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Revenue Split Settings"
          subtitle="Define how physician/provider earnings are calculated after Vitality captures the patient payment."
          secondaryCta={{ label: "Back To Admin", to: "/admin" }}
          rightActions={
            <>
              <Link className="btn btn-secondary" to="/admin/payments">
                Payments
              </Link>
              <Link className="btn btn-secondary" to="/admin/payouts">
                Payout Ledger
              </Link>
              <button className="btn btn-secondary" type="button" onClick={signOut}>
                Sign out
              </button>
            </>
          }
          showKpis={false}
        />

        <div className="space" />

        <div className="row" style={{ gap: 12, alignItems: "start", flexWrap: "wrap" }}>
          <div className="card card-pad" style={{ flex: "1 1 360px", minWidth: 320 }}>
            <div className="h2">Create Or Edit Split Rule</div>
            <div className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
              Precedence: provider + service, provider + category, clinic + service, clinic + category, provider default, clinic default, then 0% physician / 100% Vitality fallback.
            </div>

            <div className="space" />

            <form onSubmit={submitRule}>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 220px" }}>
                  <div className="muted" style={{ fontSize: 12 }}>Clinic</div>
                  <select className="input" value={form.clinic_id} onChange={(event) => setForm((current) => ({ ...current, clinic_id: event.target.value }))}>
                    <option value="">No clinic scope</option>
                    {Object.values(clinics).map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>{clinic.brand_name ?? clinic.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: "1 1 220px" }}>
                  <div className="muted" style={{ fontSize: 12 }}>Provider</div>
                  <select className="input" value={form.provider_id} onChange={(event) => setForm((current) => ({ ...current, provider_id: event.target.value }))}>
                    <option value="">Provider default not set</option>
                    {Object.values(providers).map((provider) => (
                      <option key={provider.id} value={provider.id}>{providerLabel(provider)}</option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: "1 1 220px" }}>
                  <div className="muted" style={{ fontSize: 12 }}>Service</div>
                  <select className="input" value={form.service_id} onChange={(event) => setForm((current) => ({ ...current, service_id: event.target.value }))}>
                    <option value="">No specific service</option>
                    {Object.values(services).map((service) => (
                      <option key={service.id} value={service.id}>{service.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: "1 1 220px" }}>
                  <div className="muted" style={{ fontSize: 12 }}>Service category</div>
                  <input className="input" value={form.service_category} onChange={(event) => setForm((current) => ({ ...current, service_category: event.target.value }))} placeholder="Example: iv_therapy" />
                </div>

                <div style={{ flex: "1 1 160px" }}>
                  <div className="muted" style={{ fontSize: 12 }}>Physician %</div>
                  <input className="input" type="number" min="0" max="100" step="0.01" value={form.physician_percentage} onChange={(event) => setForm((current) => ({ ...current, physician_percentage: event.target.value }))} />
                </div>

                <div style={{ flex: "1 1 160px" }}>
                  <div className="muted" style={{ fontSize: 12 }}>Vitality %</div>
                  <input className="input" type="number" min="0" max="100" step="0.01" value={form.vitality_percentage} onChange={(event) => setForm((current) => ({ ...current, vitality_percentage: event.target.value }))} />
                </div>

                <div style={{ flex: "1 1 180px" }}>
                  <div className="muted" style={{ fontSize: 12 }}>Effective start</div>
                  <input className="input" type="date" value={form.effective_start_date} onChange={(event) => setForm((current) => ({ ...current, effective_start_date: event.target.value }))} />
                </div>

                <div style={{ flex: "1 1 180px" }}>
                  <div className="muted" style={{ fontSize: 12 }}>Effective end</div>
                  <input className="input" type="date" value={form.effective_end_date} onChange={(event) => setForm((current) => ({ ...current, effective_end_date: event.target.value }))} />
                </div>
              </div>

              <div className="space" />

              <textarea className="input" rows={4} placeholder="Notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />

              <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
                  Active rule
                </label>

                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-secondary" type="button" onClick={() => setForm(EMPTY_FORM)}>
                    Reset
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? "Saving..." : form.id ? "Update Rule" : "Create Rule"}
                  </button>
                </div>
              </div>
            </form>

            {error ? <div style={{ color: "crimson", marginTop: 12 }}>{error}</div> : null}
            {success ? <div style={{ color: "#166534", marginTop: 12 }}>{success}</div> : null}
          </div>

          <div className="card card-pad" style={{ flex: "1 1 420px", minWidth: 320 }}>
            <div className="h2">Existing Rules</div>
            <div className="space" />

            {loading ? <div className="muted">Loading split rules...</div> : null}
            {!loading && sortedRules.length === 0 ? <div className="muted">No split rules are configured yet. The system will fall back to 0% physician and 100% Vitality until you add one.</div> : null}

            {!loading && sortedRules.length > 0 ? (
              <div style={{ display: "grid", gap: 12 }}>
                {sortedRules.map((rule) => (
                  <div key={rule.id} className="card card-pad card-light surface-light">
                    <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 260px" }}>
                        <div className="h2" style={{ margin: 0 }}>{describeRule(rule, providers, clinics, services)}</div>
                        <div className="muted" style={{ marginTop: 6, lineHeight: 1.8 }}>
                          {rule.physician_percentage}% physician / {rule.vitality_percentage}% Vitality
                          <br />
                          Effective: {rule.effective_start_date}{rule.effective_end_date ? ` to ${rule.effective_end_date}` : " onward"}
                          <br />
                          Status: {rule.active ? "Active" : "Inactive"}
                        </div>
                        {rule.notes ? <div className="muted" style={{ marginTop: 8 }}>{rule.notes}</div> : null}
                      </div>

                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() =>
                          setForm({
                            id: rule.id,
                            provider_id: rule.provider_id ?? "",
                            clinic_id: rule.clinic_id ?? "",
                            service_id: rule.service_id ?? "",
                            service_category: rule.service_category ?? "",
                            physician_percentage: String(rule.physician_percentage),
                            vitality_percentage: String(rule.vitality_percentage),
                            active: rule.active,
                            effective_start_date: rule.effective_start_date,
                            effective_end_date: rule.effective_end_date ?? "",
                            notes: rule.notes ?? "",
                          })
                        }
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
