import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = {
  ts: string;
  dateLabel: string;
  area: number;
  wound_label: string;
  visit_id: string;
};

type Props = {
  points: Point[];
};

export default function WoundHealingCurveChart({ points }: Props) {
  return (
    <ResponsiveContainer>
      <LineChart data={points} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: number | string | undefined) => [`${value ?? "-"} cm2`, "Area"]}
          labelFormatter={(labelStr: unknown) => `Date: ${String(labelStr ?? "")}`}
        />
        <Line type="monotone" dataKey="area" strokeWidth={2} dot />
      </LineChart>
    </ResponsiveContainer>
  );
}
