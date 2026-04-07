import { TrendingUp } from "lucide-react";

export default function ResumoOperacaoCard({
  title,
  data = [],
  labelKey,
}) {
  return (
    <div
      className="
        bg-surface
        border border-default
        rounded-2xl
        p-5
        space-y-5
        min-h-[220px]
        transition
        hover:border-[#3A3A3C]
      "
    >
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold text-page">
          {title}
        </h3>

        <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-2">
          <TrendingUp size={16} className="text-[#FA4C00]" />
        </div>
      </div>

      {/* CONTENT */}
      {data.length === 0 ? (
        <div className="text-sm text-muted">
          Nenhum dado no período
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item, idx) => {
            const total = item.totalColaboradores || item.total || 0;
            const abs = Number(item.absenteismo ?? 0);

            const color =
              abs > 10
                ? "#FF453A"
                : abs > 5
                ? "#FF9F0A"
                : "#34C759";

            return (
              <div
                key={idx}
                className="
                  flex items-center justify-between
                  gap-4
                  text-sm
                "
              >
                <div className="truncate max-w-[65%] text-page">
                  {item[labelKey]}
                </div>

                <div className="flex items-center gap-3 min-w-[110px] justify-end">
                  <span className="text-muted">
                    {total}
                  </span>

                  <span
                    className="font-semibold"
                    style={{ color }}
                  >
                    {abs.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}