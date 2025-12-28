import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = ["#FA4C00", "#0A84FF", "#34C759", "#FFD60A"];

export default function DistribuicaoGeneroChart({ data }) {
  if (!data || data.length === 0) return null;

  const renderPercentLabel = ({ percent }) =>
    `${(percent * 100).toFixed(0)}%`;

  return (
    <div className="bg-[#1A1A1C] rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-[#ffffff] mb-4 uppercase">
        Distribuição por Gênero
      </h2>

      <ResponsiveContainer width="100%" height={320}>
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
                fill={COLORS[i % COLORS.length]}
              />
            ))}
          </Pie>

          <Tooltip
            formatter={(value, name) => {
              const total = data.reduce(
                (acc, cur) => acc + cur.value,
                0
              );
              const percent = ((value / total) * 100).toFixed(1);
              return [`${value} (${percent}%)`, name];
            }}
            contentStyle={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #3D3D40",
              borderRadius: "8px",
              color: "#FFFFFF",
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
