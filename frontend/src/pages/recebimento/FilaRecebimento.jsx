import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CircleCheck, Circle, Inbox, PackageOpen, Pause, Search, Truck, X, Hourglass, MapPin } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MainLayout from "../../components/MainLayout";
import { AbasSegmentadas, Aviso, EstadoVazio, Esqueleto, FaixaIndicadores, PageHeader } from "../../components/mapaOperacional/ui";
import { BTN_SECUNDARIO, FOCO, INPUT, formatNumero } from "../../components/mapaOperacional/uiTokens";
import { FilaRecebimentoAPI } from "../../services/filaRecebimento";

const POLL_MS = 15000;
const ATRASO_MS = 5 * 60 * 1000; // sem sincronizar há mais que isso = dados desatualizados
const FUSO = "America/Sao_Paulo";

// Status da viagem na estação (trip_station_status) e da fila (queue_status), como o SPX numera.
const LH_TRANSITO = 50;
const LH_DESCARREGANDO = 60;

const fmtHora = (sec) =>
  sec ? new Date(sec * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO }) : "—";

function fmtDuracao(min) {
  if (!min || min <= 0) return "—";
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}m`;
}

function fmtPeso(g) {
  if (!g) return "—";
  const kg = g / 1000;
  return kg >= 1000 ? `${(kg / 1000).toFixed(2).replace(".", ",")} t` : `${kg.toFixed(1).replace(".", ",")} kg`;
}

// Tempo parado esperando: verde até 30 min, depois amarelo, laranja (1h) e vermelho (2h).
function corEspera(min) {
  if (!min || min < 30) return "#22C55E";
  if (min < 60) return "#F59E0B";
  if (min < 120) return "#FA4C00";
  return "#FF453A";
}

const minDesdeChegada = (i, agora) => (i.chegouSec ? Math.max(0, Math.floor((agora / 1000 - i.chegouSec) / 60)) : null);

const COLUNAS = [
  { chave: "placa", rotulo: "Placa", valor: (i) => (i.placa || "").toLowerCase() },
  { chave: "tipoVeiculo", rotulo: "Veículo", valor: (i) => (i.tipoVeiculo || "").toLowerCase() },
  { chave: "tripNumber", rotulo: "LH", valor: (i) => (i.tripNumber || "").toLowerCase() },
  { chave: "origem", rotulo: "Origem", valor: (i) => (i.origem || "").toLowerCase() },
  { chave: "etaSec", rotulo: "ETA", valor: (i) => i.etaSec ?? 0 },
  // Quanto mais antiga a chegada, maior a espera: ordenar pelo horário (negativo) mantém a ordem estável a cada segundo.
  { chave: "chegada", rotulo: "Desde a chegada", valor: (i) => (i.chegouSec ? -i.chegouSec : -1e15) },
  { chave: "espera", rotulo: "Espera", valor: (i) => i.fila?.esperaMin ?? -1 },
  { chave: "emEspera", rotulo: "Em espera desde", valor: (i) => i.fila?.emEsperaDesdeSec ?? 0 },
  { chave: "pacotes", rotulo: "Pacotes pend.", direita: true, valor: (i) => i.fila?.pacotes ?? 0 },
  { chave: "motorista", rotulo: "Motorista", valor: (i) => (i.motorista || "").toLowerCase() },
  { chave: "docaAtribuida", rotulo: "Doca atrib.", valor: (i) => (i.fila?.docaAtribuida || "").toLowerCase() },
  { chave: "docaOcupada", rotulo: "Doca ocup.", valor: (i) => (i.fila?.docaOcupada || "").toLowerCase() },
  { chave: "statusLh", rotulo: "Status LH", valor: (i) => i.statusLh ?? 0 },
  { chave: "statusFila", rotulo: "Status fila", valor: (i) => i.fila?.status ?? 0 },
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

function Pilula({ cor, icone, children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap" style={{ color: cor, background: `${cor}1A`, borderColor: `${cor}40` }}>
      {icone} {children}
    </span>
  );
}

function PilulaLh({ status }) {
  if (status === LH_TRANSITO) return <Pilula cor="#F59E0B" icone={<Truck size={12} aria-hidden="true" />}>Em trânsito</Pilula>;
  if (status === LH_DESCARREGANDO) return <Pilula cor="#22C55E" icone={<PackageOpen size={12} aria-hidden="true" />}>Descarregando</Pilula>;
  return <span className="text-muted">—</span>;
}

// queue_status: 1 pendente · 2 atribuído · 3 ocupado · 5 em espera
function PilulaFila({ status }) {
  if (status === 1) return <Pilula cor="#F59E0B" icone={<Hourglass size={12} aria-hidden="true" />}>Pendente</Pilula>;
  if (status === 2) return <Pilula cor="#8B5CF6" icone={<MapPin size={12} aria-hidden="true" />}>Atribuído</Pilula>;
  if (status === 3) return <Pilula cor="#22C55E" icone={<Truck size={12} aria-hidden="true" />}>Ocupado</Pilula>;
  if (status === 5) return <Pilula cor="#FA4C00" icone={<Pause size={12} aria-hidden="true" />}>Em espera</Pilula>;
  return <span className="text-muted">—</span>;
}

function StatusSincronizacao({ estado, detalhe, proxima }) {
  const cores = { online: "#22C55E", atrasado: "#F59E0B", offline: "#FF453A", conectando: "#8B8B93" };
  const rotulos = { online: "Online", atrasado: "Dados desatualizados", offline: "Offline", conectando: "Conectando" };
  return (
    <div role="status" className="inline-flex items-center gap-3 rounded-full border border-default bg-surface px-4 h-10 text-xs text-muted">
      <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: cores[estado] }} />
      <span>
        <b className="text-page font-semibold">{rotulos[estado]}</b>
        {detalhe && <span> · {detalhe}</span>}
      </span>
      {proxima != null && <span className="hidden sm:inline border-l border-default pl-3 tabular-nums">próxima atualização ~{proxima}s</span>}
    </div>
  );
}

function Campo({ rotulo, children, mono }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted">{rotulo}</dt>
      <dd className={`mt-0.5 text-sm font-medium ${mono ? "tabular-nums" : ""}`}>{children || "—"}</dd>
    </div>
  );
}

function BlocoEstacao({ titulo, e, carga }) {
  return (
    <div className="rounded-xl border border-default bg-surface-2 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted">{titulo}</p>
      <p className="mt-0.5 text-sm font-semibold break-words">{e?.nome || "—"}</p>
      {e && (
        <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <div><dt className="text-muted">Chegada</dt><dd className="font-medium tabular-nums">{fmtHora(e.ata)}</dd></div>
          <div><dt className="text-muted">Saída</dt><dd className="font-medium tabular-nums">{fmtHora(e.atd)}</dd></div>
          <div><dt className="text-muted">{carga.rotulo}</dt><dd className="font-medium tabular-nums">{formatNumero(carga.valor)}</dd></div>
        </dl>
      )}
    </div>
  );
}

const TIPOS_CARGA = ["Saca", "Scuttle", "Volumoso"];

function Detalhe({ i, agora, onClose }) {
  useEffect(() => {
    const aoTeclar = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const d = i.detalhe;
  const min = minDesdeChegada(i, agora);
  const comp = d.composicao;
  const tipos = comp ? [...new Set([...TIPOS_CARGA, ...Object.keys(comp.porTipo)])].filter((t) => comp.porTipo[t]) : [];
  const passos = [
    { rotulo: "Início carga", sec: d.origem?.inicioCarga },
    { rotulo: "Fim carga", sec: d.origem?.fimCarga },
    { rotulo: "Lacrado", sec: d.origem?.lacrado },
    { rotulo: "Partiu", sec: d.origem?.atd },
    { rotulo: "Chegou aqui", sec: d.destino?.ata },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes da viagem ${i.tripNumber}`}
        className="h-full w-full max-w-md bg-surface border-l border-default shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 py-4 border-b border-default shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold tabular-nums truncate text-[#FA4C00]">{i.tripNumber}</h2>
            <p className="text-xs text-muted mt-0.5">{[i.tipoVeiculo, i.placa].filter(Boolean).join(" · ") || "—"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar detalhe" className={`ml-auto h-10 w-10 grid place-items-center rounded-lg text-muted hover:text-page hover:bg-surface-2 cursor-pointer shrink-0 ${FOCO}`}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            <PilulaLh status={i.statusLh} />
            <PilulaFila status={i.fila?.status} />
          </div>

          <dl className="grid grid-cols-2 gap-4">
            <Campo rotulo="Motorista">{i.motorista}</Campo>
            <Campo rotulo="Agência">{i.agencia}</Campo>
            <Campo rotulo="Tempo aqui" mono>
              {min != null ? <span style={{ color: corEspera(min) }}>{fmtDuracao(min)}</span> : null}
            </Campo>
            <Campo rotulo="Peso total" mono>{fmtPeso(d.pesoG)}</Campo>
          </dl>

          <div className="space-y-2">
            <BlocoEstacao titulo="Origem" e={d.origem} carga={{ rotulo: "Carregados", valor: d.origem?.carregados || i.fila?.pacotes || 0 }} />
            <BlocoEstacao titulo="Destino (aqui)" e={d.destino} carga={{ rotulo: "Descarregados", valor: d.destino?.descarregados || 0 }} />
          </div>

          {(i.fila?.docaAtribuida || i.fila?.docaOcupada) && (
            <dl className="grid grid-cols-2 gap-4">
              <Campo rotulo="Doca atribuída">{i.fila.docaAtribuida}</Campo>
              <Campo rotulo="Doca ocupada">{i.fila.docaOcupada}</Campo>
            </dl>
          )}

          {tipos.length > 0 && (
            <section aria-label="Composição da carga">
              <h3 className="text-xs uppercase tracking-wide text-muted mb-2">Composição da carga · {formatNumero(comp.total)} TOs</h3>
              <ul className="space-y-2">
                {tipos.map((t) => {
                  const q = comp.porTipo[t];
                  const pct = comp.total ? Math.round((q / comp.total) * 100) : 0;
                  return (
                    <li key={t} className="flex items-center gap-3 text-xs">
                      <span className="w-20 shrink-0 text-muted">{t}</span>
                      <div className="flex-1 h-1.5 rounded bg-surface-2 overflow-hidden">
                        <div className="h-full rounded bg-[#FA4C00]" style={{ width: `${Math.max(3, pct)}%` }} />
                      </div>
                      <span className="w-20 text-right tabular-nums font-semibold">{formatNumero(q)} · {pct}%</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-label="Operação na origem">
            <h3 className="text-xs uppercase tracking-wide text-muted mb-2">Operação na origem</h3>
            <ol className="space-y-2">
              {passos.map((p) => (
                <li key={p.rotulo} className="flex items-center gap-2.5 text-sm">
                  {p.sec ? <CircleCheck size={15} className="text-[#22C55E] shrink-0" aria-hidden="true" /> : <Circle size={15} className="text-muted shrink-0" aria-hidden="true" />}
                  <span className={p.sec ? "" : "text-muted"}>{p.rotulo}</span>
                  <span className="ml-auto tabular-nums text-muted">{fmtHora(p.sec)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </aside>
    </div>
  );
}

export default function FilaRecebimento() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [offline, setOffline] = useState(false);
  const [filtro, setFiltro] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState({ chave: "chegada", asc: false });
  const [selecionado, setSelecionado] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [proximaEm, setProximaEm] = useState(() => Date.now() + POLL_MS);

  const carregar = useCallback(async () => {
    try {
      const r = await FilaRecebimentoAPI.listar();
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
  }, []);

  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  // Os tempos de espera andam a cada segundo; a busca no servidor é a cada 15s (e some quando a aba está escondida).
  useEffect(() => {
    const t = setInterval(() => {
      setAgora(Date.now());
      if (!document.hidden && Date.now() >= proximaEm) carregar();
    }, 1000);
    return () => clearInterval(t);
  }, [proximaEm, carregar]);

  const atualizarAgora = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  const itens = useMemo(() => dados?.itens || [], [dados]);

  const contagem = useMemo(
    () => ({
      TODOS: itens.length,
      TRANSITO: itens.filter((i) => i.statusLh === LH_TRANSITO).length,
      DESCARREGANDO: itens.filter((i) => i.statusLh === LH_DESCARREGANDO).length,
    }),
    [itens]
  );

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrados = itens.filter((i) => {
      if (filtro === "TRANSITO" && i.statusLh !== LH_TRANSITO) return false;
      if (filtro === "DESCARREGANDO" && i.statusLh !== LH_DESCARREGANDO) return false;
      if (!q) return true;
      return [i.motorista, i.placa, i.agencia, i.tripNumber, i.origem].some((v) => (v || "").toLowerCase().includes(q));
    });
    return ordenar(filtrados, ordem.chave, ordem.asc);
  }, [itens, filtro, busca, ordem]);

  const kpis = useMemo(() => {
    const pendentes = itens.filter((i) => i.fila?.status === 1).length;
    const emEspera = itens.filter((i) => i.fila?.status === 5).length;
    const pacotes = itens.reduce((s, i) => s + (i.fila?.pacotes || 0), 0);
    const maior = itens.reduce((melhor, i) => (i.chegouSec && (!melhor || i.chegouSec < melhor.chegouSec) ? i : melhor), null);
    return { pendentes, emEspera, pacotes, maior };
  }, [itens]);

  /* ---------- sincronização (ONLINE / DESATUALIZADO / OFFLINE) ---------- */
  // A tela depende de duas fotos (fila do pátio e viagens): vale a mais antiga das duas.
  const tFila = dados?.sincronizacao?.fila?.ultimoFetchedAt ?? null;
  const tViagens = dados?.sincronizacao?.viagens?.ultimoFetchedAt ?? null;
  const ultimoSync = tFila != null && tViagens != null ? Math.min(tFila, tViagens) : null;
  let estadoSync = "conectando";
  let detalheSync = "aguardando a primeira sincronização";
  if (dados) {
    if (offline) {
      estadoSync = "offline";
      detalheSync = "falha ao conectar no servidor";
    } else if (ultimoSync == null) {
      estadoSync = "atrasado";
      detalheSync = tFila == null && tViagens == null ? "o Tampermonkey ainda não enviou dados" : tFila == null ? "falta a sincronização da fila" : "falta a sincronização das viagens";
    } else {
      const atrasoMs = agora - ultimoSync;
      const hhmm = new Date(ultimoSync).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO });
      estadoSync = atrasoMs < ATRASO_MS ? "online" : "atrasado";
      const min = Math.floor(atrasoMs / 60000);
      detalheSync = `atualizado às ${hhmm}${min > 0 ? ` (há ${min} min)` : ""}`;
    }
  }
  const proxima = Math.max(0, Math.round((proximaEm - agora) / 1000));

  const filtrosAtivos = filtro !== "TODOS" || !!busca;
  const limpar = () => {
    setFiltro("TODOS");
    setBusca("");
  };
  const alternarOrdem = (chave) => setOrdem((o) => (o.chave === chave ? { chave, asc: !o.asc } : { chave, asc: false }));

  const minMaior = kpis.maior ? minDesdeChegada(kpis.maior, agora) : null;

  return (
    <div className="flex min-h-screen bg-page text-page overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-4 sm:p-6 xl:p-10 2xl:px-20 space-y-5 max-w-[1800px] mx-auto">
          <PageHeader
            kicker="Operação · Recebimento"
            titulo="Fila de veículos"
            subtitulo={dados ? `Queue List inbound · docas e tempos de espera · ${dados.estacao.nome.replace(/_/g, " ")}` : "Queue List inbound · docas e tempos de espera"}
            atualizadoEm={atualizadoEm}
            atualizando={atualizando}
            onAtualizar={atualizarAgora}
          />

          {erro || (!dados && offline) ? (
            <Aviso tipo="erro">{erro || "Não foi possível carregar a fila."}</Aviso>
          ) : !dados ? (
            <div aria-busy="true" aria-label="Carregando a fila" className="space-y-4">
              <Esqueleto className="h-24" />
              <Esqueleto className="h-16" />
              <Esqueleto className="h-64" />
            </div>
          ) : (
            <>
              <StatusSincronizacao estado={estadoSync} detalhe={detalheSync} proxima={proxima} />

              {estadoSync === "offline" && <Aviso tipo="alerta">Sem conexão com o servidor — os dados exibidos podem estar desatualizados.</Aviso>}
              {estadoSync === "atrasado" && <Aviso tipo="alerta">Dados desatualizados — o Tampermonkey pode estar offline ou sem sincronizar.</Aviso>}

              <FaixaIndicadores
                rotulo="Indicadores da fila"
                itens={[
                  { rotulo: "Viagens ativas", valor: formatNumero(itens.length), destaque: true, apoio: `${formatNumero(kpis.pacotes)} pacotes pendentes` },
                  { rotulo: "Em trânsito", valor: formatNumero(contagem.TRANSITO), cor: "#F59E0B", apoio: "a caminho" },
                  { rotulo: "Descarregando", valor: formatNumero(contagem.DESCARREGANDO), cor: "#22C55E", apoio: "na doca" },
                  { rotulo: "Pendentes na fila", valor: formatNumero(kpis.pendentes), cor: "#8B5CF6", apoio: "aguardando doca" },
                  { rotulo: "Em espera", valor: formatNumero(kpis.emEspera), cor: kpis.emEspera > 0 ? "#FA4C00" : undefined, apoio: "on-hold" },
                  {
                    rotulo: "Maior espera",
                    valor: minMaior != null ? fmtDuracao(minMaior) : "—",
                    cor: minMaior != null ? corEspera(minMaior) : undefined,
                    apoio: kpis.maior ? (kpis.maior.motorista || "").split(" ").slice(0, 2).join(" ") || kpis.maior.tripNumber : "sem veículo aguardando",
                  },
                ]}
              />

              <section aria-label="Filtros" className="bg-surface rounded-2xl border border-default p-4 flex items-end gap-3 flex-wrap">
                <div className="w-full lg:w-[28rem]">
                  <span className="block text-xs text-muted mb-1.5">Status da viagem</span>
                  <AbasSegmentadas
                    rotulo="Status da viagem"
                    valor={filtro}
                    onChange={setFiltro}
                    opcoes={[
                      { valor: "TODOS", rotulo: `Todos (${contagem.TODOS})` },
                      { valor: "TRANSITO", rotulo: `Em trânsito (${contagem.TRANSITO})` },
                      { valor: "DESCARREGANDO", rotulo: `Descarregando (${contagem.DESCARREGANDO})` },
                    ]}
                  />
                </div>
                <div className="flex-1 min-w-[220px] max-w-sm">
                  <label htmlFor="fila-busca" className="block text-xs text-muted mb-1.5">Buscar</label>
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
                    <input id="fila-busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Motorista, placa, agência, LH, origem…" className={`${INPUT} pl-10`} />
                  </div>
                </div>
                <button type="button" onClick={limpar} disabled={!filtrosAtivos} className={`${BTN_SECUNDARIO} disabled:opacity-50`}>
                  Limpar filtros
                </button>
                <p className="ml-auto text-sm text-muted tabular-nums" aria-live="polite">
                  <b className="text-page">{visiveis.length}</b> {visiveis.length === 1 ? "veículo" : "veículos"} de {itens.length}
                </p>
              </section>

              <section aria-label="Veículos" className="bg-surface rounded-2xl border border-default overflow-hidden">
                {itens.length === 0 ? (
                  <EstadoVazio
                    icone={ultimoSync == null ? <Inbox size={28} aria-hidden="true" /> : <CircleCheck size={28} className="text-[#22C55E]" aria-hidden="true" />}
                    titulo={ultimoSync == null ? "Aguardando sincronização" : "Nenhum veículo na fila agora"}
                    descricao={
                      ultimoSync == null
                        ? "O Tampermonkey ainda não enviou a fila e as viagens desta estação."
                        : "A sincronização está ativa e não há viagem em trânsito, descarregando ou na fila."
                    }
                  />
                ) : visiveis.length === 0 ? (
                  <EstadoVazio
                    icone={<Search size={28} aria-hidden="true" />}
                    titulo="Nenhum veículo para os filtros selecionados"
                    acao={<button type="button" onClick={limpar} className={`${BTN_SECUNDARIO} h-10 mt-2`}>Limpar filtros</button>}
                  />
                ) : (
                  <div className="overflow-auto max-h-[680px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-surface-2">
                        <tr className="text-xs text-muted uppercase tracking-wide">
                          {COLUNAS.map((c) => {
                            const ativa = ordem.chave === c.chave;
                            return (
                              <th key={c.chave} scope="col" aria-sort={ativa ? (ordem.asc ? "ascending" : "descending") : "none"} className={`font-medium px-4 py-3 whitespace-nowrap ${c.direita ? "text-right" : "text-left"}`}>
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
                        {visiveis.map((i) => {
                          const min = minDesdeChegada(i, agora);
                          return (
                            <tr
                              key={i.tripNumber}
                              tabIndex={0}
                              onClick={() => setSelecionado(i.tripNumber)}
                              onKeyDown={(e) => e.key === "Enter" && setSelecionado(i.tripNumber)}
                              className={`cursor-pointer hover:bg-surface-2 transition-colors ${FOCO}`}
                            >
                              <td className="px-4 py-3 whitespace-nowrap font-medium tabular-nums">{i.placa || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted">{i.tipoVeiculo || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap font-medium tabular-nums text-[#FA4C00]">{i.tripNumber}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted">{i.origem || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap tabular-nums">{fmtHora(i.etaSec)}</td>
                              <td className="px-4 py-3 whitespace-nowrap tabular-nums font-semibold" style={min != null ? { color: corEspera(min) } : undefined}>
                                {min != null ? fmtDuracao(min) : <span className="text-muted font-normal">—</span>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap tabular-nums font-semibold" style={i.fila?.esperaMin ? { color: corEspera(i.fila.esperaMin) } : undefined}>
                                {i.fila?.esperaMin ? fmtDuracao(i.fila.esperaMin) : <span className="text-muted font-normal">—</span>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted">{fmtHora(i.fila?.emEsperaDesdeSec)}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-right font-semibold tabular-nums">{formatNumero(i.fila?.pacotes || 0)}</td>
                              <td className="px-4 py-3 whitespace-nowrap font-medium">{i.motorista || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap font-medium text-[#8B5CF6]">{i.fila?.docaAtribuida || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap font-medium text-[#22C55E]">{i.fila?.docaOcupada || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap"><PilulaLh status={i.statusLh} /></td>
                              <td className="px-4 py-3 whitespace-nowrap"><PilulaFila status={i.fila?.status} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </MainLayout>

      {selecionado && itens.find((i) => i.tripNumber === selecionado) && (
        <Detalhe i={itens.find((i) => i.tripNumber === selecionado)} agora={agora} onClose={() => setSelecionado(null)} />
      )}
    </div>
  );
}
