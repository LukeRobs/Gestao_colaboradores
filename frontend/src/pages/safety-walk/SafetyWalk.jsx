import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  Users,
  TrendingUp,
  CheckCircle2,
  Clock,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import DashboardHeader from "../../components/dashboard/DashboardHeader";
import KpiCard from "../../components/dashboard/KpiCard";

import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";

export default function SafetyWalk() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [filtroTurno, setFiltroTurno] = useState("TODOS");
  const [periodo, setPeriodo] = useState("semana"); // semana por padrão para acompanhamento semanal
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1); // 1-12
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [pendentesExpandido, setPendentesExpandido] = useState(true);
  const [realizadosExpandido, setRealizadosExpandido] = useState(true);

  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);

  /* =====================================================
     LOAD DADOS SAFETY WALK
  ===================================================== */
  async function loadSafetyWalk() {
    try {
      setLoading(true);
      
      const params = {
        periodo,
        turno: filtroTurno !== "TODOS" ? filtroTurno : undefined,
      };

      // Se período for "mes", adicionar mês e ano
      if (periodo === "mes") {
        params.mes = mesSelecionado;
        params.ano = anoSelecionado;
      }
      
      const res = await api.get("/safety-walk", { params });
      
      setDados(res.data.data);
      setErro(null);
    } catch (e) {
      console.error('Erro ao carregar Safety Walk:', e);
      
      if (e.response?.status === 401) {
        logout();
        navigate("/login");
      } else {
        setErro("Erro ao carregar dados do Safety Walk");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSafetyWalk();
  }, [periodo, filtroTurno, mesSelecionado, anoSelecionado]);

  /* =====================================================
     FILTRAR DADOS - PESSOAS ÚNICAS
  ===================================================== */
  const dadosFiltrados = dados?.registros || [];
  
  // Agrupar por pessoa para evitar duplicatas
  const pessoasPendentes = [];
  const pessoasRealizadas = [];
  
  // Usar Map para garantir pessoas únicas
  const mapPendentes = new Map();
  const mapRealizadas = new Map();
  
  dadosFiltrados.forEach(reg => {
    const key = reg.responsavel;
    
    if (reg.status === 'PENDENTE') {
      if (!mapPendentes.has(key)) {
        mapPendentes.set(key, reg);
      }
    } else if (reg.status === 'REALIZADO') {
      if (!mapRealizadas.has(key)) {
        mapRealizadas.set(key, reg);
      }
    }
  });
  
  // Converter Maps para arrays
  const pessoasPendentesUnicas = Array.from(mapPendentes.values());
  const pessoasRealizadasUnicas = Array.from(mapRealizadas.values());

  /* =====================================================
     HELPERS
  ===================================================== */
  const meses = [
    { valor: 1, nome: "Janeiro" },
    { valor: 2, nome: "Fevereiro" },
    { valor: 3, nome: "Março" },
    { valor: 4, nome: "Abril" },
    { valor: 5, nome: "Maio" },
    { valor: 6, nome: "Junho" },
    { valor: 7, nome: "Julho" },
    { valor: 8, nome: "Agosto" },
    { valor: 9, nome: "Setembro" },
    { valor: 10, nome: "Outubro" },
    { valor: 11, nome: "Novembro" },
    { valor: 12, nome: "Dezembro" },
  ];

  const anos = [2024, 2025, 2026];

  /* =====================================================
     KPIs
  ===================================================== */
  const kpis = [
    {
      icon: ClipboardCheck,
      label: "Total de Pessoas",
      value: dados?.totalInspecoes || 0,
      color: "#FFFFFF",
      bgColor: "rgba(42, 42, 44, 1)",
    },
    {
      icon: CheckCircle2,
      label: "Realizadas",
      value: dados?.realizadas || 0,
      color: "#34C759",
      bgColor: "rgba(52, 199, 89, 0.15)",
    },
    {
      icon: Clock,
      label: "Pendentes",
      value: dados?.pendentes || 0,
      color: "#FF9F0A",
      bgColor: "rgba(255, 159, 10, 0.15)",
    },
  ];

  /* =====================================================
     RENDER
  ===================================================== */
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0D0D0D] text-[#BFBFC3]">
        <RefreshCw className="animate-spin mr-2" size={20} />
        Carregando…
      </div>
    );
  }

  if (erro) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0D0D0D] text-[#FF453A]">
        {erro}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 space-y-8">
          {/* HEADER */}
          <DashboardHeader
            title="Safety Walk"
            subtitle="Inspeções de Segurança"
            date={new Date().toLocaleDateString("pt-BR")}
          />

          {/* FILTROS */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Período */}
            <div className="flex gap-2">
              <button
                onClick={() => setPeriodo("semana")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  periodo === "semana"
                    ? "bg-[#FA4C00] text-white"
                    : "bg-[#1A1A1C] text-[#BFBFC3] hover:bg-[#222]"
                }`}
              >
                Esta Semana
              </button>
              <button
                onClick={() => setPeriodo("mes")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  periodo === "mes"
                    ? "bg-[#FA4C00] text-white"
                    : "bg-[#1A1A1C] text-[#BFBFC3] hover:bg-[#222]"
                }`}
              >
                Por Mês
              </button>
            </div>

            {/* Seletor de Mês e Ano - só aparece quando período = "mes" */}
            {periodo === "mes" && (
              <>
                <select
                  value={mesSelecionado}
                  onChange={(e) => setMesSelecionado(Number(e.target.value))}
                  className="bg-[#1A1A1C] border border-[#2A2A2C] px-4 py-2 rounded-lg text-sm"
                >
                  {meses.map((mes) => (
                    <option key={mes.valor} value={mes.valor}>
                      {mes.nome}
                    </option>
                  ))}
                </select>

                <select
                  value={anoSelecionado}
                  onChange={(e) => setAnoSelecionado(Number(e.target.value))}
                  className="bg-[#1A1A1C] border border-[#2A2A2C] px-4 py-2 rounded-lg text-sm"
                >
                  {anos.map((ano) => (
                    <option key={ano} value={ano}>
                      {ano}
                    </option>
                  ))}
                </select>
              </>
            )}

            {/* Turno */}
            <select
              value={filtroTurno}
              onChange={(e) => setFiltroTurno(e.target.value)}
              className="bg-[#1A1A1C] border border-[#2A2A2C] px-4 py-2 rounded-lg text-sm"
            >
              <option value="TODOS">Todos os Turnos</option>
              <option value="T1">Turno 1</option>
              <option value="T2">Turno 2</option>
              <option value="T3">Turno 3</option>
              <option value="ADM">Administrativo</option>
            </select>

            {/* Atualizar */}
            <button
              onClick={loadSafetyWalk}
              className="ml-auto bg-[#1A1A1C] border border-[#2A2A2C] px-4 py-2 rounded-lg text-sm hover:bg-[#222] flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Atualizar
            </button>

            {/* Exportar */}
            <button className="bg-[#34C759] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2FB350] flex items-center gap-2">
              <Download size={16} />
              Exportar
            </button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {kpis.map((kpi, idx) => (
              <div
                key={idx}
                className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-6"
              >
                <KpiCard {...kpi} />
              </div>
            ))}
          </div>

          {/* TABELAS LADO A LADO: PENDENTES E REALIZADOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* TABELA DE PENDENTES - ESQUERDA */}
            <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">
                  Responsáveis Pendentes
                </h3>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#FF9F0A]/20 text-[#FF9F0A]">
                    {pessoasPendentesUnicas.length} pendentes
                  </span>
                  <button
                    onClick={() => setPendentesExpandido(!pendentesExpandido)}
                    className="p-1 hover:bg-[#2A2A2C] rounded transition-colors"
                    title={pendentesExpandido ? "Recolher" : "Expandir"}
                  >
                    {pendentesExpandido ? (
                      <ChevronUp size={20} className="text-[#BFBFC3]" />
                    ) : (
                      <ChevronDown size={20} className="text-[#BFBFC3]" />
                    )}
                  </button>
                </div>
              </div>
              
              {pendentesExpandido && (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-hide">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-[#1A1A1C] z-10">
                      <tr className="border-b border-[#2A2A2C]">
                        <th className="text-left py-3 px-4 text-sm font-medium text-[#BFBFC3]">
                          Responsável
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-[#BFBFC3]">
                          Turno
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pessoasPendentesUnicas.length === 0 ? (
                        <tr>
                          <td
                            colSpan="2"
                            className="text-center py-8 text-[#BFBFC3]"
                          >
                            Nenhum pendente
                          </td>
                        </tr>
                      ) : (
                        pessoasPendentesUnicas.map((reg, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-[#2A2A2C] hover:bg-[#222] transition-colors"
                          >
                            <td className="py-3 px-4 text-sm">{reg.responsavel}</td>
                            <td className="py-3 px-4 text-sm">
                              <span className="px-2 py-1 rounded text-xs font-medium bg-[#2A2A2C] text-[#BFBFC3]">
                                {reg.turno}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* TABELA DE REALIZADOS - DIREITA */}
            <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">
                  Responsáveis Realizados
                </h3>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#34C759]/20 text-[#34C759]">
                    {pessoasRealizadasUnicas.length} realizados
                  </span>
                  <button
                    onClick={() => setRealizadosExpandido(!realizadosExpandido)}
                    className="p-1 hover:bg-[#2A2A2C] rounded transition-colors"
                    title={realizadosExpandido ? "Recolher" : "Expandir"}
                  >
                    {realizadosExpandido ? (
                      <ChevronUp size={20} className="text-[#BFBFC3]" />
                    ) : (
                      <ChevronDown size={20} className="text-[#BFBFC3]" />
                    )}
                  </button>
                </div>
              </div>
              
              {realizadosExpandido && (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-hide">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-[#1A1A1C] z-10">
                      <tr className="border-b border-[#2A2A2C]">
                        <th className="text-left py-3 px-4 text-sm font-medium text-[#BFBFC3]">
                          Responsável
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-[#BFBFC3]">
                          Turno
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pessoasRealizadasUnicas.length === 0 ? (
                        <tr>
                          <td
                            colSpan="2"
                            className="text-center py-8 text-[#BFBFC3]"
                          >
                            Nenhum realizado
                          </td>
                        </tr>
                      ) : (
                        pessoasRealizadasUnicas.map((reg, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-[#2A2A2C] hover:bg-[#222] transition-colors"
                          >
                            <td className="py-3 px-4 text-sm">{reg.responsavel}</td>
                            <td className="py-3 px-4 text-sm">
                              <span className="px-2 py-1 rounded text-xs font-medium bg-[#2A2A2C] text-[#BFBFC3]">
                                {reg.turno}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ADERÊNCIA POR TURNO - CARDS */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Aderência por Turno</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {dados?.conclusaoPorTurno
                ?.filter((t) => t.turno === "T1" || t.turno === "T2" || t.turno === "T3")
                .map((turno) => (
                  <div
                    key={turno.turno}
                    className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-[#BFBFC3]">
                        {turno.turno}
                      </span>
                      <span
                        className="text-3xl font-bold"
                        style={{
                          color:
                            turno.percentual >= 80
                              ? "#34C759"
                              : turno.percentual >= 50
                              ? "#FF9F0A"
                              : "#FF453A",
                        }}
                      >
                        {turno.percentual}%
                      </span>
                    </div>
                    <div className="w-full bg-[#2A2A2C] rounded-full h-3 mb-3">
                      <div
                        className="h-3 rounded-full transition-all"
                        style={{
                          width: `${turno.percentual}%`,
                          backgroundColor:
                            turno.percentual >= 80
                              ? "#34C759"
                              : turno.percentual >= 50
                              ? "#FF9F0A"
                              : "#FF453A",
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#34C759]">
                        ✓ {turno.realizadas} {turno.realizadas === 1 ? 'pessoa' : 'pessoas'}
                      </span>
                      <span className="text-[#FF9F0A]">
                        ⏰ {turno.total - turno.realizadas} {(turno.total - turno.realizadas) === 1 ? 'pendente' : 'pendentes'}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* GRÁFICO DE ADERÊNCIA GERAL */}
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-6">
              Aderência Geral - Todos os Turnos
            </h3>
            <div className="space-y-6">
              {/* Aderência Geral */}
              <div className="text-center py-6 border-b border-[#2A2A2C]">
                <p className="text-sm text-[#BFBFC3] mb-2">
                  Taxa de Conclusão Geral
                </p>
                <p
                  className="text-6xl font-bold mb-2"
                  style={{
                    color:
                      dados?.taxaConclusao >= 80
                        ? "#34C759"
                        : dados?.taxaConclusao >= 50
                        ? "#FF9F0A"
                        : "#FF453A",
                  }}
                >
                  {dados?.taxaConclusao || 0}%
                </p>
                <p className="text-sm text-[#6F6F73] mb-4">
                  {dados?.realizadas || 0} de {dados?.totalInspecoes || 0}{" "}
                  pessoas realizaram
                </p>

                {/* Percentuais por Turno */}
                <div className="flex justify-center gap-8 mt-6 pt-4 border-t border-[#2A2A2C]">
                  {dados?.conclusaoPorTurno
                    ?.filter((t) => t.turno === "T1" || t.turno === "T2" || t.turno === "T3")
                    .map((turno) => (
                      <div key={turno.turno} className="text-center">
                        <p className="text-xs text-[#BFBFC3] mb-1">
                          {turno.turno}
                        </p>
                        <p
                          className="text-2xl font-bold"
                          style={{
                            color:
                              turno.percentual >= 80
                                ? "#34C759"
                                : turno.percentual >= 50
                                ? "#FF9F0A"
                                : "#FF453A",
                          }}
                        >
                          {turno.percentual}%
                        </p>
                        <p className="text-xs text-[#6F6F73] mt-1">
                          {turno.realizadas}/{turno.total}
                        </p>
                      </div>
                    ))}
                </div>
              </div>

              {/* Gráfico de Barras Comparativo */}
              <div className="space-y-4">
                <p className="text-sm font-medium text-[#BFBFC3] mb-4">
                  Comparativo por Turno
                </p>
                {dados?.conclusaoPorTurno?.map((turno) => (
                  <div key={turno.turno} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-white min-w-[60px]">
                        {turno.turno}
                      </span>
                      <div className="flex-1 mx-4">
                        <div className="w-full bg-[#2A2A2C] rounded-full h-8 relative overflow-hidden">
                          <div
                            className="h-8 rounded-full transition-all flex items-center justify-end pr-3"
                            style={{
                              width: `${turno.percentual}%`,
                              backgroundColor:
                                turno.percentual >= 80
                                  ? "#34C759"
                                  : turno.percentual >= 50
                                  ? "#FF9F0A"
                                  : "#FF453A",
                            }}
                          >
                            <span className="text-xs font-bold text-white">
                              {turno.percentual}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-sm text-[#BFBFC3] min-w-[100px] text-right">
                        {turno.realizadas}/{turno.total}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
