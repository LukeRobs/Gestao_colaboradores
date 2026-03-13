import { useState, useEffect } from "react";
import { Calendar, Users, TrendingUp } from "lucide-react";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import ProdutividadeColaboradorTable from "../../components/produtividadeColaborador/ProdutividadeColaboradorTable";
import toast from "react-hot-toast";

export default function ProdutividadeColaborador() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [turno, setTurno] = useState("T1");
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    console.log("🔄 Carregando produtividade por colaborador:", { data, turno });
    carregarDados();
    
    // Atualização automática a cada 2 minutos
    const intervalo = setInterval(() => {
      console.log("⏰ Atualização automática disparada");
      carregarDados();
    }, 120000); // 2 minutos
    
    return () => clearInterval(intervalo);
  }, [data, turno]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setErro(null);
      
      console.log("🔄 Carregando dados com filtros:", { data, turno });
      
      const response = await api.get("/dashboard/produtividade-colaborador", {
        params: { data, turno }
      });
      
      console.log("✅ Resposta recebida:", response.data);
      
      if (response.data.success) {
        setDashboardData(response.data.data);
      }
    } catch (error) {
      console.error("❌ Erro ao carregar dashboard:", error);
      
      const mensagemErro = error.response?.data?.message || 
                          error.response?.data?.error || 
                          "Erro ao carregar dados";
      setErro(mensagemErro);
      toast.error(mensagemErro);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (dataStr) => {
    const date = new Date(dataStr + 'T00:00:00');
    const opcoes = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    
    // Em mobile, usar formato mais curto
    if (window.innerWidth < 640) {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
    
    return date.toLocaleDateString('pt-BR', opcoes);
  };

  return (
    <div className="flex h-screen bg-[#0F0F11]">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header setSidebarOpen={setSidebarOpen} />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#0F0F11] p-3 sm:p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header da página */}
            <div className="mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Produtividade por Colaborador
              </h1>
              <p className="text-[#BFBFC3] text-sm sm:text-base">
                Acompanhe a produtividade individual de cada colaborador por turno
              </p>
            </div>

            {/* Filtros */}
            <div className="bg-[#1A1A1C] rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 border border-[#2A2A2C]">
              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-medium text-[#BFBFC3] mb-2">
                    <Calendar className="inline w-4 h-4 mr-1" />
                    Data
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
                    <Users className="inline w-4 h-4 mr-1" />
                    Turno
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

            {/* Informações do período */}
            {dashboardData && (
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
                    <span>{dashboardData.resumo.totalGeral.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="text-[#BFBFC3]">
                    <span className="font-medium text-blue-400 block">Média:</span>
                    <span>{dashboardData.resumo.mediaColaborador.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="text-[#BFBFC3]">
                    <span className="font-medium text-yellow-400 block">Maior:</span>
                    <span>{dashboardData.resumo.maiorProducao.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="text-[#BFBFC3]">
                    <span className="font-medium text-red-400 block">Ativos:</span>
                    <span>{dashboardData.resumo.colaboradoresAtivos}/{dashboardData.totalColaboradores}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Conteúdo principal */}
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
                  <div className="text-red-400 text-lg font-semibold mb-2">
                    Erro ao carregar dados
                  </div>
                  <div className="text-[#BFBFC3] mb-4 text-sm sm:text-base">{erro}</div>
                  <button
                    onClick={carregarDados}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors text-sm sm:text-base"
                  >
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