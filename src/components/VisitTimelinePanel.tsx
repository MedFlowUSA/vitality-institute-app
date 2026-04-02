// src/components/VisitTimelinePanel.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type TimelineRow = {
  visit_id: string;
  patient_id: string;
  location_id: string;
  visit_date: string;
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

  const soapLabel = (row: TimelineRow) => {
    if (!row.soap_id) return "No SOAP";
    if (row.is_locked || row.is_signed) return "Signed";
    return row.soap_status ? row.soap_status : "Draft";
  };

  const soapTone = (row: TimelineRow) => {
    if (!row.soap_id) return "rgba(255,255,255,.25)";
    if (row.is_locked || row.is_signed) return "rgba(68, 220, 155, .55)";
    return "rgba(255, 210, 80, .55)";
  };

  const load = useCallback(async () => {
    if (!patientId) return;
    setErr(null);
    setLoading(true);

    try {
      let query = supabase
        .from("v_patient_visit_timeline")
        .select(
          "visit_id,patient_id,location_id,visit_date,visit_status,summary,soap_id,soap_status,is_signed,is_locked,signed_at,soap_created_at"
        )
        .eq("patient_id", patientId)
        .order("visit_date", { ascending: false });

      if (locationId) query = query.eq("location_id", locationId);

      const { data, error } = await query;
      if (error) throw error;

      setRows((data as TimelineRow[]) ?? []);
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : "Failed to load visit timeline.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [locationId, patientId]);

  useEffect(() => {
    void load();
  }, [load]);

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
        <div className="muted">Loading visits...</div>
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
        <button className="btn btn-ghost" type="button" onClick={() => void load()}>
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
            Past and current visits linked to this patient.
          </div>
        </div>
        {!compact ? (
          <div className="muted" style={{ fontSize: 12 }}>
            {rows.length} visit{rows.length === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>

      <div className="space" />

      {rows.length === 0 ? (
        <div className="muted">{emptyText}</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row) => {
            const selected = activeVisitId === row.visit_id;
            return (
              <button
                key={row.visit_id}
                type="button"
                className={selected ? "btn btn-primary" : "btn btn-ghost"}
                style={{ width: "100%", justifyContent: "space-between", textAlign: "left", padding: compact ? "10px 12px" : "12px 14px" }}
                onClick={() => onSelectVisit?.(row.visit_id)}
              >
                <span>
                  <div style={{ fontWeight: 800 }}>{fmtDate(row.visit_date)}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {row.visit_status ?? "Visit"}
                    {row.summary ? ` • ${row.summary}` : ""}
                  </div>
                </span>
                <span
                  className="v-chip"
                  style={{
                    background: soapTone(row),
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,.12)",
                  }}
                >
                  {soapLabel(row)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
