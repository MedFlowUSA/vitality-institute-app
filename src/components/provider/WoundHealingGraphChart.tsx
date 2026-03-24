import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartPoint = {
  id: string;
  visit_id: string;
  date: string;
  area: number;
  isCurrent: boolean;
};

type Props = {
  chartData: ChartPoint[];
};

export default function WoundHealingGraphChart({ chartData }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="area" strokeWidth={2} dot />

        {chartData
          .filter((datum) => datum.isCurrent)
          .map((datum) => (
            <ReferenceDot
              key={datum.id}
              x={datum.date}
              y={datum.area}
              r={6}
              ifOverflow="extendDomain"
            />
          ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
