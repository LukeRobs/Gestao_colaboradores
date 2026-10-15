import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPinOff, Search } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MainLayout from "../../components/MainLayout";
import { Aviso, EstadoVazio, Esqueleto, FaixaIndicadores, PageHeader } from "../../components/mapaOperacional/ui";
import { FOCO, INPUT, formatNumero } from "../../components/mapaOperacional/uiTokens";
import { PlanejamentoInboundAPI } from "../../services/planejamentoInbound";
import ViagemInboundModal from "./ViagemInboundModal";
import { fmtDataHora, fmtHoraIso, fmtIdade, nomePlacas } from "./inboundUtils";
import { SITUACOES } from "./inboundUtils";
import { ESTADOS_MAPA, carregarLeaflet, criarMapa, escapaHtml, estadoDoVeiculo, iconeCluster, iconeEstacao, iconeVeiculo, seguirTema } from "./mapaLeaflet";

const POLL_MS = 60000;
const ANTIGO_MIN = 24 * 60; // posição com mais de 24 h fica escondida por padrão

const CHIPS = [
  { valor: "TODOS", rotulo: "Todos" },
  { valor: "MOVIMENTO", rotulo: "Em movimento" },
  { valor: "PARADO", rotulo: "Parados" },
  { valor: "ATRASO", rotulo: "Atrasados" },
  { valor: "DESTINO", rotulo: "No destino" },
];

const casaChip = (chip, estado) => (chip === "TODOS" ? true : chip === "ATRASO" ? estado === "ATRASADO" || estado === "RISCO" : chip === estado);

function htmlPopup(v) {
  const e = ESTADOS_MAPA[estadoDoVeiculo(v)];
  const l = v.ultimaLeitura;
  const linha = (r, val) => (val ? `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:var(--color-muted)">${r}</span><b>${escapaHtml(val)}</b></div>` : "");
  return `<div style="min-width:230px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="width:10px;height:10px;border-radius:9999px;background:${e.cor};flex:none"></span>
      <b style="color:#FA4C00;font-variant-numeric:tabular-nums">${escapaHtml(v.lh)}</b>
      <span style="margin-left:auto;font-size:11px;color:${e.cor};font-weight:700">${e.rotulo}</span>
    </div>
    ${linha("Origem", v.origem)}
    ${linha("Veículo", [v.veiculo, nomePlacas(v.placas) !== "—" ? nomePlacas(v.placas) : null].filter(Boolean).join(" · "))}
    ${linha("Motorista", v.motorista)}
    ${linha("Velocidade", `${l.velocidadeKmh || 0} km/h`)}
    ${linha("Local", l.local)}
    ${linha("ETA planejado", v.prazoEta ? fmtHoraIso(v.prazoEta) : null)}
    ${linha("ETA Google", l.etaGoogle ? fmtHoraIso(l.etaGoogle) : null)}
    ${linha("Pacotes", v.pacotes ? `${v.pacotesEstimado ? "~" : ""}${formatNumero(v.pacotes)}` : null)}
    ${linha("Leitura", fmtIdade(v.idadeMin))}
    ${l.ocorrencia ? `<div style="margin-top:6px;padding:6px 8px;border-radius:8px;background:rgba(245,158,11,.14);color:#F59E0B;font-weight:600">${escapaHtml(l.ocorrencia)}</div>` : ""}
    <button type="button" data-lh="${escapaHtml(v.lh)}" style="margin-top:10px;width:100%;height:34px;border-radius:10px;background:#FA4C00;color:#fff;font-weight:700;border:0;cursor:pointer">Ver detalhes da viagem</button>
  </div>`;
}

export default function MapaFrota() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [offline, setOffline] = useState(false);
  const [chip, setChip] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const [antigos, setAntigos] = useState(false);
  const [selecionado, setSelecionado] = useState(null);
  const [modalLh, setModalLh] = useState(null);
  const [pronto, setPronto] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState(null);

  const elMapa = useRef(null);
  const mapaRef = useRef(null);
  const LRef = useRef(null);
  const clusterRef = useRef(null);
  const marcadores = useRef(new Map());
  const estacaoRef = useRef(null);
  const camadaSel = useRef(null);
  const ultimoAjuste = useRef("");

  const carregar = useCallback(async () => {
    try {
      const r = await PlanejamentoInboundAPI.mapa();
      setDados(r);
      setErro(null);
      setOffline(false);
      setAtualizadoEm(new Date());
    } catch (e) {
      setOffline(true);
      if (e.response?.status === 403 || e.response?.status === 500) setErro(e.response.data?.message || "Não foi possível carregar o mapa.");
    }
  }, []);

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

  /* ---------- lista filtrada ---------- */
  const veiculos = useMemo(() => (dados?.veiculos || []).map((v) => ({ ...v, estado: estadoDoVeiculo(v) })), [dados]);
  const recentes = useMemo(() => veiculos.filter((v) => antigos || (v.idadeMin ?? 0) <= ANTIGO_MIN), [veiculos, antigos]);

  const contagem = useMemo(() => {
    const c = { TODOS: recentes.length, MOVIMENTO: 0, PARADO: 0, ATRASO: 0, DESTINO: 0 };
    recentes.forEach((v) => {
      if (v.estado === "MOVIMENTO") c.MOVIMENTO += 1;
      if (v.estado === "PARADO") c.PARADO += 1;
      if (v.estado === "DESTINO") c.DESTINO += 1;
      if (v.estado === "ATRASADO" || v.estado === "RISCO") c.ATRASO += 1;
    });
    return c;
  }, [recentes]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const peso = { ATRASADO: 0, RISCO: 1, MOVIMENTO: 2, PARADO: 3, DESTINO: 4, OUTRO: 5 };
    return recentes
      .filter((v) => casaChip(chip, v.estado))
      .filter((v) => !q || [v.lh, v.origem, v.motorista, v.transportadora, ...v.placas].some((x) => (x || "").toLowerCase().includes(q)))
      .sort((a, b) => peso[a.estado] - peso[b.estado] || (a.prazoEta ? new Date(a.prazoEta).getTime() : Infinity) - (b.prazoEta ? new Date(b.prazoEta).getTime() : Infinity));
  }, [recentes, chip, busca]);

  // Viagens em trânsito sem posição na planilha: ficam na lista (com a busca aplicada) para ninguém achar que sumiram.
  const semPosicao = useMemo(() => {
    if (chip !== "TODOS") return [];
    const q = busca.trim().toLowerCase();
    return (dados?.semTelemetria || []).filter((v) => !q || [v.lh, v.origem, v.motorista, v.transportadora, ...v.placas].some((x) => (x || "").toLowerCase().includes(q)));
  }, [dados, chip, busca]);

  /* ---------- mapa: criação ---------- */
  // O contêiner do mapa só existe depois que os dados chegam (antes disso aparece o esqueleto).
  const temDados = !!dados;
  useEffect(() => {
    if (!temDados) return undefined;
    let cancelado = false;
    let parar = () => {};
    const marcadoresAtuais = marcadores.current;
    carregarLeaflet().then((L) => {
      if (cancelado || !elMapa.current) return;
      LRef.current = L;
      const mapa = criarMapa(L, elMapa.current);
      mapaRef.current = mapa;
      parar = seguirTema(L, mapa);
      clusterRef.current = L.markerClusterGroup({ iconCreateFunction: (c) => iconeCluster(L, c), showCoverageOnHover: false, maxClusterRadius: 46, spiderfyOnMaxZoom: true, disableClusteringAtZoom: 12 });
      mapa.addLayer(clusterRef.current);
      camadaSel.current = L.layerGroup().addTo(mapa);
      // o botão do popup abre o modal da viagem
      elMapa.current.addEventListener("click", (e) => {
        const b = e.target.closest?.("[data-lh]");
        if (b) setModalLh(b.getAttribute("data-lh"));
      });
      setPronto(true);
    });
    return () => {
      cancelado = true;
      parar();
      marcadoresAtuais.clear();
      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
      }
      setPronto(false);
    };
  }, [temDados]);

  /* ---------- mapa: estação de destino ---------- */
  useEffect(() => {
    const L = LRef.current;
    const mapa = mapaRef.current;
    if (!pronto || !L || !mapa || !dados?.estacao?.coords) return;
    if (estacaoRef.current) mapa.removeLayer(estacaoRef.current);
    estacaoRef.current = L.marker(dados.estacao.coords, { icon: iconeEstacao(L, dados.estacao.codigo), zIndexOffset: 2000 })
      .addTo(mapa)
      .bindTooltip(dados.estacao.nome, { direction: "top", offset: [0, -22] });
  }, [pronto, dados?.estacao]);

  /* ---------- mapa: marcadores ---------- */
  useEffect(() => {
    const L = LRef.current;
    const mapa = mapaRef.current;
    const cluster = clusterRef.current;
    if (!pronto || !L || !mapa || !cluster) return;

    cluster.clearLayers();
    marcadores.current.clear();
    const pontos = [];
    filtrados.forEach((v) => {
      const e = ESTADOS_MAPA[v.estado];
      const m = L.marker([v.lat, v.lng], {
        icon: iconeVeiculo(L, { cor: e.cor, pulsa: v.estado === "ATRASADO" || v.estado === "MOVIMENTO", selecionado: v.lh === selecionado }),
        opacity: (v.idadeMin ?? 0) > 180 ? 0.6 : 1,
        title: v.lh,
        keyboard: true,
      });
      m.bindPopup(htmlPopup(v), { closeButton: true, autoPanPadding: [40, 40] });
      m.on("click", () => setSelecionado(v.lh));
      marcadores.current.set(v.lh, { marcador: m, estado: v.estado });
      cluster.addLayer(m);
      pontos.push([v.lat, v.lng]);
    });

    // Enquadra só quando o conjunto filtrado muda de propósito (não a cada atualização automática).
    const chave = `${chip}|${busca}|${antigos}`;
    if (ultimoAjuste.current !== chave) {
      ultimoAjuste.current = chave;
      const todos = dados?.estacao?.coords ? [...pontos, dados.estacao.coords] : pontos;
      if (todos.length > 0) mapa.fitBounds(L.latLngBounds(todos), { padding: [60, 60], maxZoom: 10 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, filtrados]);

  /* ---------- mapa: seleção (trilha, rota até o destino, zoom) ---------- */
  useEffect(() => {
    const L = LRef.current;
    const mapa = mapaRef.current;
    if (!pronto || !L || !mapa || !camadaSel.current) return;
    camadaSel.current.clearLayers();
    marcadores.current.forEach(({ marcador, estado }, lh) => {
      marcador.setIcon(iconeVeiculo(L, { cor: ESTADOS_MAPA[estado].cor, pulsa: estado === "ATRASADO" || estado === "MOVIMENTO", selecionado: lh === selecionado }));
    });
    const v = filtrados.find((x) => x.lh === selecionado);
    const entrada = selecionado ? marcadores.current.get(selecionado) : null;
    if (!v || !entrada) return;

    const cor = ESTADOS_MAPA[v.estado].cor;
    if (v.trilha.length > 1) L.polyline(v.trilha, { color: cor, weight: 4, opacity: 0.85, lineCap: "round" }).addTo(camadaSel.current);
    if (dados?.estacao?.coords) L.polyline([[v.lat, v.lng], dados.estacao.coords], { color: "#FA4C00", weight: 2, opacity: 0.75, dashArray: "6 8" }).addTo(camadaSel.current);
    clusterRef.current.zoomToShowLayer(entrada.marcador, () => entrada.marcador.openPopup());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, selecionado]);

  const escolher = (lh) => setSelecionado((atual) => (atual === lh ? null : lh));

  const resumo = useMemo(() => ({ total: recentes.length, ...contagem }), [recentes, contagem]);

  return (
    <div className="flex min-h-screen bg-page text-page overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-4 sm:p-6 xl:p-10 2xl:px-20 space-y-5 max-w-[1800px] mx-auto">
          <PageHeader
            kicker="Operação · Recebimento"
            titulo="Mapa"
            subtitulo={dados ? `Posição dos veículos pela telemetria · destino ${dados.estacao.nome}` : "Posição dos veículos pela telemetria"}
            atualizadoEm={atualizadoEm}
            atualizando={atualizando}
            onAtualizar={atualizarAgora}
          />

          {erro || (!dados && offline) ? (
            <Aviso tipo="erro">{erro || "Não foi possível carregar o mapa."}</Aviso>
          ) : !dados ? (
            <div aria-busy="true" aria-label="Carregando mapa" className="space-y-4">
              <Esqueleto className="h-24" />
              <Esqueleto className="h-[520px]" />
            </div>
          ) : (
            <>
              {offline && <Aviso tipo="alerta">Sem conexão com o servidor — as posições exibidas podem estar desatualizadas.</Aviso>}

              <FaixaIndicadores
                rotulo="Indicadores da frota"
                itens={[
                  { rotulo: "Veículos no mapa", valor: formatNumero(resumo.total), destaque: true, apoio: `leituras das últimas 24 h${antigos ? " e antigas" : ""}` },
                  { rotulo: "Em movimento", valor: formatNumero(resumo.MOVIMENTO), cor: ESTADOS_MAPA.MOVIMENTO.cor, apoio: "velocidade acima de 0" },
                  { rotulo: "Parados", valor: formatNumero(resumo.PARADO), cor: ESTADOS_MAPA.PARADO.cor, apoio: "parada, intervalo ou pernoite" },
                  { rotulo: "Atrasados / em risco", valor: formatNumero(resumo.ATRASO), cor: resumo.ATRASO > 0 ? ESTADOS_MAPA.ATRASADO.cor : undefined, apoio: "passaram do ETA ou tendem a passar" },
                  { rotulo: "No destino", valor: formatNumero(resumo.DESTINO), cor: ESTADOS_MAPA.DESTINO.cor, apoio: "já chegaram à estação" },
                  { rotulo: "Em trânsito sem posição", valor: formatNumero(dados.semTelemetria?.length || 0), apoio: "a planilha não tem telemetria deles" },
                ]}
              />

              <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-4">
                <section aria-label="Veículos" className="bg-surface rounded-2xl border border-default flex flex-col lg:h-[calc(100vh-290px)] lg:min-h-[560px] max-h-[640px] lg:max-h-none">
                  <div className="p-4 space-y-3 border-b border-default">
                    <div className="relative">
                      <label htmlFor="mf-busca" className="sr-only">Buscar veículo</label>
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
                      <input id="mf-busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="LH, placa, origem, motorista…" className={`${INPUT} pl-10`} />
                    </div>
                    <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
                      {CHIPS.map((c) => (
                        <button
                          key={c.valor}
                          type="button"
                          aria-pressed={chip === c.valor}
                          onClick={() => setChip(c.valor)}
                          className={`h-8 px-3 rounded-full text-xs font-medium border cursor-pointer transition-colors ${FOCO} ${chip === c.valor ? "bg-[#FA4C00] border-[#FA4C00] text-white" : "border-default text-muted hover:text-page hover:bg-surface-2"}`}
                        >
                          {c.rotulo} <span className="tabular-nums opacity-80">{contagem[c.valor]}</span>
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                      <input type="checkbox" checked={antigos} onChange={(e) => setAntigos(e.target.checked)} className="accent-[#FA4C00] w-4 h-4" />
                      Incluir posições com mais de 24 h
                    </label>
                  </div>

                  {filtrados.length === 0 && semPosicao.length === 0 ? (
                    <EstadoVazio icone={<MapPinOff size={26} aria-hidden="true" />} titulo="Nenhum veículo para os filtros" descricao="Troque o estado ou inclua as posições antigas." />
                  ) : (
                    <div className="flex-1 overflow-auto scroll-tema">
                      {filtrados.length > 0 && (
                        <ul className="divide-y divide-default">
                          {filtrados.map((v) => {
                            const e = ESTADOS_MAPA[v.estado];
                            const sel = v.lh === selecionado;
                            return (
                              <li key={v.lh}>
                                <button
                                  type="button"
                                  onClick={() => escolher(v.lh)}
                                  aria-pressed={sel}
                                  className={`w-full text-left px-4 py-3 cursor-pointer transition-colors ${FOCO} ${sel ? "bg-[#FA4C00]/10" : "hover:bg-surface-2"}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: e.cor }} />
                                    <span className="font-medium tabular-nums text-[#FA4C00] text-sm">{v.lh}</span>
                                    <span className="ml-auto text-[11px] font-semibold" style={{ color: e.cor }}>{e.rotulo}</span>
                                  </div>
                                  <p className="mt-1 text-xs text-muted truncate">{[v.origem, v.veiculo].filter(Boolean).join(" · ") || "—"}</p>
                                  <p className="mt-0.5 text-xs text-muted tabular-nums">
                                    {v.prazoEta ? `ETA ${fmtHoraIso(v.prazoEta)}` : SITUACOES[v.situacao]?.rotulo} · {v.ultimaLeitura.velocidadeKmh || 0} km/h · {fmtIdade(v.idadeMin)}
                                  </p>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {semPosicao.length > 0 && (
                        <section aria-label="Em trânsito sem telemetria">
                          <div className="sticky top-0 z-10 px-4 py-2.5 bg-surface-2 border-y border-default">
                            <h3 className="text-[11px] uppercase tracking-wide text-muted font-semibold">Em trânsito sem telemetria ({semPosicao.length})</h3>
                            <p className="text-xs text-muted mt-0.5">Já saíram da origem, mas a planilha não recebeu a posição do veículo. Não dá para mostrar no mapa.</p>
                          </div>
                          <ul className="divide-y divide-default">
                            {semPosicao.map((v) => (
                              <li key={v.lh}>
                                <button type="button" onClick={() => setModalLh(v.lh)} className={`w-full text-left px-4 py-3 cursor-pointer transition-colors hover:bg-surface-2 ${FOCO}`}>
                                  <div className="flex items-center gap-2">
                                    <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full shrink-0 border border-[#8B8B93]" />
                                    <span className="font-medium tabular-nums text-[#FA4C00] text-sm">{v.lh}</span>
                                    <span className="ml-auto text-[11px] font-semibold text-muted">Sem posição</span>
                                  </div>
                                  <p className="mt-1 text-xs text-muted truncate">{[v.origem, v.veiculo].filter(Boolean).join(" · ") || "—"}</p>
                                  <p className="mt-0.5 text-xs text-muted tabular-nums">ETA {fmtDataHora(v.prazoEta)}{v.pacotes ? ` · ${v.pacotesEstimado ? "~" : ""}${formatNumero(v.pacotes)} pacotes` : ""}</p>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}
                    </div>
                  )}
                </section>

                <section aria-label="Mapa" className="relative isolate rounded-2xl border border-default overflow-hidden h-[520px] lg:h-[calc(100vh-290px)] lg:min-h-[560px]">
                  <div ref={elMapa} className="absolute inset-0" role="application" aria-label="Mapa com a posição dos veículos" />
                  <div className="absolute left-3 top-3 z-[500] rounded-xl bg-surface/95 backdrop-blur border border-default p-3 shadow-lg">
                    <p className="text-[11px] uppercase tracking-wide text-muted mb-1.5">Legenda</p>
                    <ul className="space-y-1">
                      {Object.entries(ESTADOS_MAPA).filter(([k]) => k !== "OUTRO").map(([k, e]) => (
                        <li key={k} className="flex items-center gap-2 text-xs">
                          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ background: e.cor }} />
                          {e.rotulo}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {!pronto && <div className="absolute inset-0 grid place-items-center text-sm text-muted bg-surface-2">Carregando mapa…</div>}
                </section>
              </div>
            </>
          )}
        </main>
      </MainLayout>

      {modalLh && <ViagemInboundModal lh={modalLh} onClose={() => setModalLh(null)} />}
    </div>
  );
}
