import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, FileText, CheckCircle, Clock, XCircle,
  Search, ChevronLeft, ChevronRight, Filter,
  Download, TrendingUp, Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../components/MainLayout";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { AtestadosAPI } from "../../services/atestados";
import api from "../../services/api";

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
      <Clock size={11} /> Ativo
    </span>
  );
}

/* ─── PAGINATION ───────────────────────────────────── */
function Pagination({ page, totalPages, onPage, loading }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-default">
      <span className="text-xs text-muted">Página {page} de {totalPages}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1 || loading}
          className="p-1.5 rounded-lg text-muted hover:text-page hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronLeft size={16} />
        </button>

        {pages[0] > 1 && (
          <>
            <button onClick={() => onPage(1)} className="w-8 h-8 rounded-lg text-xs text-muted hover:text-page hover:bg-surface-2 transition-colors cursor-pointer">1</button>
            {pages[0] > 2 && <span className="text-muted text-xs px-1">…</span>}
          </>
        )}

        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPage(p)}
            disabled={loading}
            className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
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
            <button onClick={() => onPage(totalPages)} className="w-8 h-8 rounded-lg text-xs text-muted hover:text-page hover:bg-surface-2 transition-colors cursor-pointer">{totalPages}</button>
          </>
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages || loading}
          className="p-1.5 rounded-lg text-muted hover:text-page hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* =====================================================
   PAGE — ATESTADOS MÉDICOS
===================================================== */
export default function AtestadosPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [atestados, setAtestados] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [stats, setStats] = useState({ total: 0, ativos: 0, finalizados: 0, cancelados: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [page, setPage] = useState(1);

  const [filtroData, setFiltroData] = useState("");
  const [filtroNome, setFiltroNome] = useState("");
  const [nomeDebounced, setNomeDebounced] = useState("");
  const nomeTimer = useRef(null);

  const hasFilters = filtroData || filtroNome;

  const handleNome = (v) => {
    setFiltroNome(v);
    clearTimeout(nomeTimer.current);
    nomeTimer.current = setTimeout(() => { setNomeDebounced(v); setPage(1); }, 400);
  };

  const clearFilters = () => {
    setFiltroData("");
    setFiltroNome(""); setNomeDebounced("");
    setPage(1);
  };

  function fmtDate(isoStr) {
    if (!isoStr) return "—";
    return isoStr.slice(0, 10).split("-").reverse().join("/");
  }

  /* ── stats (once on mount) ── */
  useEffect(() => {
    AtestadosAPI.stats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, []);

  /* ── list (filters + page) ── */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await AtestadosAPI.listar({
          page,
          limit: LIMIT,
          data: filtroData || undefined,
          nome: nomeDebounced || undefined,
        });
        if (cancelled) return;
        setAtestados(res.data ?? []);
        setPagination({
          page: res.pagination?.page ?? 1,
          totalPages: res.pagination?.totalPages ?? 1,
          total: res.pagination?.total ?? 0,
        });
      } catch {
        if (!cancelled) alert("Erro ao carregar atestados médicos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [page, filtroData, nomeDebounced]);

  /* ── actions ── */
  async function handleDownload(id) {
    try {
      const res = await api.get(`/atestados-medicos/${id}/presign-download`);
      window.open(res.data.data.url, "_blank");
    } catch {
      alert("Erro ao abrir o PDF do atestado.");
    }
  }

  async function handleFinalizar(id) {
    if (!confirm("Finalizar este atestado?")) return;
    try {
      await AtestadosAPI.finalizar(id);
      setPage(p => p); // re-trigger effect
      AtestadosAPI.stats().then(setStats).catch(() => {});
    } catch {
      alert("Erro ao finalizar atestado.");
    }
  }

  async function handleCancelar(id) {
    if (!confirm("Cancelar este atestado?")) return;
    try {
      await AtestadosAPI.cancelar(id);
      setPage(p => p);
      AtestadosAPI.stats().then(setStats).catch(() => {});
    } catch {
      alert("Erro ao cancelar atestado.");
    }
  }

  const pct = (n) => stats.total > 0 ? Math.round((n / stats.total) * 100) : 0;

  /* ─── SKELETON ─── */
  if (loading && atestados.length === 0) {
    return (
      <div className="flex min-h-screen bg-page text-page">
        <style>{`@keyframes shimmer { from { background-position:-600px 0 } to { background-position:600px 0 } }`}</style>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />
        <MainLayout>
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2"><Sk h={28} w={220} /><Sk h={14} w={260} /></div>
              <Sk h={38} w={160} r={12} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[0,1,2,3].map(i => (
                <div key={i} className="bg-surface rounded-2xl p-5 border border-default space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2"><Sk h={11} w={80} /><Sk h={26} w={50} /></div>
                    <Sk h={44} w={44} r={12} />
                  </div>
                  <Sk h={6} r={4} />
                </div>
              ))}
            </div>
            <div className="bg-surface rounded-2xl border border-default overflow-hidden">
              <div className="px-4 py-3 flex gap-4 border-b border-default">
                {[80,200,140,80,100,90].map((w,i) => <Sk key={i} h={11} w={w} />)}
              </div>
              {[0,1,2,3,4,5,6,7].map(i => (
                <div key={i} className="px-4 py-3 flex gap-4 border-b border-default last:border-0">
                  {[80,200,140,80,100,90].map((w,j) => <Sk key={j} h={11} w={w} />)}
                </div>
              ))}
            </div>
          </main>
        </MainLayout>
      </div>
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
              <h1 className="text-2xl font-semibold">Atestados Médicos</h1>
              <p className="text-sm text-muted mt-0.5">Gestão de afastamentos médicos</p>
            </div>
            <button
              onClick={() => navigate("/atestados/novo")}
              className="flex items-center gap-2 bg-[#FA4C00] hover:bg-[#D84300] text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
            >
              <Plus size={16} />
              Novo Atestado
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
                <div className="p-2.5 bg-[#FA4C00]/10 rounded-xl">
                  <TrendingUp size={22} className="text-[#FA4C00]" />
                </div>
              </div>
            </div>

            {/* Ativos */}
            <div className="bg-surface rounded-2xl p-5 border border-default">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted mb-1">Ativos</p>
                  <p className="text-2xl font-bold text-[#FF9F0A]">{loadingStats ? "—" : stats.ativos}</p>
                </div>
                <div className="p-2.5 bg-[#FF9F0A]/10 rounded-xl">
                  <Clock size={22} className="text-[#FF9F0A]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>Do total</span><span>{pct(stats.ativos)}%</span>
                </div>
                <div className="w-full bg-surface-2 rounded-full h-1.5">
                  <div className="bg-[#FF9F0A] h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct(stats.ativos)}%` }} />
                </div>
              </div>
            </div>

            {/* Finalizados */}
            <div className="bg-surface rounded-2xl p-5 border border-default">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted mb-1">Finalizados</p>
                  <p className="text-2xl font-bold text-[#34C759]">{loadingStats ? "—" : stats.finalizados}</p>
                </div>
                <div className="p-2.5 bg-[#34C759]/10 rounded-xl">
                  <CheckCircle size={22} className="text-[#34C759]" />
                </div>
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

            {/* Cancelados */}
            <div className="bg-surface rounded-2xl p-5 border border-default">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted mb-1">Cancelados</p>
                  <p className="text-2xl font-bold text-[#FF453A]">{loadingStats ? "—" : stats.cancelados}</p>
                </div>
                <div className="p-2.5 bg-[#FF453A]/10 rounded-xl">
                  <XCircle size={22} className="text-[#FF453A]" />
                </div>
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
                  className="ml-auto flex items-center gap-1 text-xs text-muted hover:text-[#FF453A] transition-colors cursor-pointer"
                >
                  <XCircle size={13} /> Limpar
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Data */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Data do afastamento</label>
                <input
                  type="date"
                  value={filtroData}
                  onChange={e => { setFiltroData(e.target.value); setPage(1); }}
                  className="px-3 py-2 bg-surface-2 border border-default rounded-xl text-sm text-page focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/40 focus:border-[#FA4C00]/50 transition-all"
                />
              </div>

              {/* Colaborador */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Colaborador</label>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar por nome..."
                    value={filtroNome}
                    onChange={e => handleNome(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (setNomeDebounced(filtroNome), setPage(1))}
                    className="w-full pl-7 pr-3 py-2 bg-surface-2 border border-default rounded-xl text-sm text-page placeholder-muted focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/40 focus:border-[#FA4C00]/50 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── TABELA ── */}
          <div className="bg-surface rounded-2xl border border-default overflow-hidden">
            {/* toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-default">
              <span className="text-xs text-muted">
                {loading
                  ? "Carregando…"
                  : `${pagination.total} atestado${pagination.total !== 1 ? "s" : ""}${hasFilters ? " encontrado" + (pagination.total !== 1 ? "s" : "") : ""}`
                }
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Colaborador</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Período</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">Dias</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">CID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide">Ações</th>
                  </tr>
                </thead>

                <tbody className={`divide-y divide-default ${loading ? "opacity-50 pointer-events-none" : ""}`}>
                  {atestados.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <FileText size={32} className="text-muted opacity-40" />
                          <p className="text-muted text-sm">
                            {hasFilters ? "Nenhum resultado para os filtros aplicados" : "Nenhum atestado cadastrado"}
                          </p>
                          {hasFilters && (
                            <button onClick={clearFilters} className="text-xs text-[#FA4C00] hover:underline mt-1 cursor-pointer">
                              Limpar filtros
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {atestados.map((a) => (
                    <tr key={a.idAtestado} className="hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-page line-clamp-1" title={a.colaborador?.nomeCompleto || a.opsId}>
                          {a.colaborador?.nomeCompleto || a.opsId}
                        </p>
                        <p className="text-xs text-muted mt-0.5">{a.opsId}</p>
                      </td>

                      <td className="px-4 py-3.5 text-muted whitespace-nowrap hidden md:table-cell">
                        {fmtDate(a.dataInicio)} → {fmtDate(a.dataFim)}
                      </td>

                      <td className="px-4 py-3.5 text-center hidden lg:table-cell">
                        <span className="text-xs font-semibold text-page bg-surface-2 px-2.5 py-1 rounded-lg tabular-nums">
                          {a.diasAfastamento ?? "—"}d
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-muted text-sm hidden lg:table-cell">
                        {a.cid || <span className="text-muted opacity-50">—</span>}
                      </td>

                      <td className="px-4 py-3.5">
                        <StatusBadge status={a.status} />
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleDownload(a.idAtestado)}
                            title="Download PDF"
                            className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-page transition-colors cursor-pointer"
                            aria-label="Download PDF"
                          >
                            <Download size={15} />
                          </button>
                          {a.status === "ATIVO" && (
                            <>
                              <button
                                onClick={() => handleFinalizar(a.idAtestado)}
                                title="Finalizar atestado"
                                className="p-1.5 rounded-lg hover:bg-[#34C759]/10 text-muted hover:text-[#34C759] transition-colors cursor-pointer"
                                aria-label="Finalizar atestado"
                              >
                                <CheckCircle size={15} />
                              </button>
                              <button
                                onClick={() => handleCancelar(a.idAtestado)}
                                title="Cancelar atestado"
                                className="p-1.5 rounded-lg hover:bg-[#FF453A]/10 text-muted hover:text-[#FF453A] transition-colors cursor-pointer"
                                aria-label="Cancelar atestado"
                              >
                                <XCircle size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={pagination.totalPages}
              onPage={setPage}
              loading={loading}
            />
          </div>

        </main>
      </MainLayout>
    </div>
  );
}
