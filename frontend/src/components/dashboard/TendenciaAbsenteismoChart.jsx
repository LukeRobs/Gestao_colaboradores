import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from "recharts";

export default function TendenciaAbsenteismoChart({ title, data = [] }) {
  const CustomLabel = ({ x, y, value }) => {
    if (value === undefined || value === null) return null;

    const num = Number(value);
    if (Number.isNaN(num)) return null;

    return (
      <text
        x={x}
        y={Math.max(y - 8, 12)} // 🔑 impede sair do topo
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize={11}
        fontWeight={600}
      >
        {num.toFixed(2)}%
      </text>
    );
  };

  return (
    <div className="bg-[#1A1A1C] rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>

      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 24, right: 16, left: 0, bottom: 0 }} // 🔑 espaço real
          >
            <CartesianGrid stroke="#2A2A2C" strokeDasharray="3 3" />

            <XAxis dataKey="data" stroke="#BFBFC3" tick={{ fontSize: 12 }} />

            <YAxis
              stroke="#BFBFC3"
              tick={{ fontSize: 12 }}
              domain={[0, "auto"]}
              padding={{ top: 20 }} // 🔑 espaço interno
              tickFormatter={(v) => `${v}%`}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: "#1A1A1C",
                border: "1px solid #2A2A2C",
                borderRadius: 8,
              }}
              labelStyle={{ color: "#fff" }}
              formatter={(v) => [`${v}%`, "Absenteísmo"]}
            />

            <Line
              type="monotone"
              dataKey="percentual"
              stroke="#FA4C00"
              strokeWidth={3}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
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
