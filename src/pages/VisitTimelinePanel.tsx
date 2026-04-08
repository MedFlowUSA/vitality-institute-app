// src/components/VisitTimelinePanel.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type TimelineRow = {
  visit_id: string;
  patient_id: string;
  location_id: string;
  visit_date: string; // timestamptz
  visit_status: string | null;
  summary: string | null;

  soap_id: string | null;
  soap_status: string | null; // 'draft' | 'signed' | null (from view)
  is_signed: boolean | null;
  is_locked: boolean | null;
  signed_at: string | null;
  soap_created_at: string | null;
};

type Props = {
  patientId: string;
  locationId?: string | null;

  // Optional: parent can react to visit selection
  onSelectVisitId?: (visitId: string) => void;

  // Optional: allow parent to control selection
  selectedVisitId?: string | null;

  // Optional: show only top N visits
  limit?: number;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function badgeStyle(kind: "draft" | "signed" | "locked" | "none") {
  const base: React.CSSProperties = {
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.16)",
    background: "rgba(255,255,255,.06)",
    whiteSpace: "nowrap",
  };

  if (kind === "draft") return { ...base, background: "rgba(255,255,255,.08)" };
  if (kind === "signed") return { ...base, background: "rgba(80,200,120,.14)", borderColor: "rgba(80,200,120,.28)" };
  if (kind === "locked") return { ...base, background: "rgba(255,190,80,.14)", borderColor: "rgba(255,190,80,.28)" };
  return { ...base, background: "rgba(255,255,255,.04)" };
}

export default function VisitTimelinePanel({
  patientId,
  locationId = null,
  onSelectVisitId,
  selectedVisitId = null,
  limit,
}: Props) {
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    if (!patientId) return;

    setLoading(true);
    setErr(null);

    try {
      let q = supabase
        .from("v_patient_visit_timeline")
        .select(
          "visit_id,patient_id,location_id,visit_date,visit_status,summary,soap_id,soap_status,is_signed,is_locked,signed_at,soap_created_at"
        )
        .eq("patient_id", patientId)
        .order("visit_date", { ascending: false });

      if (locationId) q = q.eq("location_id", locationId);
      if (limit && limit > 0) q = q.limit(limit);

      const { data, error } = await q;

      if (error) throw error;

      setRows((data as TimelineRow[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load visit timeline.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, locationId, limit]);

  const computed = useMemo(() => {
    return rows.map((r) => {
      const locked = r.is_locked === true;
      const signed = r.is_signed === true;

      let soapKind: "draft" | "signed" | "locked" | "none" = "none";
      if (locked) soapKind = "locked";
      else if (signed) soapKind = "signed";
      else if (r.soap_id) soapKind = "draft";

      const soapLabel =
        soapKind === "locked"
          ? "Locked"
          : soapKind === "signed"
          ? "Signed"
          : soapKind === "draft"
          ? "Draft"
          : "None";

      return { ...r, soapKind, soapLabel };
    });
  }, [rows]);

  return (
    <div className="card card-pad">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div className="h2">Visit Timeline</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            Click a visit to select it. SOAP status comes from <strong>v_patient_visit_timeline</strong>.
          </div>
        </div>

        <button className="btn btn-ghost" type="button" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="space" />

      {err ? (
        <div style={{ color: "crimson" }}>{err}</div>
      ) : loading ? (
        <div className="muted">Loading...</div>
      ) : computed.length === 0 ? (
        <div className="muted">No visits found.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {computed.map((v) => {
            const active = selectedVisitId ? v.visit_id === selectedVisitId : false;

            return (
              <button
                key={v.visit_id}
                type="button"
                className={active ? "btn btn-primary" : "btn btn-ghost"}
                style={{
                  width: "100%",
                  textAlign: "left",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  padding: "14px 14px",
                }}
                onClick={() => {
                  onSelectVisitId?.(v.visit_id);
                }}
              >
                <div style={{ flex: "1 1 auto" }}>
                  <div style={{ fontWeight: 800 }}>
                    {new Date(v.visit_date).toLocaleDateString()}{" "}
                    <span className="muted" style={{ fontWeight: 600 }}>
                      | {v.visit_status ?? "-"}
                    </span>
                  </div>

                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {v.summary ?? "-"}
                  </div>

                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Visit created: {fmtDate(v.visit_date)}
                    {v.soap_created_at ? ` | SOAP created: ${fmtDate(v.soap_created_at)}` : ""}
                    {v.signed_at ? ` | Signed: ${fmtDate(v.signed_at)}` : ""}
                  </div>
                </div>

                <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <span style={badgeStyle(v.soapKind)}>{`SOAP: ${v.soapLabel}`}</span>
                  {v.soap_id ? (
                    <span
                      className="muted"
                      style={{
                        fontSize: 12,
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,.12)",
                        background: "rgba(0,0,0,.12)",
                      }}
                      title={`SOAP ID: ${v.soap_id}`}
                    >
                      Note linked
                    </span>
                  ) : (
                    <span
                      className="muted"
                      style={{
                        fontSize: 12,
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,.10)",
                        background: "rgba(255,255,255,.03)",
                      }}
                    >
                      No SOAP
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
