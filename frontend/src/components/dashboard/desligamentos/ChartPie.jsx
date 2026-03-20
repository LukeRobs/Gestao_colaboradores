import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const PALETTE = [
  "#E8410A", "#F97316", "#FBBF24", "#34D399",
  "#60A5FA", "#A78BFA", "#F472B6", "#2DD4BF",
];

/* 🔥 LABEL INTELIGENTE DENTRO DO DONUT */
const renderLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  value,
}) => {
  if (!value || percent < 0.05) return ""; // 🔥 evita poluição

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;

  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={10}
      fontWeight="600"
    >
      {`${value} (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
};

const EmptyChart = () => (
  <div className="flex flex-col items-center justify-center h-40 gap-2">
    <div className="w-10 h-10 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
      <span className="text-white/20 text-lg">∅</span>
    </div>
    <p className="text-white/25 text-xs">Sem dados disponíveis</p>
  </div>
);

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  const { name, value, payload: p } = payload[0];

  return (
    <div className="bg-[#1C1C1F] border border-white/10 rounded-xl px-3 py-2 shadow-xl text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: p.fill }}
        />
        <span className="text-white/70 font-medium">{name}</span>
      </div>
      <span className="text-white font-bold text-sm">{value}</span>
    </div>
  );
};

/* 🔥 truncar texto grande */
const truncate = (str, max = 14) =>
  typeof str === "string" && str.length > max
    ? str.slice(0, max) + "…"
    : str;

export default function ChartPie({ title, data = [] }) {
  const hasData = Array.isArray(data) && data.length > 0;

  const total = hasData
    ? data.reduce((sum, d) => sum + (d.value || 0), 0)
    : 0;

  return (
    <div className="w-full bg-[#151517] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-4 hover:border-white/[0.12] transition-colors duration-300">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">{title}</h3>

        {hasData && (
          <span className="text-[11px] font-medium text-white/30 bg-white/[0.05] px-2 py-0.5 rounded-full">
            {total} total
          </span>
        )}
      </div>

      {!hasData ? (
        <EmptyChart />
      ) : (
        <>
          {/* 🔥 CHART */}
          <div className="w-full h-56"> {/* 🔥 AUMENTEI ALTURA */}
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}  // 🔥 menor
                  outerRadius={70}  // 🔥 menor → evita overflow
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                  label={renderLabel}
                  labelLine={false}
                >
                  {data.map((_, i) => (
                    <Cell
                      key={i}
                      fill={PALETTE[i % PALETTE.length]}
                      opacity={0.92}
                    />
                  ))}
                </Pie>

                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* 🔥 LEGENDA CONTROLADA */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-2">
            {data.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 text-[11px] text-white/50 max-w-[120px]"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                />
                <span className="truncate">
                  {truncate(item.name)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}