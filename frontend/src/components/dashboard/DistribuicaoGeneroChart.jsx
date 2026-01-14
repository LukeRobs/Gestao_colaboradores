import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

/**
 * Chart de distribuição genérico (ex: gênero, status, empresa, etc)
 *
 * data: [{ name: string, value: number }]
 */
export default function DistribuicaoGeneroChart({
  data = [],
  title = "Distribuição",
  height = 320,
  colors = ["#FA4C00", "#0A84FF", "#34C759", "#FFD60A"],
  showPercentLabel = true,
}) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((acc, cur) => acc + cur.value, 0);

  const renderPercentLabel = ({ value, percent }) =>
  showPercentLabel && value
    ? `${value} (${Math.round(percent * 100)}%)`
    : "";

  return (
    <div className="bg-[#1A1A1C] rounded-2xl p-6">
      {title && (
        <h2 className="text-sm font-semibold text-white mb-4 uppercase">
          {title}
        </h2>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={70}
            outerRadius={100}
            paddingAngle={2}
            label={renderPercentLabel}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={colors[i % colors.length]}
              />
            ))}
          </Pie>

          <Tooltip
            formatter={(value, name) => {
              const percent =
                total > 0
                  ? ((value / total) * 100).toFixed(1)
                  : 0;
              return [`${value} (${percent}%)`, name];
            }}
            contentStyle={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #3D3D40",
              borderRadius: "8px",
              color: "#000000",
            }}
          />

          <Legend
            verticalAlign="bottom"
            iconType="circle"
            formatter={(value) => (
              <span className="text-[#BFBFC3] text-xs">
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
