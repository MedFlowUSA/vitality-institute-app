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
  soap_status: string | null;
  is_signed: boolean | null;
  is_locked: boolean | null;
  signed_at: string | null;
  soap_created_at: string | null;
};

type Props = {
  patientId: string;
  locationId?: string | null;

  activeVisitId?: string | null;
  onSelectVisit?: (visitId: string) => void;

  title?: string;
  compact?: boolean;
};

export default function VisitTimelinePanel({
  patientId,
  locationId = null,
  activeVisitId = null,
  onSelectVisit,
  title = "Visit Timeline",
  compact = false,
}: Props) {
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  };

  const soapLabel = (r: TimelineRow) => {
    if (!r.soap_id) return "No SOAP";
    if (r.is_locked || r.is_signed) return "Signed";
    return r.soap_status ? r.soap_status : "Draft";
  };

  const soapTone = (r: TimelineRow) => {
    if (!r.soap_id) return "rgba(255,255,255,.25)";
    if (r.is_locked || r.is_signed) return "rgba(68, 220, 155, .55)";
    return "rgba(255, 210, 80, .55)";
  };

  const load = async () => {
    if (!patientId) return;
    setErr(null);
    setLoading(true);

    try {
      let q = supabase
        .from("v_patient_visit_timeline")
        .select(
          "visit_id,patient_id,location_id,visit_date,visit_status,summary,soap_id,soap_status,is_signed,is_locked,signed_at,soap_created_at"
        )
        .eq("patient_id", patientId)
        .order("visit_date", { ascending: false });

      // optional filter
      if (locationId) q = q.eq("location_id", locationId);

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
  }, [patientId, locationId]);

  const emptyText = useMemo(() => {
    if (!patientId) return "Missing patient id.";
    if (locationId) return "No visits found for this patient at this location.";
    return "No visits found for this patient.";
  }, [patientId, locationId]);

  if (loading) {
    return (
      <div className="card card-pad">
        <div className="h2">{title}</div>
        <div className="space" />
        <div className="muted">Loading visits…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="card card-pad">
        <div className="h2">{title}</div>
        <div className="space" />
        <div style={{ color: "crimson" }}>{err}</div>
        <div className="space" />
        <button className="btn btn-ghost" type="button" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="card card-pad">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div className="h2">{title}</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            Click a visit to set it active.
          </div>
        </div>

        <button className="btn btn-ghost" type="button" onClick={load}>
          Refresh
        </button>
      </div>

      <div className="space" />

      {rows.length === 0 ? (
        <div className="muted">{emptyText}</div>
      ) : (
        <div className="card card-pad" style={{ maxHeight: compact ? 340 : 520, overflow: "auto" }}>
          {rows.map((r) => {
            const active = activeVisitId === r.visit_id;

            return (
              <button
                key={r.visit_id}
                type="button"
                className={active ? "btn btn-primary" : "btn btn-ghost"}
                style={{
                  width: "100%",
                  justifyContent: "space-between",
                  textAlign: "left",
                  marginBottom: 8,
                  borderColor: active ? "rgba(255,255,255,.35)" : undefined,
                }}
                onClick={() => onSelectVisit?.(r.visit_id)}
              >
                <span style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span>{new Date(r.visit_date).toLocaleDateString()}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {r.visit_status ?? "—"}
                    </span>
                    <span
                      className="muted"
                      style={{
                        fontSize: 12,
                        padding: "3px 10px",
                        borderRadius: 999,
                        border: `1px solid ${soapTone(r)}`,
                        background: "rgba(0,0,0,.18)",
                        whiteSpace: "nowrap",
                      }}
                      title={r.soap_id ? `SOAP: ${soapLabel(r)}` : "No SOAP note yet"}
                    >
                      {soapLabel(r)}
                      {r.signed_at ? ` • ${new Date(r.signed_at).toLocaleDateString()}` : ""}
                    </span>
                  </div>

                  <div className="muted" style={{ fontSize: 12, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.summary ?? ""}
                  </div>
                </span>

                <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  {fmtDate(r.visit_date)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}