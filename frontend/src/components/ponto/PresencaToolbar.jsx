import { Search, FileSpreadsheet } from "lucide-react";

export default function PresencaToolbar({
  mes,
  turno,
  escala,
  busca,
  lider,
  lideres = [],
  pendenciaSaida,
  pendentesHoje,
  filtroFalta,
  filtroOn,
  onPendenciaSaidaChange,
  onPendentesHojeChange,
  onFiltroFaltaChange,
  onFiltroOnChange,
  onMesChange,
  onTurnoChange,
  onEscalaChange,
  onBuscaChange,
  onLiderChange,
  onExportarSheets,
  loading = false,
}) {
  const turnos = ["TODOS", "T1", "T2", "T3"];

  return (
    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
      {/* FILTROS */}
      <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
        {/* EXPORTAR GOOGLE SHEETS */}
        <button
          onClick={onExportarSheets}
          disabled={loading}
          className="
            inline-flex items-center gap-2
            px-4 py-2
            bg-[#34C759]
            hover:bg-[#28A745]
            disabled:bg-[#3A3A3C]
            disabled:cursor-not-allowed
            text-sm font-medium
            rounded-xl
            transition
          "
          title="Exportar controle de presença para Google Sheets"
        >
          <FileSpreadsheet size={16} />
          {loading ? 'Exportando...' : 'Exportar Sheets'}
        </button>

        {/* MÊS */}
        <input
          type="month"
          value={mes}
          onChange={(e) => onMesChange(e.target.value)}
          className="
            bg-surface
            text-sm
            px-4 py-2
            rounded-xl
            text-muted
            outline-none
            hover:bg-surface-2
          "
        />

        {/* TURNO */}
        <select
          value={turno}
          onChange={(e) => onTurnoChange(e.target.value)}
          className="
            bg-surface
            text-sm
            px-4 py-2
            rounded-xl
            text-muted
            outline-none
            hover:bg-surface-2
          "
        >
          {turnos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* ESCALA */}
        <select
          value={escala}
          onChange={(e) => onEscalaChange(e.target.value)}
          className="
            bg-surface
            text-sm
            px-4 py-2
            rounded-xl
            text-muted
            outline-none
            hover:bg-surface-2
          "
        >
          <option value="TODOS">Escala • Todas</option>
          <option value="E">Escala E</option>
          <option value="G">Escala G</option>
          <option value="C">Escala C</option>
        </select>

        {/* LÍDER */}
        <select
          value={lider}
          onChange={(e) => onLiderChange(e.target.value)}
          className="
            bg-surface
            text-sm
            px-4 py-2
            rounded-xl
            text-muted
            outline-none
            hover:bg-surface-2
          "
        >
          <option value="TODOS">Líder • Todos</option>
          {lideres.map((l) => (
            <option key={l.opsId} value={l.opsId}>
              {l.nomeCompleto}
            </option>
          ))}
        </select>

        {/* PENDÊNCIA DE SAÍDA */}
        <label className="
          flex items-center gap-2
          text-sm text-muted
          px-3 py-2
          rounded-xl
          bg-surface
          hover:bg-surface-2
          cursor-pointer
        ">
          <input
            type="checkbox"
            checked={!!pendenciaSaida}
            onChange={(e) => onPendenciaSaidaChange(e.target.checked)}
            className="accent-[#FA4C00]"
          />
          Entrada sem saída
        </label>

        {/* PENDENTES HOJE - BOTÃO */}
        <button
          onClick={() => onPendentesHojeChange(!pendentesHoje)}
          className={`
            inline-flex items-center gap-2
            px-3 py-2
            text-sm font-medium
            rounded-xl
            transition
            ${pendentesHoje 
              ? 'bg-[#FA4C00] text-white' 
              : 'bg-surface text-muted hover:bg-surface-2'
            }
          `}
        >
          <span>Pendentes hoje</span>
          {pendentesHoje && (
            <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full font-medium">
              Ativo
            </span>
          )}
        </button>

        {/* FALTA - BOTÃO */}
        <button
          onClick={() => onFiltroFaltaChange(!filtroFalta)}
          className={`
            inline-flex items-center gap-2
            px-3 py-2
            text-sm font-medium
            rounded-xl
            transition
            ${filtroFalta
              ? 'bg-red-600 text-white'
              : 'bg-surface text-muted hover:bg-surface-2'
            }
          `}
        >
          <span>Falta</span>
          {filtroFalta && (
            <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full font-medium">
              Ativo
            </span>
          )}
        </button>

        {/* ONBOARDING - BOTÃO */}
        <button
          onClick={() => onFiltroOnChange(!filtroOn)}
          className={`
            inline-flex items-center gap-2
            px-3 py-2
            text-sm font-medium
            rounded-xl
            transition
            ${filtroOn
              ? 'bg-orange-500 text-white'
              : 'bg-surface text-muted hover:bg-surface-2'
            }
          `}
        >
          <span>Onboarding</span>
          {filtroOn && (
            <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full font-medium">
              Ativo
            </span>
          )}
        </button>
      </div>

      {/* BUSCA */}
      <div className="flex items-center gap-2 bg-surface px-4 py-2 rounded-xl w-full sm:w-auto">
        <Search size={16} className="text-muted" />
        <input
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          placeholder="Buscar colaborador..."
          className="bg-transparent outline-none text-sm text-white placeholder-[#BFBFC3] w-full sm:w-56"
        />
      </div>
    </div>
  );
}
