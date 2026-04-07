export default function DashboardHeader({
  title,
  subtitle,
  date,
  badges = [],
}) {
  const formatDateBR = (value) => {
    if (!value) return "-";

    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-");
      return `${d}/${m}/${y}`;
    }

    const d = new Date(value);
    if (isNaN(d.getTime())) return "-";

    return d.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
  };

  const renderPeriodo = () => {
    if (!date) return "-";

    if (typeof date === "string" && date.includes("→")) {
      const [inicio, fim] = date.split("→").map((v) => v.trim());
      return `${formatDateBR(inicio)} → ${formatDateBR(fim)}`;
    }

    if (typeof date === "object" && date.inicio && date.fim) {
      return `${formatDateBR(date.inicio)} → ${formatDateBR(date.fim)}`;
    }

    return formatDateBR(date);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Título */}
      <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-page tracking-tight">
        {title}
      </h1>

      {/* Subtitulo + Badges */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted">
        {(subtitle || date) && (
          <span className="truncate">
            {subtitle}
            {date && `: ${renderPeriodo()}`}
          </span>
        )}

        {badges.map((badge, i) => (
          <span
            key={i}
            className="
              px-3 py-1
              rounded-md
              bg-surface-2
              text-page
              text-xs
              sm:text-sm
              whitespace-nowrap
            "
          >
            {badge}
          </span>
        ))}
      </div>
    </div>
  );
}