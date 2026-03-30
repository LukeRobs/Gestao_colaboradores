import { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  FileText,
  CheckCircle,
  Clock,
  TrendingUp,
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
    return (
      <span className="flex items-center gap-1 text-xs text-[#FF9F0A]">
        <Clock size={14} /> Em aberto
      </span>
    );
  };

  // Calcular estatísticas
  const treinamentosFinalizados = treinamentos.filter(t => t.status === "FINALIZADO").length;
  const treinamentosPendentes = treinamentos.filter(t => t.status !== "FINALIZADO").length;
  const total = treinamentos.length;
  const percentualRealizado = total > 0 ? Math.round((treinamentosFinalizados / total) * 100) : 0;

  /* ================= RENDER ================= */
  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#0D0D0D] text-white">
        <style>{`@keyframes shimmer { from { background-position: -600px 0 } to { background-position: 600px 0 } }`}</style>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />
        <div className="flex-1 lg:ml-64">
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
                <div key={i} className="bg-[#1A1A1C] rounded-2xl p-6 border border-[#2A2A2C] space-y-4">
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
            <div className="bg-[#1A1A1C] rounded-2xl overflow-hidden border border-[#2A2A2C]">
              <div className="bg-[#262628] px-4 py-3 flex gap-6">
                {[80, 160, 120, 80, 140, 80, 60].map((w, i) => (
                  <Sk key={i} h={12} w={w} />
                ))}
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-4 py-3 flex gap-6 border-t border-[#2A2A2C]">
                  {[80, 160, 120, 80, 140, 80, 60].map((w, j) => (
                    <Sk key={j} h={12} w={w} />
                  ))}
                </div>
              ))}
            </div>
          </main>
        </div>
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
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 space-y-8">
          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">
                Treinamentos
              </h1>
              <p className="text-sm text-[#BFBFC3]">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card Total */}
            <div className="bg-[#1A1A1C] rounded-2xl p-6 border border-[#2A2A2C]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#BFBFC3] mb-1">Total de Treinamentos</p>
                  <p className="text-2xl font-bold text-white">{total}</p>
                </div>
                <div className="p-3 bg-[#FA4C00]/10 rounded-xl">
                  <TrendingUp size={24} className="text-[#FA4C00]" />
                </div>
              </div>
            </div>

            {/* Card Realizados */}
            <div className="bg-[#1A1A1C] rounded-2xl p-6 border border-[#2A2A2C]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#BFBFC3] mb-1">Realizados</p>
                  <p className="text-2xl font-bold text-[#34C759]">{treinamentosFinalizados}</p>
                </div>
                <div className="p-3 bg-[#34C759]/10 rounded-xl">
                  <CheckCircle size={24} className="text-[#34C759]" />
                </div>
              </div>
              
              {/* Barra de progresso */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-[#BFBFC3] mb-2">
                  <span>Progresso</span>
                  <span>{percentualRealizado}%</span>
                </div>
                <div className="w-full bg-[#2A2A2C] rounded-full h-2">
                  <div 
                    className="bg-[#34C759] h-2 rounded-full transition-all duration-500"
                    style={{ width: `${percentualRealizado}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Card Pendentes */}
            <div className="bg-[#1A1A1C] rounded-2xl p-6 border border-[#2A2A2C]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#BFBFC3] mb-1">Pendentes</p>
                  <p className="text-2xl font-bold text-[#FF9F0A]">{treinamentosPendentes}</p>
                </div>
                <div className="p-3 bg-[#FF9F0A]/10 rounded-xl">
                  <Clock size={24} className="text-[#FF9F0A]" />
                </div>
              </div>
              
              {/* Indicador visual */}
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-[#2A2A2C] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#FF9F0A] transition-all duration-500"
                      style={{ width: `${total > 0 ? (treinamentosPendentes / total) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-[#BFBFC3]">
                    {total > 0 ? Math.round((treinamentosPendentes / total) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* LISTAGEM */}
          <div className="bg-[#1A1A1C] rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#262628] text-[#BFBFC3]">
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
                {treinamentos.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[#BFBFC3]"
                    >
                      Nenhum treinamento cadastrado
                    </td>
                  </tr>
                )}

                {treinamentos.map((t) => (
                  <tr
                    key={t.idTreinamento}
                    className="border-t border-[#2A2A2C] hover:bg-[#1F1F22]"
                  >
                    <td className="px-4 py-3">
                      {new Date(t.dataTreinamento).toLocaleDateString("pt-BR")}
                    </td>

                    <td className="px-4 py-3 font-medium">
                      {t.tema}
                    </td>

                    <td className="px-4 py-3">
                      {t.processo}
                    </td>

                    <td className="px-4 py-3">
                      {t.soc}
                    </td>

                    <td className="px-4 py-3">
                      {t.liderResponsavel?.nomeCompleto || "-"}
                    </td>

                    <td className="px-4 py-3">
                      {badgeStatus(t.status)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() =>
                          navigate(`/treinamentos/${t.idTreinamento}`)
                        }
                        className="inline-flex items-center gap-1 text-[#0A84FF] hover:underline"
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
      </div>
    </div>
  );
}
