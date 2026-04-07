export default function StatusColaboradoresSection({
  title = "Status dos Colaboradores",
  items = [],
  footer = "",
}) {
  if (!items || items.length === 0) return null;

  const total = items.reduce(
    (acc, cur) => acc + (cur.value ?? cur.quantidade ?? 0),
    0
  );

  const getColor = (label) => {
    const l = String(label).toUpperCase();
    if (l.includes("ATIVO")) return "#34C759";
    if (l.includes("FÉR")) return "#0A84FF";
    if (l.includes("AFAST")) return "#AF52DE";
    if (l.includes("INSS")) return "#FF6B00";
    if (l.includes("INAT")) return "#8E8E93";
    return "#FA4C00";
  };

  return (
    <div className="bg-surface border border-default rounded-2xl p-6 space-y-6">
      {title && (
        <h2 className="text-xs sm:text-sm font-semibold text-muted uppercase tracking-wide">
          {title}
        </h2>
      )}

      <div className="space-y-4">
        {items.map((item, i) => {
          const label = item.label ?? item.status ?? "-";
          const value = item.value ?? item.quantidade ?? 0;

          const percentage =
            total > 0 ? (value / total) * 100 : 0;

          const color = getColor(label);

          const circumference = 2 * Math.PI * 18;
          const offset =
            circumference - (percentage / 100) * circumference;

          return (
            <div
              key={`${label}-${i}`}
              className="flex items-center justify-between bg-[#121214] border border-default rounded-xl px-6 py-5 hover:border-[#3A3A3C] transition"
            >
              {/* Label */}
              <div className="text-sm text-muted w-40">
                {label}
              </div>

              {/* Número */}
              <div
                className="text-3xl font-semibold text-center flex-1"
                style={{ color }}
              >
                {value}
              </div>

              {/* Indicador circular */}
              <div className="relative w-12 h-12 flex items-center justify-center">
                <svg width="44" height="44">
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    stroke="var(--color-border)"
                    strokeWidth="4"
                    fill="none"
                  />
                  {percentage > 0 && (
                    <circle
                      cx="22"
                      cy="22"
                      r="18"
                      stroke={color}
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                      transform="rotate(-90 22 22)"
                    />
                  )}
                </svg>
                <div className="absolute text-[11px] text-muted font-medium">
                  {percentage.toFixed(1)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {footer && (
        <div className="pt-4 border-t border-default text-sm text-muted">
          {footer}
        </div>
      )}
    </div>
  );
}