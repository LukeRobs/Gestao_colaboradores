// Peças de interface do Transbordo: gráfico por hora, origens, selo de status e os modais da TO e do veículo (LT).

import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, CircleAlert, CircleCheck, X } from "lucide-react";
import { FOCO, formatNumero } from "../../components/mapaOperacional/uiTokens";
import { Campo, Paginacao, Pilula } from "./FilaPecas";
import { fmtDuracao, fmtInstante } from "./filaUtils";
import { METRICAS, fmtHora, fmtKg, temExcecao } from "./transbordoUtils";

const COR = "#FA4C00";
const reduzirMovimento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const EIXO = { tick: { fill: "var(--color-muted)", fontSize: 11 }, axisLine: false, tickLine: false };
const GRADE = { stroke: "var(--color-border)", strokeDasharray: "2 4", strokeOpacity: 0.9 };
const compacto = (n) => (n >= 1000 ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(n));
const rotuloValor = (v) => (v > 0 ? (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : String(v)) : "");

/** Selo de status da TO: exceção (com o motivo no título) ou OK. */
export function SeloStatus({ t }) {
  return temExcecao(t) ? (
    <Pilula cor="#FF453A" icone={<CircleAlert size={12} aria-hidden="true" />}>Exceção</Pilula>
  ) : (
    <Pilula cor="#22C55E" icone={<CircleCheck size={12} aria-hidden="true" />}>OK</Pilula>
  );
}

function TooltipHora({ active, payload, label, unidade }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-default bg-surface px-3.5 py-3 shadow-xl text-xs min-w-[150px]">
      <p className="font-semibold text-page mb-1.5">{`${label}:00 às ${label}:59`}</p>
      <p className="tabular-nums text-muted">
        <b className="text-page text-sm">{formatNumero(payload[0].value)}</b> {unidade}
      </p>
    </div>
  );
}

/** Colunas por hora do dia operacional, com o valor sobre cada coluna. Anima só na entrada (a tela atualiza de tempos em tempos). */
export function ColunasHora({ dados, metrica }) {
  const [animar, setAnimar] = useState(() => !reduzirMovimento());
  useEffect(() => {
    const t = setTimeout(() => setAnimar(false), 1200);
    return () => clearTimeout(t);
  }, []);
  const unidade = METRICAS[metrica].unidade;
  return (
    <div className="h-64" role="img" aria-label={`Gráfico de ${unidade} escaneados por hora do dia operacional`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 22, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid {...GRADE} vertical={false} />
          <XAxis dataKey="hora" {...EIXO} interval={0} />
          <YAxis {...EIXO} width={48} allowDecimals={false} tickFormatter={compacto} />
          <Tooltip content={<TooltipHora unidade={unidade} />} cursor={{ fill: "var(--color-surface-2)", opacity: 0.7 }} />
          <Bar dataKey="valor" fill={COR} radius={[6, 6, 0, 0]} maxBarSize={26} isAnimationActive={animar}>
            <LabelList dataKey="valor" position="top" formatter={rotuloValor} style={{ fill: "var(--color-muted)", fontSize: 10, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Origens em barras, na métrica escolhida; embaixo de cada nome, os outros dois números. */
export function ListaOrigens({ origens, metrica }) {
  if (origens.length === 0) return <p className="text-sm text-muted text-center py-10">Nenhuma TO no período selecionado</p>;
  const maior = Math.max(1, origens[0][metrica]);
  return (
    <ul className="space-y-3.5 max-h-64 overflow-y-auto scroll-tema pr-1">
      {origens.map((o) => (
        <li key={o.nome} title={o.nome}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{o.nome}</span>
            <span className="font-semibold tabular-nums shrink-0">{formatNumero(o[metrica])}</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.max(4, (o[metrica] / maior) * 100)}%`, background: COR }} />
          </div>
          <p className="mt-1 text-[11px] text-muted tabular-nums">
            {formatNumero(o.veiculos)} {o.veiculos === 1 ? "veículo" : "veículos"} · {formatNumero(o.tos)} TOs · {formatNumero(o.pacotes)} pacotes
          </p>
        </li>
      ))}
    </ul>
  );
}

function useModal(onClose) {
  const fechar = useRef(null);
  useEffect(() => {
    fechar.current?.focus();
    const aoTeclar = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);
  return fechar;
}

function Tiles({ itens }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {itens.map((k) => (
        <div key={k.rotulo} className="rounded-xl border border-default bg-surface-2 p-3">
          <dt className="text-[11px] uppercase tracking-wide text-muted">{k.rotulo}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums" style={k.cor ? { color: k.cor } : undefined}>{k.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function Casca({ id, titulo, subtitulo, pilulas, fechar, onClose, largura = "max-w-2xl", children }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={id} className={`w-full ${largura} max-h-[90vh] overflow-y-auto scroll-tema rounded-2xl bg-surface border border-default shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start gap-3 px-6 py-4 border-b border-default bg-surface">
          <div className="min-w-0">
            <h2 id={id} className="font-semibold tabular-nums text-lg text-[#FA4C00] truncate">{titulo}</h2>
            <p className="text-sm text-muted mt-0.5">{subtitulo || "—"}</p>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {pilulas}
            <button ref={fechar} type="button" onClick={onClose} aria-label="Fechar detalhe" className={`h-10 w-10 grid place-items-center rounded-lg text-muted hover:text-page hover:bg-surface-2 cursor-pointer ${FOCO}`}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-6">{children}</div>
      </div>
    </div>
  );
}

/** Detalhe de uma TO. */
export function ModalTO({ t, onClose }) {
  const fechar = useModal(onClose);
  return (
    <Casca id="tb-to-titulo" titulo={t.toNumber} subtitulo={[t.packTypeName, t.loadedStationName].filter(Boolean).join(" · ")} pilulas={<SeloStatus t={t} />} fechar={fechar} onClose={onClose} largura="max-w-xl">
      {temExcecao(t) && (
        <div role="alert" className="flex gap-2 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 px-3 py-2.5 text-sm text-[#FF453A]">
          <CircleAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{t.abnormalLabels.join(", ")}</span>
        </div>
      )}
      <Tiles
        itens={[
          { rotulo: "Pacotes", valor: formatNumero(t.parcels) },
          { rotulo: "Peso", valor: `${fmtKg(t.weightG)} kg` },
          { rotulo: "Hora do scan", valor: fmtHora(t) },
          { rotulo: "Turno", valor: t.turno || "—" },
        ]}
      />
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo rotulo="Estação remetente">{t.loadedStationName}</Campo>
        <Campo rotulo="Estação destino">{t.unloadedStationName}</Campo>
        <Campo rotulo="Doca">{t.dockNumber}</Campo>
        <Campo rotulo="Operador">{t.operator}</Campo>
        <Campo rotulo="Viagem (LT)" mono>{t.tripNumber}</Campo>
        <Campo rotulo="Placa" mono>{t.vehicleNumber}</Campo>
        <Campo rotulo="Motorista">{t.driverName}</Campo>
      </dl>
    </Casca>
  );
}

/** Detalhe de um veículo (LT): totais, janela de scan e as TOs dele. */
export function ModalVeiculo({ v, onClose }) {
  const fechar = useModal(onClose);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const itens = useMemo(() => [...v.itens].sort((a, b) => (b.scanEm || "").localeCompare(a.scanEm || "")), [v]);
  const totalPaginas = Math.max(1, Math.ceil(itens.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = itens.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);
  return (
    <Casca
      id="tb-lt-titulo"
      titulo={v.lt || v.placa || "Veículo"}
      subtitulo={[v.placa, v.motorista].filter(Boolean).join(" · ")}
      pilulas={v.excecoes > 0 ? <Pilula cor="#FF453A" icone={<CircleAlert size={12} aria-hidden="true" />}>{v.excecoes} {v.excecoes === 1 ? "exceção" : "exceções"}</Pilula> : <Pilula cor="#22C55E" icone={<CircleCheck size={12} aria-hidden="true" />}>Sem exceções</Pilula>}
      fechar={fechar}
      onClose={onClose}
      largura="max-w-3xl"
    >
      <Tiles
        itens={[
          { rotulo: "TOs", valor: formatNumero(v.tos) },
          { rotulo: "Pacotes", valor: formatNumero(v.pacotes) },
          { rotulo: "Peso", valor: `${fmtKg(v.pesoG)} kg` },
          { rotulo: "Tempo de scan", valor: v.duracaoMin > 0 ? fmtDuracao(v.duracaoMin) : "—" },
        ]}
      />
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Campo rotulo="Origem">{v.origem ? `${v.origem}${v.outrasOrigens ? ` +${v.outrasOrigens}` : ""}` : null}</Campo>
        <Campo rotulo="Doca">{v.doca}</Campo>
        <Campo rotulo="Primeiro scan" mono>{fmtInstante(v.primeiroScan)}</Campo>
        <Campo rotulo="Último scan" mono>{fmtInstante(v.ultimoScan)}</Campo>
      </dl>

      <section aria-label="TOs do veículo" className="rounded-xl border border-default overflow-hidden">
        <h3 className="px-4 py-3 text-xs uppercase tracking-wide text-muted bg-surface-2">TOs deste veículo</h3>
        <div className="overflow-x-auto scroll-tema">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted text-left border-b border-default">
                <th className="px-4 py-2.5 font-medium">TO</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium text-right">Pacotes</th>
                <th className="px-4 py-2.5 font-medium text-right">Peso</th>
                <th className="px-4 py-2.5 font-medium">Scan</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {daPagina.map((t) => (
                <tr key={t.toNumber}>
                  <td className="px-4 py-2.5 whitespace-nowrap font-medium tabular-nums text-[#FA4C00]">{t.toNumber}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted">{t.packTypeName || "—"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatNumero(t.parcels)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted whitespace-nowrap">{fmtKg(t.weightG)} kg</td>
                  <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">{fmtHora(t)}</td>
                  <td className="px-4 py-2.5"><SeloStatus t={t} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginacao total={itens.length} pagina={paginaAtual} porPagina={porPagina} onPagina={setPagina} onPorPagina={(n) => { setPorPagina(n); setPagina(1); }} />
      </section>
    </Casca>
  );
}

/** "HH:mm → HH:mm" da janela de scan de um veículo. */
export function JanelaScan({ v }) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span className="font-medium">{fmtInstante(v.primeiroScan)}</span>
      <ArrowRight size={13} className="text-muted" aria-label="até" />
      <span className="font-medium">{fmtInstante(v.ultimoScan)}</span>
    </span>
  );
}
