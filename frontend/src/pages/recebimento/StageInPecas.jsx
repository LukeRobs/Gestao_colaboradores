// Peças de interface do Stage IN: abas de zona, cards por zona, tabelas de calor e painéis de apoio.

import { formatNumero } from "../../components/mapaOperacional/uiTokens";
import { corAging, corOcupacao, corTurno, fmtDur, rgba, zonaCurta } from "./stageInUtils";

/** Abas de zona com a contagem de cada uma (pacotes quando há Report, senão TOs). */
export function AbasZona({ abas, valor, onChange }) {
  return (
    <div role="tablist" aria-label="Zona" className="flex gap-1.5 overflow-x-auto pb-1 scroll-tema">
      {abas.map((a) => {
        const ativo = valor === a.chave;
        return (
          <button
            key={a.chave}
            role="tab"
            type="button"
            aria-selected={ativo}
            onClick={() => onChange(a.chave)}
            className={`h-10 px-3.5 inline-flex items-center gap-2 rounded-xl border text-sm font-medium whitespace-nowrap cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#FA4C00]/70 ${
              ativo ? "bg-[#FA4C00] border-[#FA4C00] text-white" : "bg-surface border-default text-muted hover:text-page hover:bg-surface-2"
            }`}
          >
            {a.cor && <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: ativo ? "#fff" : a.cor }} />}
            {a.rotulo}
            <span className={`tabular-nums text-xs px-1.5 py-0.5 rounded-md ${ativo ? "bg-black/20" : "bg-surface-2"}`}>{formatNumero(a.contagem)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Cabecalho({ titulo, subtitulo }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold leading-tight">{titulo}</h2>
      {subtitulo && <p className="text-xs text-muted mt-1">{subtitulo}</p>}
    </div>
  );
}

export function Secao({ titulo, subtitulo, indice = 0, children }) {
  return (
    <section aria-label={titulo} className="anim-in rounded-2xl border border-default bg-surface p-5" style={{ "--i": indice }}>
      <Cabecalho titulo={titulo} subtitulo={subtitulo} />
      {children}
    </section>
  );
}

/** Card de uma zona: número principal e os indicadores de apoio. `metricas`: [{ rotulo, valor }]. */
export function CardZona({ nome, cor, valor, unidade, metricas }) {
  return (
    <div className="rounded-xl border border-default bg-surface-2/50 p-4 border-t-2" style={{ borderTopColor: cor }}>
      <p className="text-xs font-semibold uppercase tracking-wide truncate" style={{ color: cor }} title={nome}>
        {zonaCurta(nome)}
      </p>
      <p className="mt-2 text-3xl leading-none font-semibold tabular-nums">{valor}</p>
      <p className="mt-1 text-xs text-muted">{unidade}</p>
      {metricas.length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {metricas.map((m) => (
            <div key={m.rotulo} className="flex gap-1">
              <dt>{m.rotulo}</dt>
              <dd className="font-semibold text-page tabular-nums">{m.valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/**
 * Tabela de calor (linhas × zonas). `linhas`: [{ rotulo, cor?, celulas: { zona: n }, total, extra? }];
 * `zonas`: [{ nome, apoio }]; `extraRotulo`: título da coluna extra opcional (ex.: SPP).
 */
export function TabelaCalor({ primeiraColuna, linhas, zonas, cores, totaisZona, totalGeral, extraRotulo, extraTotal }) {
  const maxPorZona = Object.fromEntries(zonas.map((z) => [z.nome, Math.max(1, ...linhas.map((l) => l.celulas[z.nome] || 0))]));
  const th = "px-3 py-2.5 text-xs font-medium text-muted text-right whitespace-nowrap";
  return (
    <div className="overflow-x-auto scroll-tema -mx-1 px-1">
      <table className="w-full text-sm border-separate border-spacing-y-1">
        <thead>
          <tr>
            <th className="px-3 py-2.5 text-xs font-medium text-muted text-left whitespace-nowrap">{primeiraColuna}</th>
            {zonas.map((z) => (
              <th key={z.nome} className={th} style={{ color: cores[z.nome] }}>
                {zonaCurta(z.nome)}
                <span className="block text-[11px] font-normal text-muted">{z.apoio}</span>
              </th>
            ))}
            <th className={th}>Total</th>
            {extraRotulo && <th className={th}>{extraRotulo}</th>}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.rotulo}>
              <td className="px-3 py-1.5 font-medium whitespace-nowrap" style={l.cor ? { color: l.cor } : undefined}>{l.rotulo}</td>
              {zonas.map((z) => {
                const v = l.celulas[z.nome] || 0;
                return (
                  <td key={z.nome} className="px-1.5 py-1 text-right">
                    <span
                      className={`inline-block min-w-14 rounded-lg px-2.5 py-1 tabular-nums ${v === 0 ? "text-muted" : "font-medium"}`}
                      style={v > 0 ? { background: rgba(cores[z.nome], 0.07 + (v / maxPorZona[z.nome]) * 0.5) } : undefined}
                    >
                      {v > 0 ? formatNumero(v) : "—"}
                    </span>
                  </td>
                );
              })}
              <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatNumero(l.total)}</td>
              {extraRotulo && <td className="px-3 py-1.5 text-right tabular-nums text-muted">{l.extra ?? "—"}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-default">
            <td className="px-3 pt-2.5 font-semibold">Total</td>
            {zonas.map((z) => (
              <td key={z.nome} className="px-3 pt-2.5 text-right font-semibold tabular-nums" style={{ color: cores[z.nome] }}>
                {formatNumero(totaisZona[z.nome] || 0)}
              </td>
            ))}
            <td className="px-3 pt-2.5 text-right font-semibold tabular-nums">{formatNumero(totalGeral)}</td>
            {extraRotulo && <td className="px-3 pt-2.5 text-right font-semibold tabular-nums text-muted">{extraTotal ?? "—"}</td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Top 5 ruas com maior aging. */
export function PainelTop5({ ruas, cores, indice }) {
  return (
    <Secao titulo="Top 5 ruas por aging" subtitulo="As ruas com TOs há mais tempo no staging" indice={indice}>
      {ruas.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">Nenhuma rua ativa</p>
      ) : (
        <ol className="space-y-2">
          {ruas.map((r, i) => (
            <li key={r.nome} className="flex items-center gap-3 rounded-xl bg-surface-2/60 px-3 py-2.5">
              <span aria-hidden="true" className="grid place-items-center w-6 h-6 rounded-lg bg-surface text-xs font-semibold text-muted tabular-nums shrink-0">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" title={r.nome}>{r.nome}</p>
                <p className="text-xs truncate text-muted tabular-nums">
                  <span style={{ color: cores[r.zona] }}>{zonaCurta(r.zona)}</span> · {r.tos} TOs{r.pacotes != null ? ` · ${formatNumero(r.pacotes)} pcts` : ""}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: corAging(r.aging) }}>{fmtDur(r.aging)}</span>
            </li>
          ))}
        </ol>
      )}
    </Secao>
  );
}

/** Ocupação (TOs ÷ capacidade) por zona, só com as ruas disponíveis. */
export function PainelOcupacao({ linhas, cores, indice }) {
  return (
    <Secao titulo="Ocupação por zona" subtitulo="TOs em relação à capacidade das ruas disponíveis" indice={indice}>
      {linhas.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">—</p>
      ) : (
        <ul className="space-y-3.5">
          {linhas.map((l) => (
            <li key={l.zona}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium truncate" style={{ color: cores[l.zona] }}>{zonaCurta(l.zona)}</span>
                <span className="tabular-nums text-muted text-xs shrink-0">
                  {l.tos}/{l.capacidade} · <b className="text-page text-sm">{l.pct.toFixed(1).replace(".", ",")}%</b>
                </span>
              </div>
              <div role="img" aria-label={`Ocupação de ${zonaCurta(l.zona)}: ${l.pct.toFixed(0)}%`} className="mt-1.5 h-2 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.min(l.pct, 100)}%`, background: corOcupacao(l.pct) }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

/** Pacotes por turno que endereçou (rosca em SVG + legenda). */
export function PainelTurno({ turnos, indice }) {
  const R = 38;
  const C = 2 * Math.PI * R;
  const total = turnos.reduce((s, t) => s + t.pacotes, 0);
  const segmentos = turnos.map((t, i) => {
    const antes = turnos.slice(0, i).reduce((s, x) => s + x.pacotes, 0);
    const fracao = total > 0 ? t.pacotes / total : 0;
    return { ...t, cor: corTurno(t.nome, i), fracao, tamanho: fracao * C, inicio: C * (0.25 - (total > 0 ? antes / total : 0)) };
  });
  return (
    <Secao titulo="Turno que endereçou" subtitulo="Pacotes por turno em que a TO foi endereçada" indice={indice}>
      {turnos.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">Sem dados do Report</p>
      ) : (
        <div className="flex items-center gap-5 flex-wrap">
          <div className="relative w-32 h-32 shrink-0">
            <svg viewBox="0 0 100 100" width="128" height="128" role="img" aria-label="Pacotes por turno" className="block -rotate-0">
              <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-surface-2)" strokeWidth="17" />
              {segmentos.map((s) => (
                <circle key={s.nome} cx="50" cy="50" r={R} fill="none" stroke={s.cor} strokeWidth="17" strokeDasharray={`${s.tamanho.toFixed(3)} ${(C - s.tamanho).toFixed(3)}`} strokeDashoffset={s.inicio.toFixed(3)} />
              ))}
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">
              <div>
                <p className="text-xl font-semibold tabular-nums leading-none">{formatNumero(total)}</p>
                <p className="text-[11px] text-muted mt-1">pacotes</p>
              </div>
            </div>
          </div>
          <ul className="flex-1 min-w-40 space-y-2">
            {segmentos.map((s) => (
              <li key={s.nome} className="flex items-center gap-2.5 text-sm">
                <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.cor }} />
                <span className="font-medium">{s.nome}</span>
                <span className="text-xs text-muted tabular-nums">{(s.fracao * 100).toFixed(1).replace(".", ",")}%</span>
                <span className="ml-auto font-semibold tabular-nums">{formatNumero(s.pacotes)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Secao>
  );
}
