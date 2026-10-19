import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Boxes, CalendarDays, CircleAlert, CircleCheck, Circle, Clock, Gauge, Hourglass, Inbox, Info, Package, Search, Truck, X } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MainLayout from "../../components/MainLayout";
import { Aviso, DiaNavegador, EstadoVazio, Esqueleto, PageHeader } from "../../components/mapaOperacional/ui";
import { BTN_SECUNDARIO, FOCO, INPUT, formatNumero } from "../../components/mapaOperacional/uiTokens";
import { FilaRecebimentoAPI } from "../../services/filaRecebimento";
import { corEspera, fmtDuracao, fmtInstante, fmtPeso } from "./filaUtils";
import { BlocoEstacao, Campo, ComposicaoCarga, Paginacao, Pilula } from "./FilaPecas";
import { Kpi, KpiDestaque } from "./PrevisaoPecas";

const POLL_MS = 60000; // o dia atual se atualiza sozinho; dia passado não muda
const fmtDataBR = (iso) => iso.split("-").reverse().join("/");
const ms = (iso) => (iso ? new Date(iso).getTime() : 0);
const segParaIso = (sec) => (sec ? new Date(sec * 1000).toISOString() : null);
const docaDe = (r) => r.docaOcupada || r.docaAtribuida || "";
const divergente = (r) => r.esperados > 0 && r.descarregados < r.esperados;

const COLUNAS = [
  { chave: "placa", rotulo: "Veículo", valor: (r) => (r.placa || "").toLowerCase() },
  { chave: "tripNumber", rotulo: "LH · origem", valor: (r) => (r.tripNumber || "").toLowerCase() },
  { chave: "chegada", rotulo: "Chegada → fim", valor: (r) => ms(r.chegouEm) },
  { chave: "tempo", rotulo: "Na estação", valor: (r) => r.tempoNaEstacaoMin ?? -1 },
  { chave: "espera", rotulo: "Espera", titulo: "Espera na fila", valor: (r) => r.esperaMaxMin ?? 0 },
  { chave: "doca", rotulo: "Doca", valor: (r) => docaDe(r).toLowerCase() },
  { chave: "pacotes", rotulo: "Pacotes", direita: true, valor: (r) => r.pacotes ?? 0 },
  { chave: "descarga", rotulo: "TOs", titulo: "TOs descarregadas", direita: true, valor: (r) => r.descarregados ?? 0 },
  { chave: "motorista", rotulo: "Motorista", valor: (r) => (r.motorista || "").toLowerCase() },
];

function ordenar(lista, chave, asc) {
  const col = COLUNAS.find((c) => c.chave === chave);
  return [...lista].sort((a, b) => {
    const va = col.valor(a);
    const vb = col.valor(b);
    const r = typeof va === "number" ? va - vb : va.localeCompare(vb);
    return asc ? r : -r;
  });
}

function PassoLinha({ rotulo, valor }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      {valor ? <CircleCheck size={15} className="text-[#22C55E] shrink-0" aria-hidden="true" /> : <Circle size={15} className="text-muted shrink-0" aria-hidden="true" />}
      <span className={valor ? "" : "text-muted"}>{rotulo}</span>
      <span className="ml-auto tabular-nums text-muted">{fmtInstante(valor, { comData: true })}</span>
    </li>
  );
}

function ModalViagem({ r, onClose }) {
  const fechar = useRef(null);
  useEffect(() => {
    fechar.current?.focus();
    const aoTeclar = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const d = r.detalhe || {};
  const o = d.origem;
  const dest = d.destino;
  const diverge = divergente(r);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vr-titulo"
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-surface border border-default shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 px-6 py-4 border-b border-default bg-surface">
          <div className="min-w-0">
            <h2 id="vr-titulo" className="font-semibold tabular-nums text-lg text-[#FA4C00] truncate">{r.tripNumber}</h2>
            <p className="text-sm text-muted mt-0.5">{[r.placa, r.tipoVeiculo].filter(Boolean).join(" · ") || "—"}</p>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Pilula cor="#22C55E" icone={<CircleCheck size={12} aria-hidden="true" />}>Finalizada</Pilula>
            {diverge && <Pilula cor="#F59E0B" icone={<CircleAlert size={12} aria-hidden="true" />}>Descarga incompleta</Pilula>}
            <button ref={fechar} type="button" onClick={onClose} aria-label="Fechar detalhe" className={`h-10 w-10 grid place-items-center rounded-lg text-muted hover:text-page hover:bg-surface-2 cursor-pointer ${FOCO}`}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { rotulo: "Tempo na estação", valor: fmtDuracao(r.tempoNaEstacaoMin), cor: undefined },
              { rotulo: "Espera na fila", valor: r.esperaMaxMin > 0 ? fmtDuracao(r.esperaMaxMin) : "—", cor: r.esperaMaxMin > 0 ? corEspera(r.esperaMaxMin) : undefined },
              { rotulo: "TOs descarregadas", valor: r.esperados > 0 ? `${formatNumero(r.descarregados)} de ${formatNumero(r.esperados)}` : formatNumero(r.descarregados), cor: diverge ? "#F59E0B" : undefined },
              { rotulo: "Peso total", valor: fmtPeso(r.pesoG), cor: undefined },
            ].map((k) => (
              <div key={k.rotulo} className="rounded-xl border border-default bg-surface-2 p-3">
                <dt className="text-[11px] uppercase tracking-wide text-muted">{k.rotulo}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums" style={k.cor ? { color: k.cor } : undefined}>{k.valor}</dd>
              </div>
            ))}
          </dl>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-4">
                <Campo rotulo="Motorista">{r.motorista}</Campo>
                <Campo rotulo="Agência">{r.agencia}</Campo>
                <Campo rotulo="Doca atribuída">{r.docaAtribuida}</Campo>
                <Campo rotulo="Doca ocupada">{r.docaOcupada}</Campo>
                <Campo rotulo="Número da fila" mono>{r.filaNumero}</Campo>
                <Campo rotulo="Pacotes" mono>{r.pacotes > 0 ? formatNumero(r.pacotes) : null}</Campo>
              </dl>
              {r.tripName && <Campo rotulo="Viagem">{r.tripName}</Campo>}
              <div className="space-y-2">
                <BlocoEstacao titulo="Origem" e={o} carga={{ rotulo: "TOs carregadas", valor: r.carregados || o?.carregados || 0 }} />
                <BlocoEstacao titulo="Destino (aqui)" e={dest} carga={{ rotulo: "TOs descarregadas", valor: r.descarregados }} />
              </div>
            </div>

            <div className="space-y-6">
              <section aria-label="Na estação">
                <h3 className="text-xs uppercase tracking-wide text-muted mb-2">Na estação</h3>
                <ol className="space-y-2">
                  <PassoLinha rotulo="ETA previsto" valor={r.etaEm} />
                  <PassoLinha rotulo="Chegou" valor={r.chegouEm} />
                  <PassoLinha rotulo="Entrou na fila" valor={r.entrouFilaEm} />
                  <PassoLinha rotulo="Fim da descarga" valor={r.descargaFimEm} />
                  <PassoLinha rotulo="Finalizada" valor={r.finalizadoEm} />
                </ol>
              </section>
              <section aria-label="Operação na origem">
                <h3 className="text-xs uppercase tracking-wide text-muted mb-2">Operação na origem</h3>
                <ol className="space-y-2">
                  <PassoLinha rotulo="Início carga" valor={segParaIso(o?.inicioCarga)} />
                  <PassoLinha rotulo="Fim carga" valor={segParaIso(o?.fimCarga)} />
                  <PassoLinha rotulo="Lacrado" valor={segParaIso(o?.lacrado)} />
                  <PassoLinha rotulo="Partiu" valor={segParaIso(o?.atd)} />
                </ol>
              </section>
            </div>
          </div>

          <ComposicaoCarga comp={r.composicao} />
        </div>
      </div>
    </div>
  );
}

export default function VeiculosRecebidos() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [offline, setOffline] = useState(false);
  const [dia, setDia] = useState(null); // null = o dia operacional atual
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState({ chave: "chegada", asc: false });
  const [selecionado, setSelecionado] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [atualizando, setAtualizando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const r = await FilaRecebimentoAPI.recebidos({ data: dia || undefined });
      setDados(r);
      setErro(null);
      setOffline(false);
      setAtualizadoEm(new Date());
    } catch (e) {
      setOffline(true);
      if (e.response?.status === 403) setErro(e.response.data?.message || "Este módulo não está disponível para a sua estação.");
    }
  }, [dia]);

  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  const diaAtual = dados?.diaOperacionalAtual;
  const diaMostrado = dados?.dia;
  const ehHoje = !!diaAtual && diaMostrado === diaAtual;
  useEffect(() => {
    if (!ehHoje) return undefined;
    const t = setInterval(() => !document.hidden && carregar(), POLL_MS);
    return () => clearInterval(t);
  }, [ehHoje, carregar]);

  const atualizarAgora = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  const lista = useMemo(() => dados?.lista || [], [dados]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrados = q ? lista.filter((r) => [r.motorista, r.placa, r.agencia, r.tripNumber, r.origem, docaDe(r)].some((v) => (v || "").toLowerCase().includes(q))) : lista;
    return ordenar(filtrados, ordem.chave, ordem.asc);
  }, [lista, busca, ordem]);

  const kpis = useMemo(() => {
    const comTempo = visiveis.filter((r) => r.tempoNaEstacaoMin != null);
    const comEspera = visiveis.filter((r) => r.esperaMaxMin > 0);
    const media = (arr, f) => (arr.length ? Math.round(arr.reduce((s, r) => s + f(r), 0) / arr.length) : null);
    const maior = comTempo.reduce((m, r) => (!m || r.tempoNaEstacaoMin > m.tempoNaEstacaoMin ? r : m), null);
    return {
      pacotes: visiveis.reduce((s, r) => s + (r.pacotes || 0), 0),
      tos: visiveis.reduce((s, r) => s + (r.descarregados || 0), 0),
      semPacotes: visiveis.filter((r) => !r.pacotes).length,
      tempoMedio: media(comTempo, (r) => r.tempoNaEstacaoMin),
      esperaMedia: media(comEspera, (r) => r.esperaMaxMin),
      comEspera: comEspera.length,
      maior,
    };
  }, [visiveis]);

  const diaSel = diaMostrado || dia;
  const filtrosAtivos = !!busca || (dia && dia !== diaAtual);
  const limpar = () => {
    setBusca("");
    setDia(null);
    setPagina(1);
  };
  const alternarOrdem = (chave) => {
    setOrdem((o) => (o.chave === chave ? { chave, asc: !o.asc } : { chave, asc: false }));
    setPagina(1);
  };

  // Se a lista encolher (atualização, filtro), a página nunca passa da última.
  const totalPaginas = Math.max(1, Math.ceil(visiveis.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = visiveis.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);
  const aberta = selecionado ? lista.find((r) => r.tripNumber === selecionado) : null;

  return (
    <div className="flex min-h-screen bg-page text-page overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-4 sm:p-6 xl:p-10 2xl:px-20 space-y-6 max-w-[1800px] mx-auto">
          <PageHeader
            kicker="Operação · Recebimento"
            titulo="Veículos recebidos"
            subtitulo={dados ? `Histórico de cargas finalizadas · ${dados.estacao.nome.replace(/_/g, " ")}` : "Histórico de cargas finalizadas"}
            atualizadoEm={atualizadoEm}
            atualizando={atualizando}
            onAtualizar={atualizarAgora}
          />

          {erro || (!dados && offline) ? (
            <Aviso tipo="erro">{erro || "Não foi possível carregar os veículos recebidos."}</Aviso>
          ) : !dados ? (
            <div aria-busy="true" aria-label="Carregando veículos recebidos" className="space-y-4">
              <Esqueleto className="h-36" />
              <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-3">
                <Esqueleto className="h-56 sm:col-span-3 xl:col-span-1" />
                <Esqueleto className="h-56" />
                <Esqueleto className="h-56" />
                <Esqueleto className="h-56" />
              </div>
              <Esqueleto className="h-64" />
            </div>
          ) : (
            <>
              {/* ---------- dia e busca ---------- */}
              <section aria-label="Dia operacional e busca" className="anim-in rounded-2xl border border-default bg-surface p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span aria-hidden="true" className="grid place-items-center w-10 h-10 rounded-xl bg-[#FA4C00]/12 text-[#FA4C00] shrink-0">
                      <CalendarDays size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted">Dia operacional</p>
                      <p className="text-base font-semibold tabular-nums">
                        {fmtDataBR(diaSel || diaAtual)}
                        <span className="ml-2 text-sm font-normal text-muted">06:00 às 05:59</span>
                      </p>
                    </div>
                  </div>
                  <div className="ml-auto">
                    <DiaNavegador data={diaSel} maximo={diaAtual} onChange={(d) => { setDia(d === diaAtual ? null : d); setPagina(1); }} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[240px] max-w-xl">
                    <label htmlFor="vr-busca" className="sr-only">Buscar veículo recebido</label>
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
                    <input id="vr-busca" type="search" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Buscar por motorista, placa, agência, LH, origem ou doca…" className={`${INPUT} pl-10`} />
                  </div>
                  <button type="button" onClick={limpar} disabled={!filtrosAtivos} className={`${BTN_SECUNDARIO} disabled:opacity-50`}>
                    Limpar filtros
                  </button>
                  <p className="ml-auto text-sm text-muted tabular-nums" aria-live="polite">
                    <b className="text-page">{visiveis.length}</b> {visiveis.length === 1 ? "veículo" : "veículos"} de {lista.length} no dia
                  </p>
                </div>

                <p className="flex items-center gap-2 text-xs text-muted">
                  <Info size={13} className="shrink-0" aria-hidden="true" />
                  Um veículo entra aqui quando finaliza a descarga.
                </p>
              </section>

              {offline && <Aviso tipo="alerta">Sem conexão com o servidor — os dados exibidos podem estar desatualizados.</Aviso>}

              {/* ---------- indicadores ---------- */}
              <section aria-label="Indicadores dos veículos recebidos" className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-3">
                <KpiDestaque
                    className="sm:col-span-3 xl:col-span-1"
                    indice={0}
                    icone={<Package size={20} />}
                    rotulo="Total de pacotes recebidos"
                    valor={formatNumero(kpis.pacotes)}
                    apoio={`volume dos ${formatNumero(visiveis.length)} ${visiveis.length === 1 ? "veículo" : "veículos"} finalizados no dia`}
                    aviso={kpis.semPacotes ? `${kpis.semPacotes} ${kpis.semPacotes === 1 ? "veículo" : "veículos"} sem volume informado` : null}
                    extras={[
                      { icone: <Truck size={13} />, rotulo: "Veículos recebidos", valor: formatNumero(visiveis.length) },
                      { icone: <Boxes size={13} />, rotulo: "TOs descarregadas", valor: formatNumero(kpis.tos) },
                    ]}
                />
                <Kpi indice={1} icone={<Clock size={16} />} rotulo="Tempo médio na estação" valor={kpis.tempoMedio != null ? fmtDuracao(kpis.tempoMedio) : "—"} tom="#3B82F6" apoio="da chegada ao fim da descarga" />
                <Kpi
                  indice={2}
                  icone={<Hourglass size={16} />}
                  rotulo="Espera média na fila"
                  valor={kpis.esperaMedia != null ? fmtDuracao(kpis.esperaMedia) : "—"}
                  tom={kpis.esperaMedia != null ? corEspera(kpis.esperaMedia) : "#F59E0B"}
                  corValor={kpis.esperaMedia != null ? corEspera(kpis.esperaMedia) : undefined}
                  apoio={kpis.comEspera ? `${kpis.comEspera} de ${visiveis.length} com fila registrada` : "sem fila registrada"}
                />
                <Kpi
                  indice={3}
                  icone={<Gauge size={16} />}
                  rotulo="Maior permanência"
                  valor={kpis.maior ? fmtDuracao(kpis.maior.tempoNaEstacaoMin) : "—"}
                  tom={kpis.maior ? corEspera(kpis.maior.tempoNaEstacaoMin) : "#8B8B93"}
                  corValor={kpis.maior ? corEspera(kpis.maior.tempoNaEstacaoMin) : undefined}
                  apoio={kpis.maior ? kpis.maior.placa || kpis.maior.tripNumber : "sem veículo no dia"}
                />
              </section>

              {/* ---------- tabela ---------- */}
              <section aria-label="Veículos recebidos" className="anim-in rounded-2xl border border-default bg-surface overflow-hidden">
                {lista.length === 0 ? (
                  <EstadoVazio
                    icone={<Inbox size={28} aria-hidden="true" />}
                    titulo="Nenhum veículo finalizado neste dia"
                    descricao="Os veículos aparecem aqui quando terminam a descarga. Dias anteriores a partir da ativação mostram o histórico do SPX."
                  />
                ) : visiveis.length === 0 ? (
                  <EstadoVazio
                    icone={<Search size={28} aria-hidden="true" />}
                    titulo="Nenhum veículo para os filtros selecionados"
                    acao={<button type="button" onClick={limpar} className={`${BTN_SECUNDARIO} h-10 mt-2`}>Limpar filtros</button>}
                  />
                ) : (
                  <div className="overflow-auto max-h-[680px] scroll-tema">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-surface-2">
                        <tr className="text-xs text-muted uppercase tracking-wide">
                          {COLUNAS.map((c) => {
                            const ativa = ordem.chave === c.chave;
                            return (
                              <th key={c.chave} scope="col" aria-sort={ativa ? (ordem.asc ? "ascending" : "descending") : "none"} className={`font-medium px-3 py-3.5 whitespace-nowrap ${c.direita ? "text-right" : "text-left"}`}>
                                <button type="button" title={c.titulo} onClick={() => alternarOrdem(c.chave)} className={`inline-flex items-center gap-1 uppercase tracking-wide cursor-pointer hover:text-page ${ativa ? "text-[#FA4C00]" : ""} ${FOCO}`}>
                                  {c.rotulo}
                                  {ativa && (ordem.asc ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
                                </button>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-default">
                        {daPagina.map((r) => {
                          const doca = docaDe(r).replace(/^Doca\s+/i, "");
                          const corTempo = r.tempoNaEstacaoMin ? corEspera(r.tempoNaEstacaoMin) : null;
                          return (
                            <tr
                              key={r.tripNumber}
                              tabIndex={0}
                              onClick={() => setSelecionado(r.tripNumber)}
                              onKeyDown={(e) => e.key === "Enter" && setSelecionado(r.tripNumber)}
                              className={`cursor-pointer hover:bg-surface-2 transition-colors ${FOCO}`}
                            >
                              <td className="px-3 py-3.5 whitespace-nowrap">
                                <span className="block font-semibold tabular-nums">{r.placa || "—"}</span>
                                <span className="block text-xs text-muted">{r.tipoVeiculo || "—"}</span>
                              </td>
                              <td className="px-3 py-3.5">
                                <span className="block font-medium tabular-nums text-[#FA4C00] whitespace-nowrap">{r.tripNumber}</span>
                                <span className="block max-w-[170px] truncate text-xs text-muted" title={r.origem || undefined}>{r.origem || "—"}</span>
                              </td>
                              <td className="px-3 py-3.5 whitespace-nowrap tabular-nums">
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="font-medium">{fmtInstante(r.chegouEm)}</span>
                                  <ArrowRight size={13} className="text-muted" aria-label="até" />
                                  <span className="font-medium">{fmtInstante(r.descargaFimEm || r.finalizadoEm)}</span>
                                </span>
                              </td>
                              <td className="px-3 py-3.5 whitespace-nowrap">
                                {corTempo ? (
                                  <span className="inline-flex rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums" style={{ color: corTempo, background: `${corTempo}1F` }}>{fmtDuracao(r.tempoNaEstacaoMin)}</span>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td className="px-3 py-3.5 whitespace-nowrap tabular-nums font-semibold" style={r.esperaMaxMin > 0 ? { color: corEspera(r.esperaMaxMin) } : undefined}>
                                {r.esperaMaxMin > 0 ? fmtDuracao(r.esperaMaxMin) : <span className="text-muted font-normal">—</span>}
                              </td>
                              <td className="px-3 py-3.5 whitespace-nowrap">
                                {doca ? (
                                  <span className="inline-flex rounded-md border border-[#22C55E]/30 bg-[#22C55E]/10 px-2 py-0.5 text-xs font-semibold text-[#22C55E]">{doca}</span>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td className="px-3 py-3.5 whitespace-nowrap text-right tabular-nums font-semibold">
                                {r.pacotes > 0 ? formatNumero(r.pacotes) : <span className="text-muted font-normal" title="Sem volume informado na planilha">—</span>}
                              </td>
                              <td className="px-3 py-3.5 whitespace-nowrap text-right tabular-nums">
                                {divergente(r) ? (
                                  <span className="inline-flex items-center gap-1 font-semibold text-[#F59E0B]" title="Descarregou menos que o esperado">
                                    <CircleAlert size={13} aria-hidden="true" />
                                    {formatNumero(r.descarregados)}<span className="font-normal text-muted"> / {formatNumero(r.esperados)}</span>
                                  </span>
                                ) : (
                                  <span className="font-semibold">{formatNumero(r.descarregados)}</span>
                                )}
                              </td>
                              <td className="px-3 py-3.5 font-medium"><div className="max-w-[150px] truncate" title={r.motorista || undefined}>{r.motorista || "—"}</div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {visiveis.length > 0 && (
                  <Paginacao
                    total={visiveis.length}
                    pagina={paginaAtual}
                    porPagina={porPagina}
                    onPagina={setPagina}
                    onPorPagina={(n) => {
                      setPorPagina(n);
                      setPagina(1);
                    }}
                  />
                )}
              </section>
            </>
          )}
        </main>
      </MainLayout>

      {aberta && <ModalViagem r={aberta} onClose={() => setSelecionado(null)} />}
    </div>
  );
}
