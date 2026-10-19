import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Boxes, CalendarDays, CircleAlert, CircleCheck, Inbox, MapPin, Package, Scale, Search, Truck } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MainLayout from "../../components/MainLayout";
import { AbasSegmentadas, Aviso, DiaNavegador, EstadoVazio, Esqueleto, PageHeader } from "../../components/mapaOperacional/ui";
import { BTN_SECUNDARIO, FOCO, INPUT, formatNumero } from "../../components/mapaOperacional/uiTokens";
import { TransbordoAPI } from "../../services/transbordo";
import { FUSO, fmtDuracao } from "./filaUtils";
import { LinhaSincronizacao, Paginacao } from "./FilaPecas";
import { CardGrafico, Destaque, Kpi, KpiDestaque } from "./PrevisaoPecas";
import { ColunasHora, JanelaScan, ListaOrigens, ModalTO, ModalVeiculo, SeloStatus } from "./TransbordoPecas";
import { METRICAS, TURNOS, agruparVeiculos, chaveVeiculo, fmtDataBR, fmtHora, fmtKg, origensDoDia, resumoPorTurno, serieHora, temExcecao } from "./transbordoUtils";

const POLL_MS = 15000;
const ATRASO_MS = 5 * 60 * 1000; // sem sincronizar há mais que isso = dados desatualizados

const COLUNAS_TOS = [
  { chave: "toNumber", rotulo: "TO", valor: (t) => t.toNumber.toLowerCase() },
  { chave: "packTypeName", rotulo: "Tipo", valor: (t) => (t.packTypeName || "").toLowerCase() },
  { chave: "parcels", rotulo: "Pacotes", direita: true, valor: (t) => t.parcels ?? 0 },
  { chave: "weightG", rotulo: "Peso", direita: true, valor: (t) => t.weightG ?? 0 },
  { chave: "loadedStationName", rotulo: "Origem", valor: (t) => (t.loadedStationName || "").toLowerCase() },
  { chave: "scanEm", rotulo: "Scan", titulo: "Hora do scan", valor: (t) => t.scanEm || "" },
  { chave: "dockNumber", rotulo: "Doca", valor: (t) => (t.dockNumber || "").toLowerCase() },
  { chave: "tripNumber", rotulo: "Veículo · LT", valor: (t) => (t.tripNumber || "").toLowerCase() },
  { chave: "excecao", rotulo: "Status", valor: (t) => (temExcecao(t) ? 1 : 0) },
];

const COLUNAS_VEICULOS = [
  { chave: "placa", rotulo: "Veículo", valor: (v) => (v.placa || "").toLowerCase() },
  { chave: "lt", rotulo: "LT · origem", valor: (v) => (v.lt || "").toLowerCase() },
  { chave: "janela", rotulo: "Janela de scan", valor: (v) => v.ultimoScan || "" },
  { chave: "duracao", rotulo: "Tempo", titulo: "Do primeiro ao último scan", valor: (v) => v.duracaoMin },
  { chave: "doca", rotulo: "Doca", valor: (v) => (v.doca || "").toLowerCase() },
  { chave: "tos", rotulo: "TOs", direita: true, valor: (v) => v.tos },
  { chave: "pacotes", rotulo: "Pacotes", direita: true, valor: (v) => v.pacotes },
  { chave: "peso", rotulo: "Peso", direita: true, valor: (v) => v.pesoG },
  { chave: "motorista", rotulo: "Motorista", valor: (v) => (v.motorista || "").toLowerCase() },
  { chave: "excecoes", rotulo: "Status", valor: (v) => v.excecoes },
];

function ordenar(lista, colunas, chave, asc) {
  const col = colunas.find((c) => c.chave === chave);
  return [...lista].sort((a, b) => {
    const va = col.valor(a);
    const vb = col.valor(b);
    const r = typeof va === "number" ? va - vb : va.localeCompare(vb);
    return asc ? r : -r;
  });
}

function Cabecalho({ colunas, ordem, onOrdenar }) {
  return (
    <thead className="sticky top-0 z-10 bg-surface-2">
      <tr className="text-xs text-muted uppercase tracking-wide">
        {colunas.map((c) => {
          const ativa = ordem.chave === c.chave;
          return (
            <th key={c.chave} scope="col" aria-sort={ativa ? (ordem.asc ? "ascending" : "descending") : "none"} className={`font-medium px-3 py-3.5 whitespace-nowrap ${c.direita ? "text-right" : "text-left"}`}>
              <button type="button" title={c.titulo} onClick={() => onOrdenar(c.chave)} className={`inline-flex items-center gap-1 uppercase tracking-wide cursor-pointer hover:text-page ${ativa ? "text-[#FA4C00]" : ""} ${FOCO}`}>
                {c.rotulo}
                {ativa && (ordem.asc ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
              </button>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

export default function Transbordo() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [offline, setOffline] = useState(false);
  const [dia, setDia] = useState(null); // null = o dia operacional atual
  const [origem, setOrigem] = useState("");
  const [busca, setBusca] = useState("");
  const [turno, setTurno] = useState("TODOS");
  const [metrica, setMetrica] = useState("pacotes");
  const [vista, setVista] = useState("tos");
  const [ordemTos, setOrdemTos] = useState({ chave: "scanEm", asc: false });
  const [ordemVeic, setOrdemVeic] = useState({ chave: "janela", asc: false });
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [toAberta, setToAberta] = useState(null);
  const [ltAberto, setLtAberto] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [proximaEm, setProximaEm] = useState(() => Date.now() + POLL_MS);

  const carregar = useCallback(async () => {
    try {
      const r = await TransbordoAPI.listar({ data: dia || undefined });
      setDados(r);
      setErro(null);
      setOffline(false);
      setAtualizadoEm(new Date());
    } catch (e) {
      setOffline(true);
      if (e.response?.status === 403) setErro(e.response.data?.message || "Este módulo não está disponível para a sua estação.");
    } finally {
      setProximaEm(Date.now() + POLL_MS);
    }
  }, [dia]);

  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  // Atualiza sozinho só no dia operacional atual; dia passado não muda.
  const diaAtual = dados?.diaOperacionalAtual;
  const diaMostrado = dados?.dia;
  const ehHoje = !!diaAtual && diaMostrado === diaAtual;
  useEffect(() => {
    const t = setInterval(() => {
      setAgora(Date.now());
      if (ehHoje && !document.hidden && Date.now() >= proximaEm) carregar();
    }, 1000);
    return () => clearInterval(t);
  }, [ehHoje, proximaEm, carregar]);

  const atualizarAgora = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  const lista = useMemo(() => dados?.lista || [], [dados]);
  const origens = useMemo(() => [...new Set(lista.map((t) => t.loadedStationName).filter(Boolean))].sort(), [lista]);

  const filtrar = useCallback(
    (itens, { ignorarTurno = false } = {}) => {
      const q = busca.trim().toLowerCase();
      return itens.filter((t) => {
        if (origem && t.loadedStationName !== origem) return false;
        if (!ignorarTurno && turno !== "TODOS" && t.turno !== turno) return false;
        if (!q) return true;
        return [t.toNumber, t.loadedStationName, t.operator, t.tripNumber, t.vehicleNumber, t.driverName, t.dockNumber].some((v) => (v || "").toLowerCase().includes(q));
      });
    },
    [origem, turno, busca]
  );

  const visiveis = useMemo(() => filtrar(lista), [filtrar, lista]);
  const veiculos = useMemo(() => agruparVeiculos(visiveis), [visiveis]);

  const kpis = useMemo(() => {
    const pacotes = visiveis.reduce((s, t) => s + (t.parcels || 0), 0);
    const peso = visiveis.reduce((s, t) => s + (t.weightG || 0), 0);
    const origensAtivas = new Set(visiveis.map((t) => t.loadedStationName).filter(Boolean));
    return { pacotes, peso, origensAtivas, excecoes: visiveis.filter(temExcecao).length };
  }, [visiveis]);

  const porHora = useMemo(() => serieHora(visiveis, metrica), [visiveis, metrica]);
  const topOrigens = useMemo(() => origensDoDia(visiveis, metrica), [visiveis, metrica]);
  const resumoTurnos = useMemo(() => resumoPorTurno(filtrar(lista, { ignorarTurno: true })), [filtrar, lista]);
  const pico = useMemo(() => porHora.reduce((m, h) => (h.valor > (m?.valor ?? 0) ? h : m), null), [porHora]);

  /* ---------- tabelas (ordenação + paginação) ---------- */
  const tabelaTos = useMemo(() => ordenar(visiveis, COLUNAS_TOS, ordemTos.chave, ordemTos.asc), [visiveis, ordemTos]);
  const tabelaVeic = useMemo(() => ordenar(veiculos, COLUNAS_VEICULOS, ordemVeic.chave, ordemVeic.asc), [veiculos, ordemVeic]);
  const linhasAtivas = vista === "tos" ? tabelaTos : tabelaVeic;
  const totalPaginas = Math.max(1, Math.ceil(linhasAtivas.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = linhasAtivas.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);

  const alternarOrdem = (chave) => {
    const set = vista === "tos" ? setOrdemTos : setOrdemVeic;
    set((o) => (o.chave === chave ? { chave, asc: !o.asc } : { chave, asc: false }));
    setPagina(1);
  };

  /* ---------- sincronização (ONLINE / DESATUALIZADO / OFFLINE) ---------- */
  const ultimoSync = dados?.sincronizacao?.ultimoFetchedAt ?? null;
  let estadoSync = "conectando";
  let detalheSync = "aguardando a primeira sincronização";
  if (dados) {
    if (offline) {
      estadoSync = "offline";
      detalheSync = "falha ao conectar no servidor";
    } else if (ultimoSync == null) {
      estadoSync = "atrasado";
      detalheSync = "o Tampermonkey ainda não enviou dados";
    } else {
      const atrasoMs = agora - ultimoSync;
      const hhmm = new Date(ultimoSync).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO });
      estadoSync = atrasoMs < ATRASO_MS ? "online" : "atrasado";
      const min = Math.floor(atrasoMs / 60000);
      detalheSync = `atualizado às ${hhmm}${min > 0 ? ` (há ${min} min)` : ""}`;
    }
  }
  const proxima = ehHoje ? Math.max(0, Math.round((proximaEm - agora) / 1000)) : null;

  const diaSel = diaMostrado || dia;
  const filtrosAtivos = !!origem || turno !== "TODOS" || !!busca || (dia && dia !== diaAtual);
  const limpar = () => {
    setOrigem("");
    setTurno("TODOS");
    setBusca("");
    setDia(null);
    setPagina(1);
  };

  const anterior = dados?.contagemDiaAnterior || 0;
  const tendencia = anterior > 0 ? Math.round(((visiveis.length - anterior) / anterior) * 100) : null;
  const abertaVeic = ltAberto ? veiculos.find((v) => v.chave === ltAberto) : null;
  const semDados = lista.length === 0;
  const unidadeMetrica = METRICAS[metrica].unidade;

  return (
    <div className="flex min-h-screen bg-page text-page overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-4 sm:p-6 xl:p-10 2xl:px-20 space-y-6 max-w-[1800px] mx-auto">
          <PageHeader
            kicker="Operação · Recebimento"
            titulo="Transbordo"
            subtitulo={dados ? `TOs com tag CD escaneadas · ${dados.estacao.nome.replace(/_/g, " ")}` : "TOs com tag CD escaneadas"}
            atualizadoEm={atualizadoEm}
            atualizando={atualizando}
            onAtualizar={atualizarAgora}
          />

          {erro || (!dados && offline) ? (
            <Aviso tipo="erro">{erro || "Não foi possível carregar o transbordo."}</Aviso>
          ) : !dados ? (
            <div aria-busy="true" aria-label="Carregando transbordo" className="space-y-6">
              <Esqueleto className="h-44" />
              <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-3">
                <Esqueleto className="h-56 sm:col-span-3 xl:col-span-1" />
                <Esqueleto className="h-56" />
                <Esqueleto className="h-56" />
                <Esqueleto className="h-56" />
              </div>
              <Esqueleto className="h-72" />
              <Esqueleto className="h-64" />
            </div>
          ) : (
            <>
              {/* ---------- dia, filtros e sincronização ---------- */}
              <section aria-label="Dia operacional e filtros" className="anim-in rounded-2xl border border-default bg-surface p-4 space-y-4">
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

                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-full sm:w-60">
                    <label htmlFor="tb-origem" className="block text-xs text-muted mb-1.5">Origem</label>
                    <select id="tb-origem" value={origem} onChange={(e) => { setOrigem(e.target.value); setPagina(1); }} className={`${INPUT} cursor-pointer`}>
                      <option value="">Todas</option>
                      {origens.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div className="relative flex-1 min-w-[240px] max-w-xl">
                    <label htmlFor="tb-busca" className="block text-xs text-muted mb-1.5">Buscar</label>
                    <Search size={15} className="absolute left-3.5 bottom-3.5 text-muted pointer-events-none" aria-hidden="true" />
                    <input id="tb-busca" type="search" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="TO, LT, placa, motorista…" className={`${INPUT} pl-10`} />
                  </div>
                  <div className="w-full sm:w-64">
                    <span className="block text-xs text-muted mb-1.5">Turno</span>
                    <AbasSegmentadas rotulo="Turno" valor={turno} onChange={(v) => { setTurno(v); setPagina(1); }} opcoes={[{ valor: "TODOS", rotulo: "Todos" }, ...TURNOS.map((t) => ({ valor: t, rotulo: t }))]} />
                  </div>
                  <button type="button" onClick={limpar} disabled={!filtrosAtivos} className={`${BTN_SECUNDARIO} disabled:opacity-50`}>
                    Limpar filtros
                  </button>
                  <p className="ml-auto text-sm text-muted tabular-nums" aria-live="polite">
                    <b className="text-page">{formatNumero(veiculos.length)}</b> {veiculos.length === 1 ? "veículo" : "veículos"} · <b className="text-page">{formatNumero(visiveis.length)}</b> de {formatNumero(lista.length)} {lista.length === 1 ? "TO" : "TOs"} no dia
                  </p>
                </div>

                <LinhaSincronizacao sincronizacao={{ estado: estadoSync, detalhe: detalheSync, proxima }} />
              </section>

              {estadoSync === "offline" && <Aviso tipo="alerta">Sem conexão com o servidor — os dados exibidos podem estar desatualizados.</Aviso>}
              {estadoSync === "atrasado" && ehHoje && <Aviso tipo="alerta">Dados desatualizados — o Tampermonkey pode estar offline ou sem sincronizar.</Aviso>}

              {/* ---------- indicadores ---------- */}
              <section aria-label="Indicadores do transbordo" className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-3">
                <KpiDestaque
                  className="sm:col-span-3 xl:col-span-1"
                  indice={0}
                  icone={<Package size={20} />}
                  rotulo="Pacotes em transbordo"
                  valor={formatNumero(kpis.pacotes)}
                  apoio={tendencia === null ? "soma dos pacotes de cada TO" : `TOs ${tendencia >= 0 ? "▲" : "▼"} ${Math.abs(tendencia)}% vs dia anterior (${formatNumero(anterior)})`}
                  extras={[
                    { icone: <Truck size={13} />, rotulo: "Veículos (LT)", valor: formatNumero(veiculos.length) },
                    { icone: <Boxes size={13} />, rotulo: "TOs de transbordo", valor: formatNumero(visiveis.length) },
                  ]}
                />
                <Kpi
                  indice={1}
                  icone={<Scale size={16} />}
                  rotulo="Peso escaneado"
                  valor={`${fmtKg(kpis.peso)} kg`}
                  tom="#3B82F6"
                  apoio={veiculos.length ? `${fmtKg(kpis.peso / veiculos.length)} kg por veículo` : "total escaneado no dia"}
                />
                <Kpi
                  indice={2}
                  icone={<MapPin size={16} />}
                  rotulo="Origens ativas"
                  valor={formatNumero(kpis.origensAtivas.size)}
                  tom="#8B5CF6"
                  apoio={kpis.origensAtivas.size ? [...kpis.origensAtivas].slice(0, 2).join(", ") + (kpis.origensAtivas.size > 2 ? ` +${kpis.origensAtivas.size - 2}` : "") : "nenhuma estação com TO no dia"}
                />
                <Kpi
                  indice={3}
                  icone={kpis.excecoes > 0 ? <CircleAlert size={16} /> : <CircleCheck size={16} />}
                  rotulo="Exceções"
                  valor={formatNumero(kpis.excecoes)}
                  tom={kpis.excecoes > 0 ? "#FF453A" : "#22C55E"}
                  corValor={kpis.excecoes > 0 ? "#FF453A" : "#22C55E"}
                  apoio={kpis.excecoes > 0 ? "requer verificação" : "nenhuma pendência"}
                />
              </section>

              {/* ---------- por hora e origens ---------- */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 flex flex-col [&>section]:flex-1">
                  <CardGrafico
                    icone={<Package size={17} />}
                    titulo={`${METRICAS[metrica].rotulo} por hora`}
                    subtitulo={`${fmtDataBR(diaSel || diaAtual)} · ${formatNumero(visiveis.length)} ${visiveis.length === 1 ? "TO" : "TOs"} · dia operacional (06:00 às 05:59)`}
                    indice={1}
                    legenda={
                      <div className="w-full sm:w-72">
                        <AbasSegmentadas rotulo="Métrica dos gráficos" valor={metrica} onChange={setMetrica} opcoes={Object.entries(METRICAS).map(([valor, m]) => ({ valor, rotulo: m.rotulo }))} />
                      </div>
                    }
                    destaques={pico && pico.valor > 0 ? <Destaque rotulo="Pico" valor={`${pico.hora}h · ${formatNumero(pico.valor)} ${unidadeMetrica}`} /> : null}
                  >
                    <ColunasHora dados={porHora} metrica={metrica} />
                  </CardGrafico>
                </div>
                <CardGrafico icone={<MapPin size={17} />} titulo="Top origens" subtitulo={`Por ${unidadeMetrica}`} indice={2}>
                  <ListaOrigens origens={topOrigens} metrica={metrica} />
                </CardGrafico>
              </div>

              {/* ---------- comparação por turno ---------- */}
              <CardGrafico icone={<CalendarDays size={17} />} titulo="Comparação por turno" subtitulo="Clique numa linha para filtrar a página pelo turno" indice={3}>
                <div className="overflow-x-auto scroll-tema">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted uppercase tracking-wide">
                        <th scope="col" className="text-left font-medium px-4 py-3">Turno</th>
                        <th scope="col" className="text-right font-medium px-4 py-3">Veículos (LT)</th>
                        <th scope="col" className="text-right font-medium px-4 py-3">TOs</th>
                        <th scope="col" className="text-right font-medium px-4 py-3">Pacotes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-default">
                      {TURNOS.map((t) => (
                        <tr
                          key={t}
                          tabIndex={0}
                          aria-pressed={turno === t}
                          onClick={() => { setTurno(turno === t ? "TODOS" : t); setPagina(1); }}
                          onKeyDown={(e) => e.key === "Enter" && (setTurno(turno === t ? "TODOS" : t), setPagina(1))}
                          className={`cursor-pointer transition-colors ${FOCO} ${turno === t ? "bg-[#FA4C00]/10" : "hover:bg-surface-2"}`}
                        >
                          <td className="px-4 py-3 font-semibold">{t}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumero(resumoTurnos[t].veiculos)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumero(resumoTurnos[t].tos)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumero(resumoTurnos[t].pacotes)}</td>
                        </tr>
                      ))}
                      <tr className="font-semibold">
                        <td className="px-4 py-3">Total</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatNumero(new Set(filtrar(lista, { ignorarTurno: true }).map(chaveVeiculo)).size)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatNumero(TURNOS.reduce((s, t) => s + resumoTurnos[t].tos, 0))}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatNumero(TURNOS.reduce((s, t) => s + resumoTurnos[t].pacotes, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-muted">Um veículo que escaneia em mais de um turno aparece em cada um; o total conta cada veículo uma vez.</p>
              </CardGrafico>

              {/* ---------- tabela ---------- */}
              <section aria-label="TOs e veículos de transbordo" className="anim-in rounded-2xl border border-default bg-surface overflow-hidden">
                <div className="flex items-center justify-between gap-3 flex-wrap p-5">
                  <div>
                    <h2 className="text-sm font-semibold leading-tight">{vista === "tos" ? "TOs de transbordo (CD)" : "Veículos (LT) do transbordo"}</h2>
                    <p className="text-xs text-muted mt-1 tabular-nums">
                      {fmtDataBR(diaSel || diaAtual)} · {formatNumero(linhasAtivas.length)} {vista === "tos" ? (linhasAtivas.length === 1 ? "TO" : "TOs") : linhasAtivas.length === 1 ? "veículo" : "veículos"} · clique na linha para ver o detalhe
                    </p>
                  </div>
                  <div className="w-full sm:w-72">
                    <AbasSegmentadas
                      rotulo="Visualização da tabela"
                      valor={vista}
                      onChange={(v) => { setVista(v); setPagina(1); }}
                      opcoes={[
                        { valor: "tos", rotulo: `TOs (${formatNumero(visiveis.length)})` },
                        { valor: "veiculos", rotulo: `Veículos (${formatNumero(veiculos.length)})` },
                      ]}
                    />
                  </div>
                </div>

                {semDados ? (
                  <EstadoVazio
                    icone={ultimoSync == null ? <Inbox size={28} aria-hidden="true" /> : <CircleCheck size={28} className="text-[#22C55E]" aria-hidden="true" />}
                    titulo={ultimoSync == null ? "Aguardando sincronização" : "Sem TOs de transbordo neste dia"}
                    descricao={ultimoSync == null ? "O Tampermonkey ainda não enviou dados de transbordo desta estação." : "A sincronização está ativa e nenhuma TO com tag CD foi encontrada neste dia operacional."}
                  />
                ) : linhasAtivas.length === 0 ? (
                  <EstadoVazio icone={<Search size={28} aria-hidden="true" />} titulo="Nenhum registro para os filtros selecionados" acao={<button type="button" onClick={limpar} className={`${BTN_SECUNDARIO} h-10 mt-2`}>Limpar filtros</button>} />
                ) : (
                  <div className="overflow-auto max-h-[680px] scroll-tema border-t border-default">
                    <table className="w-full text-sm">
                      {vista === "tos" ? (
                        <>
                          <Cabecalho colunas={COLUNAS_TOS} ordem={ordemTos} onOrdenar={alternarOrdem} />
                          <tbody className="divide-y divide-default">
                            {daPagina.map((t) => (
                              <tr key={t.toNumber} tabIndex={0} onClick={() => setToAberta(t.toNumber)} onKeyDown={(e) => e.key === "Enter" && setToAberta(t.toNumber)} className={`cursor-pointer hover:bg-surface-2 transition-colors ${FOCO}`}>
                                <td className="px-3 py-3.5 whitespace-nowrap font-medium tabular-nums text-[#FA4C00]">{t.toNumber}</td>
                                <td className="px-3 py-3.5 whitespace-nowrap text-muted">{t.packTypeName || "—"}</td>
                                <td className="px-3 py-3.5 whitespace-nowrap text-right font-semibold tabular-nums">{formatNumero(t.parcels)}</td>
                                <td className="px-3 py-3.5 whitespace-nowrap text-right tabular-nums text-muted">{fmtKg(t.weightG)} kg</td>
                                <td className="px-3 py-3.5 font-medium"><div className="max-w-[190px] truncate" title={t.loadedStationName || undefined}>{t.loadedStationName || "—"}</div></td>
                                <td className="px-3 py-3.5 whitespace-nowrap font-medium tabular-nums">{fmtHora(t)}</td>
                                <td className="px-3 py-3.5 whitespace-nowrap text-muted">{(t.dockNumber || "").replace(/^Doca\s+(Outbound\s+|Inbound\s+)?/i, "") || "—"}</td>
                                <td className="px-3 py-3.5 whitespace-nowrap">
                                  <span className="block font-medium tabular-nums">{t.vehicleNumber || "—"}</span>
                                  <span className="block text-xs tabular-nums text-muted">{t.tripNumber || "—"}</span>
                                </td>
                                <td className="px-3 py-3.5 whitespace-nowrap"><SeloStatus t={t} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </>
                      ) : (
                        <>
                          <Cabecalho colunas={COLUNAS_VEICULOS} ordem={ordemVeic} onOrdenar={alternarOrdem} />
                          <tbody className="divide-y divide-default">
                            {daPagina.map((v) => (
                              <tr key={v.chave} tabIndex={0} onClick={() => setLtAberto(v.chave)} onKeyDown={(e) => e.key === "Enter" && setLtAberto(v.chave)} className={`cursor-pointer hover:bg-surface-2 transition-colors ${FOCO}`}>
                                <td className="px-3 py-3.5 whitespace-nowrap font-semibold tabular-nums">{v.placa || "—"}</td>
                                <td className="px-3 py-3.5">
                                  <span className="block font-medium tabular-nums text-[#FA4C00] whitespace-nowrap">{v.lt || "—"}</span>
                                  <span className="block max-w-[190px] truncate text-xs text-muted" title={v.origem || undefined}>{v.origem ? `${v.origem}${v.outrasOrigens ? ` +${v.outrasOrigens}` : ""}` : "—"}</span>
                                </td>
                                <td className="px-3 py-3.5 whitespace-nowrap"><JanelaScan v={v} /></td>
                                <td className="px-3 py-3.5 whitespace-nowrap tabular-nums">{v.duracaoMin > 0 ? fmtDuracao(v.duracaoMin) : <span className="text-muted">—</span>}</td>
                                <td className="px-3 py-3.5 whitespace-nowrap text-muted">{(v.doca || "").replace(/^Doca\s+(Outbound\s+|Inbound\s+)?/i, "") || "—"}</td>
                                <td className="px-3 py-3.5 whitespace-nowrap text-right font-semibold tabular-nums">{formatNumero(v.tos)}</td>
                                <td className="px-3 py-3.5 whitespace-nowrap text-right font-semibold tabular-nums">{formatNumero(v.pacotes)}</td>
                                <td className="px-3 py-3.5 whitespace-nowrap text-right tabular-nums text-muted">{fmtKg(v.pesoG)} kg</td>
                                <td className="px-3 py-3.5 font-medium"><div className="max-w-[150px] truncate" title={v.motorista || undefined}>{v.motorista || "—"}</div></td>
                                <td className="px-3 py-3.5 whitespace-nowrap">
                                  {v.excecoes > 0 ? (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-[#FF453A]/35 bg-[#FF453A]/10 px-2 py-0.5 text-xs font-semibold text-[#FF453A]">
                                      <CircleAlert size={12} aria-hidden="true" /> {v.excecoes}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-[#22C55E]/30 bg-[#22C55E]/10 px-2 py-0.5 text-xs font-semibold text-[#22C55E]">
                                      <CircleCheck size={12} aria-hidden="true" /> OK
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </>
                      )}
                    </table>
                  </div>
                )}
                {linhasAtivas.length > 0 && <Paginacao total={linhasAtivas.length} pagina={paginaAtual} porPagina={porPagina} onPagina={setPagina} onPorPagina={(n) => { setPorPagina(n); setPagina(1); }} />}
              </section>
            </>
          )}
        </main>
      </MainLayout>

      {toAberta && lista.find((t) => t.toNumber === toAberta) && <ModalTO t={lista.find((t) => t.toNumber === toAberta)} onClose={() => setToAberta(null)} />}
      {abertaVeic && <ModalVeiculo v={abertaVeic} onClose={() => setLtAberto(null)} />}
    </div>
  );
}
