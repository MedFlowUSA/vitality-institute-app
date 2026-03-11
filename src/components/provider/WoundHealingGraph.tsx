import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";

type GraphRow = {
  id: string;
  created_at: string;
  visit_id: string;
  wound_label: string;
  area_cm2: number | null;
};

type Props = {
  rows: GraphRow[];
  currentVisitId?: string;
  title?: string;
};

function fmtDate(v: string) {
  try {
    return new Date(v).toLocaleDateString();
  } catch {
    return v;
  }
}

export default function WoundHealingGraph({
  rows,
  currentVisitId,
  title = "Wound Area Trend",
}: Props) {
  const chartData = useMemo(() => {
    return rows
      .filter((r) => r.area_cm2 != null)
      .sort((a, b) => (a.created_at > b.created_at ? 1 : -1))
      .map((r, index) => ({
        id: r.id,
        visit_id: r.visit_id,
        date: fmtDate(r.created_at),
        area: r.area_cm2 as number,
        label: `${index + 1}`,
        isCurrent: currentVisitId ? r.visit_id === currentVisitId : false,
      }));
  }, [rows, currentVisitId]);

  if (chartData.length === 0) {
    return (
      <div className="card card-pad">
        <div className="muted">{title}</div>
        <div className="space" />
        <div className="muted">No graph data available.</div>
      </div>
    );
  }

  return (
    <div className="card card-pad" style={{ height: 340 }}>
      <div className="muted" style={{ marginBottom: 10 }}>{title}</div>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="area" strokeWidth={2} dot />

          {chartData
            .filter((d) => d.isCurrent)
            .map((d) => (
              <ReferenceDot
                key={d.id}
                x={d.date}
                y={d.area}
                r={6}
                ifOverflow="extendDomain"
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
