export default function DashboardHeader({
  title,
  subtitle,
  date,
  badges = [],
}) {
  /* =====================================================
     FORMATADORES
  ===================================================== */

  const formatDateBR = (value) => {
  if (!value) return "-";

  // Se já vier no formato YYYY-MM-DD
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }

  // Qualquer Date ou ISO → força locale BR (SEM UTC)
  const d = new Date(value);

    if (isNaN(d.getTime())) return "-";

    return d.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
  };

  const renderPeriodo = () => {
    if (!date) return "-";

    // String já no formato "inicio → fim"
    if (typeof date === "string" && date.includes("→")) {
      const [inicio, fim] = date.split("→").map(v => v.trim());
      return `${formatDateBR(inicio)} → ${formatDateBR(fim)}`;
    }

    // Objeto { inicio, fim }
    if (typeof date === "object" && date.inicio && date.fim) {
      return `${formatDateBR(date.inicio)} → ${formatDateBR(date.fim)}`;
    }

    // Data única
    return formatDateBR(date);
  };


  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold text-white">
        {title}
      </h1>

      <div className="flex flex-wrap items-center gap-3 text-sm text-[#BFBFC3]">
        {(subtitle || date) && (
          <span>
            {subtitle}
            {date && `: ${renderPeriodo()}`}
          </span>
        )}

        {badges.map((badge, i) => (
          <span
            key={i}
            className="px-2 py-0.5 rounded-md bg-[#2A2A2C] text-white"
          >
            {badge}
          </span>
        ))}
      </div>
    </div>
  );
}
