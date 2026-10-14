import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, Inbox, Search, X } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MainLayout from "../../components/MainLayout";
import {
  AbasSegmentadas,
  Aviso,
  DiaNavegador,
  EstadoVazio,
  Esqueleto,
  FaixaIndicadores,
  PageHeader,
} from "../../components/mapaOperacional/ui";
import { BTN_SECUNDARIO, FOCO, INPUT, formatNumero } from "../../components/mapaOperacional/uiTokens";
import { TransbordoAPI } from "../../services/transbordo";

const POLL_MS = 15000;
const ATRASO_MS = 5 * 60 * 1000; // sem sincronizar há mais que isso = dados desatualizados
const TURNOS = ["T1", "T2", "T3"];
// O dia operacional começa às 06:00 — o gráfico segue essa ordem (T3 da madrugada fecha o dia à direita).
const HORAS_DO_DIA = [...Array.from({ length: 18 }, (_, i) => i + 6), ...Array.from({ length: 6 }, (_, i) => i)];

const fmtKg = (gramas) => ((gramas || 0) / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtHora = (t) => (t.hora == null ? "—" : `${String(t.hora).padStart(2, "0")}:${String(t.minuto).padStart(2, "0")}`);
const fmtDataBR = (iso) => iso.split("-").reverse().join("/");
const temExcecao = (t) => Array.isArray(t.abnormalLabels) && t.abnormalLabels.length > 0;

const COLUNAS = [
  { chave: "toNumber", rotulo: "TO", tipo: "texto" },
  { chave: "packTypeName", rotulo: "Tipo", tipo: "texto" },
  { chave: "parcels", rotulo: "Pacotes", tipo: "numero", direita: true },
  { chave: "weightG", rotulo: "Peso", tipo: "numero", direita: true },
  { chave: "loadedStationName", rotulo: "Estação remetente", tipo: "texto" },
  { chave: "scanEm", rotulo: "Hora do scan", tipo: "texto" },
  { chave: "dockNumber", rotulo: "Doca", tipo: "texto" },
  { chave: "operator", rotulo: "Operador", tipo: "texto" },
  { chave: "tripNumber", rotulo: "LH", tipo: "texto" },
  { chave: "excecao", rotulo: "Status", tipo: "excecao" },
];

function ordenar(lista, chave, asc) {
  const col = COLUNAS.find((c) => c.chave === chave);
  const valor = (t) => {
    if (col.tipo === "excecao") return temExcecao(t) ? 1 : 0;
    if (col.tipo === "numero") return t[chave] ?? 0;
    return String(t[chave] ?? "").toLowerCase();
  };
  return [...lista].sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    const r = typeof va === "number" ? va - vb : va.localeCompare(vb);
    return asc ? r : -r;
  });
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

function Detalhe({ t, onClose }) {
  useEffect(() => {
    const aoTeclar = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes da TO ${t.toNumber}`}
        className="h-full w-full max-w-sm bg-surface border-l border-default shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 h-16 border-b border-default shrink-0">
          <h2 className="font-semibold tabular-nums truncate">{t.toNumber}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar detalhe" className={`ml-auto h-10 w-10 grid place-items-center rounded-lg text-muted hover:text-page hover:bg-surface-2 cursor-pointer ${FOCO}`}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <dl className="p-5 space-y-4 overflow-y-auto">
          {temExcecao(t) && (
            <div role="alert" className="flex gap-2 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 px-3 py-2.5 text-sm text-[#FF453A]">
              <CircleAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
              <span>{t.abnormalLabels.join(", ")}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Campo rotulo="Pacotes" mono>{formatNumero(t.parcels)}</Campo>
            <Campo rotulo="Peso" mono>{`${fmtKg(t.weightG)} kg`}</Campo>
            <Campo rotulo="Tipo">{t.packTypeName}</Campo>
            <Campo rotulo="Hora do scan" mono>{fmtHora(t)}</Campo>
          </div>
          <Campo rotulo="Estação remetente">{t.loadedStationName}</Campo>
          <Campo rotulo="Estação destino">{t.unloadedStationName}</Campo>
          <Campo rotulo="Doca">{t.dockNumber}</Campo>
          <Campo rotulo="Operador">{t.operator}</Campo>
          <div className="grid grid-cols-2 gap-4">
            <Campo rotulo="Viagem (LH)" mono>{t.tripNumber}</Campo>
            <Campo rotulo="Placa" mono>{t.vehicleNumber}</Campo>
          </div>
          <Campo rotulo="Motorista">{t.driverName}</Campo>
        </dl>
      </aside>
    </div>
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
  const [ordem, setOrdem] = useState({ chave: "scanEm", asc: false });
  const [selecionada, setSelecionada] = useState(null);
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
      else if (!dados) setErro("Não foi possível carregar o transbordo.");
    } finally {
      setProximaEm(Date.now() + POLL_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        return [t.toNumber, t.loadedStationName, t.operator, t.tripNumber, t.dockNumber].some((v) => (v || "").toLowerCase().includes(q));
      });
    },
    [origem, turno, busca]
  );

  const visiveis = useMemo(() => filtrar(lista), [filtrar, lista]);
  const tabela = useMemo(() => ordenar(visiveis, ordem.chave, ordem.asc), [visiveis, ordem]);

  const kpis = useMemo(() => {
    const pacotes = visiveis.reduce((s, t) => s + (t.parcels || 0), 0);
    const peso = visiveis.reduce((s, t) => s + (t.weightG || 0), 0);
    const origensAtivas = new Set(visiveis.map((t) => t.loadedStationName).filter(Boolean));
    return { pacotes, peso, origensAtivas, excecoes: visiveis.filter(temExcecao).length };
  }, [visiveis]);

  const porHora = useMemo(() => {
    const m = new Array(24).fill(0);
    visiveis.forEach((t) => {
      if (t.hora != null) m[t.hora] += t.parcels || 0;
    });
    return m;
  }, [visiveis]);
  const maxHora = Math.max(1, ...porHora);

  const topOrigens = useMemo(() => {
    const c = {};
    visiveis.forEach((t) => {
      const o = t.loadedStationName || "(sem origem)";
      c[o] = (c[o] || 0) + 1;
    });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [visiveis]);

  const resumoTurnos = useMemo(() => {
    const agg = Object.fromEntries(TURNOS.map((t) => [t, { tos: 0, pacotes: 0 }]));
    filtrar(lista, { ignorarTurno: true }).forEach((t) => {
      if (!t.turno) return;
      agg[t.turno].tos += 1;
      agg[t.turno].pacotes += t.parcels || 0;
    });
    return agg;
  }, [filtrar, lista]);

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
      const hhmm = new Date(ultimoSync).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
  };

  const anterior = dados?.contagemDiaAnterior || 0;
  const tendencia = anterior > 0 ? Math.round(((visiveis.length - anterior) / anterior) * 100) : null;

  const alternarOrdem = (chave) => setOrdem((o) => (o.chave === chave ? { chave, asc: !o.asc } : { chave, asc: false }));

  return (
    <div className="flex min-h-screen bg-page text-page overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-4 sm:p-6 xl:p-10 2xl:px-20 space-y-5 max-w-[1800px] mx-auto">
          <PageHeader
            kicker="Operação · Recebimento"
            titulo="Transbordo"
            subtitulo={dados ? `TOs com tag CD escaneadas · ${dados.estacao.nome.replace(/_/g, " ")}` : "TOs com tag CD escaneadas"}
            atualizadoEm={atualizadoEm}
            atualizando={atualizando}
            onAtualizar={atualizarAgora}
          />

          {erro ? (
            <Aviso tipo="erro">{erro}</Aviso>
          ) : !dados ? (
            <div aria-busy="true" aria-label="Carregando transbordo" className="space-y-4">
              <Esqueleto className="h-24" />
              <Esqueleto className="h-16" />
              <Esqueleto className="h-64" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <StatusSincronizacao estado={estadoSync} detalhe={detalheSync} proxima={proxima} />
                <DiaNavegador data={diaSel} maximo={diaAtual} onChange={(d) => setDia(d === diaAtual ? null : d)} />
              </div>

              {estadoSync === "offline" && <Aviso tipo="alerta">Sem conexão com o servidor — os dados exibidos podem estar desatualizados.</Aviso>}
              {estadoSync === "atrasado" && ehHoje && <Aviso tipo="alerta">Dados desatualizados — o Tampermonkey pode estar offline ou sem sincronizar.</Aviso>}

              <FaixaIndicadores
                rotulo="Indicadores do transbordo"
                itens={[
                  {
                    rotulo: "TOs de transbordo",
                    valor: formatNumero(visiveis.length),
                    destaque: true,
                    apoio: tendencia === null ? undefined : `${tendencia >= 0 ? "▲" : "▼"} ${Math.abs(tendencia)}% vs dia anterior (${formatNumero(anterior)})`,
                  },
                  { rotulo: "Pacotes", valor: formatNumero(kpis.pacotes), apoio: "soma dos pacotes por TO" },
                  { rotulo: "Peso", valor: `${fmtKg(kpis.peso)} kg`, apoio: "total escaneado no dia" },
                  {
                    rotulo: "Origens ativas",
                    valor: formatNumero(kpis.origensAtivas.size),
                    apoio: kpis.origensAtivas.size ? [...kpis.origensAtivas].slice(0, 2).join(", ") + (kpis.origensAtivas.size > 2 ? ` +${kpis.origensAtivas.size - 2}` : "") : "nenhuma estação com TO no dia",
                  },
                  {
                    rotulo: "Exceções",
                    valor: formatNumero(kpis.excecoes),
                    cor: kpis.excecoes > 0 ? "#FF453A" : "#22C55E",
                    apoio: kpis.excecoes > 0 ? "requer verificação" : "nenhuma pendência",
                  },
                ]}
              />

              <section aria-label="Filtros" className="bg-surface rounded-2xl border border-default p-4 flex items-end gap-3 flex-wrap">
                <div className="min-w-[200px]">
                  <label htmlFor="tb-origem" className="block text-xs text-muted mb-1.5">Origem</label>
                  <select id="tb-origem" value={origem} onChange={(e) => setOrigem(e.target.value)} className={`${INPUT} min-w-[200px] cursor-pointer`}>
                    <option value="">Todas</option>
                    {origens.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[220px] max-w-sm">
                  <label htmlFor="tb-busca" className="block text-xs text-muted mb-1.5">Buscar</label>
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
                    <input id="tb-busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="TO, doca, operador, LH…" className={`${INPUT} pl-10`} />
                  </div>
                </div>
                <div className="w-full sm:w-64">
                  <span className="block text-xs text-muted mb-1.5">Turno</span>
                  <AbasSegmentadas rotulo="Turno" valor={turno} onChange={setTurno} opcoes={[{ valor: "TODOS", rotulo: "Todos" }, ...TURNOS.map((t) => ({ valor: t, rotulo: t }))]} />
                </div>
                <button type="button" onClick={limpar} disabled={!filtrosAtivos} className={`${BTN_SECUNDARIO} disabled:opacity-50`}>
                  Limpar filtros
                </button>
                <p className="ml-auto text-sm text-muted tabular-nums" aria-live="polite">
                  <b className="text-page">{visiveis.length}</b> {visiveis.length === 1 ? "TO" : "TOs"} de {lista.length} no dia
                </p>
              </section>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <section aria-label="Pacotes por hora" className="xl:col-span-2 bg-surface rounded-2xl border border-default p-5">
                  <h2 className="text-sm font-semibold mb-1">Pacotes por hora</h2>
                  <p className="text-xs text-muted mb-4">{fmtDataBR(diaSel || diaAtual)} · {visiveis.length} {visiveis.length === 1 ? "TO" : "TOs"} · dia operacional (06:00 às 05:59)</p>
                  <div className="overflow-x-auto">
                    <div className="flex items-end gap-1 h-44 min-w-[640px]" role="img" aria-label="Gráfico de pacotes escaneados por hora">
                      {HORAS_DO_DIA.map((h) => {
                        const v = porHora[h];
                        const alt = v > 0 ? Math.max(4, Math.round((v / maxHora) * 120)) : 0;
                        return (
                          <div key={h} className="flex-1 min-w-[24px] flex flex-col items-center justify-end gap-1 h-full">
                            <span className="text-[10px] tabular-nums text-muted h-4">{v > 0 ? formatNumero(v) : ""}</span>
                            {alt > 0 ? (
                              <div className="w-full rounded-t bg-[#FA4C00] opacity-85 hover:opacity-100 transition-opacity" style={{ height: alt }} title={`${formatNumero(v)} pacotes às ${String(h).padStart(2, "0")}:00`} />
                            ) : (
                              <div className="w-full h-0.5 rounded bg-[var(--color-border)]" />
                            )}
                            <span className="text-[10px] tabular-nums text-muted">{String(h).padStart(2, "0")}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <section aria-label="Top origens" className="bg-surface rounded-2xl border border-default p-5">
                  <h2 className="text-sm font-semibold mb-4">Top origens</h2>
                  {topOrigens.length === 0 ? (
                    <p className="text-sm text-muted text-center py-8">Nenhuma TO no período selecionado</p>
                  ) : (
                    <ul className="space-y-3 max-h-56 overflow-y-auto">
                      {topOrigens.map(([nome, qtd]) => (
                        <li key={nome} className="flex items-center gap-3" title={nome}>
                          <span className="w-2/5 shrink-0 truncate text-xs text-muted">{nome}</span>
                          <div className="flex-1 h-1.5 rounded bg-surface-2 overflow-hidden">
                            <div className="h-full rounded bg-[#FA4C00]" style={{ width: `${Math.max(4, Math.round((qtd / topOrigens[0][1]) * 100))}%` }} />
                          </div>
                          <span className="w-10 text-right text-xs font-semibold tabular-nums">{formatNumero(qtd)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <section aria-label="Comparação por turno" className="bg-surface rounded-2xl border border-default overflow-hidden">
                <div className="px-5 py-4 border-b border-default">
                  <h2 className="text-sm font-semibold">Comparação por turno <span className="font-normal text-muted">— clique numa linha para filtrar</span></h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted uppercase tracking-wide">
                      <th scope="col" className="text-left font-medium px-5 py-3">Turno</th>
                      <th scope="col" className="text-right font-medium px-5 py-3">TOs</th>
                      <th scope="col" className="text-right font-medium px-5 py-3">Pacotes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    {TURNOS.map((t) => (
                      <tr
                        key={t}
                        tabIndex={0}
                        aria-pressed={turno === t}
                        onClick={() => setTurno(turno === t ? "TODOS" : t)}
                        onKeyDown={(e) => e.key === "Enter" && setTurno(turno === t ? "TODOS" : t)}
                        className={`cursor-pointer transition-colors ${FOCO} ${turno === t ? "bg-[#FA4C00]/10" : "hover:bg-surface-2"}`}
                      >
                        <td className="px-5 py-3 font-semibold">{t}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{formatNumero(resumoTurnos[t].tos)}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{formatNumero(resumoTurnos[t].pacotes)}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold">
                      <td className="px-5 py-3">Total</td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatNumero(TURNOS.reduce((s, t) => s + resumoTurnos[t].tos, 0))}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatNumero(TURNOS.reduce((s, t) => s + resumoTurnos[t].pacotes, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <section aria-label="TOs de transbordo" className="bg-surface rounded-2xl border border-default overflow-hidden">
                <div className="px-5 py-4 border-b border-default">
                  <h2 className="text-sm font-semibold">TOs de transbordo (CD) <span className="font-normal text-muted">· {fmtDataBR(diaSel || diaAtual)}</span></h2>
                </div>

                {lista.length === 0 ? (
                  <EstadoVazio
                    icone={ultimoSync == null ? <Inbox size={28} aria-hidden="true" /> : <CircleCheck size={28} className="text-[#22C55E]" aria-hidden="true" />}
                    titulo={ultimoSync == null ? "Aguardando sincronização" : "Sem TOs de transbordo neste dia"}
                    descricao={
                      ultimoSync == null
                        ? "O Tampermonkey ainda não enviou dados de transbordo desta estação."
                        : "A sincronização está ativa e nenhuma TO com tag CD foi encontrada neste dia operacional."
                    }
                  />
                ) : tabela.length === 0 ? (
                  <EstadoVazio
                    icone={<Search size={28} aria-hidden="true" />}
                    titulo="Nenhum registro para os filtros selecionados"
                    acao={<button type="button" onClick={limpar} className={`${BTN_SECUNDARIO} h-10 mt-2`}>Limpar filtros</button>}
                  />
                ) : (
                  <div className="overflow-auto max-h-[640px]">
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
                        {tabela.map((t) => {
                          const exc = temExcecao(t);
                          return (
                            <tr
                              key={t.toNumber}
                              tabIndex={0}
                              onClick={() => setSelecionada(t)}
                              onKeyDown={(e) => e.key === "Enter" && setSelecionada(t)}
                              className={`cursor-pointer hover:bg-surface-2 transition-colors ${FOCO} ${exc ? "shadow-[inset_3px_0_0_#FF453A]" : ""}`}
                            >
                              <td className="px-4 py-3 whitespace-nowrap font-medium tabular-nums text-[#FA4C00]">{t.toNumber}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted">{t.packTypeName || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-right font-semibold tabular-nums">{formatNumero(t.parcels)}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums text-muted">{fmtKg(t.weightG)} kg</td>
                              <td className="px-4 py-3 whitespace-nowrap font-medium">{t.loadedStationName || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap font-medium tabular-nums">{fmtHora(t)}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted">{t.dockNumber || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{t.operator || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted">{t.tripNumber || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {exc ? (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-[#FF453A]/35 bg-[#FF453A]/10 px-2 py-0.5 text-xs font-semibold text-[#FF453A]">
                                    <CircleAlert size={12} aria-hidden="true" /> Exceção
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-[#22C55E]/30 bg-[#22C55E]/10 px-2 py-0.5 text-xs font-semibold text-[#22C55E]">
                                    <CircleCheck size={12} aria-hidden="true" /> OK
                                  </span>
                                )}
                              </td>
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

      {selecionada && <Detalhe t={selecionada} onClose={() => setSelecionada(null)} />}
    </div>
  );
}
