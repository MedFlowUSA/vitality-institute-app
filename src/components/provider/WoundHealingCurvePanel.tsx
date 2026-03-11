import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Props = {
  patientId: string;
  locationId: string;
  visitId?: string; // optional (we can highlight current visit later)
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

function areaOf(r: WoundRow): number | null {
  if (r.length_cm == null || r.width_cm == null) return null;
  const a = Number(r.length_cm) * Number(r.width_cm);
  if (!Number.isFinite(a)) return null;
  return Number(a.toFixed(2));
}

export default function WoundHealingCurvePanel({ patientId, locationId }: Props) {
  const [rows, setRows] = useState<WoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [label, setLabel] = useState<string>("");

  const load = async () => {
    if (!patientId || !locationId) return;
    setLoading(true);
    setErr(null);

    try {
      const { data, error } = await supabase
        .from("wound_assessments")
        .select("id,created_at,wound_label,length_cm,width_cm,visit_id")
        .eq("patient_id", patientId)
        .eq("location_id", locationId)
        .order("created_at", { ascending: true }); // oldest -> newest for curve

      if (error) throw error;
      setRows((data as WoundRow[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load wound curve data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, locationId]);

  const labels = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const key = (r.wound_label || "").trim();
      if (key) set.add(key);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  useEffect(() => {
    // set default label after load
    if (!label && labels.length) setLabel(labels[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels.join("|")]);

  const points: Point[] = useMemo(() => {
    const filtered = rows.filter((r) => (r.wound_label || "").trim() === (label || "").trim());
    const pts: Point[] = [];
    for (const r of filtered) {
      const a = areaOf(r);
      if (a == null) continue;
      pts.push({
        ts: r.created_at,
        dateLabel: new Date(r.created_at).toLocaleDateString(),
        area: a,
        wound_label: r.wound_label,
        visit_id: r.visit_id,
      });
    }
    return pts;
  }, [rows, label]);

  const stats = useMemo(() => {
    if (points.length < 2) return { pct: null as number | null, stalled: null as boolean | null };

    const last = points[points.length - 1]?.area ?? null;
    const prev = points[points.length - 2]?.area ?? null;
    if (last == null || prev == null || prev === 0) return { pct: null, stalled: null };

    const pct = Number((((prev - last) / prev) * 100).toFixed(1)); // positive = improvement
    const stalled = pct < 10; // basic heuristic: <10% improvement since last measure = “stalled”
    return { pct, stalled };
  }, [points]);

  return (
    <div className="card card-pad">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div className="h2">Healing Curve</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            Tracks wound area (cm²) over time — this is the “hospital buyer” data layer.
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{ minWidth: 260 }}
            disabled={loading || labels.length === 0}
          >
            {labels.length === 0 ? (
              <option value="">No wounds yet</option>
            ) : (
              labels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))
            )}
          </select>

          <button className="btn btn-ghost" type="button" onClick={load} disabled={loading}>
            Refresh
          </button>

          {stats.pct != null ? (
            <div className="v-chip" title="Compared to previous measurement">
              Δ: <strong>{stats.pct >= 0 ? `+${stats.pct}% improved` : `${stats.pct}%`}</strong>
              {stats.stalled ? <span className="muted"> • stalled</span> : <span className="muted"> • improving</span>}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12 }}>Add 2+ measurements to compute change.</div>
          )}
        </div>
      </div>

      <div className="space" />

      {err ? <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div> : null}

      {loading ? (
        <div className="muted">Loading…</div>
      ) : points.length === 0 ? (
        <div className="muted">No chart data yet. Add wound measurements (length + width) to generate the curve.</div>
      ) : (
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={points} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: any) => [`${value} cm²`, "Area"]}
                labelFormatter={(labelStr: unknown) => `Date: ${String(labelStr ?? "")}`}
              />
              <Line type="monotone" dataKey="area" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
