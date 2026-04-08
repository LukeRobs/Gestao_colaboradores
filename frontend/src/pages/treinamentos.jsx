import { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/MainLayout";
import {
  Plus,
  FileText,
  CheckCircle,
  Clock,
  TrendingUp,
  XCircle,
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

import { TreinamentosAPI } from "../services/treinamentos";
import { AuthContext } from "../context/AuthContext";

/* ─── SKELETON ─────────────────────────────────────────────────────── */
function Sk({ h = 16, w = "100%", r = 8 }) {
  return (
    <div
      style={{
        height: h,
        width: w,
        borderRadius: r,
        background: "linear-gradient(90deg,#1f1f1f 25%,#2a2a2a 50%,#1f1f1f 75%)",
        backgroundSize: "600px 100%",
        animation: "shimmer 1.4s infinite linear",
      }}
    />
  );
}

/* =====================================================
   PAGE — TREINAMENTOS
===================================================== */
export default function TreinamentosPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [treinamentos, setTreinamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  /* filtros */
  const [filtroLider, setFiltroLider] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);

  /* ================= LOAD ================= */
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await TreinamentosAPI.listar();
        setTreinamentos(data || []);
      } catch (e) {
        if (e.response?.status === 401) {
          logout();
          navigate("/login");
        } else {
          setErro("Erro ao carregar treinamentos");
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [logout, navigate]);

  /* ================= HELPERS ================= */
  const badgeStatus = (status) => {
    if (status === "FINALIZADO") {
      return (
        <span className="flex items-center gap-1 text-xs text-[#34C759]">
          <CheckCircle size={14} /> Finalizado
        </span>
      );
    }
    if (status === "CANCELADO") {
      return (
        <span className="flex items-center gap-1 text-xs text-[#FF453A]">
          <XCircle size={14} /> Cancelado
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs text-[#FF9F0A]">
        <Clock size={14} /> Em aberto
      </span>
    );
  };

  // Calcular estatísticas
  const treinamentosFinalizados = treinamentos.filter(t => t.status === "FINALIZADO").length;
  const treinamentosCancelados = treinamentos.filter(t => t.status === "CANCELADO").length;
  const treinamentosPendentes = treinamentos.filter(t => t.status === "ABERTO").length;
  const total = treinamentos.length;
  const percentualRealizado = total > 0 ? Math.round((treinamentosFinalizados / total) * 100) : 0;

  // Líderes únicos para o filtro
  const lideres = [...new Map(
    treinamentos
      .filter(t => t.liderResponsavel?.nomeCompleto)
      .map(t => [t.liderResponsavelOpsId, t.liderResponsavel.nomeCompleto])
  ).entries()].map(([opsId, nome]) => ({ opsId, nome }));

  // Aplicar filtros
  const treinamentosFiltrados = treinamentos.filter(t => {
    if (filtroLider && t.liderResponsavelOpsId !== filtroLider) return false;
    if (filtroDataInicio) {
      const data = new Date(t.dataTreinamento);
      if (data < new Date(filtroDataInicio)) return false;
    }
    if (filtroDataFim) {
      const data = new Date(t.dataTreinamento);
      if (data > new Date(filtroDataFim + "T23:59:59")) return false;
    }
    return true;
  });

  /* ================= RENDER ================= */
  if (loading) {
    return (
      <div className="flex min-h-screen bg-page text-page">
        <style>{`@keyframes shimmer { from { background-position: -600px 0 } to { background-position: 600px 0 } }`}</style>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />
        <MainLayout>
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-8 space-y-8">
            {/* header */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Sk h={28} w={200} r={8} />
                <Sk h={14} w={260} r={6} />
              </div>
              <Sk h={38} w={160} r={12} />
            </div>

            {/* 3 cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-surface rounded-2xl p-6 border border-default space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Sk h={12} w={140} />
                      <Sk h={28} w={60} />
                    </div>
                    <Sk h={48} w={48} r={12} />
                  </div>
                  <Sk h={8} r={4} />
                </div>
              ))}
            </div>

            {/* tabela */}
            <div className="bg-surface rounded-2xl overflow-hidden border border-default">
              <div className="bg-surface-2 px-4 py-3 flex gap-6">
                {[80, 160, 120, 80, 140, 80, 60].map((w, i) => (
                  <Sk key={i} h={12} w={w} />
                ))}
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-4 py-3 flex gap-6 border-t border-default">
                  {[80, 160, 120, 80, 140, 80, 60].map((w, j) => (
                    <Sk key={j} h={12} w={w} />
                  ))}
                </div>
              ))}
            </div>
          </main>
        </MainLayout>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="h-screen flex items-center justify-center text-[#FF453A]">
        {erro}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-page text-page">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 space-y-8">
          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">
                Treinamentos
              </h1>
              <p className="text-sm text-muted">
                Gestão e controle de treinamentos
              </p>
            </div>

            <button
              onClick={() => navigate("/treinamentos/novo")}
              className="flex items-center gap-2 bg-[#FA4C00] hover:bg-[#D84300] text-white px-4 py-2 rounded-xl text-sm font-medium"
            >
              <Plus size={16} />
              Novo Treinamento
            </button>
          </div>

          {/* ESTATÍSTICAS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Card Total */}
            <div className="bg-surface rounded-2xl p-6 border border-default">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted mb-1">Total</p>
                  <p className="text-2xl font-bold text-page">{total}</p>
                </div>
                <div className="p-3 bg-[#FA4C00]/10 rounded-xl">
                  <TrendingUp size={24} className="text-[#FA4C00]" />
                </div>
              </div>
            </div>

            {/* Card Realizados */}
            <div className="bg-surface rounded-2xl p-6 border border-default">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted mb-1">Realizados</p>
                  <p className="text-2xl font-bold text-[#34C759]">{treinamentosFinalizados}</p>
                </div>
                <div className="p-3 bg-[#34C759]/10 rounded-xl">
                  <CheckCircle size={24} className="text-[#34C759]" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted mb-2">
                  <span>Progresso</span>
                  <span>{percentualRealizado}%</span>
                </div>
                <div className="w-full bg-surface-2 rounded-full h-2">
                  <div className="bg-[#34C759] h-2 rounded-full transition-all duration-500" style={{ width: `${percentualRealizado}%` }} />
                </div>
              </div>
            </div>

            {/* Card Pendentes */}
            <div className="bg-surface rounded-2xl p-6 border border-default">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted mb-1">Pendentes</p>
                  <p className="text-2xl font-bold text-[#FF9F0A]">{treinamentosPendentes}</p>
                </div>
                <div className="p-3 bg-[#FF9F0A]/10 rounded-xl">
                  <Clock size={24} className="text-[#FF9F0A]" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-[#FF9F0A] transition-all duration-500" style={{ width: `${total > 0 ? (treinamentosPendentes / total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs text-muted">{total > 0 ? Math.round((treinamentosPendentes / total) * 100) : 0}%</span>
                </div>
              </div>
            </div>

            {/* Card Cancelados */}
            <div className="bg-surface rounded-2xl p-6 border border-default">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted mb-1">Cancelados</p>
                  <p className="text-2xl font-bold text-[#FF453A]">{treinamentosCancelados}</p>
                </div>
                <div className="p-3 bg-[#FF453A]/10 rounded-xl">
                  <XCircle size={24} className="text-[#FF453A]" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-[#FF453A] transition-all duration-500" style={{ width: `${total > 0 ? (treinamentosCancelados / total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs text-muted">{total > 0 ? Math.round((treinamentosCancelados / total) * 100) : 0}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* FILTROS */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Líder</label>
              <select
                value={filtroLider}
                onChange={(e) => setFiltroLider(e.target.value)}
                className="px-3 py-2 bg-surface border border-default rounded-xl text-sm text-page focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/50 appearance-none min-w-[180px]"
              >
                <option value="">Todos os líderes</option>
                {lideres.map(l => (
                  <option key={l.opsId} value={l.opsId}>{l.nome}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Data início</label>
              <input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                className="px-3 py-2 bg-surface border border-default rounded-xl text-sm text-page focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Data fim</label>
              <input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                className="px-3 py-2 bg-surface border border-default rounded-xl text-sm text-page focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/50"
              />
            </div>
            {(filtroLider || filtroDataInicio || filtroDataFim) && (
              <button
                onClick={() => { setFiltroLider(""); setFiltroDataInicio(""); setFiltroDataFim(""); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-sm text-muted transition-colors cursor-pointer border border-default"
              >
                <XCircle size={14} /> Limpar filtros
              </button>
            )}
          </div>

          {/* LISTAGEM */}
          <div className="bg-surface rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Tema</th>
                  <th className="px-4 py-3 text-left">Processo</th>
                  <th className="px-4 py-3 text-left">SOC</th>
                  <th className="px-4 py-3 text-left">Líder</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>

              <tbody>
                {treinamentosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted">
                      {treinamentos.length === 0 ? "Nenhum treinamento cadastrado" : "Nenhum resultado para os filtros aplicados"}
                    </td>
                  </tr>
                )}

                {treinamentosFiltrados.map((t) => (
                  <tr key={t.idTreinamento} className="border-t border-default hover:bg-surface-3">
                    <td className="px-4 py-3">
                      {new Date(t.dataTreinamento).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 font-medium">{t.tema}</td>
                    <td className="px-4 py-3">{t.processo}</td>
                    <td className="px-4 py-3">{t.soc}</td>
                    <td className="px-4 py-3">{t.liderResponsavel?.nomeCompleto || "-"}</td>
                    <td className="px-4 py-3">{badgeStatus(t.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => navigate(`/treinamentos/${t.idTreinamento}`)}
                        className="inline-flex items-center gap-1 text-[#0A84FF] hover:underline cursor-pointer"
                      >
                        <FileText size={14} />
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </MainLayout>
    </div>
  );
}