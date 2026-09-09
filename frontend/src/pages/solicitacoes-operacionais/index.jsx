import { useEffect, useState, useContext, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import MainLayout from "../../components/MainLayout";
import {
  Plus, FileText, CheckCircle, Clock, XCircle, CalendarDays, Settings,
  Search, ChevronLeft, ChevronRight, Filter, CheckSquare, X, AlertTriangle,
  Check, Minus,
} from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";

import api from "../../services/api";
import { SolicitacoesOperacionaisAPI } from "../../services/solicitacoesOperacionais";
import { AuthContext } from "../../context/AuthContext";
import { StatusOperacionalBadge, TipoBadge, TIPO_LABEL, formatDateOnly } from "./shared";
import { AprovadoresOperacionaisModal } from "../../components/solicitacoesOperacionais/AprovadoresOperacionaisModal";

const LIMIT = 20;
const STATUS_APROVAVEIS = ["PENDENTE", "AGUARDANDO_SEGUNDA_APROVACAO"];
const TIPOS_APROVACAO_LOTE = ["FOLGA", "SINERGIA", "BANCO_HORAS", "INTERNALIZACAO"];

/* ─── CHECKBOX (custom, com estado indeterminado) ──── */
function Checkbox({ checked, indeterminate = false, onChange, disabled, title, size = 18 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !checked && indeterminate;
  }, [checked, indeterminate]);

  const marcado = checked || indeterminate;

  return (
    <label
      title={title}
      className={`inline-flex items-center justify-center ${disabled ? "cursor-not-allowed opacity-30" : "cursor-pointer"}`}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="peer sr-only"
      />
      <span
        style={{ width: size, height: size }}
        className={`flex items-center justify-center rounded-md border-2 transition-all duration-150 ease-out
          peer-focus-visible:ring-2 peer-focus-visible:ring-[#FA4C00]/40 peer-focus-visible:ring-offset-1
          ${marcado
            ? "bg-[#FA4C00] border-[#FA4C00] scale-100"
            : "bg-surface-2 border-default-2 hover:border-[#FA4C00]/60 hover:bg-[#FA4C00]/5"}`}
      >
        {checked && <Check size={size - 6} strokeWidth={3.5} className="text-white" />}
        {!checked && indeterminate && <Minus size={size - 6} strokeWidth={3.5} className="text-white" />}
      </span>
    </label>
  );
}

/* ─── PAGINATION ───────────────────────────────────── */
function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const delta = 2;
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) pages.push(i);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-default">
      <span className="text-xs text-muted">Página {page} de {totalPages}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 1} className="p-1.5 rounded-lg text-muted hover:text-page hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft size={16} />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${p === page ? "bg-[#FA4C00] text-white" : "text-muted hover:text-page hover:bg-surface-2"}`}
          >
            {p}
          </button>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages} className="p-1.5 rounded-lg text-muted hover:text-page hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ─── MODAL: RESUMO DA APROVAÇÃO EM LOTE ───────────── */
function ResumoAprovacaoModal({ open, onClose, onContinuar, ids, detalhesPorId, truncado }) {
  if (!open) return null;

  const porTipo = {};
  const porSolicitante = {};
  for (const id of ids) {
    const d = detalhesPorId[id];
    if (!d) continue;
    porTipo[d.tipo] = (porTipo[d.tipo] || 0) + 1;
    porSolicitante[d.solicitanteNome] = (porSolicitante[d.solicitanteNome] || 0) + 1;
  }
  const solicitantesOrdenados = Object.entries(porSolicitante).sort((a, b) => b[1] - a[1]);
  const MOSTRAR_MAX = 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-default rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-default">
          <div className="flex items-center gap-2">
            <CheckSquare size={18} className="text-[#FA4C00]" />
            <h2 className="text-base font-semibold">Confirmar aprovação em lote</h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-page transition-colors"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-page">
            Você está prestes a aprovar <strong>{ids.length}</strong> solicitaç{ids.length !== 1 ? "ões" : "ão"}.
          </p>

          {truncado && (
            <div className="flex items-start gap-2 bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 rounded-xl px-3 py-2.5 text-xs text-[#FF9F0A]">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Há mais resultados do que o limite de seleção em lote (200). Apenas os primeiros 200 foram selecionados.
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Por tipo</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(porTipo).map(([tipo, qtd]) => (
                <span key={tipo} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#0A84FF]/10 text-[#0A84FF] border border-[#0A84FF]/20">
                  {TIPO_LABEL[tipo] || tipo}: {qtd}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Solicitantes</p>
            <ul className="text-sm text-page space-y-1">
              {solicitantesOrdenados.slice(0, MOSTRAR_MAX).map(([nome, qtd]) => (
                <li key={nome} className="flex items-center justify-between text-xs">
                  <span className="line-clamp-1">{nome}</span>
                  <span className="text-muted">{qtd}</span>
                </li>
              ))}
            </ul>
            {solicitantesOrdenados.length > MOSTRAR_MAX && (
              <p className="text-xs text-muted mt-1">+{solicitantesOrdenados.length - MOSTRAR_MAX} outro(s)</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-default">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-muted hover:text-page hover:bg-surface-2 transition-colors">
            Cancelar
          </button>
          <button onClick={onContinuar} className="px-4 py-2 rounded-xl text-sm font-medium bg-[#FA4C00] hover:bg-[#D84300] text-white transition-colors">
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── MODAL: CONFIRMAÇÃO FINAL + PROGRESSO ─────────── */
function ConfirmacaoFinalModal({ open, onClose, onConfirmar, total, processando, progresso }) {
  if (!open) return null;
  const atual = progresso?.atual ?? 0;
  const alvo = progresso?.total || total;
  const pct = alvo > 0 ? Math.min(100, Math.round((atual / alvo) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-default rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-default">
          <AlertTriangle size={18} className="text-[#FF9F0A]" />
          <h2 className="text-base font-semibold">{processando ? "Aprovando solicitações…" : "Tem certeza?"}</h2>
        </div>

        <div className="px-5 py-4">
          {processando ? (
            <div className="space-y-3">
              <p className="text-sm text-page">
                Aprovando <strong>{atual}</strong> de <strong>{alvo}</strong> solicitaç{alvo !== 1 ? "ões" : "ão"}…
              </p>
              <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-[#FA4C00] transition-all duration-300 ease-out" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted">Cada aprovação envia e-mail e notificação — pode levar alguns segundos por item.</p>
            </div>
          ) : (
            <p className="text-sm text-page">
              Esta ação vai aprovar <strong>{total}</strong> solicitaç{total !== 1 ? "ões" : "ão"} de uma vez e não pode ser desfeita. Deseja continuar?
            </p>
          )}
        </div>

        {!processando && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-default">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-muted hover:text-page hover:bg-surface-2 transition-colors">
              Voltar
            </button>
            <button onClick={onConfirmar} className="px-4 py-2 rounded-xl text-sm font-medium bg-[#FF9F0A] hover:bg-[#E08E00] text-white transition-colors">
              Sim, aprovar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* =====================================================
   PAGE — SOLICITAÇÕES OPERACIONAIS
===================================================== */
export default function SolicitacoesOperacionaisPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aprovadoresOpen, setAprovadoresOpen] = useState(false);

  const [stats, setStats] = useState({ pendentes: 0, aprovadas: 0, reprovadas: 0, doMes: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  const [solicitacoes, setSolicitacoes] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  /* filtros */
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroTurno, setFiltroTurno] = useState("");
  const [turnos, setTurnos] = useState([]);
  const [filtroSolicitante, setFiltroSolicitante] = useState("");
  const [filtroColaborador, setFiltroColaborador] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  const [solicitanteDebounced, setSolicitanteDebounced] = useState("");
  const solicitanteTimer = useRef(null);
  const [colaboradorDebounced, setColaboradorDebounced] = useState("");
  const colaboradorTimer = useRef(null);

  /* seleção em lote */
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [detalhesPorId, setDetalhesPorId] = useState({});
  const [selecaoTruncada, setSelecaoTruncada] = useState(false);
  const [carregandoSelecaoFiltro, setCarregandoSelecaoFiltro] = useState(false);
  const [resumoAberto, setResumoAberto] = useState(false);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const [aprovandoLote, setAprovandoLote] = useState(false);
  const [progressoLote, setProgressoLote] = useState({ atual: 0, total: 0 });

  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);

  const handleSolicitante = (v) => {
    setFiltroSolicitante(v);
    clearTimeout(solicitanteTimer.current);
    solicitanteTimer.current = setTimeout(() => { setSolicitanteDebounced(v); setPage(1); }, 400);
  };

  const handleColaborador = (v) => {
    setFiltroColaborador(v);
    clearTimeout(colaboradorTimer.current);
    colaboradorTimer.current = setTimeout(() => { setColaboradorDebounced(v); setPage(1); }, 400);
  };

  const hasFilters = filtroStatus || filtroTipo || filtroTurno || filtroSolicitante || filtroColaborador || filtroDataInicio || filtroDataFim;

  const clearFilters = () => {
    setFiltroStatus(""); setFiltroTipo(""); setFiltroTurno("");
    setFiltroSolicitante(""); setSolicitanteDebounced("");
    setFiltroColaborador(""); setColaboradorDebounced("");
    setFiltroDataInicio(""); setFiltroDataFim("");
    setPage(1);
  };

  function carregarStats() {
    setLoadingStats(true);
    SolicitacoesOperacionaisAPI.stats()
      .then(setStats)
      .catch((e) => { if (e.response?.status === 401) { logout(); navigate("/login"); } })
      .finally(() => setLoadingStats(false));
  }

  useEffect(() => { carregarStats(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get("/turnos").then((r) => {
      const p = r.data?.data ?? r.data;
      const lista = Array.isArray(p) ? p : p?.items ?? [];
      // /turnos retorna de todas as estações — deduplica por nome (o filtro usa o nome).
      const nomesUnicos = [...new Set(lista.map((t) => t.nomeTurno).filter(Boolean))].sort();
      setTurnos(nomesUnicos);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await SolicitacoesOperacionaisAPI.listar({
          page,
          limit: LIMIT,
          status: filtroStatus || undefined,
          tipo: filtroTipo || undefined,
          turno: filtroTurno || undefined,
          solicitante: solicitanteDebounced || undefined,
          colaborador: colaboradorDebounced || undefined,
          dataInicio: filtroDataInicio || undefined,
          dataFim: filtroDataFim || undefined,
        });
        if (cancelled) return;
        setSolicitacoes(res.data || []);
        setPagination({
          page: res.pagination?.page ?? 1,
          totalPages: res.pagination?.totalPages ?? 1,
          total: res.pagination?.total ?? 0,
        });
      } catch (e) {
        if (cancelled) return;
        if (e.response?.status === 401) { logout(); navigate("/login"); }
        else setErro("Erro ao carregar solicitações");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [page, filtroStatus, filtroTipo, filtroTurno, solicitanteDebounced, colaboradorDebounced, filtroDataInicio, filtroDataFim, reloadKey, logout, navigate]);

  // Filtros/página mudaram: seleção manual perde o sentido (ids não visíveis mais).
  useEffect(() => {
    limparSelecao();
  }, [filtroStatus, filtroTipo, filtroTurno, solicitanteDebounced, colaboradorDebounced, filtroDataInicio, filtroDataFim]);

  function limparSelecao() {
    setSelecionados(new Set());
    setDetalhesPorId({});
    setSelecaoTruncada(false);
  }

  function isAprovavel(status) {
    return STATUS_APROVAVEIS.includes(status);
  }

  function isSelecionavelEmLote(s) {
    return isAprovavel(s.status) && TIPOS_APROVACAO_LOTE.includes(s.tipo);
  }

  function toggleLinha(s) {
    if (!isSelecionavelEmLote(s)) return;
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(s.idSolicitacao)) next.delete(s.idSolicitacao);
      else next.add(s.idSolicitacao);
      return next;
    });
    setDetalhesPorId((prev) => ({
      ...prev,
      [s.idSolicitacao]: { tipo: s.tipo, solicitanteNome: s.solicitante?.name || "—" },
    }));
    setSelecaoTruncada(false);
  }

  const aprovaveisDaPagina = solicitacoes.filter((s) => isSelecionavelEmLote(s));
  const todosDaPaginaSelecionados =
    aprovaveisDaPagina.length > 0 && aprovaveisDaPagina.every((s) => selecionados.has(s.idSolicitacao));

  function toggleTodosDaPagina() {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (todosDaPaginaSelecionados) {
        aprovaveisDaPagina.forEach((s) => next.delete(s.idSolicitacao));
      } else {
        aprovaveisDaPagina.forEach((s) => next.add(s.idSolicitacao));
      }
      return next;
    });
    setDetalhesPorId((prev) => {
      const next = { ...prev };
      aprovaveisDaPagina.forEach((s) => {
        next[s.idSolicitacao] = { tipo: s.tipo, solicitanteNome: s.solicitante?.name || "—" };
      });
      return next;
    });
    setSelecaoTruncada(false);
  }

  async function selecionarTodosDoFiltro() {
    setCarregandoSelecaoFiltro(true);
    try {
      const res = await SolicitacoesOperacionaisAPI.idsAprovaveis({
        status: filtroStatus || undefined,
        tipo: filtroTipo || undefined,
        turno: filtroTurno || undefined,
        solicitante: solicitanteDebounced || undefined,
        colaborador: colaboradorDebounced || undefined,
        dataInicio: filtroDataInicio || undefined,
        dataFim: filtroDataFim || undefined,
      });
      setSelecionados(new Set(res.ids || []));
      const mapa = {};
      (res.detalhes || []).forEach((d) => { mapa[d.idSolicitacao] = { tipo: d.tipo, solicitanteNome: d.solicitanteNome }; });
      setDetalhesPorId(mapa);
      setSelecaoTruncada(!!res.truncado);
      if (!res.ids?.length) toast("Nenhuma solicitação aprovável encontrada para este filtro", { icon: "ℹ️" });
    } catch (e) {
      if (e.response?.status === 401) { logout(); navigate("/login"); }
      else toast.error("Erro ao buscar solicitações do filtro");
    } finally {
      setCarregandoSelecaoFiltro(false);
    }
  }

  async function confirmarAprovacaoLote() {
    const ids = [...selecionados];
    setAprovandoLote(true);
    setProgressoLote({ atual: 0, total: ids.length });

    let aprovadas = 0;
    const erros = [];

    for (let i = 0; i < ids.length; i++) {
      try {
        await SolicitacoesOperacionaisAPI.aprovar(ids[i]);
        aprovadas++;
      } catch (e) {
        if (e.response?.status === 401) { logout(); navigate("/login"); return; }
        erros.push({ idSolicitacao: ids[i], motivo: e.response?.data?.message || "Erro desconhecido" });
      }
      setProgressoLote({ atual: i + 1, total: ids.length });
    }

    if (erros.length > 0) {
      toast.error(`${aprovadas} aprovada(s), ${erros.length} com erro`, { duration: 6000 });
    } else {
      toast.success(`${aprovadas} solicitação(ões) aprovada(s) com sucesso`);
    }

    setAprovandoLote(false);
    setConfirmacaoAberta(false);
    setResumoAberto(false);
    limparSelecao();
    setReloadKey((k) => k + 1);
    carregarStats();
  }

  if (erro) {
    return <div className="h-screen flex items-center justify-center text-[#FF453A]">{erro}</div>;
  }

  return (
    <div className="flex min-h-screen bg-page text-page">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-6 md:p-8 space-y-6">
          {/* ── HEADER ── */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Solicitações Operacionais</h1>
              <p className="text-sm text-muted mt-0.5">Folga, Banco de Horas, Sinergia e Troca de DSR</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAprovadoresOpen(true)}
                className="flex items-center gap-2 bg-surface-2 hover:bg-surface-3 text-page px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                title="Configurar aprovadores"
              >
                <Settings size={16} />
              </button>
              <button
                onClick={() => navigate("/solicitacoes-operacionais/nova")}
                className="flex items-center gap-2 bg-[#FA4C00] hover:bg-[#D84300] text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                Nova Solicitação
              </button>
            </div>
          </div>

          {/* ── KPI CARDS ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface rounded-2xl p-5 border border-default">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted mb-1">Pendentes</p>
                  <p className="text-2xl font-bold text-[#FF9F0A]">{loadingStats ? "—" : stats.pendentes}</p>
                </div>
                <div className="p-2.5 bg-[#FF9F0A]/10 rounded-xl"><Clock size={22} className="text-[#FF9F0A]" /></div>
              </div>
            </div>
            <div className="bg-surface rounded-2xl p-5 border border-default">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted mb-1">Aprovadas</p>
                  <p className="text-2xl font-bold text-[#34C759]">{loadingStats ? "—" : stats.aprovadas}</p>
                </div>
                <div className="p-2.5 bg-[#34C759]/10 rounded-xl"><CheckCircle size={22} className="text-[#34C759]" /></div>
              </div>
            </div>
            <div className="bg-surface rounded-2xl p-5 border border-default">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted mb-1">Reprovadas</p>
                  <p className="text-2xl font-bold text-[#FF453A]">{loadingStats ? "—" : stats.reprovadas}</p>
                </div>
                <div className="p-2.5 bg-[#FF453A]/10 rounded-xl"><XCircle size={22} className="text-[#FF453A]" /></div>
              </div>
            </div>
            <div className="bg-surface rounded-2xl p-5 border border-default">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted mb-1">Solicitações do Mês</p>
                  <p className="text-2xl font-bold text-[#0A84FF]">{loadingStats ? "—" : stats.doMes}</p>
                </div>
                <div className="p-2.5 bg-[#0A84FF]/10 rounded-xl"><CalendarDays size={22} className="text-[#0A84FF]" /></div>
              </div>
            </div>
          </div>

          {/* ── FILTROS ── */}
          <div className="bg-surface rounded-2xl border border-default p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={14} className="text-muted" />
              <span className="text-xs font-medium text-muted uppercase tracking-wide">Filtros</span>
              {hasFilters && (
                <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-xs text-muted hover:text-[#FF453A] transition-colors">
                  <XCircle size={13} /> Limpar
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Data início</label>
                <input type="date" value={filtroDataInicio} onChange={(e) => { setFiltroDataInicio(e.target.value); setPage(1); }} className="px-3 py-2 bg-surface-2 border border-default rounded-xl text-sm text-page focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/40 transition-all" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Data fim</label>
                <input type="date" value={filtroDataFim} onChange={(e) => { setFiltroDataFim(e.target.value); setPage(1); }} className="px-3 py-2 bg-surface-2 border border-default rounded-xl text-sm text-page focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/40 transition-all" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Tipo</label>
                <select value={filtroTipo} onChange={(e) => { setFiltroTipo(e.target.value); setPage(1); }} className="px-3 py-2 bg-surface-2 border border-default rounded-xl text-sm text-page focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/40 transition-all appearance-none">
                  <option value="">Todos</option>
                  {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Turno</label>
                <select value={filtroTurno} onChange={(e) => { setFiltroTurno(e.target.value); setPage(1); }} className="px-3 py-2 bg-surface-2 border border-default rounded-xl text-sm text-page focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/40 transition-all appearance-none">
                  <option value="">Todos</option>
                  {turnos.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Status</label>
                <select value={filtroStatus} onChange={(e) => { setFiltroStatus(e.target.value); setPage(1); }} className="px-3 py-2 bg-surface-2 border border-default rounded-xl text-sm text-page focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/40 transition-all appearance-none">
                  <option value="">Todos</option>
                  <option value="PENDENTE">Pendente</option>
                  <option value="AGUARDANDO_SEGUNDA_APROVACAO">Aguardando 2ª Aprovação</option>
                  <option value="APROVADA">Aprovada</option>
                  <option value="REPROVADA">Reprovada</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Solicitante</label>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input type="text" placeholder="Buscar solicitante..." value={filtroSolicitante} onChange={(e) => handleSolicitante(e.target.value)} className="w-full pl-7 pr-3 py-2 bg-surface-2 border border-default rounded-xl text-sm text-page placeholder-muted focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/40 transition-all" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Colaborador</label>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input type="text" placeholder="Buscar colaborador..." value={filtroColaborador} onChange={(e) => handleColaborador(e.target.value)} className="w-full pl-7 pr-3 py-2 bg-surface-2 border border-default rounded-xl text-sm text-page placeholder-muted focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/40 transition-all" />
                </div>
              </div>
            </div>
          </div>

          {/* ── BARRA DE SELEÇÃO / AÇÃO EM LOTE ── */}
          {selecionados.size > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-3 bg-[#FA4C00]/10 border border-[#FA4C00]/25 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-page">
                <CheckSquare size={16} className="text-[#FA4C00]" />
                <strong>{selecionados.size}</strong> selecionada{selecionados.size !== 1 ? "s" : ""}
                <button onClick={limparSelecao} className="text-xs text-muted hover:text-page underline ml-2">Limpar seleção</button>
              </div>
              <button
                onClick={() => setResumoAberto(true)}
                className="flex items-center gap-2 bg-[#FA4C00] hover:bg-[#D84300] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                <CheckCircle size={15} />
                Aprovar selecionadas
              </button>
            </div>
          )}

          {/* ── TABELA ── */}
          <div className="bg-surface rounded-2xl border border-default overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-default gap-3 flex-wrap">
              <span className="text-xs text-muted">
                {loading ? "Carregando…" : `${pagination.total} solicitaç${pagination.total !== 1 ? "ões" : "ão"}`}
              </span>
              <div className="flex items-center gap-3">
                {todosDaPaginaSelecionados && pagination.total > aprovaveisDaPagina.length && (
                  <button
                    onClick={selecionarTodosDoFiltro}
                    disabled={carregandoSelecaoFiltro}
                    className="text-xs text-[#FA4C00] hover:text-[#D84300] underline disabled:opacity-50"
                  >
                    {carregandoSelecaoFiltro ? "Buscando…" : "Selecionar todas as solicitações do filtro"}
                  </button>
                )}
                {loading && (
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <div className="w-3 h-3 rounded-full border-2 border-[#FA4C00] border-t-transparent animate-spin" />
                    Atualizando
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 border-b border-default">
                    <th className="px-4 py-3 text-left w-10">
                      <Checkbox
                        checked={todosDaPaginaSelecionados}
                        indeterminate={!todosDaPaginaSelecionados && aprovaveisDaPagina.some((s) => selecionados.has(s.idSolicitacao))}
                        onChange={toggleTodosDaPagina}
                        disabled={aprovaveisDaPagina.length === 0}
                        title="Selecionar todas as aprováveis desta página"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap">Nº</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Colaborador</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">CPF</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Solicitante</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Setor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Turno</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap">Data Solicitação</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap">Data Decisão</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Responsável</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide">Ações</th>
                  </tr>
                </thead>

                <tbody className={loading ? "opacity-50 pointer-events-none" : ""}>
                  {solicitacoes.length === 0 && !loading && (
                    <tr>
                      <td colSpan={13} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <FileText size={32} className="text-muted opacity-40" />
                          <p className="text-muted text-sm">
                            {hasFilters ? "Nenhum resultado para os filtros aplicados" : "Nenhuma solicitação cadastrada"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {solicitacoes.map((s) => (
                    <tr key={s.idSolicitacao} className={`border-t border-default transition-colors ${selecionados.has(s.idSolicitacao) ? "bg-[#FA4C00]/5" : "hover:bg-surface-2/50"}`}>
                      <td className="px-4 py-3">
                        {TIPOS_APROVACAO_LOTE.includes(s.tipo) && (
                          <Checkbox
                            checked={selecionados.has(s.idSolicitacao)}
                            onChange={() => toggleLinha(s)}
                            disabled={!isAprovavel(s.status)}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">#{s.idSolicitacao}</td>
                      <td className="px-4 py-3"><TipoBadge tipo={s.tipo} /></td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <span className="line-clamp-1 font-medium" title={s.colaborador?.nomeCompleto}>
                          {s.colaborador?.nomeCompleto || "—"}
                        </span>
                        {s.colaborador2?.nomeCompleto && (
                          <span className="block text-xs text-muted line-clamp-1">↔ {s.colaborador2.nomeCompleto}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{s.colaborador?.cpf || "—"}</td>
                      <td className="px-4 py-3 max-w-[140px]">
                        <span className="line-clamp-1 text-xs">{s.solicitante?.name || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">{s.colaborador?.setor?.nomeSetor || "—"}</td>
                      <td className="px-4 py-3 text-muted text-xs">{s.colaborador?.turno?.nomeTurno || "—"}</td>
                      <td className="px-4 py-3"><StatusOperacionalBadge status={s.status} /></td>
                      <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{formatDateOnly(s.dataCriacao)}</td>
                      <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{s.decididoEm ? formatDateOnly(s.decididoEm) : "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted max-w-[140px]">
                        <span className="line-clamp-1">{s.decididoPor?.name || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/solicitacoes-operacionais/${s.idSolicitacao}`}
                          className="inline-flex items-center gap-1.5 text-xs text-[#0A84FF] hover:text-[#409CFF] hover:underline transition-colors"
                        >
                          <FileText size={13} /> Detalhes
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={pagination.page} totalPages={pagination.totalPages} onPage={(p) => setPage(p)} />
          </div>
        </main>
      </MainLayout>

      <AprovadoresOperacionaisModal open={aprovadoresOpen} onClose={() => setAprovadoresOpen(false)} />

      <ResumoAprovacaoModal
        open={resumoAberto}
        onClose={() => setResumoAberto(false)}
        onContinuar={() => { setResumoAberto(false); setConfirmacaoAberta(true); }}
        ids={[...selecionados]}
        detalhesPorId={detalhesPorId}
        truncado={selecaoTruncada}
      />

      <ConfirmacaoFinalModal
        open={confirmacaoAberta}
        onClose={() => setConfirmacaoAberta(false)}
        onConfirmar={confirmarAprovacaoLote}
        total={selecionados.size}
        processando={aprovandoLote}
        progresso={progressoLote}
      />
    </div>
  );
}
