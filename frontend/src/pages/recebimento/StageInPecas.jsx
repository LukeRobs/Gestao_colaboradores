// Peças de interface do Stage IN: filtro de zona, cards por zona, gráfico de aging, perfil, tabelas de calor e painéis de apoio.

import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CircleCheck, Gauge, Layers, ListOrdered, Sun, TriangleAlert } from "lucide-react";
import { formatNumero } from "../../components/mapaOperacional/uiTokens";
import { CardGrafico } from "./PrevisaoPecas";
import { LinhaSincronizacao, Pilula } from "./FilaPecas";
import { corAging, corOcupacao, corTurno, fmtDur, rgba, zonaCurta } from "./stageInUtils";

const reduzirMovimento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const EIXO = { tick: { fill: "var(--color-muted)", fontSize: 11 }, axisLine: false, tickLine: false };
const GRADE = { stroke: "var(--color-border)", strokeDasharray: "2 4", strokeOpacity: 0.9 };
const compacto = (n) => (n >= 1000 ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(n));
const rotuloValor = (v) => (v > 0 ? (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : String(v)) : "");

/** Zona: chip com a zona escolhida, pílulas para trocar (com a contagem) e a linha de sincronização. */
export function FiltroZona({ abas, valor, onChange, rotuloAtual, sincronizacao }) {
  return (
    <section aria-label="Zona" className="anim-in rounded-2xl border border-default bg-surface p-4 space-y-4">
      <div className="flex items-center gap-3 min-w-0">
        <span aria-hidden="true" className="grid place-items-center w-10 h-10 rounded-xl bg-[#FA4C00]/12 text-[#FA4C00] shrink-0">
          <Layers size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted">Zona do staging</p>
          <p className="text-base font-semibold truncate">{rotuloAtual}</p>
        </div>
      </div>

      <div role="tablist" aria-label="Zona" className="flex gap-2 overflow-x-auto pb-1 scroll-tema">
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
                ativo ? "bg-[#FA4C00] border-[#FA4C00] text-white" : "bg-surface-2/60 border-default text-muted hover:text-page hover:bg-surface-2"
              }`}
            >
              {a.cor && <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: ativo ? "#fff" : a.cor }} />}
              {a.rotulo}
              <span className={`tabular-nums text-xs px-1.5 py-0.5 rounded-md ${ativo ? "bg-black/20" : "bg-surface"}`}>{formatNumero(a.contagem)}</span>
            </button>
          );
        })}
      </div>

      <LinhaSincronizacao sincronizacao={sincronizacao} />
    </section>
  );
}

/** Card de uma zona: número principal, participação no total e os indicadores de apoio. `metricas`: [{ rotulo, valor }]. */
export function CardZona({ nome, cor, valor, unidade, metricas, participacao }) {
  return (
    <div className="rounded-xl border border-default bg-surface-2/50 p-4 flex flex-col">
      <div className="flex items-center gap-2 min-w-0">
        <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cor }} />
        <p className="text-xs font-semibold uppercase tracking-wide truncate" title={nome}>{zonaCurta(nome)}</p>
      </div>
      <p className="mt-3 text-3xl leading-none font-semibold tabular-nums">{valor}</p>
      <p className="mt-1 text-xs text-muted">{unidade}</p>
      {participacao != null && (
        <div className="mt-3">
          <div role="img" aria-label={`${participacao.toFixed(0)}% do total`} className="h-1.5 rounded-full bg-surface overflow-hidden">
            <div className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.max(participacao, 2)}%`, background: cor }} />
          </div>
          <p className="mt-1 text-[11px] text-muted tabular-nums">{participacao.toFixed(1).replace(".", ",")}% do total</p>
        </div>
      )}
      {metricas.length > 0 && (
        <dl className="mt-3 pt-3 border-t border-default flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
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

function TooltipAging({ active, payload, label, zonas }) {
  if (!active || !payload?.length) return null;
  const linhas = payload.filter((p) => p.dataKey !== "total" && p.value > 0);
  const total = payload.find((p) => p.dataKey === "total")?.value ?? linhas.reduce((s, p) => s + p.value, 0);
  return (
    <div className="rounded-xl border border-default bg-surface px-3.5 py-3 shadow-xl text-xs min-w-[170px]">
      <p className="font-semibold text-page mb-2">Aging {label}</p>
      <ul className="space-y-1.5">
        {linhas.map((p) => (
          <li key={p.dataKey} className="flex items-center gap-2">
            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
            <span className="text-muted truncate max-w-32">{zonaCurta(zonas[p.dataKey])}</span>
            <span className="ml-auto font-semibold tabular-nums text-page">{formatNumero(p.value)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 pt-2 border-t border-default text-muted tabular-nums">Total · <b className="text-page">{formatNumero(total)}</b></p>
    </div>
  );
}

/** Colunas empilhadas por zona: pacotes (ou TOs) por faixa de aging. */
export function GraficoAging({ linhas, zonas, cores }) {
  // Anima só na entrada: a tela atualiza a cada poucos segundos e as colunas não podem recomeçar do zero.
  const [animar, setAnimar] = useState(() => !reduzirMovimento());
  useEffect(() => {
    const t = setTimeout(() => setAnimar(false), 1200);
    return () => clearTimeout(t);
  }, []);
  const chaves = useMemo(() => Object.fromEntries(zonas.map((z, i) => [`z${i}`, z.nome])), [zonas]);
  const dados = useMemo(
    () => linhas.map((l) => ({ faixa: l.rotulo, total: l.total, ...Object.fromEntries(zonas.map((z, i) => [`z${i}`, l.celulas[z.nome] || 0])) })),
    [linhas, zonas]
  );
  return (
    <div>
      <ul className="flex flex-wrap gap-2 mb-3 text-xs text-muted" aria-label="Legenda do gráfico">
        {zonas.map((z) => (
          <li key={z.nome} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1">
            <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: cores[z.nome] }} />
            {zonaCurta(z.nome)}
          </li>
        ))}
      </ul>
      <div className="h-72" role="img" aria-label="Pacotes por faixa de aging, empilhados por zona">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados} margin={{ top: 22, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid {...GRADE} vertical={false} />
            <XAxis dataKey="faixa" {...EIXO} interval={0} />
            <YAxis {...EIXO} width={48} allowDecimals={false} tickFormatter={compacto} />
            <Tooltip content={<TooltipAging zonas={chaves} />} cursor={{ fill: "var(--color-surface-2)", opacity: 0.7 }} />
            {zonas.map((z, i) => (
              <Bar key={z.nome} dataKey={`z${i}`} stackId="aging" fill={cores[z.nome]} maxBarSize={44} radius={i === zonas.length - 1 ? [6, 6, 0, 0] : 0} isAnimationActive={animar} />
            ))}
            <Line dataKey="total" stroke="none" dot={false} activeDot={false} legendType="none" isAnimationActive={false}>
              <LabelList dataKey="total" position="top" offset={6} formatter={rotuloValor} style={{ fill: "var(--color-muted)", fontSize: 10, fontWeight: 700 }} />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
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

/** Composição do perfil de pacote: barra única e um bloco por perfil (valor e participação). */
export function ComposicaoPerfil({ perfis, totais, total }) {
  return (
    <div>
      <div role="img" aria-label="Composição por perfil de pacote" className="flex h-3 w-full gap-0.5 rounded-full overflow-hidden bg-surface-2">
        {total > 0 &&
          perfis
            .filter((p) => totais[p.chave] > 0)
            .map((p) => (
              <span key={p.chave} title={`${p.rotulo}: ${formatNumero(totais[p.chave])}`} className="h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${(totais[p.chave] / total) * 100}%`, background: p.cor }} />
            ))}
      </div>
      <ul className="mt-4 grid gap-2 grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
        {perfis.map((p) => (
          <li key={p.chave} className="rounded-xl bg-surface-2/60 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: p.cor }} />
              {p.rotulo}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums leading-none">{formatNumero(totais[p.chave])}</p>
            <p className="mt-1 text-[11px] text-muted tabular-nums">{total ? ((totais[p.chave] / total) * 100).toFixed(1).replace(".", ",") : "0,0"}%</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Criticidade de aging: pacotes por faixa de tempo de cada TO, com a gravidade da faixa.
 * Clicar numa faixa filtra a tabela de ruas (`ativa` é a faixa escolhida; clicar de novo limpa).
 */
export function AgingCritico({ info, ativa, onSelecionar, indice }) {
  const maior = Math.max(...info.faixas.map((f) => f.pacotes), 1);
  const alerta = info.alerta;
  return (
    <CardGrafico
      icone={<TriangleAlert size={17} />}
      titulo="Criticidade de aging"
      subtitulo={`Backlog por tempo de cada TO em staging · ${formatNumero(info.total)} pacotes · clique numa faixa para filtrar as ruas`}
      indice={indice}
      legenda={
        alerta ? (
          <Pilula cor="#FF453A" icone={<TriangleAlert size={12} aria-hidden="true" />}>{alerta.texto}</Pilula>
        ) : (
          <Pilula cor="#22C55E" icone={<CircleCheck size={12} aria-hidden="true" />}>Aging dentro dos limites operacionais</Pilula>
        )
      }
    >
      <ul className="space-y-2">
        {info.faixas.map((f) => {
          const marcada = ativa?.chave === f.chave;
          return (
            <li key={f.chave}>
              <button
                type="button"
                aria-pressed={marcada}
                onClick={() => onSelecionar(marcada ? null : f)}
                title={f.dica}
                className={`w-full grid items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 text-left cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#FA4C00]/70 grid-cols-[1fr_auto] sm:grid-cols-[8.5rem_6.5rem_1fr_3.5rem_7.5rem] ${
                  marcada ? "border-[#FA4C00] bg-[#FA4C00]/8" : "border-default bg-surface-2/50 hover:bg-surface-2"
                }`}
              >
                <span className="text-sm font-semibold" style={{ color: f.cor }}>{f.rotulo}</span>
                <span className="text-right sm:text-left">
                  <span className="block text-base font-semibold tabular-nums leading-none" style={{ color: f.cor }}>{formatNumero(f.pacotes)}</span>
                  <span className="block mt-1 text-[11px] text-muted tabular-nums">{f.tos} {f.tos === 1 ? "TO" : "TOs"}</span>
                </span>
                <span role="img" aria-label={`${f.pct.toFixed(1)}% do total`} className="col-span-2 sm:col-span-1 h-2 rounded-full bg-surface overflow-hidden">
                  <span className="block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${(f.pacotes / maior) * 100}%`, background: f.cor }} />
                </span>
                <span className="text-sm font-semibold tabular-nums sm:text-right" style={{ color: f.cor }}>{f.pct.toFixed(1).replace(".", ",")}%</span>
                <span className="justify-self-end sm:justify-self-start">
                  <Pilula cor={f.cor}>{f.status}</Pilula>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </CardGrafico>
  );
}

/** Top 5 ruas com maior aging. */
export function PainelTop5({ ruas, cores, indice }) {
  return (
    <CardGrafico icone={<ListOrdered size={17} />} titulo="Top 5 ruas por aging" subtitulo="As ruas com TOs há mais tempo no staging" indice={indice}>
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
    </CardGrafico>
  );
}

/** Ocupação (TOs ÷ capacidade) por zona, só com as ruas disponíveis. */
export function PainelOcupacao({ linhas, cores, indice }) {
  return (
    <CardGrafico icone={<Gauge size={17} />} titulo="Ocupação por zona" subtitulo="TOs em relação à capacidade das ruas disponíveis" indice={indice}>
      {linhas.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">—</p>
      ) : (
        <ul className="space-y-3.5">
          {linhas.map((l) => (
            <li key={l.zona}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="inline-flex items-center gap-2 font-medium truncate">
                  <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: cores[l.zona] }} />
                  {zonaCurta(l.zona)}
                </span>
                <span className="tabular-nums text-muted text-xs shrink-0">
                  {l.tos}/{l.capacidade} · <b className="text-sm" style={{ color: corOcupacao(l.pct) }}>{l.pct.toFixed(1).replace(".", ",")}%</b>
                </span>
              </div>
              <div role="img" aria-label={`Ocupação de ${zonaCurta(l.zona)}: ${l.pct.toFixed(0)}%`} className="mt-1.5 h-2 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.min(l.pct, 100)}%`, background: corOcupacao(l.pct) }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </CardGrafico>
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
    <CardGrafico icone={<Sun size={17} />} titulo="Turno que endereçou" subtitulo="Pacotes por turno em que a TO foi endereçada" indice={indice}>
      {turnos.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">Sem dados do Report</p>
      ) : (
        <div className="flex items-center gap-5 flex-wrap">
          <div className="relative w-32 h-32 shrink-0">
            <svg viewBox="0 0 100 100" width="128" height="128" role="img" aria-label="Pacotes por turno" className="block">
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
    </CardGrafico>
  );
}
