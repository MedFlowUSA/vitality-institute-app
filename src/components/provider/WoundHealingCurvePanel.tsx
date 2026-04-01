import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const LazyWoundHealingCurveChart = lazy(() => import("./WoundHealingCurveChart"));

type Props = {
  patientId: string;
  locationId: string;
  visitId?: string;
};

type WoundRow = {
  id: string;
  created_at: string;
  wound_label: string;
  length_cm: number | null;
  width_cm: number | null;
  visit_id: string;
};

type Point = {
  ts: string;
  dateLabel: string;
  area: number;
  wound_label: string;
  visit_id: string;
};

function areaOf(row: WoundRow): number | null {
  if (row.length_cm == null || row.width_cm == null) return null;
  const area = Number(row.length_cm) * Number(row.width_cm);
  if (!Number.isFinite(area)) return null;
  return Number(area.toFixed(2));
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export default function WoundHealingCurvePanel({ patientId, locationId }: Props) {
  const [rows, setRows] = useState<WoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  const load = useCallback(async () => {
    if (!patientId || !locationId) return;
    setLoading(true);
    setErr(null);

    try {
      const { data, error } = await supabase
        .from("wound_assessments")
        .select("id,created_at,wound_label,length_cm,width_cm,visit_id")
        .eq("patient_id", patientId)
        .eq("location_id", locationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setRows((data as WoundRow[]) ?? []);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to load wound curve data."));
    } finally {
      setLoading(false);
    }
  }, [locationId, patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const labels = useMemo(() => {
    const labelSet = new Set<string>();
    for (const row of rows) {
      const key = (row.wound_label || "").trim();
      if (key) labelSet.add(key);
    }
    return Array.from(labelSet).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  useEffect(() => {
    if (!label && labels.length) setLabel(labels[0]);
  }, [label, labels]);

  const points: Point[] = useMemo(() => {
    const filtered = rows.filter((row) => (row.wound_label || "").trim() === (label || "").trim());
    return filtered.flatMap((row) => {
      const area = areaOf(row);
      if (area == null) return [];
      return [{
        ts: row.created_at,
        dateLabel: new Date(row.created_at).toLocaleDateString(),
        area,
        wound_label: row.wound_label,
        visit_id: row.visit_id,
      }];
    });
  }, [rows, label]);

  const stats = useMemo(() => {
    if (points.length < 2) return { pct: null as number | null, stalled: null as boolean | null };

    const last = points[points.length - 1]?.area ?? null;
    const previous = points[points.length - 2]?.area ?? null;
    if (last == null || previous == null || previous === 0) {
      return { pct: null, stalled: null };
    }

    const pct = Number((((previous - last) / previous) * 100).toFixed(1));
    const stalled = pct < 10;
    return { pct, stalled };
  }, [points]);

  return (
    <div className="card card-pad">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div className="h2">Healing Curve</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            Tracks wound area (cm2) over time as an objective healing trend.
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            className="input"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            style={{ minWidth: 260 }}
            disabled={loading || labels.length === 0}
          >
            {labels.length === 0 ? (
              <option value="">No wounds yet</option>
            ) : (
              labels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))
            )}
          </select>

          <button className="btn btn-ghost" type="button" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>

          {stats.pct != null ? (
            <div className="v-chip" title="Compared to previous measurement">
              Change: <strong>{stats.pct >= 0 ? `+${stats.pct}% improved` : `${stats.pct}%`}</strong>
              {stats.stalled ? <span className="muted"> - stalled</span> : <span className="muted"> - improving</span>}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12 }}>Add 2+ measurements to compute change.</div>
          )}
        </div>
      </div>

      <div className="space" />

      {err ? <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div> : null}

      {loading ? (
        <div className="muted">Loading...</div>
      ) : points.length === 0 ? (
        <div className="muted">No chart data yet. Add wound measurements (length and width) to generate the curve.</div>
      ) : (
        <div style={{ width: "100%", height: 260 }}>
          <Suspense fallback={<div className="muted">Loading graph...</div>}>
            <LazyWoundHealingCurveChart points={points} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
