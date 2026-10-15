import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, Circle, Inbox, Search, X } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MainLayout from "../../components/MainLayout";
import { Aviso, DiaNavegador, EstadoVazio, Esqueleto, FaixaIndicadores, PageHeader } from "../../components/mapaOperacional/ui";
import { BTN_SECUNDARIO, FOCO, INPUT, formatNumero } from "../../components/mapaOperacional/uiTokens";
import { FilaRecebimentoAPI } from "../../services/filaRecebimento";
import { corEspera, fmtDuracao, fmtInstante, fmtPeso } from "./filaUtils";
import { BlocoEstacao, Campo, ComposicaoCarga, Paginacao, Pilula } from "./FilaPecas";

const POLL_MS = 60000; // o dia atual se atualiza sozinho; dia passado não muda
const fmtDataBR = (iso) => iso.split("-").reverse().join("/");
const ms = (iso) => (iso ? new Date(iso).getTime() : 0);
const segParaIso = (sec) => (sec ? new Date(sec * 1000).toISOString() : null);
const docaDe = (r) => r.docaOcupada || r.docaAtribuida || "";
const divergente = (r) => r.esperados > 0 && r.descarregados < r.esperados;

const COLUNAS = [
  { chave: "placa", rotulo: "Placa / veículo", valor: (r) => (r.placa || "").toLowerCase() },
  { chave: "tripNumber", rotulo: "LH", valor: (r) => (r.tripNumber || "").toLowerCase() },
  { chave: "origem", rotulo: "Origem", valor: (r) => (r.origem || "").toLowerCase() },
  { chave: "chegada", rotulo: "Chegada", valor: (r) => ms(r.chegouEm) },
  { chave: "fim", rotulo: "Fim da descarga", valor: (r) => ms(r.descargaFimEm || r.finalizadoEm) },
  { chave: "tempo", rotulo: "Na estação", valor: (r) => r.tempoNaEstacaoMin ?? -1 },
  { chave: "espera", rotulo: "Espera na fila", valor: (r) => r.esperaMaxMin ?? 0 },
  { chave: "doca", rotulo: "Doca", valor: (r) => docaDe(r).toLowerCase() },
  { chave: "descarga", rotulo: "TOs descarregadas", direita: true, valor: (r) => r.descarregados ?? 0 },
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
                <Campo rotulo="Pacotes na fila" mono>{r.pacotesFila > 0 ? formatNumero(r.pacotesFila) : null}</Campo>
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
      pacotes: visiveis.reduce((s, r) => s + (r.descarregados || 0), 0),
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

        <main className="p-4 sm:p-6 xl:p-10 2xl:px-20 space-y-5 max-w-[1800px] mx-auto">
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
              <Esqueleto className="h-24" />
              <Esqueleto className="h-16" />
              <Esqueleto className="h-64" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-muted">Dia operacional das 06:00 às 05:59 · um veículo entra aqui quando finaliza a descarga.</p>
                <DiaNavegador data={diaSel} maximo={diaAtual} onChange={(d) => { setDia(d === diaAtual ? null : d); setPagina(1); }} />
              </div>

              {offline && <Aviso tipo="alerta">Sem conexão com o servidor — os dados exibidos podem estar desatualizados.</Aviso>}

              <FaixaIndicadores
                rotulo="Indicadores dos veículos recebidos"
                itens={[
                  { rotulo: "Veículos recebidos", valor: formatNumero(visiveis.length), destaque: true, apoio: `${fmtDataBR(diaSel || diaAtual)}` },
                  { rotulo: "TOs descarregadas", valor: formatNumero(kpis.pacotes), apoio: "soma das descargas" },
                  { rotulo: "Tempo médio na estação", valor: kpis.tempoMedio != null ? fmtDuracao(kpis.tempoMedio) : "—", apoio: "da chegada ao fim da descarga" },
                  {
                    rotulo: "Espera média na fila",
                    valor: kpis.esperaMedia != null ? fmtDuracao(kpis.esperaMedia) : "—",
                    cor: kpis.esperaMedia != null ? corEspera(kpis.esperaMedia) : undefined,
                    apoio: kpis.comEspera ? `${kpis.comEspera} de ${visiveis.length} com fila registrada` : "sem fila registrada",
                  },
                  {
                    rotulo: "Maior permanência",
                    valor: kpis.maior ? fmtDuracao(kpis.maior.tempoNaEstacaoMin) : "—",
                    cor: kpis.maior ? corEspera(kpis.maior.tempoNaEstacaoMin) : undefined,
                    apoio: kpis.maior ? kpis.maior.placa || kpis.maior.tripNumber : "sem veículo no dia",
                  },
                ]}
              />

              <section aria-label="Filtros" className="bg-surface rounded-2xl border border-default p-4 flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[220px] max-w-md">
                  <label htmlFor="vr-busca" className="block text-xs text-muted mb-1.5">Buscar</label>
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
                    <input id="vr-busca" type="search" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Motorista, placa, agência, LH, origem, doca…" className={`${INPUT} pl-10`} />
                  </div>
                </div>
                <button type="button" onClick={limpar} disabled={!filtrosAtivos} className={`${BTN_SECUNDARIO} disabled:opacity-50`}>
                  Limpar filtros
                </button>
                <p className="ml-auto text-sm text-muted tabular-nums" aria-live="polite">
                  <b className="text-page">{visiveis.length}</b> {visiveis.length === 1 ? "veículo" : "veículos"} de {lista.length} no dia
                </p>
              </section>

              <section aria-label="Veículos recebidos" className="bg-surface rounded-2xl border border-default overflow-hidden">
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
                              <th key={c.chave} scope="col" aria-sort={ativa ? (ordem.asc ? "ascending" : "descending") : "none"} className={`font-medium px-3 py-3 whitespace-nowrap ${c.direita ? "text-right" : "text-left"}`}>
                                <button type="button" onClick={() => alternarOrdem(c.chave)} className={`inline-flex items-center gap-1 uppercase tracking-wide cursor-pointer hover:text-page ${ativa ? "text-[#FA4C00]" : ""} ${FOCO}`}>
                                  {c.rotulo}
                                  {ativa && (ordem.asc ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
                                </button>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-default">
                        {daPagina.map((r) => (
                          <tr
                            key={r.tripNumber}
                            tabIndex={0}
                            onClick={() => setSelecionado(r.tripNumber)}
                            onKeyDown={(e) => e.key === "Enter" && setSelecionado(r.tripNumber)}
                            className={`cursor-pointer hover:bg-surface-2 transition-colors ${FOCO}`}
                          >
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className="block font-medium tabular-nums">{r.placa || "—"}</span>
                              <span className="block text-xs text-muted">{r.tipoVeiculo || "—"}</span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap font-medium tabular-nums text-[#FA4C00]">{r.tripNumber}</td>
                            <td className="px-3 py-3 text-muted"><div className="max-w-[170px] truncate" title={r.origem || undefined}>{r.origem || "—"}</div></td>
                            <td className="px-3 py-3 whitespace-nowrap tabular-nums">{fmtInstante(r.chegouEm)}</td>
                            <td className="px-3 py-3 whitespace-nowrap tabular-nums">{fmtInstante(r.descargaFimEm || r.finalizadoEm)}</td>
                            <td className="px-3 py-3 whitespace-nowrap tabular-nums font-semibold" style={r.tempoNaEstacaoMin ? { color: corEspera(r.tempoNaEstacaoMin) } : undefined}>
                              {r.tempoNaEstacaoMin ? fmtDuracao(r.tempoNaEstacaoMin) : <span className="text-muted font-normal">—</span>}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap tabular-nums font-semibold" style={r.esperaMaxMin > 0 ? { color: corEspera(r.esperaMaxMin) } : undefined}>
                              {r.esperaMaxMin > 0 ? fmtDuracao(r.esperaMaxMin) : <span className="text-muted font-normal">—</span>}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap font-medium text-[#22C55E]">{docaDe(r) || <span className="text-muted font-normal">—</span>}</td>
                            <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums">
                              {divergente(r) ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-[#F59E0B]" title="Descarregou menos que o esperado">
                                  <CircleAlert size={13} aria-hidden="true" />
                                  {formatNumero(r.descarregados)}<span className="font-normal text-muted"> / {formatNumero(r.esperados)}</span>
                                </span>
                              ) : (
                                <span className="font-semibold">{formatNumero(r.descarregados)}</span>
                              )}
                            </td>
                            <td className="px-3 py-3 font-medium"><div className="max-w-[190px] truncate" title={r.motorista || undefined}>{r.motorista || "—"}</div></td>
                          </tr>
                        ))}
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
