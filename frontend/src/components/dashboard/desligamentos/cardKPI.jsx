export default function Card({
  title,
  value,
  sub,
  accent = "#E8410A",
  icon,
}) {
  const isEmpty =
    value === null ||
    value === undefined ||
    value === "-" ||
    value === "";

  return (
    <div
      className="group relative w-full rounded-2xl p-4 border border-white/[0.07] bg-[#151517] overflow-hidden transition-all duration-300 hover:border-white/[0.14] hover:-translate-y-0.5 hover:shadow-lg"
      style={{ "--accent": accent }}
    >
      {/* Accent glow */}
      <div
        className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl transition-opacity duration-300 opacity-70 group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
      />

      {/* Glow background */}
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-10 group-hover:opacity-20 transition-opacity duration-300"
        style={{ background: accent }}
      />

      {/* Icon */}
      {icon && (
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm mb-3"
          style={{ background: `${accent}20`, color: accent }}
        >
          {icon}
        </div>
      )}

      {/* Title */}
      <p className="text-[11px] font-semibold tracking-wider uppercase text-white/40 leading-none mb-2">
        {title}
      </p>

      {/* Value */}
      <div className="flex flex-col">
        {isEmpty ? (
          <span className="text-white/20 text-sm font-medium">—</span>
        ) : (
          <>
            <h2
              className="text-xl font-bold leading-tight truncate max-w-full"
              style={{
                color: typeof value === "number" ? "white" : accent,
              }}
              title={String(value)}
            >
              {value}
            </h2>

            {/* 🔥 Sub (quantidade / contexto) */}
            {sub && (
              <span className="text-[11px] text-white/40 mt-1">
                {sub}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}