import { Search, FileSpreadsheet, Download, SlidersHorizontal, X } from "lucide-react";

const selectCls = `
  bg-surface-2 border border-default
  text-sm text-page
  px-3 py-2
  rounded-xl
  outline-none
  cursor-pointer
  hover:border-[#FA4C00]/40
  focus:border-[#FA4C00]/60
  transition-colors
  appearance-none
`;

const STATUS_OPTIONS = [
  { value: "TODOS",           label: "Status • Todos" },
  { value: "FALTA",           label: "Com Falta" },
  { value: "ONBOARDING",      label: "Onboarding" },
  { value: "PENDENCIA_SAIDA", label: "Entrada sem saída" },
  { value: "PENDENTES_HOJE",  label: "Pendentes hoje" },
];

export default function PresencaToolbar({
  mes,
  turno,
  turnos = [],
  escala,
  escalas = [],
  busca,
  lider,
  lideres = [],
  status = "TODOS",
  onMesChange,
  onTurnoChange,
  onEscalaChange,
  onBuscaChange,
  onLiderChange,
  onStatusChange,
  onExportarSheets,
  onExportarCsv,
  isAdmin = false,
  loading = false,
}) {
  const hasActiveFilters =
    turno !== "TODOS" ||
    escala !== "TODOS" ||
    lider !== "TODOS" ||
    status !== "TODOS" ||
    busca.trim() !== "";

  function limparFiltros() {
    onTurnoChange("TODOS");
    onEscalaChange("TODOS");
    onLiderChange("TODOS");
    onStatusChange("TODOS");
    onBuscaChange("");
  }

  return (
    <div className="bg-surface border border-default rounded-2xl p-4 space-y-3">
      {/* ── Linha 1: export + mês + filtros principais ── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Export */}
        {isAdmin ? (
          <button
            onClick={onExportarSheets}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#34C759] hover:bg-[#28A745] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition"
          >
            <FileSpreadsheet size={15} />
            {loading ? "Exportando…" : "Exportar Sheets"}
          </button>
        ) : (
          <button
            onClick={onExportarCsv}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface-2 border border-default hover:bg-[#FA4C00]/10 hover:border-[#FA4C00]/40 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-muted rounded-xl transition"
          >
            <Download size={15} />
            {loading ? "Exportando…" : "Exportar CSV"}
          </button>
        )}

        {/* Divisor */}
        <div className="w-px h-7 bg-[var(--color-border)] mx-1" />

        {/* Mês */}
        <input
          type="month"
          value={mes}
          onChange={(e) => onMesChange(e.target.value)}
          className={selectCls}
          style={{ colorScheme: "dark" }}
        />

        {/* Turno */}
        <div className="relative">
          <select
            value={turno}
            onChange={(e) => onTurnoChange(e.target.value)}
            className={selectCls + " pr-7"}
          >
            <option value="TODOS">Turno • Todos</option>
            {turnos.map((t) => (
              <option key={t.idTurno} value={t.nomeTurno}>
                {t.nomeTurno}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted text-xs">▾</span>
        </div>

        {/* Escala */}
        <div className="relative">
          <select
            value={escala}
            onChange={(e) => onEscalaChange(e.target.value)}
            className={selectCls + " pr-7"}
          >
            <option value="TODOS">Escala • Todas</option>
            {escalas.map((e) => (
              <option key={e.idEscala} value={e.nomeEscala}>
                {e.nomeEscala}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted text-xs">▾</span>
        </div>

        {/* Status */}
        <div className="relative">
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className={
              selectCls +
              " pr-7 " +
              (status !== "TODOS"
                ? "border-[#FA4C00]/60 bg-[#FA4C00]/10 text-[#FA4C00] font-medium"
                : "")
            }
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: status !== "TODOS" ? "#FA4C00" : "var(--color-muted)" }}>▾</span>
        </div>

        {/* Líder */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <select
            value={lider}
            onChange={(e) => onLiderChange(e.target.value)}
            className={selectCls + " pr-7 w-full"}
          >
            <option value="TODOS">Líder • Todos</option>
            {lideres.map((l) => (
              <option key={l.opsId} value={l.opsId}>
                {l.nomeCompleto}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted text-xs">▾</span>
        </div>

        {/* Limpar filtros */}
        {hasActiveFilters && (
          <button
            onClick={limparFiltros}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted hover:text-[#FA4C00] hover:bg-[#FA4C00]/10 rounded-xl transition border border-default hover:border-[#FA4C00]/30"
          >
            <X size={13} />
            Limpar
          </button>
        )}
      </div>

      {/* ── Linha 2: busca + indicador de filtros ativos ── */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 bg-surface-2 border border-default px-3 py-2 rounded-xl flex-1 max-w-xs focus-within:border-[#FA4C00]/50 transition-colors">
          <Search size={15} className="text-subtle shrink-0" />
          <input
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder="Buscar colaborador…"
            className="bg-transparent outline-none text-sm text-page placeholder-subtle w-full"
          />
          {busca && (
            <button onClick={() => onBuscaChange("")} className="text-subtle hover:text-muted transition-colors">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Badge de filtros ativos */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FA4C00]/10 border border-[#FA4C00]/20 rounded-xl">
            <SlidersHorizontal size={13} className="text-[#FA4C00]" />
            <span className="text-xs font-medium text-[#FA4C00]">Filtros ativos</span>
          </div>
        )}
      </div>
    </div>
  );
}
