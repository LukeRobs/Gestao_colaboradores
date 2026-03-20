import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";

const PALETTE = [
  "#E8410A", "#F97316", "#FBBF24", "#34D399",
  "#60A5FA", "#A78BFA", "#F472B6", "#2DD4BF",
];

const EmptyChart = () => (
  <div className="flex flex-col items-center justify-center h-40 gap-2">
    <div className="w-10 h-10 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
      <span className="text-white/20 text-lg">∅</span>
    </div>
    <p className="text-white/25 text-xs">Sem dados disponíveis</p>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1C1C1F] border border-white/10 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-white/50 mb-1 font-medium">{label}</p>
      <p className="text-white font-bold text-sm">{payload[0]?.value}</p>
    </div>
  );
};

export default function ChartBar({ title, data = [], color }) {
  const hasData = Array.isArray(data) && data.length > 0;
  const maxVal = hasData ? Math.max(...data.map((d) => d.value || 0)) : 0;

  const tickFormatter = (val) =>
    typeof val === "string" && val.length > 10 ? val.slice(0, 10) + "…" : val;

  return (
    <div className="w-full bg-[#151517] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-3 hover:border-white/[0.12] transition-colors duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">{title}</h3>
        {hasData && (
          <span className="text-[11px] font-medium text-white/30 bg-white/[0.05] px-2 py-0.5 rounded-full">
            {data.length} itens
          </span>
        )}
      </div>

      {/* Chart */}
      {!hasData ? (
        <EmptyChart />
      ) : (
        <div className="w-full h-56"> {/* 🔥 aumentei altura */}
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 30, right: 8, left: -20, bottom: 10 }} // 🔥 mais espaço em cima
              barCategoryGap="30%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />

              <XAxis
                dataKey="name"
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={tickFormatter}
              />

              <YAxis
                tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                domain={[0, "dataMax + 10"]} // 🔥 espaço para labels
              />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />

              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                
                {/* 🔥 LABELS VISÍVEIS */}
                <LabelList
                  dataKey="value"
                  position="top"
                  fill="rgba(255,255,255,0.6)"
                  fontSize={10}
                />

                {data.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      color ||
                      (entry.value === maxVal
                        ? "#E8410A"
                        : PALETTE[i % PALETTE.length])
                    }
                    opacity={entry.value === maxVal ? 1 : 0.65}
                  />
                ))}
              </Bar>

            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}