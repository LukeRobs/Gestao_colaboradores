const MEDALS = ["🥇", "🥈", "🥉"];
const ACCENT = "#E8410A";

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-10 gap-2">
    <div className="w-10 h-10 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
      <span className="text-white/20 text-lg">∅</span>
    </div>
    <p className="text-white/25 text-xs">Sem dados disponíveis</p>
  </div>
);

export default function RankingLider({ title, data = [] }) {
  const hasData = Array.isArray(data) && data.length > 0;

  // Sort descending by value and take top 10
  const sorted = hasData
    ? [...data].sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 10)
    : [];

  const max = sorted[0]?.value || 1;

  return (
    <div className="w-full bg-[#151517] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-4 hover:border-white/[0.12] transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">{title}</h3>
        {hasData && (
          <span className="text-[11px] font-medium text-white/30 bg-white/[0.05] px-2 py-0.5 rounded-full">
            {sorted.length} líderes
          </span>
        )}
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {sorted.map((item, i) => {
            const pct = Math.round(((item.value || 0) / max) * 100);
            const isTop3 = i < 3;

            return (
              <li key={i} className="group flex items-center gap-3">
                {/* Rank badge */}
                <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center">
                  {isTop3 ? (
                    <span className="text-base leading-none">{MEDALS[i]}</span>
                  ) : (
                    <span className="text-[11px] font-bold text-white/25 w-5 text-center">
                      {i + 1}
                    </span>
                  )}
                </div>

                {/* Name + bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-xs font-medium truncate pr-2"
                      style={{ color: isTop3 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.5)" }}
                      title={item.name}
                    >
                      {item.name || "—"}
                    </span>
                    <span
                      className="text-xs font-bold flex-shrink-0"
                      style={{ color: isTop3 ? ACCENT : "rgba(255,255,255,0.35)" }}
                    >
                      {item.value}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1 w-full bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: isTop3
                          ? `linear-gradient(90deg, ${ACCENT}, #F97316)`
                          : "rgba(255,255,255,0.15)",
                      }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}