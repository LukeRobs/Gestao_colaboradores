export default function DashboardHeader({ dataOperacional, turnoAtual }) {
  const dataFmt = (() => {
    if (!dataOperacional) return "-";

    // Se vier como "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataOperacional)) {
      const [y, m, d] = dataOperacional.split("-");
      return `${d}/${m}/${y}`;
    }

    // Se vier ISO completo: "2025-12-30T00:00:00.000Z"
    // pega só a parte da data e formata sem timezone
    const isoDate = String(dataOperacional).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      const [y, m, d] = isoDate.split("-");
      return `${d}/${m}/${y}`;
    }

    return "-";
  })();

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold text-white">Dashboard Operacional</h1>

      <div className="flex items-center gap-3 text-sm text-[#BFBFC3]">
        <span>Dia operacional: {dataFmt}</span>

        {turnoAtual && (
          <span className="px-2 py-0.5 rounded-md bg-[#2A2A2C] text-white">
            Turno atual: {turnoAtual}
          </span>
        )}
      </div>
    </div>
  );
}
