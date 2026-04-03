import { useState, useEffect, useContext } from "react";
import { Calendar, Users, TrendingUp, ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import ProdutividadeColaboradorTable from "../../components/produtividadeColaborador/ProdutividadeColaboradorTable";
import toast from "react-hot-toast";
import { AuthContext } from "../../context/AuthContext";

/**
 * Calcula quantos segundos faltam para o próximo ciclo de 5 minutos.
 * Ex: 14:03:20 → próximo ciclo 14:05:00 → faltam 100s
 */
function segundosParaProximoSync() {
  const agora = new Date();
  const segundosTotais = agora.getMinutes() * 60 + agora.getSeconds();
  const ciclo = 5 * 60;
  return ciclo - (segundosTotais % ciclo);
}

function SyncBadge({ turno, data, onSyncComplete }) {
  const [segundos, setSegundos] = useState(segundosParaProximoSync);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const tick = setInterval(async () => {
      const s = segundosParaProximoSync();
      setSegundos(s);

      // Quando o timer zera (ciclo reinicia para ~300), dispara o salvamento
      if (s >= 299 && !syncing) {
        setSyncing(true);
        try {
          await api.post("/dashboard/produtividade-colaborador/trigger-salvamento", {
            turno,
            data,
          });
          onSyncComplete?.();
        } catch (e) {
          console.error("Erro no sync:", e.message);
        } finally {
          setSyncing(false);
        }
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [turno, data, syncing]);

  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  const label = `${min}:${String(seg).padStart(2, "0")}`;
  const quaseSync = segundos <= 30;

  return (
    <div
      title="Tempo até o próximo salvamento no banco"
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
        syncing
          ? "bg-blue-500/15 border-blue-500/40 text-blue-400"
          : quaseSync
          ? "bg-green-500/15 border-green-500/40 text-green-400"
          : "bg-[#1A1A1C] border-[#2A2A2C] text-[#BFBFC3]"
      }`}
    >
      <RefreshCw className={`w-3 h-3 ${syncing || quaseSync ? "animate-spin" : ""}`} />
      <span>{syncing ? "Salvando..." : `Sync ${label}`}</span>
    </div>
  );
}

// Retorna a data atual no fuso de Brasília
function getDataHoje() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export default function ProdutividadeColaborador() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const isOperacao = user?.role === "OPERACAO";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [turno, setTurno] = useState("T1");
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    carregarDados();
    const intervalo = setInterval(carregarDados, 120000);
    return () => clearInterval(intervalo);
  }, [data, turno]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setErro(null);
      const response = await api.get("/dashboard/produtividade-colaborador", {
        params: { data, turno }
      });
      if (response.data.success) {
        setDashboardData(response.data.data);
      }
    } catch (error) {
      const mensagemErro = error.response?.data?.message || "Erro ao carregar dados";
      setErro(mensagemErro);
      toast.error(mensagemErro);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (dataStr) => {
    const date = new Date(dataStr + "T00:00:00");
    if (window.innerWidth < 640) {
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    }
    return date.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  };

  return (
    <div className="flex h-screen bg-[#0F0F11]">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#0F0F11] p-3 sm:p-6">
          <div className="max-w-7xl mx-auto">

            {/* Header */}
            <div className="mb-6 sm:mb-8 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {isOperacao && (
                  <button
                    onClick={() => navigate("/ponto")}
                    className="p-2 rounded-lg border border-[#2A2A2C] text-[#BFBFC3] hover:bg-[#2A2A2C] transition"
                    title="Voltar ao Ponto"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">
                      Produtividade por Colaborador
                    </h1>
                    <SyncBadge turno={turno} data={data} onSyncComplete={carregarDados} />
                  </div>
                  <p className="text-[#BFBFC3] text-sm sm:text-base">
                    Acompanhe a produtividade individual de cada colaborador por turno
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* Seletor de turno para OPERACAO */}
                {isOperacao && (
                  <div className="flex gap-2">
                    {["T1", "T2", "T3"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTurno(t)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${
                          turno === t
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "bg-[#1A1A1C] border-[#2A2A2C] text-[#BFBFC3] hover:bg-[#2A2A2C]"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Filtros — apenas para não-OPERACAO */}
            {!isOperacao && (
              <div className="bg-[#1A1A1C] rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 border border-[#2A2A2C]">
                <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
                  <div className="flex-1 min-w-0">
                    <label className="block text-sm font-medium text-[#BFBFC3] mb-2">
                      <Calendar className="inline w-4 h-4 mr-1 text-white" />Data
                    </label>
                    <input
                      type="date"
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                      className="w-full px-3 py-2 bg-[#2A2A2C] border border-[#3A3A3C] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-sm font-medium text-[#BFBFC3] mb-2">
                      <Users className="inline w-4 h-4 mr-1" />Turno
                    </label>
                    <select
                      value={turno}
                      onChange={(e) => setTurno(e.target.value)}
                      className="w-full px-3 py-2 bg-[#2A2A2C] border border-[#3A3A3C] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="T1">T1 - 06:00 às 14:00</option>
                      <option value="T2">T2 - 14:00 às 22:00</option>
                      <option value="T3">T3 - 22:00 às 06:00</option>
                    </select>
                  </div>
                  <button
                    onClick={carregarDados}
                    disabled={loading}
                    className="px-4 sm:px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-md transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    <TrendingUp className="w-4 h-4" />
                    {loading ? "Carregando..." : "Atualizar"}
                  </button>
                </div>
              </div>
            )}

            {/* Resumo — apenas para não-OPERACAO */}
            {!isOperacao && dashboardData && (
              <div className="bg-[#1A1A1C] rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 border border-[#2A2A2C]">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div className="text-[#BFBFC3]">
                    <span className="font-medium text-white block">Data:</span>
                    <span className="truncate block">{formatarData(dashboardData.data)}</span>
                  </div>
                  <div className="text-[#BFBFC3]">
                    <span className="font-medium text-white block">Turno:</span>
                    <span>{dashboardData.turno}</span>
                  </div>
                  <div className="text-[#BFBFC3]">
                    <span className="font-medium text-white block">Colaboradores:</span>
                    <span>{dashboardData.totalColaboradores}</span>
                  </div>
                  <div className="text-[#BFBFC3]">
                    <span className="font-medium text-green-400 block">Total Geral:</span>
                    <span>{dashboardData.resumo.totalGeral.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="text-[#BFBFC3]">
                    <span className="font-medium text-blue-400 block">Média:</span>
                    <span>{dashboardData.resumo.mediaColaborador.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="text-[#BFBFC3]">
                    <span className="font-medium text-yellow-400 block">Maior:</span>
                    <span>{dashboardData.resumo.maiorProducao.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="text-[#BFBFC3]">
                    <span className="font-medium text-red-400 block">Ativos:</span>
                    <span>{dashboardData.resumo.colaboradoresAtivos}/{dashboardData.totalColaboradores}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tabela */}
            {loading ? (
              <div className="bg-[#1A1A1C] rounded-lg p-6 sm:p-8 border border-[#2A2A2C]">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="ml-3 text-[#BFBFC3] text-sm sm:text-base">Carregando dados...</span>
                </div>
              </div>
            ) : erro ? (
              <div className="bg-[#1A1A1C] rounded-lg p-6 sm:p-8 border border-red-500/20">
                <div className="text-center">
                  <div className="text-red-400 text-lg font-semibold mb-2">Erro ao carregar dados</div>
                  <div className="text-[#BFBFC3] mb-4 text-sm sm:text-base">{erro}</div>
                  <button onClick={carregarDados} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors text-sm sm:text-base">
                    Tentar novamente
                  </button>
                </div>
              </div>
            ) : dashboardData ? (
              <div className="bg-[#1A1A1C] rounded-lg border border-[#2A2A2C] overflow-hidden">
                <ProdutividadeColaboradorTable
                  colaboradores={dashboardData.colaboradores}
                  horasTurno={dashboardData.horasTurno}
                  turno={dashboardData.turno}
                />
              </div>
            ) : (
              <div className="bg-[#1A1A1C] rounded-lg p-6 sm:p-8 border border-[#2A2A2C]">
                <div className="text-center text-[#BFBFC3] text-sm sm:text-base">
                  Nenhum dado disponível para os filtros selecionados
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
