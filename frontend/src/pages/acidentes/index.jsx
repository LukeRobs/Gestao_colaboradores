import { useEffect, useState, useRef, useContext } from "react";
import {
  Plus, AlertTriangle, TrendingUp, XCircle,
  Search, ChevronLeft, ChevronRight, Filter,
  Calendar, MapPin, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../components/MainLayout";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { AcidentesAPI } from "../../services/acidentes";
import { AuthContext } from "../../context/AuthContext";

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

/* ─── CANCEL MODAL ─────────────────────────────────── */
function CancelModal({ acidenteId, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function handleConfirm() {
    if (!motivo.trim()) return;
    setSalvando(true);
    try {
      await AcidentesAPI.cancelar(acidenteId, motivo);
      onConfirm();
    } catch {
      alert("Erro ao cancelar acidente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl w-full max-w-md border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <XCircle size={18} className="text-[#FF453A]" />
            <h2 className="font-semibold text-base">Cancelar Registro</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-muted">Informe o motivo do cancelamento. Esta ação não pode ser desfeita.</p>
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Descreva o motivo do cancelamento..."
            rows={4}
            className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#FF453A]/50 resize-none"
          />
        </div>
        <div className="px-5 py-4 border-t border-white/5 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition-colors cursor-pointer">
            Voltar
          </button>
          <button
            onClick={handleConfirm}
            disabled={salvando || !motivo.trim()}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-colors ${
              salvando || !motivo.trim()
                ? "bg-[#FF453A]/30 text-white/30 cursor-not-allowed"
                : "bg-[#FF453A] hover:bg-[#D93025] cursor-pointer"
            }`}
          >
            <XCircle size={15} />
            {salvando ? "Cancelando..." : "Confirmar cancelamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   PAGE — ACIDENTES
===================================================== */
export default function AcidentesPage() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [acidentes, setAcidentes] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [totalGeral, setTotalGeral] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [page, setPage] = useState(1);

  const [filtroNome, setFiltroNome] = useState("");
  const [filtroData, setFiltroData] = useState("");
  const [nomeDebounced, setNomeDebounced] = useState("");
  const nomeTimer = useRef(null);

  const [cancelTarget, setCancelTarget] = useState(null);

  const hasFilters = !!(filtroNome || filtroData);

  const handleNome = (v) => {
    setFiltroNome(v);
    clearTimeout(nomeTimer.current);
    nomeTimer.current = setTimeout(() => { setNomeDebounced(v); setPage(1); }, 400);
  };

  const clearFilters = () => {
    setFiltroNome(""); setNomeDebounced("");
    setFiltroData("");
    setPage(1);
  };

  function fmtDate(isoStr) {
    if (!isoStr) return "—";
    const d = new Date(isoStr);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("pt-BR");
  }

  function fmtHora(raw) {
    if (!raw) return "—";
    if (typeof raw === "string" && raw.length <= 8) return raw.slice(0, 5);
    const d = new Date(raw);
    if (!isNaN(d)) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return "—";
  }

  /* ── stats total (once on mount) ── */
  useEffect(() => {
    AcidentesAPI.stats()
      .then(s => setTotalGeral(s.total))
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, []);

  /* ── list (filters + page) ── */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await AcidentesAPI.listar({
          page,
          limit: LIMIT,
          nome: nomeDebounced || undefined,
          data: filtroData || undefined,
        });
        if (cancelled) return;
        setAcidentes(res.data ?? []);
        setPagination({
          page: res.pagination?.page ?? 1,
          totalPages: res.pagination?.totalPages ?? 1,
          total: res.pagination?.total ?? 0,
        });
      } catch {
        if (!cancelled) alert("Erro ao carregar acidentes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [page, nomeDebounced, filtroData]);

  function refreshList() {
    setPage(p => p);
  }

  /* ─── SKELETON ─── */
  if (loading && acidentes.length === 0) {
    return (
      <div className="flex min-h-screen bg-page text-page">
        <style>{`@keyframes shimmer { from { background-position:-600px 0 } to { background-position:600px 0 } }`}</style>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />
        <MainLayout>
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2"><Sk h={28} w={220} /><Sk h={14} w={280} /></div>
              <Sk h={38} w={160} r={12} />
            </div>
            <div className="max-w-xs">
              <div className="bg-surface rounded-2xl p-5 border border-default space-y-3">
                <div className="flex items-center justify-between"><div className="space-y-2"><Sk h={11} w={100} /><Sk h={26} w={60} /></div><Sk h={44} w={44} r={12} /></div>
              </div>
            </div>
            <div className="bg-surface rounded-2xl border border-default overflow-hidden">
              <div className="px-4 py-3 flex gap-4 border-b border-default">
                {[80, 200, 120, 140, 80].map((w, i) => <Sk key={i} h={11} w={w} />)}
              </div>
              {[0,1,2,3,4,5,6,7].map(i => (
                <div key={i} className="px-4 py-3 flex gap-4 border-b border-default last:border-0">
                  {[80, 200, 120, 140, 80].map((w, j) => <Sk key={j} h={11} w={w} />)}
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
              <h1 className="text-2xl font-semibold">Acidentes de Trabalho</h1>
              <p className="text-sm text-muted mt-0.5">Registro e acompanhamento de ocorrências</p>
            </div>
            <button
              onClick={() => navigate("/acidentes/novo")}
              className="flex items-center gap-2 bg-[#FA4C00] hover:bg-[#D84300] text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
            >
              <Plus size={16} />
              Novo Acidente
            </button>
          </div>

          {/* ── KPI CARD ── */}
          <div className="bg-surface rounded-2xl p-5 border border-default max-w-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted mb-1">Total de Registros</p>
                <p className="text-2xl font-bold">{loadingStats ? "—" : totalGeral}</p>
              </div>
              <div className="p-2.5 bg-[#FA4C00]/10 rounded-xl">
                <TrendingUp size={22} className="text-[#FA4C00]" />
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Data da ocorrência</label>
                <input
                  type="date"
                  value={filtroData}
                  onChange={e => { setFiltroData(e.target.value); setPage(1); }}
                  className="px-3 py-2 bg-surface-2 border border-default rounded-xl text-sm text-page focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/40 focus:border-[#FA4C00]/50 transition-all"
                />
              </div>

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
                  : `${pagination.total} registro${pagination.total !== 1 ? "s" : ""}${hasFilters ? " encontrado" + (pagination.total !== 1 ? "s" : "") : " no total"}`
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide hidden md:table-cell whitespace-nowrap">Data / Hora</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">Local</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide hidden xl:table-cell">Tipo</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide">Ações</th>
                  </tr>
                </thead>

                <tbody className={`divide-y divide-default ${loading ? "opacity-50 pointer-events-none" : ""}`}>
                  {acidentes.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <AlertTriangle size={32} className="text-muted opacity-40" />
                          <p className="text-muted text-sm">
                            {hasFilters ? "Nenhum resultado para os filtros aplicados" : "Nenhum acidente registrado"}
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

                  {acidentes.map((a) => {
                    const podeCancelar =
                      a.status !== "CANCELADO" &&
                      (user?.role === "ADMIN" || user?.name === a?.nomeRegistrante);

                    return (
                      <tr
                        key={a.idAcidente}
                        className={`hover:bg-surface-2 transition-colors ${a.status === "CANCELADO" ? "opacity-50" : ""}`}
                      >
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-page line-clamp-1" title={a.colaborador?.nomeCompleto || a.opsIdColaborador}>
                            {a.colaborador?.nomeCompleto || a.opsIdColaborador}
                          </p>
                          <p className="text-xs text-muted mt-0.5">{a.opsIdColaborador}</p>
                        </td>

                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <div className="flex items-center gap-1.5 text-muted whitespace-nowrap">
                            <Calendar size={12} className="text-[#FA4C00]" />
                            <span>{fmtDate(a.dataOcorrencia)}</span>
                          </div>
                          <p className="text-xs text-muted mt-0.5 pl-4">{fmtHora(a.horarioOcorrencia)}</p>
                        </td>

                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <div className="flex items-center gap-1.5 text-muted">
                            <MapPin size={12} className="shrink-0" />
                            <span className="line-clamp-1 text-sm" title={a.localOcorrencia}>{a.localOcorrencia || "—"}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 hidden xl:table-cell">
                          <span className="text-sm text-muted line-clamp-1" title={a.tipoOcorrencia}>{a.tipoOcorrencia || "—"}</span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end">
                            {podeCancelar && (
                              <button
                                onClick={() => setCancelTarget(a.idAcidente)}
                                title="Cancelar registro"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#FF453A]/10 text-muted hover:text-[#FF453A] text-xs transition-colors cursor-pointer"
                                aria-label="Cancelar registro"
                              >
                                <XCircle size={14} />
                                <span className="hidden sm:inline">Cancelar</span>
                              </button>
                            )}
                            {a.status === "CANCELADO" && (
                              <span className="text-xs text-muted italic">Cancelado</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      {cancelTarget && (
        <CancelModal
          acidenteId={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={() => {
            setCancelTarget(null);
            refreshList();
          }}
        />
      )}
    </div>
  );
}
