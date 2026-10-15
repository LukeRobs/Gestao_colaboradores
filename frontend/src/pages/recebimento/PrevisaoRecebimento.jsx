import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Building2, CalendarDays, CircleCheck, Clock, Gauge, Hourglass, Info, Layers, Package, Target, TrendingUp, TriangleAlert, Truck } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MainLayout from "../../components/MainLayout";
import { AbasSegmentadas, Aviso, DiaNavegador, EstadoVazio, Esqueleto, PageHeader } from "../../components/mapaOperacional/ui";
import { FOCO, formatNumero } from "../../components/mapaOperacional/uiTokens";
import { PlanejamentoInboundAPI } from "../../services/planejamentoInbound";
import { Pilula } from "./FilaPecas";
import { PilulaSituacao } from "./InboundPecas";
import { BarrasHorizontais, Colunas, CurvaHora, Legenda } from "./PrevisaoGraficos";
import { BarraSegmentada, CardGrafico, Destaque, Kpi } from "./PrevisaoPecas";
import ViagemInboundModal from "./ViagemInboundModal";
import { COR_RECEBIDO, LEGENDA_PREV_REC, TURNOS, fmtDataHora, fmtDia, fmtDuracao, fmtHoraIso } from "./inboundUtils";

const POLL_MS = 60000;
const JANELA_TURNO = { T1: "06:00–13:59", T2: "14:00–21:59", T3: "22:00–05:59" };
const TRILHA = "var(--color-surface-3)";

const compacto = (n) => (n >= 1000 ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : formatNumero(n));
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default function PrevisaoRecebimento() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [offline, setOffline] = useState(false);
  const [dia, setDia] = useState(null); // null = o dia operacional atual
  const [turno, setTurno] = useState(""); // "" = todos os turnos
  const [metrica, setMetrica] = useState("veiculos");
  const [selecionada, setSelecionada] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const r = await PlanejamentoInboundAPI.previsao({ data: dia || undefined, turno: turno || undefined });
      setDados(r);
      setErro(null);
      setOffline(false);
      setAtualizadoEm(new Date());
    } catch (e) {
      setOffline(true);
      if (e.response?.status === 403 || e.response?.status === 500) setErro(e.response.data?.message || "Não foi possível carregar a previsão.");
    }
  }, [dia, turno]);

  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  const diaAtual = dados?.diaOperacionalAtual;
  const ehHoje = !!diaAtual && dados?.dia === diaAtual;
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

  const c = dados?.cards;
  const curvas = dados?.curvas;
  const pacotes = metrica === "pacotes";
  const chavePrev = pacotes ? "pacotesPrevistos" : "previstos";
  const chaveRec = pacotes ? "pacotesRecebidos" : "recebidos";
  const sufixo = pacotes ? "pacotes" : "veículos";

  const porHora = useMemo(() => (curvas ? curvas.porHora.map((h) => ({ ...h, hora: String(h.hora).padStart(2, "0") })) : []), [curvas]);
  const picoHora = useCallback((chave) => porHora.reduce((m, h) => (h[chave] > (m?.[chave] ?? 0) ? h : m), null), [porHora]);
  const picoVeiculos = picoHora("previstos");
  const picoPacotes = picoHora("pacotesPrevistos");

  // FM = hubs de first mile (FMH). Os totais abaixo são só dessa modalidade, no dia/turno escolhido.
  const fmTotais = useMemo(() => {
    const base = { previstos: 0, recebidos: 0, pacotesPrevistos: 0, pacotesRecebidos: 0, fms: 0 };
    (curvas?.porFm || []).forEach((f) => {
      base.previstos += f.previstos;
      base.recebidos += f.recebidos;
      base.pacotesPrevistos += f.pacotesPrevistos;
      base.pacotesRecebidos += f.pacotesRecebidos;
      base.fms += 1;
    });
    return base;
  }, [curvas]);
  const porFm = useMemo(() => (curvas ? [...curvas.porFm].sort((a, b) => b[chavePrev] - a[chavePrev]).slice(0, 12) : []), [curvas, chavePrev]);

  const aderencia = c?.aderencia;
  const corAderencia = aderencia?.pct == null ? "#8B8B93" : aderencia.pct >= 90 ? "#22C55E" : aderencia.pct >= 75 ? "#F59E0B" : "#FF453A";
  const diaSel = dados?.dia || dia;
  const vazio = c && c.previstos === 0;

  return (
    <div className="flex min-h-screen bg-page text-page overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-4 sm:p-6 xl:p-10 2xl:px-20 space-y-6 max-w-[1800px] mx-auto">
          <PageHeader
            kicker="Operação · Recebimento"
            titulo="Previsão de recebimento"
            subtitulo={dados ? `Veículos e pacotes previstos × recebidos · ${dados.estacao.nome}` : "Veículos e pacotes previstos × recebidos"}
            atualizadoEm={atualizadoEm}
            atualizando={atualizando}
            onAtualizar={atualizarAgora}
          />

          {erro || (!dados && offline) ? (
            <Aviso tipo="erro">{erro || "Não foi possível carregar a previsão."}</Aviso>
          ) : !dados ? (
            <div aria-busy="true" aria-label="Carregando previsão" className="space-y-4">
              <Esqueleto className="h-20" />
              <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <Esqueleto key={i} className="h-36" />
                ))}
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Esqueleto className="h-96" />
                <Esqueleto className="h-96" />
              </div>
            </div>
          ) : (
            <>
              {/* ---------- período e turno ---------- */}
              <section aria-label="Período e turno" className="anim-in rounded-2xl border border-default bg-surface p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span aria-hidden="true" className="grid place-items-center w-10 h-10 rounded-xl bg-[#FA4C00]/12 text-[#FA4C00] shrink-0">
                    <CalendarDays size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted">Dia operacional</p>
                    <p className="text-base font-semibold tabular-nums">
                      {fmtDia(diaSel)}
                      <span className="ml-2 text-sm font-normal text-muted">{turno ? `${turno} · ${JANELA_TURNO[turno]}` : "todos os turnos · 06:00 às 05:59"}</span>
                    </p>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-3 flex-wrap">
                  <div className="w-full sm:w-72">
                    <AbasSegmentadas rotulo="Turno" valor={turno || "TODOS"} onChange={(v) => setTurno(v === "TODOS" ? "" : v)} opcoes={[{ valor: "TODOS", rotulo: "Todos" }, ...TURNOS.map((t) => ({ valor: t, rotulo: t }))]} />
                  </div>
                  <DiaNavegador data={diaSel} maximo={undefined} onChange={(d) => setDia(d === diaAtual ? null : d)} />
                </div>
                <p className="w-full flex items-center gap-2 text-xs text-muted">
                  <span aria-hidden="true" className={`w-2 h-2 rounded-full ${offline ? "bg-[#FF453A]" : "bg-[#22C55E] motion-safe:animate-pulse"}`} />
                  {offline ? "Sem conexão com o servidor — dados podem estar desatualizados." : `Planilha lida às ${fmtHoraIso(dados.leituraEm)}${ehHoje ? " · atualiza sozinha a cada minuto" : ""}`}
                </p>
              </section>

              {/* ---------- indicadores ---------- */}
              <section aria-label="Indicadores da previsão de recebimento" className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
                <Kpi indice={0} icone={<Truck size={16} />} rotulo="Carros previstos" valor={formatNumero(c.previstos)} tom="#FA4C00" apoio={`${c.canceladas} ${c.canceladas === 1 ? "cancelado" : "cancelados"} no período`} />
                <Kpi
                  indice={1}
                  icone={<Package size={16} />}
                  rotulo="Pacotes previstos"
                  valor={formatNumero(c.pacotes.total)}
                  tom="#8B5CF6"
                  apoio={c.pacotes.estimados > 0 ? `${compacto(c.pacotes.informados)} informados + ~${compacto(c.pacotes.estimados)} estimados` : "volume informado pela origem"}
                  barra={<BarraSegmentada rotulo="Pacotes informados e estimados" segmentos={[{ rotulo: "Informados", valor: c.pacotes.informados, cor: "#8B5CF6" }, { rotulo: "Estimados", valor: c.pacotes.estimados, cor: "#8B5CF655" }]} />}
                />
                <Kpi
                  indice={2}
                  icone={<CircleCheck size={16} />}
                  rotulo="Já recebidos"
                  valor={formatNumero(c.recebidos.veiculos)}
                  tom="#22C55E"
                  corValor="#22C55E"
                  apoio={`${formatNumero(c.recebidos.pacotes)} pacotes · ${pct(c.recebidos.veiculos, c.previstos)}% dos previstos`}
                  barra={<BarraSegmentada rotulo="Recebidos sobre previstos" segmentos={[{ rotulo: "Recebidos", valor: c.recebidos.veiculos, cor: "#22C55E" }, { rotulo: "Restante", valor: Math.max(0, c.previstos - c.recebidos.veiculos), cor: TRILHA }]} />}
                />
                <Kpi
                  indice={3}
                  icone={<Hourglass size={16} />}
                  rotulo="Pendentes"
                  valor={formatNumero(c.pendentes.veiculos)}
                  tom="#F59E0B"
                  apoio={`${c.pendentes.noPatio} no pátio · ${c.pendentes.emTransito} em trânsito · ${c.pendentes.programadas} programados`}
                  barra={<BarraSegmentada rotulo="Pendentes por situação" segmentos={[{ rotulo: "No pátio", valor: c.pendentes.noPatio, cor: "#8B5CF6" }, { rotulo: "Em trânsito", valor: c.pendentes.emTransito, cor: "#3B82F6" }, { rotulo: "Programados", valor: c.pendentes.programadas, cor: "#8B8B93" }]} />}
                />
                <Kpi
                  indice={4}
                  icone={<TriangleAlert size={16} />}
                  rotulo="Atrasados"
                  valor={formatNumero(c.atrasados.veiculos)}
                  tom={c.atrasados.veiculos > 0 ? "#FF453A" : "#22C55E"}
                  corValor={c.atrasados.veiculos > 0 ? "#FF453A" : undefined}
                  apoio={c.atrasados.veiculos > 0 ? `${formatNumero(c.atrasados.pacotes)} pacotes${c.atrasados.tendemAtrasar ? ` · ${c.atrasados.tendemAtrasar} tendem a atrasar` : ""}` : c.atrasados.tendemAtrasar ? `${c.atrasados.tendemAtrasar} tendem a atrasar` : "nenhum atraso"}
                />
                <Kpi
                  indice={5}
                  icone={<Target size={16} />}
                  rotulo="Aderência pelo ETA"
                  valor={aderencia.pct == null ? "—" : `${aderencia.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                  tom={corAderencia}
                  corValor={aderencia.pct == null ? undefined : corAderencia}
                  apoio={aderencia.base ? `${aderencia.noPrazo} no prazo · ${aderencia.adiantadas} adiantados · ${aderencia.atrasadas} atrasados` : "ainda sem chegadas no período"}
                  barra={<BarraSegmentada rotulo="Chegadas por aderência ao ETA" segmentos={[{ rotulo: "No prazo", valor: aderencia.noPrazo, cor: "#22C55E" }, { rotulo: "Adiantados", valor: aderencia.adiantadas, cor: "#3B82F6" }, { rotulo: "Atrasados", valor: aderencia.atrasadas, cor: "#FF453A" }]} />}
                />
              </section>

              <p className="flex items-start gap-2 rounded-xl bg-surface-2/60 px-3.5 py-2.5 text-xs text-muted">
                <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Aderência = chegadas dentro de ±30 min do ETA planejado. Pacotes com “~” são estimados pela mediana histórica da origem, porque o volume só é informado depois do carregamento
                  {c.pacotes.viagensEstimadas ? ` (${c.pacotes.viagensEstimadas} ${c.pacotes.viagensEstimadas === 1 ? "viagem" : "viagens"} neste período)` : ""}.
                </span>
              </p>

              {vazio ? (
                <div className="rounded-2xl border border-default bg-surface">
                  <EstadoVazio titulo="Nenhuma viagem prevista neste período" descricao={turno ? `Não há viagens com ETA no ${turno} deste dia operacional. Tente outro turno ou escolha “Todos”.` : "A planilha de programação não tem viagens com ETA neste dia operacional para a estação."} />
                </div>
              ) : (
                <>
                  {/* ---------- curvas por hora ---------- */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <CardGrafico
                      indice={0}
                      icone={<TrendingUp size={16} />}
                      titulo="Curva de recebimento por hora — veículos"
                      subtitulo="Chegadas previstas (ETA) e recebidas, na ordem do dia operacional"
                      legenda={<Legenda itens={LEGENDA_PREV_REC} />}
                      destaques={
                        <>
                          <Destaque rotulo="Pico previsto" valor={picoVeiculos ? `${picoVeiculos.hora}h · ${picoVeiculos.previstos} ${picoVeiculos.previstos === 1 ? "veículo" : "veículos"}` : "—"} />
                          <Destaque rotulo="Recebidos" valor={`${c.recebidos.veiculos} de ${c.previstos}`} cor={COR_RECEBIDO} />
                        </>
                      }
                    >
                      <CurvaHora dados={porHora} chavePrev="previstos" chaveRec="recebidos" unidade="veículos" />
                    </CardGrafico>

                    <CardGrafico
                      indice={1}
                      icone={<Package size={16} />}
                      titulo="Curva de recebimento por hora — pacotes"
                      subtitulo="Volume previsto (informado + estimado) e recebido"
                      legenda={<Legenda itens={LEGENDA_PREV_REC} />}
                      destaques={
                        <>
                          <Destaque rotulo="Pico previsto" valor={picoPacotes ? `${picoPacotes.hora}h · ${compacto(picoPacotes.pacotesPrevistos)}` : "—"} />
                          <Destaque rotulo="Recebidos" valor={`${compacto(c.recebidos.pacotes)} de ${compacto(c.pacotes.total)}`} cor={COR_RECEBIDO} />
                        </>
                      }
                    >
                      <CurvaHora dados={porHora} chavePrev="pacotesPrevistos" chaveRec="pacotesRecebidos" unidade="pacotes" />
                    </CardGrafico>
                  </div>

                  {/* ---------- distribuição ---------- */}
                  <div className="flex items-end justify-between gap-3 flex-wrap pt-2">
                    <div>
                      <h2 className="text-base font-semibold">Distribuição do período</h2>
                      <p className="text-xs text-muted mt-0.5">SPP, turno, tipo de origem e FM</p>
                    </div>
                    <div className="w-full sm:w-64">
                      <AbasSegmentadas rotulo="Métrica dos gráficos de turno, tipo de origem e FM" valor={metrica} onChange={setMetrica} opcoes={[{ valor: "veiculos", rotulo: "Veículos" }, { valor: "pacotes", rotulo: "Pacotes" }]} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <CardGrafico
                      indice={0}
                      icone={<Layers size={16} />}
                      titulo="Curva de recebimento por SPP"
                      subtitulo={`TOs por faixa de SPP (pacotes por TO)${dados.semSpp ? ` · ${dados.semSpp} viagens sem SPP informado` : ""}`}
                      legenda={<Legenda itens={LEGENDA_PREV_REC} />}
                    >
                      <Colunas dados={curvas.porSpp} chaveX="faixa" chavePrev="previstos" chaveRec="recebidos" altura="flex-1 min-h-72" unidade="TOs" />
                    </CardGrafico>

                    <CardGrafico indice={1} icone={<Clock size={16} />} titulo="Curva de recebimento por turno" subtitulo={`Em ${sufixo} · clique num turno para filtrar a tela`} legenda={<Legenda itens={LEGENDA_PREV_REC} />}>
                      <Colunas dados={curvas.porTurno} chaveX="turno" chavePrev={chavePrev} chaveRec={chaveRec} altura="h-44" unidade={sufixo} />
                      <ul className="mt-4 space-y-2">
                        {curvas.porTurno.map((t) => {
                          const ativo = turno === t.turno;
                          return (
                            <li key={t.turno}>
                              <button
                                type="button"
                                aria-pressed={ativo}
                                onClick={() => setTurno(ativo ? "" : t.turno)}
                                className={`w-full text-left rounded-xl border px-3.5 py-3 cursor-pointer transition-colors ${FOCO} ${ativo ? "border-[#FA4C00]/60 bg-[#FA4C00]/8" : "border-default hover:bg-surface-2"}`}
                              >
                                <div className="flex items-baseline gap-2">
                                  <b className="text-sm">{t.turno}</b>
                                  <span className="text-xs text-muted">{JANELA_TURNO[t.turno]}</span>
                                  <span className="ml-auto text-xs tabular-nums text-muted">
                                    <b className="text-page">{t.recebidos}</b> de {t.previstos} veículos
                                  </span>
                                </div>
                                <div className="mt-2">
                                  <BarraSegmentada rotulo={`${t.turno}: recebidos sobre previstos`} segmentos={[{ rotulo: "Recebidos", valor: t.recebidos, cor: COR_RECEBIDO }, { rotulo: "Restante", valor: Math.max(0, t.previstos - t.recebidos), cor: TRILHA }]} />
                                </div>
                                <p className="mt-1.5 text-xs text-muted tabular-nums">
                                  {t.pendentes} pendentes · <span style={t.atrasados ? { color: "#FF453A", fontWeight: 600 } : undefined}>{t.atrasados} atrasados</span> · {compacto(t.pacotesRecebidos)} de {compacto(t.pacotesPrevistos)} pacotes
                                </p>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </CardGrafico>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <CardGrafico indice={0} icone={<Boxes size={16} />} titulo="Curva de recebimento por tipo de origem" subtitulo={`SOC, FMH, HUB, XPT e FBS · em ${sufixo}`} legenda={<Legenda itens={LEGENDA_PREV_REC} />}>
                      <Colunas dados={curvas.porTipoOrigem} chaveX="nome" chavePrev={chavePrev} chaveRec={chaveRec} altura="flex-1 min-h-72" unidade={sufixo} />
                    </CardGrafico>

                    <CardGrafico
                      indice={1}
                      icone={<Building2 size={16} />}
                      titulo="Curva de recebimento por FM"
                      subtitulo={`Hubs de first mile (FMH) · em ${sufixo}${curvas.porFm.length > 12 ? " · 12 maiores" : ""}`}
                      legenda={<Legenda itens={LEGENDA_PREV_REC} />}
                      destaques={
                        fmTotais.fms > 0 && (
                          <>
                            <Destaque rotulo="Pacotes previstos (FM)" valor={formatNumero(fmTotais.pacotesPrevistos)} />
                            <Destaque rotulo="Pacotes recebidos (FM)" valor={formatNumero(fmTotais.pacotesRecebidos)} cor={COR_RECEBIDO} />
                            <Destaque rotulo="Veículos" valor={`${fmTotais.recebidos} de ${fmTotais.previstos}`} />
                            <Destaque rotulo="% dos pacotes do período" valor={`${pct(fmTotais.pacotesPrevistos, c.pacotes.total)}%`} />
                          </>
                        )
                      }
                    >
                      {porFm.length ? <BarrasHorizontais dados={porFm} chavePrev={chavePrev} chaveRec={chaveRec} unidade={sufixo} /> : <EstadoVazio titulo="Nenhuma FM prevista neste período" />}
                    </CardGrafico>
                  </div>

                  {/* ---------- pendentes ---------- */}
                  <section aria-label="Pendentes do período" className="anim-in rounded-2xl border border-default bg-surface overflow-hidden">
                    <div className="px-5 py-4 border-b border-default flex items-center gap-3 flex-wrap">
                      <span aria-hidden="true" className="grid place-items-center w-9 h-9 rounded-xl bg-[#F59E0B]/15 text-[#F59E0B] shrink-0">
                        <Gauge size={17} />
                      </span>
                      <div>
                        <h2 className="text-sm font-semibold leading-tight">Pendentes do período</h2>
                        <p className="text-xs text-muted mt-1">Atrasados primeiro, depois por ETA · clique para abrir a viagem</p>
                      </div>
                      <span className="ml-auto rounded-full bg-surface-2 px-3 py-1 text-xs tabular-nums text-muted">
                        <b className="text-page">{dados.proximas.length}</b> de {c.pendentes.veiculos}
                      </span>
                    </div>
                    {dados.proximas.length === 0 ? (
                      <EstadoVazio titulo="Tudo recebido" descricao="Não há veículos pendentes neste período." />
                    ) : (
                      <div className="overflow-auto scroll-tema">
                        <table className="w-full text-sm">
                          <thead className="bg-surface-2 text-xs text-muted uppercase tracking-wide">
                            <tr>
                              <th scope="col" className="text-left font-medium px-4 py-3">LH</th>
                              <th scope="col" className="text-left font-medium px-4 py-3">Origem</th>
                              <th scope="col" className="text-left font-medium px-4 py-3">ETA planejado</th>
                              <th scope="col" className="text-left font-medium px-4 py-3">Situação</th>
                              <th scope="col" className="text-left font-medium px-4 py-3">Atraso</th>
                              <th scope="col" className="text-right font-medium px-4 py-3">Pacotes</th>
                              <th scope="col" className="text-left font-medium px-4 py-3">Motorista</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-default">
                            {[...dados.proximas].sort((a, b) => Number(b.atrasada) - Number(a.atrasada) || new Date(a.prazoEta) - new Date(b.prazoEta)).map((v) => (
                              <tr
                                key={v.lh}
                                tabIndex={0}
                                onClick={() => setSelecionada(v.lh)}
                                onKeyDown={(e) => e.key === "Enter" && setSelecionada(v.lh)}
                                className={`cursor-pointer hover:bg-surface-2 transition-colors ${FOCO} ${v.atrasada ? "shadow-[inset_3px_0_0_#FF453A]" : ""}`}
                              >
                                <td className="px-4 py-3 whitespace-nowrap font-medium tabular-nums text-[#FA4C00]">{v.lh}</td>
                                <td className="px-4 py-3 whitespace-nowrap">{v.origem || "—"} <span className="text-xs text-muted">{v.tipoOrigem}</span></td>
                                <td className="px-4 py-3 whitespace-nowrap tabular-nums font-medium">{fmtDataHora(v.prazoEta)}</td>
                                <td className="px-4 py-3 whitespace-nowrap"><PilulaSituacao situacao={v.situacao} /></td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {v.atrasada ? (
                                    <Pilula cor="#FF453A" icone={<TriangleAlert size={12} aria-hidden="true" />}>+{fmtDuracao(v.atrasoMin)}</Pilula>
                                  ) : v.tendeAtrasar ? (
                                    <Pilula cor="#FA4C00" icone={<TriangleAlert size={12} aria-hidden="true" />}>Tende a atrasar</Pilula>
                                  ) : (
                                    <span className="text-muted">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums font-semibold">{v.pacotes ? `${v.pacotesEstimado ? "~" : ""}${formatNumero(v.pacotes)}` : "—"}</td>
                                <td className="px-4 py-3"><div className="max-w-[200px] truncate" title={v.motorista || undefined}>{v.motorista || "—"}</div></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </main>
      </MainLayout>

      {selecionada && <ViagemInboundModal lh={selecionada} onClose={() => setSelecionada(null)} />}
    </div>
  );
}
