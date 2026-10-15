import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Inbox, MapPin, Search } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MainLayout from "../../components/MainLayout";
import { AbasSegmentadas, Aviso, EstadoVazio, Esqueleto, PageHeader } from "../../components/mapaOperacional/ui";
import { BTN_SECUNDARIO, FOCO, INPUT, formatNumero } from "../../components/mapaOperacional/uiTokens";
import { PlanejamentoInboundAPI } from "../../services/planejamentoInbound";
import { Paginacao } from "./FilaPecas";
import { PilulaEta, PilulaSituacao } from "./InboundPecas";
import ViagemInboundModal from "./ViagemInboundModal";
import { SITUACOES, TIPOS_ORIGEM, TURNOS, fmtDataHora, fmtDesvio, fmtDia, fmtDuracao, nomePlacas } from "./inboundUtils";

const POLL_MS = 60000;
const ordemSituacao = { ATRASADA: 0, EM_TRANSITO: 1, NO_PATIO: 2, PROGRAMADA: 3, RECEBIDA: 4, NO_SHOW: 5, CANCELADA: 6 };
const ms = (iso) => (iso ? new Date(iso).getTime() : 0);

const COLUNAS = [
  { chave: "lh", rotulo: "LH", valor: (v) => v.lh.toLowerCase() },
  { chave: "placa", rotulo: "Placa / veículo", valor: (v) => (v.placas[0] || "").toLowerCase() },
  { chave: "origem", rotulo: "Origem", valor: (v) => (v.origem || "").toLowerCase() },
  { chave: "solicitacao", rotulo: "Solicitação", valor: (v) => (v.solicitacao || "").toLowerCase() },
  { chave: "turno", rotulo: "Turno", valor: (v) => v.turno || "" },
  { chave: "prazoEta", rotulo: "ETA planejado", valor: (v) => ms(v.prazoEta) },
  { chave: "etaReal", rotulo: "ETA real", valor: (v) => ms(v.etaReal) },
  { chave: "descarga", rotulo: "Fim da descarga", valor: (v) => ms(v.descarga) },
  { chave: "desvio", rotulo: "Desvio", valor: (v) => v.desvioEtaMin ?? (v.atrasada ? v.atrasoMin : -99999) },
  { chave: "pacotes", rotulo: "Pacotes", direita: true, valor: (v) => v.pacotes || 0 },
  { chave: "tos", rotulo: "TOs", direita: true, valor: (v) => v.tos || 0 },
  { chave: "situacao", rotulo: "Situação", valor: (v) => ordemSituacao[v.atrasada ? "ATRASADA" : v.situacao] ?? 9 },
  { chave: "motorista", rotulo: "Motorista", valor: (v) => (v.motorista || "").toLowerCase() },
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

const somarDia = (dia, n) => {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export default function ViagensRecebimento() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [offline, setOffline] = useState(false);
  const [periodo, setPeriodo] = useState({ de: null, ate: null }); // null = o dia operacional atual
  const [situacao, setSituacao] = useState("TODAS");
  const [tipo, setTipo] = useState("");
  const [turno, setTurno] = useState("");
  const [solicitacao, setSolicitacao] = useState("");
  const [soComCarga, setSoComCarga] = useState(false);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState({ chave: "prazoEta", asc: true });
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [selecionada, setSelecionada] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const r = await PlanejamentoInboundAPI.viagens({ de: periodo.de || undefined, ate: periodo.ate || undefined });
      setDados(r);
      setErro(null);
      setOffline(false);
      setAtualizadoEm(new Date());
    } catch (e) {
      setOffline(true);
      if (e.response?.status === 403 || e.response?.status === 500) setErro(e.response.data?.message || "Não foi possível carregar as viagens.");
    }
  }, [periodo]);

  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  useEffect(() => {
    const t = setInterval(() => !document.hidden && carregar(), POLL_MS);
    return () => clearInterval(t);
  }, [carregar]);

  const atualizarAgora = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  const viagens = useMemo(() => dados?.viagens || [], [dados]);
  const solicitacoes = useMemo(() => [...new Set(viagens.map((v) => v.solicitacao).filter(Boolean))].sort(), [viagens]);

  // Filtros que não são a situação: os contadores das abas de situação respeitam eles.
  const baseFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return viagens.filter((v) => {
      if (tipo && v.tipoOrigem !== tipo) return false;
      if (turno && v.turno !== turno) return false;
      if (solicitacao && v.solicitacao !== solicitacao) return false;
      // "com carga" = o volume veio da planilha (não é estimativa) ou há TOs informadas
      if (soComCarga && v.pacotesEstimado) return false;
      if (soComCarga && !v.pacotes && !v.tos) return false;
      if (!q) return true;
      return [v.lh, v.origem, v.motorista, v.transportadora, v.solicitacao, ...v.placas].some((x) => (x || "").toLowerCase().includes(q));
    });
  }, [viagens, tipo, turno, solicitacao, soComCarga, busca]);

  const contagem = useMemo(() => {
    const c = { TODAS: baseFiltrada.length, ATRASADAS: 0 };
    Object.keys(SITUACOES).forEach((k) => (c[k] = 0));
    baseFiltrada.forEach((v) => {
      c[v.situacao] += 1;
      if (v.atrasada) c.ATRASADAS += 1;
    });
    return c;
  }, [baseFiltrada]);

  const visiveis = useMemo(() => {
    const lista = baseFiltrada.filter((v) => (situacao === "TODAS" ? true : situacao === "ATRASADAS" ? v.atrasada : v.situacao === situacao));
    return ordenar(lista, ordem.chave, ordem.asc);
  }, [baseFiltrada, situacao, ordem]);

  const totalPaginas = Math.max(1, Math.ceil(visiveis.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = visiveis.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);

  const de = dados?.de;
  const ate = dados?.ate;
  const hoje = dados?.diaOperacionalAtual;
  const filtrosAtivos = !!tipo || !!turno || !!solicitacao || !!busca || soComCarga || situacao !== "TODAS" || periodo.de || periodo.ate;
  const limpar = () => {
    setTipo("");
    setTurno("");
    setSolicitacao("");
    setSoComCarga(false);
    setBusca("");
    setSituacao("TODAS");
    setPeriodo({ de: null, ate: null });
    setPagina(1);
  };
  const mudar = (fn) => (valor) => {
    fn(valor);
    setPagina(1);
  };
  const alternarOrdem = (chave) => {
    setOrdem((o) => (o.chave === chave ? { chave, asc: !o.asc } : { chave, asc: chave === "prazoEta" }));
    setPagina(1);
  };
  const predefinir = (nome) => {
    if (!hoje) return;
    const mapa = { hoje: [hoje, hoje], ontem: [somarDia(hoje, -1), somarDia(hoje, -1)], proximos3: [hoje, somarDia(hoje, 2)], semana: [somarDia(hoje, -6), hoje] };
    const [a, b] = mapa[nome];
    setPeriodo({ de: a, ate: b });
    setPagina(1);
  };

  const abas = [
    { valor: "TODAS", rotulo: `Todas (${contagem.TODAS})` },
    { valor: "RECEBIDA", rotulo: `Recebidas (${contagem.RECEBIDA})` },
    { valor: "NO_PATIO", rotulo: `No pátio (${contagem.NO_PATIO})` },
    { valor: "EM_TRANSITO", rotulo: `Em trânsito (${contagem.EM_TRANSITO})` },
    { valor: "PROGRAMADA", rotulo: `Programadas (${contagem.PROGRAMADA})` },
    { valor: "ATRASADAS", rotulo: `Atrasadas (${contagem.ATRASADAS})` },
    { valor: "CANCELADA", rotulo: `Canceladas (${contagem.CANCELADA})` },
  ];

  return (
    <div className="flex min-h-screen bg-page text-page overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-4 sm:p-6 xl:p-10 2xl:px-20 space-y-5 max-w-[1800px] mx-auto">
          <PageHeader
            kicker="Operação · Recebimento"
            titulo="Viagens"
            subtitulo={dados ? `Todas as viagens (LH) programadas para a estação · ${dados.estacao.nome}` : "Todas as viagens (LH) programadas para a estação"}
            atualizadoEm={atualizadoEm}
            atualizando={atualizando}
            onAtualizar={atualizarAgora}
          />

          {erro || (!dados && offline) ? (
            <Aviso tipo="erro">{erro || "Não foi possível carregar as viagens."}</Aviso>
          ) : !dados ? (
            <div aria-busy="true" aria-label="Carregando viagens" className="space-y-4">
              <Esqueleto className="h-16" />
              <Esqueleto className="h-20" />
              <Esqueleto className="h-64" />
            </div>
          ) : (
            <>
              {offline && <Aviso tipo="alerta">Sem conexão com o servidor — os dados exibidos podem estar desatualizados.</Aviso>}

              <section aria-label="Período" className="bg-surface rounded-2xl border border-default p-4 flex items-end gap-3 flex-wrap">
                <div>
                  <label htmlFor="vg-de" className="block text-xs text-muted mb-1.5">De (dia operacional)</label>
                  <input id="vg-de" type="date" value={de || ""} max={ate} onChange={(e) => e.target.value && mudar((d) => setPeriodo({ de: d, ate: periodo.ate || ate }))(e.target.value)} className={`${INPUT} w-44`} />
                </div>
                <div>
                  <label htmlFor="vg-ate" className="block text-xs text-muted mb-1.5">Até</label>
                  <input id="vg-ate" type="date" value={ate || ""} min={de} onChange={(e) => e.target.value && mudar((d) => setPeriodo({ de: periodo.de || de, ate: d }))(e.target.value)} className={`${INPUT} w-44`} />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[["hoje", "Hoje"], ["ontem", "Ontem"], ["proximos3", "Próximos 3 dias"], ["semana", "Últimos 7 dias"]].map(([k, r]) => (
                    <button key={k} type="button" onClick={() => predefinir(k)} className={`${BTN_SECUNDARIO} h-10`}>{r}</button>
                  ))}
                </div>
                <p className="ml-auto text-sm text-muted tabular-nums">
                  {fmtDia(de)}{de !== ate ? ` a ${fmtDia(ate)}` : ""} · <b className="text-page">{viagens.length}</b> {viagens.length === 1 ? "viagem" : "viagens"}
                </p>
              </section>

              <section aria-label="Filtros" className="bg-surface rounded-2xl border border-default p-4 space-y-4">
                <div className="overflow-x-auto scroll-tema">
                  <div className="min-w-[760px]">
                    <AbasSegmentadas rotulo="Situação da viagem" valor={situacao} onChange={mudar(setSituacao)} opcoes={abas} />
                  </div>
                </div>
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="flex-1 min-w-[220px] max-w-sm">
                    <label htmlFor="vg-busca" className="block text-xs text-muted mb-1.5">Buscar</label>
                    <div className="relative">
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
                      <input id="vg-busca" type="search" value={busca} onChange={(e) => mudar(setBusca)(e.target.value)} placeholder="LH, placa, origem, motorista…" className={`${INPUT} pl-10`} />
                    </div>
                  </div>
                  {[
                    { id: "vg-tipo", rotulo: "Tipo de origem", valor: tipo, set: setTipo, opcoes: TIPOS_ORIGEM },
                    { id: "vg-turno", rotulo: "Turno", valor: turno, set: setTurno, opcoes: TURNOS },
                    { id: "vg-solic", rotulo: "Solicitação", valor: solicitacao, set: setSolicitacao, opcoes: solicitacoes },
                  ].map((f) => (
                    <div key={f.id}>
                      <label htmlFor={f.id} className="block text-xs text-muted mb-1.5">{f.rotulo}</label>
                      <select id={f.id} value={f.valor} onChange={(e) => mudar(f.set)(e.target.value)} className={`${INPUT} min-w-[140px] cursor-pointer`}>
                        <option value="">Todos</option>
                        {f.opcoes.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  <label className="flex items-center gap-2 h-10 text-sm text-muted cursor-pointer" title="Esconde as viagens que ainda não foram carregadas na origem (volume só estimado)">
                    <input type="checkbox" checked={soComCarga} onChange={(e) => mudar(setSoComCarga)(e.target.checked)} className="accent-[#FA4C00] w-4 h-4" />
                    Só com carga informada
                  </label>
                  <button type="button" onClick={limpar} disabled={!filtrosAtivos} className={`${BTN_SECUNDARIO} disabled:opacity-50`}>Limpar filtros</button>
                  <p className="ml-auto text-sm text-muted tabular-nums" aria-live="polite">
                    <b className="text-page">{visiveis.length}</b> de {viagens.length}
                  </p>
                </div>
              </section>

              <section aria-label="Viagens" className="bg-surface rounded-2xl border border-default overflow-hidden">
                {viagens.length === 0 ? (
                  <EstadoVazio icone={<Inbox size={28} aria-hidden="true" />} titulo="Nenhuma viagem neste período" descricao="A planilha de programação não tem viagens com ETA nesses dias para esta estação." />
                ) : visiveis.length === 0 ? (
                  <EstadoVazio icone={<Search size={28} aria-hidden="true" />} titulo="Nenhuma viagem para os filtros selecionados" acao={<button type="button" onClick={limpar} className={`${BTN_SECUNDARIO} h-10 mt-2`}>Limpar filtros</button>} />
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
                        {daPagina.map((v) => (
                          <tr
                            key={v.lh}
                            tabIndex={0}
                            onClick={() => setSelecionada(v.lh)}
                            onKeyDown={(e) => e.key === "Enter" && setSelecionada(v.lh)}
                            className={`cursor-pointer hover:bg-surface-2 transition-colors ${FOCO} ${v.atrasada ? "shadow-[inset_3px_0_0_#FF453A]" : ""}`}
                          >
                            <td className="px-3 py-3 whitespace-nowrap font-medium tabular-nums text-[#FA4C00]">
                              <span className="inline-flex items-center gap-1.5">
                                {v.lh}
                                {v.temTelemetria && <MapPin size={12} className="text-[#3B82F6]" aria-label="Com telemetria" />}
                              </span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className="block font-medium tabular-nums">{nomePlacas(v.placas)}</span>
                              <span className="block text-xs text-muted">{v.veiculo || "—"}</span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="max-w-[180px] truncate font-medium" title={v.origem || undefined}>{v.origem || "—"}</div>
                              <span className="block text-xs text-muted">{v.tipoOrigem}</span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-muted">{v.solicitacao || "—"}</td>
                            <td className="px-3 py-3 whitespace-nowrap font-medium">{v.turno}</td>
                            <td className="px-3 py-3 whitespace-nowrap tabular-nums font-medium">{fmtDataHora(v.prazoEta)}</td>
                            <td className="px-3 py-3 whitespace-nowrap tabular-nums">{fmtDataHora(v.etaReal)}</td>
                            <td className="px-3 py-3 whitespace-nowrap tabular-nums text-muted">{fmtDataHora(v.descarga)}</td>
                            <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                              {v.desvioEtaMin !== null ? (
                                <span className="inline-flex items-center gap-2"><span className="font-semibold">{fmtDesvio(v.desvioEtaMin)}</span><PilulaEta classe={v.classeEta} /></span>
                              ) : v.atrasada ? (
                                <span className="font-semibold text-[#FF453A]">+{fmtDuracao(v.atrasoMin)}</span>
                              ) : v.tendeAtrasar ? (
                                <span className="text-xs font-semibold text-[#FA4C00]">tende a atrasar</span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums font-semibold" title={v.pacotesEstimado ? "Estimado pela mediana da origem" : undefined}>
                              {v.pacotes ? `${v.pacotesEstimado ? "~" : ""}${formatNumero(v.pacotes)}` : <span className="text-muted font-normal">—</span>}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-muted">{v.tos ? formatNumero(v.tos) : "—"}</td>
                            <td className="px-3 py-3 whitespace-nowrap"><PilulaSituacao situacao={v.situacao} /></td>
                            <td className="px-3 py-3"><div className="max-w-[170px] truncate" title={v.motorista || undefined}>{v.motorista || "—"}</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {visiveis.length > 0 && (
                  <Paginacao total={visiveis.length} pagina={paginaAtual} porPagina={porPagina} onPagina={setPagina} onPorPagina={(n) => { setPorPagina(n); setPagina(1); }} />
                )}
              </section>
            </>
          )}
        </main>
      </MainLayout>

      {selecionada && <ViagemInboundModal lh={selecionada} onClose={() => setSelecionada(null)} />}
    </div>
  );
}
