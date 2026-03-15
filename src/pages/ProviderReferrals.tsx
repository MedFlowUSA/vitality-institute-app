// src/pages/ProviderReferrals.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import VitalityHero from "../components/VitalityHero";
import SystemStatusBar from "../components/SystemStatusBar";

type ReferralRow = {
  id: string;
  created_at: string;
  created_by: string;
  location_id: string;
  patient_id: string;

  first_name: string | null;
  last_name: string | null;
  phone: string | null;

  status: string | null;

  source_type: string | null;
  source_name: string | null;
  referral_source_type: string | null;
  referral_source_name: string | null;

  wound_type: string | null;
  wound_location: string | null;
  wound_duration_weeks: number | null;
  has_infection: boolean | null;
  has_cellulitis: boolean | null;
  has_osteomyelitis: boolean | null;
  pain_score: number | null;
  notes: string | null;
  reason: string | null;

  urgency_score: number | null;
  denial_risk_score: number | null;
  denial_risk_reasons: any;
  denial_reason_count: number | null;
};

const PROVIDER_ROLES = ["super_admin", "location_admin", "provider", "clinical_staff", "billing", "front_desk"] as const;

export default function ProviderReferrals() {
  const { user, role, activeLocationId } = useAuth();
  const nav = useNavigate();

  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [status, setStatus] = useState<string>("new");
  const [q, setQ] = useState("");

  const isAdmin = role === "super_admin" || role === "location_admin";

  const fullName = (r: ReferralRow) => {
    const n = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
    return n || "Patient";
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString();

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      if (!user?.id) throw new Error("Not signed in.");
      if (!role || !(PROVIDER_ROLES as readonly string[]).includes(role)) throw new Error("Not authorized.");

      let query = supabase
        .from("v_provider_referrals_queue")
        .select(
          `id,created_at,created_by,location_id,patient_id,
           first_name,last_name,phone,
           status,source_type,source_name,referral_source_type,referral_source_name,
           wound_type,wound_location,wound_duration_weeks,has_infection,has_cellulitis,has_osteomyelitis,pain_score,notes,reason,
           urgency_score,denial_risk_score,denial_risk_reasons,denial_reason_count`
        )
        .order("urgency_score", { ascending: false })
        .order("denial_risk_score", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(250);

      if (activeLocationId) query = query.eq("location_id", activeLocationId);
      if (!activeLocationId && !isAdmin) {
        // Non-admins rely on RLS to constrain visibility; no extra filter needed
      }

      if (status) query = query.eq("status", status);

      if (q.trim()) {
        const t = q.trim();
        query = query.or(
          `first_name.ilike.%${t}%,last_name.ilike.%${t}%,phone.ilike.%${t}%,source_name.ilike.%${t}%,wound_location.ilike.%${t}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      setRows((data as ReferralRow[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load referrals.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role, activeLocationId, status]);

  const setReferralStatus = async (referralId: string, nextStatus: string) => {
    setErr(null);
    try {
      const { error } = await supabase.from("referrals").update({ status: nextStatus }).eq("id", referralId);
      if (error) throw error;
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update referral status.");
    }
  };

  const convertToAppointment = async (r: ReferralRow) => {
    setErr(null);
    try {
      if (!r.location_id || !r.patient_id) throw new Error("Missing location_id or patient_id.");

      // Create an appointment request (provider can later approve/confirm)
      const start = new Date();
      start.setHours(start.getHours() + 24); // default: tomorrow-ish (adjust later in UI)

      const { data: appt, error: aErr } = await supabase
        .from("appointments")
        .insert([
          {
            patient_id: r.patient_id,
            location_id: r.location_id,
            service_id: null,
            start_time: start.toISOString(),
            status: "requested",
            visit_type: "in_person",
            telehealth_enabled: false,
            notes: `Converted from referral ${r.id}. ${r.reason ?? ""}`.trim(),
          },
        ])
        .select("id")
        .maybeSingle();

      if (aErr) throw aErr;
      if (!appt?.id) throw new Error("Appointment was not created.");

      // Move referral forward in workflow
      await setReferralStatus(r.id, "reviewing");

      // Open patient center (or command center) depending on your flow
      nav(`/provider/patients/${r.patient_id}`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to convert referral to appointment.");
    }
  };

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Referrals"
          subtitle="Hospital-grade referral inbox - urgency + denial-risk triage"
          secondaryCta={{ label: "Back", to: "/provider" }}
          primaryCta={{ label: "Command Center", to: "/provider/command" }}
          showKpis={false}
        />

        <SystemStatusBar />
        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ minWidth: 220 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Status</div>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%" }}>
                <option value="">All</option>
                <option value="new">new</option>
                <option value="reviewing">reviewing</option>
                <option value="scheduled">scheduled</option>
                <option value="closed">closed</option>
                <option value="denied">denied</option>
              </select>
            </div>

            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Search</div>
              <input
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Patient name, phone, source, wound location..."
                style={{ width: "100%" }}
                onKeyDown={(e) => (e.key === "Enter" ? load() : null)}
              />
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-primary" type="button" onClick={load} disabled={loading}>
                {loading ? "Loading..." : "Refresh"}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => { setQ(""); load(); }} disabled={loading}>
                Clear
              </button>
            </div>
          </div>

          {err ? <div style={{ color: "crimson", marginTop: 12 }}>{err}</div> : null}
        </div>

        <div className="space" />

        <div className="card card-pad">
          {loading ? (
            <div className="muted">Loading referrals...</div>
          ) : rows.length === 0 ? (
            <div className="muted">No referrals found.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {rows.map((r) => (
                <div key={r.id} className="card card-pad" style={{ background: "rgba(0,0,0,.18)" }}>
                  <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ flex: "1 1 520px" }}>
                      <div className="h2" style={{ margin: 0 }}>
                        {fullName(r)} - {r.wound_type ?? "-"} - {r.wound_location ?? "-"}
                      </div>
                      <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                        Created: <strong>{fmt(r.created_at)}</strong> - Status: <strong>{r.status ?? "-"}</strong>
                      </div>
                      <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                        Source: {r.source_name ?? "-"} {r.referral_source_name ? `- ${r.referral_source_name}` : ""}
                      </div>

                      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                        <div className="v-chip">Urgency: <strong>{r.urgency_score ?? 0}</strong></div>
                        <div className="v-chip">Denial risk: <strong>{r.denial_risk_score ?? 0}</strong></div>
                        <div className="v-chip">Reasons: <strong>{r.denial_reason_count ?? 0}</strong></div>
                        {r.has_infection ? <div className="v-chip">Flag: <strong>Infection</strong></div> : null}
                        {r.has_cellulitis ? <div className="v-chip">Flag: <strong>Cellulitis</strong></div> : null}
                        {r.has_osteomyelitis ? <div className="v-chip">Flag: <strong>Osteomyelitis</strong></div> : null}
                      </div>

                      {r.reason ? (
                        <div className="muted" style={{ marginTop: 10 }}>
                          Reason: {r.reason}
                        </div>
                      ) : null}
                    </div>

                    <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button className="btn btn-ghost" type="button" onClick={() => nav(`/provider/patients/${r.patient_id}`)}>
                        Open Patient
                      </button>

                      <button className="btn btn-primary" type="button" onClick={() => convertToAppointment(r)}>
                        Convert -&gt; Appointment
                      </button>

                      {r.status !== "reviewing" ? (
                        <button className="btn btn-ghost" type="button" onClick={() => setReferralStatus(r.id, "reviewing")}>
                          Mark Reviewing
                        </button>
                      ) : null}

                      <button className="btn btn-ghost" type="button" onClick={() => setReferralStatus(r.id, "closed")}>
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space" />
      </div>
    </div>
  );
}
