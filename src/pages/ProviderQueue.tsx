// src/pages/ProviderQueue.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import VitalityHero from "../components/VitalityHero";
import SystemStatusBar from "../components/SystemStatusBar";

type VisitRow = {
  id: string;
  patient_id: string;
  location_id: string;
  appointment_id: string | null;
  visit_date: string;
  status: string | null;
  summary: string | null;
  created_at: string;
};

type SoapMini = {
  id: string;
  visit_id: string;
  is_locked: boolean | null;
  is_signed: boolean | null;
  signed_at: string | null;
};

type LabMini = {
  id: string;
  visit_id: string | null;
  status: string;
};

export default function ProviderQueue() {
  const nav = useNavigate();
  const { user, role, signOut, activeLocationId } = useAuth();

  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [soapByVisit, setSoapByVisit] = useState<Record<string, SoapMini>>({});
  const [labsByVisit, setLabsByVisit] = useState<Record<string, LabMini[]>>({});

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const isStaff = role && role !== "patient";

  // Load queue for active location
  const loadQueue = async () => {
    if (!user?.id) return;
    if (!activeLocationId) {
      setVisits([]);
      setSoapByVisit({});
      setLabsByVisit({});
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      // Visits
      const { data: v, error: vErr } = await supabase
        .from("patient_visits")
        .select("id,patient_id,location_id,appointment_id,visit_date,status,summary,created_at")
        .eq("location_id", activeLocationId)
        .order("visit_date", { ascending: false })
        .limit(60);

      if (vErr) throw vErr;
      const visitRows = (v as VisitRow[]) ?? [];
      setVisits(visitRows);

      const visitIds = visitRows.map((x) => x.id);

      // SOAP minis
      if (visitIds.length) {
        const { data: s, error: sErr } = await supabase
          .from("patient_soap_notes")
          .select("id,visit_id,is_locked,is_signed,signed_at")
          .in("visit_id", visitIds);

        if (sErr) throw sErr;

        const map: Record<string, SoapMini> = {};
        for (const row of (s as any[]) ?? []) {
          // last write wins is fine for now; if multiples exist it is a data issue anyway
          map[row.visit_id] = {
            id: row.id,
            visit_id: row.visit_id,
            is_locked: row.is_locked ?? null,
            is_signed: row.is_signed ?? null,
            signed_at: row.signed_at ?? null,
          };
        }
        setSoapByVisit(map);
      } else {
        setSoapByVisit({});
      }

      // Labs minis
      if (visitIds.length) {
        const { data: l, error: lErr } = await supabase
          .from("patient_labs")
          .select("id,visit_id,status")
          .eq("location_id", activeLocationId)
          .in("visit_id", visitIds);

        if (lErr) throw lErr;

        const map: Record<string, LabMini[]> = {};
        for (const row of (l as any[]) ?? []) {
          const vid = row.visit_id ?? "general";
          const arr = map[vid] ?? [];
          arr.push({ id: row.id, visit_id: row.visit_id, status: row.status });
          map[vid] = arr;
        }
        setLabsByVisit(map);
      } else {
        setLabsByVisit({});
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load provider queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLocationId, user?.id]);

  const fmtDate = (iso: string) => new Date(iso).toLocaleString();

  const kpis = useMemo(() => {
    const now = new Date();
    const todayKey = now.toLocaleDateString();

    const openVisits = visits.filter((v) => (v.status ?? "").toLowerCase() !== "closed").length;

    const needsSoap = visits.filter((v) => {
      const s = soapByVisit[v.id];
      return !s?.id || !(s.is_locked || s.is_signed || s.signed_at);
    }).length;

    const needsLabs = visits.filter((v) => {
      const labs = labsByVisit[v.id] ?? [];
      return labs.length === 0;
    }).length;

    const newToday = visits.filter((v) => new Date(v.created_at).toLocaleDateString() === todayKey).length;

    return { openVisits, needsSoap, needsLabs, newToday };
  }, [visits, soapByVisit, labsByVisit]);

  const getNextStep = (visit: VisitRow) => {
    const soap = soapByVisit[visit.id];
    const labs = labsByVisit[visit.id] ?? [];

    if (!soap?.id) return "Open the visit and start the SOAP note.";
    if (!(soap.is_locked || soap.is_signed || soap.signed_at)) return "Finish and sign the SOAP note.";
    if (labs.length === 0) return "Review whether labs need to be added or ordered.";
    if ((visit.status ?? "").toLowerCase() !== "closed") return "Review the chart and close the visit when ready.";
    return "Visit is complete. Reopen only if follow-up work is needed.";
  };

  if (!isStaff) {
    return (
      <div className="app-bg">
        <div className="shell">
          <div className="card card-pad">
            <div className="h2">Not authorized</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Provider Queue is staff-only.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Provider Queue"
          subtitle="Live operational dashboard - Filtered by your active location"
          secondaryCta={{ label: "Back", to: "/provider" }}
          primaryCta={{ label: "AI Plan Builder", to: "/provider/ai" }}
          rightActions={
            <button className="btn btn-secondary" onClick={signOut} type="button">
              Sign out
            </button>
          }
          showKpis={true}
        />

        {/* Visible status + context */}
        <div className="space" />
        <SystemStatusBar />

        <div className="space" />

        {!activeLocationId ? (
          <div className="card card-pad">
            <div className="h2">No active location set</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Set your active location (profiles.active_location_id). Once set, your queue will populate automatically.
            </div>
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="card card-pad">
              <div className="h2">Today at a glance</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                Location ID: <strong>{activeLocationId}</strong>
              </div>

              <div className="space" />

              <div className="v-statgrid">
                <div className="v-stat">
                  <div className="k">Open Visits</div>
                  <div className="v">{kpis.openVisits}</div>
                </div>
                <div className="v-stat">
                  <div className="k">Needs SOAP</div>
                  <div className="v">{kpis.needsSoap}</div>
                </div>
                <div className="v-stat">
                  <div className="k">Needs Labs</div>
                  <div className="v">{kpis.needsLabs}</div>
                </div>
                <div className="v-stat">
                  <div className="k">New Today</div>
                  <div className="v">{kpis.newToday}</div>
                </div>
              </div>

              {err ? <div style={{ color: "crimson", marginTop: 12 }}>{err}</div> : null}

              <div className="space" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <button className="btn btn-primary" type="button" onClick={loadQueue} disabled={loading}>
                  {loading ? "Refreshing..." : "Refresh Queue"}
                </button>

                <button className="btn btn-secondary" type="button" onClick={() => nav("/provider/patients")}>
                  Patients List
                </button>

                <button className="btn btn-secondary" type="button" onClick={() => nav("/provider/command")}>
                  Command Center
                </button>
              </div>
            </div>

            <div className="space" />

            {/* Queue list */}
            <div className="card card-pad">
              <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div className="h2">Queue</div>
                  <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                    Latest visits for this location.
                  </div>
                </div>
              </div>

              <div className="space" />

              {loading ? (
                <div className="muted">Loading...</div>
              ) : visits.length === 0 ? (
                <div className="muted">No visits found for this location yet.</div>
              ) : (
                visits.map((v) => {
                  const soap = soapByVisit[v.id];
                  const labs = labsByVisit[v.id] ?? [];
                  const soapLabel = !soap?.id ? "None" : soap.is_locked || soap.is_signed || soap.signed_at ? "Signed" : "Draft";

                  return (
                    <button
                      key={v.id}
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        width: "100%",
                        justifyContent: "space-between",
                        marginBottom: 10,
                        textAlign: "left",
                        padding: "14px 16px",
                        minHeight: 96,
                      }}
                      onClick={() => nav(`/provider/visit/${v.id}`)}
                      title="Open Visit Chart"
                    >
                      <span>
                        <div style={{ fontWeight: 800 }}>{fmtDate(v.visit_date)}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          Visit: {v.id.slice(0, 8)} - Patient: {v.patient_id.slice(0, 8)}
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          Status: <strong>{v.status ?? "-"}</strong>
                          {" - "}
                          SOAP: <strong>{soapLabel}</strong>
                          {" - "}
                          Labs: <strong>{labs.length}</strong>
                          {v.summary ? ` - ${v.summary}` : ""}
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 6, opacity: 0.9 }}>
                          Next step: {getNextStep(v)}
                        </div>
                      </span>

                      <span className="v-chip">Open Visit</span>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
