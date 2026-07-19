import { useState, useMemo } from "react";
import { X, Search, ChevronLeft, ChevronRight, Users, AlertTriangle } from "lucide-react";

const PAGE_SIZE = 20;
const FORA_ESCALA_COLOR = "#FFD60A";

function ColaboradoresModal({ status, color, foraDeEscalaSet, onClose }) {
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(1);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let base = status.colaboradores;
    if (termo) {
      base = base.filter(
        (c) =>
          c.nome?.toLowerCase().includes(termo) ||
          c.setor?.toLowerCase().includes(termo)
      );
    }
    // Colaboradores que lançaram fora da escala (dia de DSR) sempre no topo, em destaque
    return [...base].sort((a, b) => {
      const aFora = foraDeEscalaSet.has(a.opsId);
      const bFora = foraDeEscalaSet.has(b.opsId);
      if (aFora !== bFora) return aFora ? -1 : 1;
      return (a.nome || "").localeCompare(b.nome || "");
    });
  }, [status.colaboradores, busca, foraDeEscalaSet]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const paginaAtual = filtrados.slice(
    (pageClamped - 1) * PAGE_SIZE,
    pageClamped * PAGE_SIZE
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-default shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-default shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${color}1A` }}
            >
              <Users size={16} style={{ color }} />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-base text-page truncate">{status.label}</h2>
              <p className="text-xs text-muted">
                {status.colaboradores.length}{" "}
                {status.colaboradores.length === 1 ? "colaborador" : "colaboradores"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-page transition-colors shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* BUSCA */}
        <div className="px-5 py-3 border-b border-default shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <input
              type="text"
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPage(1); }}
              placeholder="Buscar por nome ou setor..."
              className="w-full pl-9 pr-4 py-2.5 bg-surface-2 border border-default rounded-xl text-sm text-page placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/50"
            />
          </div>
        </div>

        {/* LISTA */}
        <div className="flex-1 overflow-y-auto px-5 py-2">
          {paginaAtual.length === 0 ? (
            <p className="text-center text-muted text-sm py-10">Nenhum colaborador encontrado</p>
          ) : (
            paginaAtual.map((c, i) => {
              const foraDaEscala = foraDeEscalaSet.has(c.opsId);
              return (
                <div
                  key={c.opsId || i}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl mb-1 border transition-colors ${
                    foraDaEscala
                      ? "border-[#FFD60A]/40 bg-[#FFD60A]/10"
                      : "border-transparent hover:bg-surface-2"
                  }`}
                  title={foraDaEscala ? "Lançamento em dia de DSR — trabalhou fora da escala" : undefined}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    {foraDaEscala && (
                      <AlertTriangle size={13} className="shrink-0" style={{ color: FORA_ESCALA_COLOR }} />
                    )}
                    <span
                      className="text-sm truncate"
                      style={{ color: foraDaEscala ? FORA_ESCALA_COLOR : "var(--color-text)" }}
                    >
                      {c.nome}
                    </span>
                  </span>
                  <span className="text-xs text-muted shrink-0 ml-3 truncate max-w-[40%]">{c.setor}</span>
                </div>
              );
            })
          )}
        </div>

        {/* PAGINAÇÃO */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-default shrink-0">
            <span className="text-xs text-muted">
              Página {pageClamped} de {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageClamped === 1}
                className="p-1.5 rounded-lg text-muted hover:text-page hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageClamped === totalPages}
                className="p-1.5 rounded-lg text-muted hover:text-page hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StatusColaboradoresSection({
  title = "Status dos Colaboradores",
  items = [],
  footer = "",
  foraDeEscala = [],
}) {
  const [modalStatus, setModalStatus] = useState(null);

  const foraDeEscalaSet = useMemo(() => new Set(foraDeEscala), [foraDeEscala]);

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
    // Categoria informativa (sem lançamento no dia) — não é ausência/falta,
    // por isso usa neutro em vez do vermelho/laranja das demais categorias.
    if (l.includes("SEM LAN")) return "#8E8E93";
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
          const colaboradores = item.colaboradores;
          const clicavel = Array.isArray(colaboradores) && colaboradores.length > 0;

          const percentage =
            total > 0 ? (value / total) * 100 : 0;

          const color = getColor(label);

          const circumference = 2 * Math.PI * 18;
          const offset =
            circumference - (percentage / 100) * circumference;

          return (
            <div
              key={`${label}-${i}`}
              onClick={clicavel ? () => setModalStatus({ label, colaboradores, color }) : undefined}
              className={`flex items-center justify-between bg-[#121214] border border-default rounded-xl px-6 py-5 transition ${
                clicavel ? "hover:border-[#FA4C00]/50 cursor-pointer" : "hover:border-[#3A3A3C]"
              }`}
              title={clicavel ? "Ver colaboradores" : undefined}
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

      {modalStatus && (
        <ColaboradoresModal
          status={modalStatus}
          color={modalStatus.color}
          foraDeEscalaSet={foraDeEscalaSet}
          onClose={() => setModalStatus(null)}
        />
      )}
    </div>
  );
}
