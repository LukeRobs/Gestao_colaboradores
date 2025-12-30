export default function DashboardHeader({ dataOperacional, turnoAtual }) {
  const dataFmt = dataOperacional
    ? new Date(dataOperacional + "T00:00:00").toLocaleDateString("pt-BR")
    : "-";


  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold text-white">
        Dashboard Operacional
      </h1>

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
