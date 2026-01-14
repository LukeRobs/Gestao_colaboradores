import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const COLORS = ["#FA4C00", "#0A84FF"]; // SPX (laranja) | BPO (azul)

export default function DistribuicaoColaboradoresCadastradosChart({
  title = "Colaboradores Cadastrados",
  data = [],
}) {
  const total = data.reduce((s, d) => s + d.value, 0);

  const renderLabel = ({ value, percent }) => {
    if (!value || !percent) return "";
    return `${value} (${Math.round(percent * 100)}%)`;
  };

  return (
    <div className="bg-[#1A1A1C] rounded-2xl p-6 space-y-4">
      <h3 className="text-sm font-semibold text-[#BFBFC3] uppercase">
        {title}
      </h3>

      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={70}
              outerRadius={95}
              paddingAngle={3}
              label={renderLabel}
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>

            <Tooltip
              formatter={(v, _, props) => {
                const pct = total
                  ? Math.round((v / total) * 100)
                  : 0;
                return [`${v} (${pct}%)`, props.payload.name];
              }}
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #2A2A2C",
                borderRadius: 8,
              }}
              labelStyle={{ color: "#BFBFC3" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* LEGENDA */}
      <div className="flex justify-center gap-6 text-xs">
        {data.map((d, i) => {
          const pct = total
            ? Math.round((d.value / total) * 100)
            : 0;

          return (
            <div key={d.name} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[i] }}
              />
              <span className="text-[#BFBFC3]">
                {d.name} — {d.value} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
