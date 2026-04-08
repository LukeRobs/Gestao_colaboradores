import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const COLORS = {
  SPX: "#FA4C00",
  BPO: "#3B82F6",
};

function clampPercent(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export default function DistribuicaoVinculoChart({ title, data = [] }) {
  const safeData = Array.isArray(data) ? data : [];

  if (!safeData.length) {
    return (
      <div className="bg-surface rounded-2xl p-4 sm:p-6 text-muted">
        Nenhum dado disponível
      </div>
    );
  }

  const total = safeData.reduce((acc, cur) => acc + (Number(cur.value) || 0), 0);

  // ✅ Label interno pra nunca “escapar” do card
  const renderInnerLabel = ({ percent }) => {
    const pct = clampPercent((percent || 0) * 100);

    // 🔥 não mostra label em fatias muito pequenas (evita poluição visual)
    if (pct < 6) return "";
    return `${Math.round(pct)}%`;
  };

  return (
    <section className="bg-surface rounded-2xl p-4 sm:p-6 space-y-4 w-full overflow-hidden">
      {title && (
        <h2 className="text-xs sm:text-sm font-semibold text-muted uppercase tracking-wide">
          {title}
        </h2>
      )}

      {/* 🔥 ALTURA RESPONSIVA */}
      <div className="h-60 sm:h-[280px] lg:h-80 relative">
        {/* TOTAL CENTRAL */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-page">
            {total}
          </span>
          <span className="text-[10px] sm:text-xs text-muted tracking-wide">
            TOTAL
          </span>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Pie
              data={safeData}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="82%"
              paddingAngle={4}
              labelLine={false}
              // ✅ deixa os percentuais DENTRO do donut
              label={renderInnerLabel}
              // ✅ centraliza melhor em telas pequenas
              cx="50%"
              cy="50%"
            >
              {safeData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={COLORS[entry.name] || "#888"}
                  stroke="#0D0D0D"
                  strokeWidth={2}
                />
              ))}
            </Pie>

            <Tooltip
              formatter={(value, name) => {
                const v = Number(value) || 0;
                const percent = total > 0 ? (v / total) * 100 : 0;
                return [`${v} (${percent.toFixed(1)}%)`, name];
              }}
              contentStyle={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid #3D3D40",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "var(--color-text)" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 🔥 LEGENDA RESPONSIVA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {safeData.map((d) => {
          const value = Number(d.value) || 0;
          const percent = total > 0 ? Math.round((value / total) * 100) : 0;

          return (
            <div key={d.name} className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[d.name] || "#888" }}
              />
              <span className="text-muted truncate">
                {d.name} — {value} ({percent}%)
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}