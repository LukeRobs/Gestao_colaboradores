import { useEffect, useState, useContext, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/MainLayout";
import {
  Plus, FileText, CheckCircle, Clock, TrendingUp, XCircle,
  Search, ChevronLeft, ChevronRight, Filter,
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

import { TreinamentosAPI } from "../services/treinamentos";
import { AuthContext } from "../context/AuthContext";

const LIMIT = 20;

/* ─── SKELETON ─────────────────────────────────────── */
function Sk({ h = 16, w = "100%", r = 8 }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: r,
      background: "linear-gradient(90deg,#1f1f1f 25%,#2a2a2a 50%,#1f1f1f 75%)",
      backgroundSize: "600px 100%",
      animation: "shimmer 1.4s infinite linear",
    }} />
  );
}

/* ─── STATUS BADGE ─────────────────────────────────── */
function StatusBadge({ status }) {
  if (status === "FINALIZADO")
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20">
        <CheckCircle size={11} /> Finalizado
      </span>
    );
  if (status === "CANCELADO")
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FF453A]/10 text-[#FF453A] border border-[#FF453A]/20">
        <XCircle size={11} /> Cancelado
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FF9F0A]/10 text-[#FF9F0A] border border-[#FF9F0A]/20">
      <Clock size={11} /> Em aberto
    </span>
  );
}

/* ─── PAGINATION ───────────────────────────────────── */
function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-default">
      <span className="text-xs text-muted">
        Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg text-muted hover:text-page hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        {pages[0] > 1 && (
          <>
            <button onClick={() => onPage(1)} className="w-8 h-8 rounded-lg text-xs text-muted hover:text-page hover:bg-surface-2 transition-colors">1</button>
            {pages[0] > 2 && <span className="text-muted text-xs px-1">…</span>}
          </>
        )}

        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
              p === page
                ? "bg-[#FA4C00] text-white"
                : "text-muted hover:text-page hover:bg-surface-2"
            }`}
          >
            {p}
          </button>
        ))}

        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && <span className="text-muted text-xs px-1">…</span>}
            <button onClick={() => onPage(totalPages)} className="w-8 h-8 rounded-lg text-xs text-muted hover:text-page hover:bg-surface-2 transition-colors">{totalPages}</button>
          </>
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg text-muted hover:text-page hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* =====================================================
   PAGE — TREINAMENTOS
===================================================== */
export default function TreinamentosPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [treinamentos, setTreinamentos] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [stats, setStats] = useState({ total: 0, finalizados: 0, pendentes: 0, cancelados: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [erro, setErro] = useState(null);
  const [page, setPage] = useState(1);

  /* filtros */
  const [filtroTema, setFiltroTema] = useState("");
  const [filtroProcesso, setFiltroProcesso] = useState("");
  const [filtroLider, setFiltroLider] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  /* líderes extraídos dos dados carregados */
  const [lideres, setLideres] = useState([]);
  const lideresRef = useRef(new Map());

  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);

  /* debounce tema/processo */
  const [temaDebounced, setTemaDebounced] = useState("");
  const [processoDebounced, setProcessoDebounced] = useState("");
  const temaTimer = useRef(null);
  const processoTimer = useRef(null);

  const handleTema = (v) => {
    setFiltroTema(v);
    clearTimeout(temaTimer.current);
    temaTimer.current = setTimeout(() => { setTemaDebounced(v); setPage(1); }, 400);
  };
  const handleProcesso = (v) => {
    setFiltroProcesso(v);
    clearTimeout(processoTimer.current);
    processoTimer.current = setTimeout(() => { setProcessoDebounced(v); setPage(1); }, 400);
  };

  const hasFilters = filtroTema || filtroProcesso || filtroLider || filtroDataInicio || filtroDataFim;

  const clearFilters = () => {
    setFiltroTema(""); setTemaDebounced("");
    setFiltroProcesso(""); setProcessoDebounced("");
    setFiltroLider("");
    setFiltroDataInicio(""); setFiltroDataFim("");
    setPage(1);
  };

  /* ── LOAD STATS (once on mount) ── */
  useEffect(() => {
    TreinamentosAPI.stats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, []);

  /* ── LOAD LIST (filters + page) ── */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await TreinamentosAPI.listar({
          page,
          limit: LIMIT,
          tema: temaDebounced || undefined,
          processo: processoDebounced || undefined,
          lider: filtroLider || undefined,
          dataInicio: filtroDataInicio || undefined,
          dataFim: filtroDataFim || undefined,
        });
        if (cancelled) return;
        setTreinamentos(res.data || []);
        setPagination({
          page: res.pagination?.page ?? 1,
          totalPages: res.pagination?.totalPages ?? 1,
          total: res.pagination?.total ?? 0,
        });

        // acumula líderes únicos
        (res.data || []).forEach(t => {
          if (t.liderResponsavelOpsId && t.liderResponsavel?.nomeCompleto) {
            lideresRef.current.set(t.liderResponsavelOpsId, t.liderResponsavel.nomeCompleto);
          }
        });
        setLideres([...lideresRef.current.entries()].map(([opsId, nome]) => ({ opsId, nome })));
      } catch (e) {
        if (cancelled) return;
        if (e.response?.status === 401) { logout(); navigate("/login"); }
        else setErro("Erro ao carregar treinamentos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [page, temaDebounced, processoDebounced, filtroLider, filtroDataInicio, filtroDataFim, logout, navigate]);

  /* ── percentual ── */
  const pct = (n) => stats.total > 0 ? Math.round((n / stats.total) * 100) : 0;

  /* ================= SKELETON ================= */
  if (loading && treinamentos.length === 0) {
    return (
      <div className="flex min-h-screen bg-page text-page">
        <style>{`@keyframes shimmer { from { background-position:-600px 0 } to { background-position:600px 0 } }`}</style>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />
        <MainLayout>
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2"><Sk h={28} w={200} /><Sk h={14} w={260} /></div>
              <Sk h={38} w={160} r={12} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[0,1,2,3].map(i => (
                <div key={i} className="bg-surface rounded-2xl p-5 border border-default space-y-3">
                  <div className="flex items-center justify-between"><div className="space-y-2"><Sk h={11} w={80} /><Sk h={26} w={50} /></div><Sk h={44} w={44} r={12} /></div>
                  <Sk h={6} r={4} />
                </div>
              ))}
            </div>
            <div className="bg-surface rounded-2xl border border-default overflow-hidden">
              <div className="px-4 py-3 flex gap-4 border-b border-default">{[80,200,140,120,160,90,70].map((w,i) => <Sk key={i} h={11} w={w} />)}</div>
              {[0,1,2,3,4,5,6,7].map(i => (
                <div key={i} className="px-4 py-3 flex gap-4 border-b border-default last:border-0">{[80,200,140,120,160,90,70].map((w,j) => <Sk key={j} h={11} w={w} />)}</div>
              ))}
            </div>
          </main>
        </MainLayout>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="h-screen flex items-center justify-center text-[#FF453A]">{erro}</div>
    );
  }

  return (
    <div className="flex min-h-screen bg-page text-page">
      <style>{`@keyframes shimmer { from { background-position:-600px 0 } to { background-position:600px 0 } }`}</style>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-6 md:p-8 space-y-6">

          {/* ── HEADER ── */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Treinamentos</h1>
              <p className="text-sm text-muted mt-0.5">Gestão e controle de treinamentos</p>
            </div>
            <button
              onClick={() => navigate("/treinamentos/novo")}
              className="flex items-center gap-2 bg-[#FA4C00] hover:bg-[#D84300] text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Novo Treinamento
            </button>
          </div>

          {/* ── KPI CARDS ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total */}
            <div className="bg-surface rounded-2xl p-5 border border-default">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted mb-1">Total</p>
                  <p className="text-2xl font-bold">{loadingStats ? "—" : stats.total}</p>
                </div>
                <div className="p-2.5 bg-[#FA4C00]/10 rounded-xl"><TrendingUp size={22} className="text-[#FA4C00]" /></div>
              </div>
            </div>

            {/* Realizados */}
            <div className="bg-surface rounded-2xl p-5 border border-default">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted mb-1">Realizados</p>
                  <p className="text-2xl font-bold text-[#34C759]">{loadingStats ? "—" : stats.finalizados}</p>
                </div>
                <div className="p-2.5 bg-[#34C759]/10 rounded-xl"><CheckCircle size={22} className="text-[#34C759]" /></div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>Progresso</span><span>{pct(stats.finalizados)}%</span>
                </div>
                <div className="w-full bg-surface-2 rounded-full h-1.5">
                  <div className="bg-[#34C759] h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct(stats.finalizados)}%` }} />
                </div>
              </div>
            </div>

            {/* Pendentes */}
            <div className="bg-surface rounded-2xl p-5 border border-default">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted mb-1">Pendentes</p>
                  <p className="text-2xl font-bold text-[#FF9F0A]">{loadingStats ? "—" : stats.pendentes}</p>
                </div>
                <div className="p-2.5 bg-[#FF9F0A]/10 rounded-xl"><Clock size={22} className="text-[#FF9F0A]" /></div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>Do total</span><span>{pct(stats.pendentes)}%</span>
                </div>
                <div className="w-full bg-surface-2 rounded-full h-1.5">
                  <div className="bg-[#FF9F0A] h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct(stats.pendentes)}%` }} />
                </div>
              </div>
            </div>

            {/* Cancelados */}
            <div className="bg-surface rounded-2xl p-5 border border-default">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted mb-1">Cancelados</p>
                  <p className="text-2xl font-bold text-[#FF453A]">{loadingStats ? "—" : stats.cancelados}</p>
                </div>
                <div className="p-2.5 bg-[#FF453A]/10 rounded-xl"><XCircle size={22} className="text-[#FF453A]" /></div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>Do total</span><span>{pct(stats.cancelados)}%</span>
                </div>
                <div className="w-full bg-surface-2 rounded-full h-1.5">
                  <div className="bg-[#FF453A] h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct(stats.cancelados)}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* ── FILTROS ── */}
          <div className="bg-surface rounded-2xl border border-default p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={14} className="text-muted" />
              <span className="text-xs font-medium text-muted uppercase tracking-wide">Filtros</span>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="ml-auto flex items-center gap-1 text-xs text-muted hover:text-[#FF453A] transition-colors"
                >
                  <XCircle size={13} /> Limpar
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Tema */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Tema</label>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar tema..."
                    value={filtroTema}
                    onChange={e => handleTema(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-surface-2 border border-default rounded-xl text-sm text-page placeholder-muted focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/40 focus:border-[#FA4C00]/50 transition-all"
                  />
                </div>
              </div>

              {/* Processo */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Processo</label>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar processo..."
                    value={filtroProcesso}
                    onChange={e => handleProcesso(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-surface-2 border border-default rounded-xl text-sm text-page placeholder-muted focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/40 focus:border-[#FA4C00]/50 transition-all"
                  />
                </div>
              </div>

              {/* Líder */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Líder</label>
                <select
                  value={filtroLider}
                  onChange={e => { setFiltroLider(e.target.value); setPage(1); }}
                  className="px-3 py-2 bg-surface-2 border border-default rounded-xl text-sm text-page focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/40 focus:border-[#FA4C00]/50 transition-all appearance-none"
                >
                  <option value="">Todos os líderes</option>
                  {lideres.map(l => <option key={l.opsId} value={l.opsId}>{l.nome}</option>)}
                </select>
              </div>

              {/* Data início */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Data início</label>
                <input
                  type="date"
                  value={filtroDataInicio}
                  onChange={e => { setFiltroDataInicio(e.target.value); setPage(1); }}
                  className="px-3 py-2 bg-surface-2 border border-default rounded-xl text-sm text-page focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/40 focus:border-[#FA4C00]/50 transition-all"
                />
              </div>

              {/* Data fim */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Data fim</label>
                <input
                  type="date"
                  value={filtroDataFim}
                  onChange={e => { setFiltroDataFim(e.target.value); setPage(1); }}
                  className="px-3 py-2 bg-surface-2 border border-default rounded-xl text-sm text-page focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/40 focus:border-[#FA4C00]/50 transition-all"
                />
              </div>
            </div>
          </div>

          {/* ── TABELA ── */}
          <div className="bg-surface rounded-2xl border border-default overflow-hidden">
            {/* header da tabela + contagem */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-default">
              <span className="text-xs text-muted">
                {loading ? "Carregando…" : `${pagination.total} treinamento${pagination.total !== 1 ? "s" : ""}${hasFilters ? " encontrado" + (pagination.total !== 1 ? "s" : "") : ""}`}
              </span>
              {loading && (
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <div className="w-3 h-3 rounded-full border-2 border-[#FA4C00] border-t-transparent animate-spin" />
                  Atualizando
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 border-b border-default">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Tema</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Processo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap">SOC</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Líder</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide">Ações</th>
                  </tr>
                </thead>

                <tbody className={loading ? "opacity-50 pointer-events-none" : ""}>
                  {treinamentos.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <FileText size={32} className="text-muted opacity-40" />
                          <p className="text-muted text-sm">
                            {hasFilters ? "Nenhum resultado para os filtros aplicados" : "Nenhum treinamento cadastrado"}
                          </p>
                          {hasFilters && (
                            <button onClick={clearFilters} className="text-xs text-[#FA4C00] hover:underline mt-1">
                              Limpar filtros
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {treinamentos.map((t) => (
                    <tr key={t.idTreinamento} className="border-t border-default hover:bg-surface-2/50 transition-colors">
                      <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                        {new Date(t.dataTreinamento).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 font-medium max-w-[220px]">
                        <span className="line-clamp-1" title={t.tema}>{t.tema}</span>
                      </td>
                      <td className="px-4 py-3 text-muted max-w-[180px]">
                        <span className="line-clamp-1" title={t.processo}>{t.processo || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                        {t.soc || "—"}
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <span className="line-clamp-1 text-xs" title={t.liderResponsavel?.nomeCompleto}>
                          {t.liderResponsavel?.nomeCompleto || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/treinamentos/${t.idTreinamento}`)}
                          className="inline-flex items-center gap-1.5 text-xs text-[#0A84FF] hover:text-[#409CFF] hover:underline transition-colors"
                        >
                          <FileText size={13} /> Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPage={(p) => setPage(p)}
            />
          </div>

        </main>
      </MainLayout>
    </div>
  );
}
