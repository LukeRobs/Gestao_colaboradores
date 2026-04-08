import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from "recharts";

export default function ChartBarHorizontal({ title, data = [] }) {
  const safeData = Array.isArray(data) ? data : [];

  if (!safeData.length) {
    return (
      <div className="bg-[#1c1c1c] rounded-xl p-4 border border-white/5">
        <h2 className="text-sm font-medium mb-3">{title}</h2>
        <p className="text-sm text-white/60">Sem dados.</p>
      </div>
    );
  }

  // 🔥 altura dinâmica (resolve esmagamento)
  const height = Math.max(260, safeData.length * 42);

  // 🔥 cortar texto longo
  const formatName = (name) => {
    if (!name) return "";
    return name.length > 18 ? name.slice(0, 18) + "…" : name;
  };

  const formatted = safeData.map((d) => ({
    ...d,
    name: formatName(d.name),
  }));

  return (
    <div className="bg-[#1c1c1c] rounded-xl p-4 border border-white/5">
      <h2 className="text-sm font-medium mb-3">{title}</h2>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={formatted}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.06)" />

            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: "#BFBFC3", fontSize: 12 }}
            />

            <YAxis
              type="category"
              dataKey="name"
              width={150} // 🔥 AQUI É CRUCIAL
              tick={{ fill: "#BFBFC3", fontSize: 12 }}
            />

            <Tooltip
              contentStyle={{
                background: "#232323",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
              }}
            />

            <Bar dataKey="value" fill="#FA4C00" radius={[0, 6, 6, 0]}>
              <LabelList
                dataKey="value"
                position="right"
                style={{
                  fill: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}