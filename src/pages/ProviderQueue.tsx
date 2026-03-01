// src/pages/ProviderQueue.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import VitalityHero from "../components/VitalityHero";

type VisitRow = {
  id: string;
  patient_id: string;
  location_id: string;
  visit_date: string | null;
  status: string | null;
  summary: string | null;
  created_at: string;
};

type DemoRow = {
  patient_id: string;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  phone: string | null;
};

type QueueItem = {
  visit: VisitRow;
  demo: DemoRow | null;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString();
}

function statusChip(status: string | null) {
  const s = (status || "").toLowerCase();
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.06)",
    whiteSpace: "nowrap",
  };

  if (s === "open") return { ...base, border: "1px solid rgba(148,163,184,.35)", background: "rgba(148,163,184,.14)" };
  if (s === "pending_review") return { ...base, border: "1px solid rgba(245,158,11,.35)", background: "rgba(245,158,11,.14)" };
  if (s === "in_progress") return { ...base, border: "1px solid rgba(59,130,246,.35)", background: "rgba(59,130,246,.14)" };
  if (s === "completed") return { ...base, border: "1px solid rgba(34,197,94,.35)", background: "rgba(34,197,94,.14)" };

  return base;
}

export default function ProviderQueue() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [demos, setDemos] = useState<Record<string, DemoRow>>({});

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "pending_review" | "in_progress" | "completed">("open");

  const statusOptions = [
    { value: "all", label: "All" },
    { value: "open", label: "Open" },
    { value: "pending_review", label: "Pending Review" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
  ] as const;

  const loadQueue = async () => {
    setLoading(true);
    setErr(null);

    try {
      let qb = supabase
        .from("patient_visits")
        .select("id,patient_id,location_id,visit_date,status,summary,created_at")
        .order("visit_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") qb = qb.eq("status", statusFilter);

      const { data: v, error: vErr } = await qb;
      if (vErr) throw vErr;

      const visitRows = (v as VisitRow[]) ?? [];
      setVisits(visitRows);

      const patientIds = Array.from(new Set(visitRows.map((x) => x.patient_id)));
      if (patientIds.length === 0) {
        setDemos({});
        return;
      }

      const { data: d, error: dErr } = await supabase
        .from("patient_demographics")
        .select("patient_id,first_name,last_name,dob,phone")
        .in("patient_id", patientIds);

      if (dErr) throw dErr;

      const map: Record<string, DemoRow> = {};
      for (const row of (d as DemoRow[]) ?? []) map[row.patient_id] = row;
      setDemos(map);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const items: QueueItem[] = useMemo(() => {
    const base = visits.map((visit) => ({
      visit,
      demo: demos[visit.patient_id] ?? null,
    }));

    const s = q.trim().toLowerCase();
    if (!s) return base;

    return base.filter((it) => {
      const name = `${it.demo?.first_name ?? ""} ${it.demo?.last_name ?? ""}`.trim().toLowerCase();
      const phone = (it.demo?.phone ?? "").toLowerCase();
      const pid = it.visit.patient_id.toLowerCase();
      const summary = (it.visit.summary ?? "").toLowerCase();
      const status = (it.visit.status ?? "").toLowerCase();
      return name.includes(s) || phone.includes(s) || pid.includes(s) || summary.includes(s) || status.includes(s);
    });
  }, [visits, demos, q]);

  const labelFor = (it: QueueItem) => {
    const name = `${it.demo?.first_name ?? ""} ${it.demo?.last_name ?? ""}`.trim();
    return name || `Patient ${it.visit.patient_id.slice(0, 8)}`;
  };

  // ✅ FIXED ROUTE: matches App.tsx /provider/patients/:patientId
  const goPatient = (patientId: string) => nav(`/provider/patients/${patientId}`);

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Provider Queue"
          subtitle="Your working list of patient visits"
          secondaryCta={{ label: "Back", to: "/provider" }}
          rightActions={
            <button className="btn btn-ghost" type="button" onClick={loadQueue}>
              Refresh
            </button>
          }
          showKpis={true}
        />

        <div className="space" />

        {/* Quick actions (makes provider portal feel “full”) */}
        <div className="card card-pad">
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div className="h2">Command Center</div>
              <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                Jump straight into intake review, labs, messages, or patient center.
              </div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" type="button" onClick={() => nav("/provider/intake")}>
                Intake Review
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => nav("/provider/labs")}>
                Labs
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => nav("/provider/chat")}>
                Messages
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => nav("/provider/patients")}>
                Patient Center
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => nav("/provider/ai")}>
                AI Drafts
              </button>
            </div>
          </div>
        </div>

        <div className="space" />

        <div className="card card-pad">
          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              className="input"
              placeholder="Search name, phone, patient id, visit summary, or status…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ flex: "1 1 320px" }}
            />

            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{ flex: "0 0 200px" }}
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {err ? <div style={{ color: "crimson", marginTop: 12 }}>{err}</div> : null}

          <div className="space" />

          <div className="card card-pad" style={{ maxHeight: 560, overflow: "auto" }}>
            {loading ? (
              <div className="muted">Loading…</div>
            ) : items.length === 0 ? (
              <div className="muted">No visits match this filter.</div>
            ) : (
              items.map((it) => {
                const when = it.visit.visit_date ? it.visit.visit_date : it.visit.created_at;
                return (
                  <div key={it.visit.id} className="card card-pad" style={{ marginBottom: 10 }}>
                    <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 260 }}>
                        <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 900, fontSize: 16 }}>{labelFor(it)}</div>
                          <span style={statusChip(it.visit.status)}>{(it.visit.status ?? "—").toUpperCase()}</span>
                        </div>

                        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                          Visit: {fmt(when)} {it.demo?.phone ? ` • ${it.demo.phone}` : ""}
                        </div>

                        {it.visit.summary ? (
                          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                            {it.visit.summary}
                          </div>
                        ) : null}

                        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
                          Visit ID: {it.visit.id}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div className="row" style={{ gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button className="btn btn-primary" type="button" onClick={() => goPatient(it.visit.patient_id)}>
                            Open Patient
                          </button>
                          <button className="btn btn-ghost" type="button" onClick={() => nav(`/provider/intake`)}>
                            Intake
                          </button>
                          <button className="btn btn-ghost" type="button" onClick={() => nav(`/provider/labs`)}>
                            Labs
                          </button>
                          <button className="btn btn-ghost" type="button" onClick={() => nav(`/provider/chat`)}>
                            Messages
                          </button>
                        </div>

                        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                          Open →
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space" />
      </div>
    </div>
  );
}