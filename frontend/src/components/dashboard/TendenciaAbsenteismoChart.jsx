import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
  Area,
} from "recharts";

export default function TendenciaAbsenteismoChart({
  title,
  data = [],
}) {
  const CustomLabel = ({ x, y, value }) => {
    if (value == null) return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    return (
      <text
        x={x}
        y={Math.max(y - 10, 12)}
        textAnchor="middle"
        fill="var(--color-muted)"
        fontSize={11}
        fontWeight={600}
      >
        {num.toFixed(2)}%
      </text>
    );
  };

  return (
    <div className="bg-surface border border-default rounded-2xl p-6 space-y-6">
      {title && (
        <h2 className="text-xs sm:text-sm font-semibold text-muted uppercase tracking-wide">
          {title}
        </h2>
      )}

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 30, right: 20, left: 0, bottom: 10 }}>
            <defs>
              <linearGradient id="absGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FA4C00" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#FA4C00" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              stroke="var(--color-border)"
              strokeDasharray="2 4"
              vertical={false}
            />

            <XAxis
              dataKey="data"
              stroke="var(--color-subtle)"
              tick={{ fontSize: 12, fill: "var(--color-muted)" }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              stroke="var(--color-subtle)"
              tick={{ fontSize: 12, fill: "var(--color-muted)" }}
              domain={[0, "auto"]}
              tickFormatter={(v) => `${v}%`}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 10,
              }}
              labelStyle={{ color: "var(--color-text)" }}
              itemStyle={{ color: "var(--color-muted)" }}
              formatter={(v) => [`${v}%`, "Absenteísmo"]}
            />

            <Area
              type="monotone"
              dataKey="percentual"
              stroke="none"
              fill="url(#absGradient)"
              isAnimationActive={false}
            />

            <Line
              type="monotone"
              dataKey="percentual"
              stroke="#FA4C00"
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: "var(--color-surface)" }}
              activeDot={{ r: 6, fill: "#FA4C00", stroke: "var(--color-surface)", strokeWidth: 2 }}
              isAnimationActive={false}
            >
              <LabelList content={CustomLabel} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}