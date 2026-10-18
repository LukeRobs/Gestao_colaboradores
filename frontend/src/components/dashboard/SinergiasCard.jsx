import { Send } from "lucide-react";

const TURNO_COLORS = { T1: "#3B82F6", T2: "#FA4C00", T3: "#A855F7" };
const FALLBACK_COLORS = ["#22C55E", "#F59E0B", "#14B8A6", "#EC4899", "#71717A"];

function corDoTurno(turno, i) {
  return TURNO_COLORS[turno] || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
}

// Esconde o número dentro do segmento quando ele é estreito demais para caber
const MIN_PCT_PARA_ROTULO = 9;

export default function SinergiasCard({ data = {} }) {
  const { total = 0, turnos = [], porDestino = [] } = data;
  const maxQuantidade = Math.max(1, ...porDestino.map((d) => d.quantidade));

  return (
    <div className="bg-surface border border-default rounded-2xl p-5 space-y-5">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FA4C00]/10 flex items-center justify-center shrink-0">
            <Send size={16} className="text-[#FA4C00]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-page leading-tight">
              Sinergias Enviadas por Área
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Pessoas únicas com sinergia aprovada no período
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-2xl font-bold text-page tabular-nums leading-none">{total}</p>
          <p className="text-[11px] text-muted uppercase tracking-wide mt-1">
            {total === 1 ? "pessoa" : "pessoas"}
          </p>
        </div>
      </div>

      {total === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted">Nenhuma sinergia aprovada no período</p>
        </div>
      ) : (
        <>
          {/* LEGENDA */}
          {turnos.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {turnos.map((t, i) => (
                <span key={t} className="flex items-center gap-1.5 text-xs text-muted">
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: corDoTurno(t, i) }}
                  />
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* RANKING POR DESTINO */}
          <ul className="space-y-4">
            {porDestino.map((d) => {
              const larguraBarra = (d.quantidade / maxQuantidade) * 100;

              return (
                <li key={d.destino}>
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <span className="text-sm font-medium text-page truncate">{d.label}</span>
                    <span className="text-sm tabular-nums shrink-0">
                      <span className="font-semibold text-page">{d.quantidade}</span>
                      <span className="text-muted"> · {d.percentual}%</span>
                    </span>
                  </div>

                  <div className="h-6 w-full rounded-md bg-surface-2 overflow-hidden">
                    <div
                      className="h-full flex rounded-md overflow-hidden transition-[width] duration-500 ease-out"
                      style={{ width: `${larguraBarra}%` }}
                    >
                      {turnos.map((t, i) => {
                        const qtd = d.porTurno?.[t] || 0;
                        if (!qtd) return null;
                        const pctNaBarra = (qtd / d.quantidade) * 100;
                        const pctNoTrilho = (pctNaBarra * larguraBarra) / 100;

                        return (
                          <div
                            key={t}
                            title={`${t}: ${qtd} ${qtd === 1 ? "pessoa" : "pessoas"}`}
                            className="h-full flex items-center justify-center text-[11px] font-semibold text-white tabular-nums border-r border-black/10 last:border-r-0"
                            style={{ width: `${pctNaBarra}%`, backgroundColor: corDoTurno(t, i) }}
                          >
                            {pctNoTrilho >= MIN_PCT_PARA_ROTULO ? qtd : ""}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="text-[11px] text-muted pt-3 border-t border-default">
            Separado pelo turno atual do colaborador. Quem foi enviado a mais de uma área
            conta em cada uma, por isso os percentuais podem somar mais de 100%.
          </p>
        </>
      )}
    </div>
  );
}
