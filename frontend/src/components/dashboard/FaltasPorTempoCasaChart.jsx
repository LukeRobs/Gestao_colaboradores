import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";

const COLORS = [
  "#FA4C00",
  "#E84400",
  "#D03C00",
  "#B83400",
  "#A02C00",
  "#8C2500",
  "#781E00",
  "#641700",
  "#501000",
  "#3C0A00",
];

export default function FaltasPorTempoCasaChart({ data = [], title }) {
  if (!data || data.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid #2A2A2C",
          borderRadius: 10,
          padding: "10px 14px",
        }}
      >
        <p style={{ color: "#FFFFFF", fontWeight: 600, marginBottom: 4 }}>
          {label}
        </p>
        <p style={{ color: "#BFBFC3", fontSize: 12 }}>
          Faltas: <span style={{ color: "#FA4C00" }}>{d.faltas}</span>
        </p>
        <p style={{ color: "#BFBFC3", fontSize: 12 }}>
          Escalados: {d.escalados}
        </p>
        <p style={{ color: "#BFBFC3", fontSize: 12 }}>
          Taxa: <span style={{ color: "#FFD60A" }}>{d.percentual}%</span>
        </p>
      </div>
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
          <BarChart
            data={data}
            margin={{ top: 24, right: 16, left: 0, bottom: 8 }}
            barCategoryGap="30%"
          >
            <CartesianGrid
              stroke="var(--color-border)"
              strokeDasharray="2 4"
              vertical={false}
            />

            <XAxis
              dataKey="faixa"
              stroke="#8E8E93"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              stroke="#8E8E93"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#2A2A2C55" }} />

            <Bar dataKey="faltas" radius={[6, 6, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
              <LabelList
                dataKey="faltas"
                position="top"
                style={{ fill: "#FFFFFF", fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
