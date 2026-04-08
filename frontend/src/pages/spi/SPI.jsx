import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../components/MainLayout";
import {
  Shield,
  ClipboardCheck,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import DashboardHeader from "../../components/dashboard/DashboardHeader";

import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";

export default function SPI() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("safety"); // "safety", "ddsma" ou "opa"
  
  // Estados Safety Walk
  const [dadosSafety, setDadosSafety] = useState(null);
  const [loadingSafety, setLoadingSafety] = useState(true);
  
  // Estados DDSMA
  const [dadosDDSMA, setDadosDDSMA] = useState(null);
  const [loadingDDSMA, setLoadingDDSMA] = useState(true);
  
  // Estados OPA
  const [dadosOPA, setDadosOPA] = useState(null);
  const [loadingOPA, setLoadingOPA] = useState(true);
  
  // Estados compartilhados
  const [erro, setErro] = useState(null);
  const [filtroTurno, setFiltroTurno] = useState("TODOS");
  const [periodo, setPeriodo] = useState("semana_atual");
  const [semanaSelecionada, setSemanaSelecionada] = useState("");
  const [pendentesExpandido, setPendentesExpandido] = useState(true);
  const [realizadosExpandido, setRealizadosExpandido] = useState(true);

  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);

  /* =====================================================
     LOAD DADOS
  ===================================================== */
  async function loadSafetyWalk() {
    try {
      setLoadingSafety(true);
      const params = {
        periodo,
        turno: filtroTurno !== "TODOS" ? filtroTurno : undefined,
      };
      if (periodo === "semana_especifica" && semanaSelecionada) {
        params.semana = semanaSelecionada;
      }
      const res = await api.get("/safety-walk", { params });
      setDadosSafety(res.data.data);
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
      setLoadingSafety(false);
    }
  }

  async function loadDDSMA() {
    try {
      setLoadingDDSMA(true);
      const params = {
        periodo,
        turno: filtroTurno !== "TODOS" ? filtroTurno : undefined,
      };
      if (periodo === "semana_especifica" && semanaSelecionada) {
        params.semana = semanaSelecionada;
      }
      const res = await api.get("/ddsma", { params });
      setDadosDDSMA(res.data.data);
      setErro(null);
    } catch (e) {
      console.error('Erro ao carregar DDSMA:', e);
      if (e.response?.status === 401) {
        logout();
        navigate("/login");
      } else {
        setErro("Erro ao carregar dados do DDSMA");
      }
    } finally {
      setLoadingDDSMA(false);
    }
  }

  async function loadOPA() {
    try {
      setLoadingOPA(true);
      const params = {
        periodo,
        turno: filtroTurno !== "TODOS" ? filtroTurno : undefined,
      };
      if (periodo === "semana_especifica" && semanaSelecionada) {
        params.semana = semanaSelecionada;
      }
      const res = await api.get("/opa", { params });
      setDadosOPA(res.data.data);
      setErro(null);
    } catch (e) {
      console.error('Erro ao carregar OPA:', e);
      if (e.response?.status === 401) {
        logout();
        navigate("/login");
      } else {
        setErro("Erro ao carregar dados do OPA");
      }
    } finally {
      setLoadingOPA(false);
    }
  }

  useEffect(() => {
    loadSafetyWalk();
    loadDDSMA();
    loadOPA();
  }, [periodo, filtroTurno, semanaSelecionada]);

  /* =====================================================
     SELEÇÃO DE ABA
  ===================================================== */

  /* =====================================================
     PROCESSAR DADOS
  ===================================================== */
  const dados = abaAtiva === "safety" ? dadosSafety : abaAtiva === "ddsma" ? dadosDDSMA : dadosOPA;
  
  const dadosFiltrados = dados?.registros || [];

  // Para DDSMA os registros já vêm consolidados por pessoa com campo `status`
  // Para Safety/OPA mantém lógica original (deduplicação por Map)
  let pessoasPendentesUnicas, pessoasRealizadasUnicas;

  if (abaAtiva === "ddsma") {
    pessoasPendentesUnicas = dadosFiltrados.filter(r => r.status === 'PENDENTE');
    pessoasRealizadasUnicas = dadosFiltrados.filter(r => r.status === 'REALIZADO');
  } else {
    const mapPendentes = new Map();
    const mapRealizadas = new Map();
    dadosFiltrados.forEach(reg => {
      const key = reg.responsavel;
      if (reg.status === 'PENDENTE') {
        if (!mapPendentes.has(key)) mapPendentes.set(key, reg);
      } else if (reg.status === 'REALIZADO') {
        if (!mapRealizadas.has(key)) mapRealizadas.set(key, reg);
      }
    });
    pessoasPendentesUnicas = Array.from(mapPendentes.values());
    pessoasRealizadasUnicas = Array.from(mapRealizadas.values());
  }

  const semanasDisponiveis = dados?.semanasDisponiveis || [];
  const semanaAtual = dados?.semanaAtual || '';

  // Filtrar semanas até a atual (não mostrar semanas futuras)
  const semanaAtualNum = semanaAtual ? parseInt(semanaAtual.replace('W', '')) : 0;
  const semanasAteAtual = semanasDisponiveis.filter(s => {
    const num = parseInt(s.replace('W', ''));
    return num <= semanaAtualNum;
  });

  /* =====================================================
     KPIs CONSOLIDADOS
  ===================================================== */
  const kpisSafety = {
    icon: ClipboardCheck,
    label: "Safety Walk",
    total: dadosSafety?.totalInspecoes || 0,
    realizadas: dadosSafety?.realizadas || 0,
    pendentes: dadosSafety?.pendentes || 0,
    taxa: dadosSafety?.taxaConclusao || 0,
    color: "#007AFF",
  };

  const kpisDDSMA = {
    icon: Shield,
    label: "DDSMA",
    total: dadosDDSMA?.totalInspecoes || 0,
    realizadas: dadosDDSMA?.realizadas || 0,
    pendentes: dadosDDSMA?.pendentes || 0,
    taxa: dadosDDSMA?.taxaConclusao || 0,
    color: "#FF9F0A",
  };

  const kpisOPA = {
    icon: AlertTriangle,
    label: "OPA",
    total: dadosOPA?.totalInspecoes || 0,
    realizadas: dadosOPA?.realizadas || 0,
    pendentes: dadosOPA?.pendentes || 0,
    taxa: dadosOPA?.taxaConclusao || 0,
    color: "#FF453A",
  };

  /* =====================================================
     RENDER
  ===================================================== */

  // Skeleton shimmer igual ao dashboardDesligamento
  function Skeleton({ h = "h-48", w = "w-full" }) {
    return (
      <div className={`${h} ${w} rounded-2xl bg-white/[0.04] overflow-hidden relative`}>
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>
    );
  }

  if (loadingSafety && loadingDDSMA && loadingOPA) {
    return (
      <div className="flex min-h-screen bg-page text-page">
        <Sidebar isOpen={false} onClose={() => {}} />
        <MainLayout>
          <Header onMenuClick={() => {}} />
          <main className="p-8 space-y-8">
            {/* Header */}
            <Skeleton h="h-12" />

            {/* 3 cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} h="h-48" />
              ))}
            </div>

            {/* Filtros */}
            <div className="flex gap-4">
              <Skeleton h="h-10" w="w-36" />
              <Skeleton h="h-10" w="w-36" />
              <Skeleton h="h-10" w="w-40" />
            </div>

            {/* Tabelas pendentes/realizados */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton h="h-72" />
              <Skeleton h="h-72" />
            </div>

            {/* Gráficos por turno */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} h="h-64" />
              ))}
            </div>

            {/* Aderência geral */}
            <Skeleton h="h-48" />
          </main>
        </MainLayout>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="h-screen flex items-center justify-center bg-page text-[#FF453A]">
        {erro}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-page text-page">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 space-y-8">
          {/* HEADER */}
          <DashboardHeader
            title="SPI - Sistema de Performance Integrado"
            subtitle="Safety Walk, DDSMA & OPA"
            date={new Date().toLocaleDateString("pt-BR")}
          />

          {/* CARDS LADO A LADO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* CARD SAFETY WALK */}
            <div 
              onClick={() => setAbaAtiva("safety")}
              className={`bg-surface border-2 rounded-xl p-6 transition-all cursor-pointer hover:shadow-xl ${
                abaAtiva === "safety" ? "border-[#007AFF]" : "border-default hover:border-[#007AFF]/50"
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-[#007AFF]/20">
                  <ClipboardCheck size={24} className="text-[#007AFF]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Safety Walk</h3>
                  <p className="text-xs text-muted">Inspeções de Segurança</p>
                </div>
              </div>
              <div className="text-center mb-4">
                <p className="text-4xl font-bold" style={{
                  color: kpisSafety.taxa >= 80 ? "#34C759" : kpisSafety.taxa >= 50 ? "#FF9F0A" : "#FF453A"
                }}>
                  {kpisSafety.taxa}%
                </p>
                <p className="text-xs text-[#6F6F73] mt-1">Taxa de Conclusão</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-page rounded-xl">
                  <p className="text-xl font-bold text-white">{kpisSafety.total}</p>
                  <p className="text-xs text-muted mt-1">Total</p>
                </div>
                <div className="text-center p-3 bg-[#34C759]/10 rounded-xl">
                  <p className="text-xl font-bold text-[#34C759]">{kpisSafety.realizadas}</p>
                  <p className="text-xs text-muted mt-1">Realizadas</p>
                </div>
                <div className="text-center p-3 bg-[#FF9F0A]/10 rounded-xl">
                  <p className="text-xl font-bold text-[#FF9F0A]">{kpisSafety.pendentes}</p>
                  <p className="text-xs text-muted mt-1">Pendentes</p>
                </div>
              </div>
            </div>

            {/* CARD DDSMA */}
            <div 
              onClick={() => setAbaAtiva("ddsma")}
              className={`bg-surface border-2 rounded-xl p-6 transition-all cursor-pointer hover:shadow-xl ${
                abaAtiva === "ddsma" ? "border-[#FF9F0A]" : "border-default hover:border-[#FF9F0A]/50"
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-[#FF9F0A]/20">
                  <Shield size={24} className="text-[#FF9F0A]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">DDSMA</h3>
                  <p className="text-xs text-muted">Diálogo Diário de Segurança</p>
                </div>
              </div>
              <div className="text-center mb-4">
                <p className="text-4xl font-bold" style={{
                  color: kpisDDSMA.taxa >= 80 ? "#34C759" : kpisDDSMA.taxa >= 50 ? "#FF9F0A" : "#FF453A"
                }}>
                  {kpisDDSMA.taxa}%
                </p>
                <p className="text-xs text-[#6F6F73] mt-1">Taxa de Conclusão</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-page rounded-xl">
                  <p className="text-xl font-bold text-white">{kpisDDSMA.total}</p>
                  <p className="text-xs text-muted mt-1">Total</p>
                </div>
                <div className="text-center p-3 bg-[#34C759]/10 rounded-xl">
                  <p className="text-xl font-bold text-[#34C759]">{kpisDDSMA.realizadas}</p>
                  <p className="text-xs text-muted mt-1">Realizadas</p>
                </div>
                <div className="text-center p-3 bg-[#FF9F0A]/10 rounded-xl">
                  <p className="text-xl font-bold text-[#FF9F0A]">{kpisDDSMA.pendentes}</p>
                  <p className="text-xs text-muted mt-1">Pendentes</p>
                </div>
              </div>
            </div>

            {/* CARD OPA */}
            <div 
              onClick={() => setAbaAtiva("opa")}
              className={`bg-surface border-2 rounded-xl p-6 transition-all cursor-pointer hover:shadow-xl ${
                abaAtiva === "opa" ? "border-[#FF453A]" : "border-default hover:border-[#FF453A]/50"
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-[#FF453A]/20">
                  <AlertTriangle size={24} className="text-[#FF453A]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">OPA</h3>
                  <p className="text-xs text-muted">Observação Preventiva de Atos</p>
                </div>
              </div>
              <div className="text-center mb-4">
                <p className="text-4xl font-bold" style={{
                  color: kpisOPA.taxa >= 80 ? "#34C759" : kpisOPA.taxa >= 50 ? "#FF9F0A" : "#FF453A"
                }}>
                  {kpisOPA.taxa}%
                </p>
                <p className="text-xs text-[#6F6F73] mt-1">Taxa de Conclusão</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-page rounded-xl">
                  <p className="text-xl font-bold text-white">{kpisOPA.total}</p>
                  <p className="text-xs text-muted mt-1">Total</p>
                </div>
                <div className="text-center p-3 bg-[#34C759]/10 rounded-xl">
                  <p className="text-xl font-bold text-[#34C759]">{kpisOPA.realizadas}</p>
                  <p className="text-xs text-muted mt-1">Realizadas</p>
                </div>
                <div className="text-center p-3 bg-[#FF9F0A]/10 rounded-xl">
                  <p className="text-xl font-bold text-[#FF9F0A]">{kpisOPA.pendentes}</p>
                  <p className="text-xs text-muted mt-1">Pendentes</p>
                </div>
              </div>
            </div>
          </div>

          {/* INDICADOR CENTRALIZADO */}
          <div className="flex items-center justify-center gap-3">
            {/* Traço Safety Walk */}
            <div 
              className={`h-1 w-16 rounded-full transition-all duration-300 ${
                abaAtiva === "safety" ? "bg-[#007AFF]" : "bg-surface-2"
              }`}
            ></div>
            
            {/* Traço DDSMA */}
            <div 
              className={`h-1 w-16 rounded-full transition-all duration-300 ${
                abaAtiva === "ddsma" ? "bg-[#FF9F0A]" : "bg-surface-2"
              }`}
            ></div>
            
            {/* Traço OPA */}
            <div 
              className={`h-1 w-16 rounded-full transition-all duration-300 ${
                abaAtiva === "opa" ? "bg-[#FF453A]" : "bg-surface-2"
              }`}
            ></div>
          </div>

          {/* Texto do indicador */}
          <div className="text-center">
            <p className="text-sm font-medium" style={{
              color: abaAtiva === "safety" ? "#007AFF" : abaAtiva === "ddsma" ? "#FF9F0A" : "#FF453A"
            }}>
              Visualizando {abaAtiva === "safety" ? "Safety Walk" : abaAtiva === "ddsma" ? "DDSMA" : "OPA"}
            </p>
          </div>

          {/* FILTROS */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPeriodo("semana_atual");
                  setSemanaSelecionada("");
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  periodo === "semana_atual"
                    ? "bg-[#FA4C00] text-white"
                    : "bg-surface text-muted hover:bg-surface-3"
                }`}
              >
                Esta Semana {semanaAtual && `(${semanaAtual})`}
              </button>
              <button
                onClick={() => setPeriodo("semana_especifica")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  periodo === "semana_especifica"
                    ? "bg-[#FA4C00] text-white"
                    : "bg-surface text-muted hover:bg-surface-3"
                }`}
              >
                Por Semana
              </button>
            </div>

            {periodo === "semana_especifica" && (
              <select
                value={semanaSelecionada}
                onChange={(e) => setSemanaSelecionada(e.target.value)}
                className="bg-surface border border-default px-4 py-2 rounded-lg text-sm scrollbar-hide overflow-y-hidden"
                size={1}
              >
                <option value="">Selecione uma semana</option>
                {semanasAteAtual.map((semana) => (
                  <option key={semana} value={semana}>
                    {semana}
                  </option>
                ))}
              </select>
            )}

            <select
              value={filtroTurno}
              onChange={(e) => setFiltroTurno(e.target.value)}
              className="bg-surface border border-default px-4 py-2 rounded-lg text-sm"
            >
              <option value="TODOS">Todos os Turnos</option>
              <option value="T1">Turno 1</option>
              <option value="T2">Turno 2</option>
              <option value="T3">Turno 3</option>
              <option value="ADM">Administrativo</option>
            </select>

            <button
              onClick={() => {
                loadSafetyWalk();
                loadDDSMA();
                loadOPA();
              }}
              className="ml-auto bg-surface border border-default px-4 py-2 rounded-lg text-sm hover:bg-surface-3 flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Atualizar
            </button>

            <button className="bg-[#34C759] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2FB350] flex items-center gap-2">
              <Download size={16} />
              Exportar
            </button>
          </div>

          {/* TABELAS LADO A LADO: PENDENTES E REALIZADOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PENDENTES */}
            <div className="bg-surface border border-default rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Responsáveis Pendentes</h3>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#FF9F0A]/20 text-[#FF9F0A]">
                    {pessoasPendentesUnicas.length} pendentes
                  </span>
                  <button
                    onClick={() => setPendentesExpandido(!pendentesExpandido)}
                    className="p-1 hover:bg-surface-2 rounded transition-colors"
                  >
                    {pendentesExpandido ? (
                      <ChevronUp size={20} className="text-muted" />
                    ) : (
                      <ChevronDown size={20} className="text-muted" />
                    )}
                  </button>
                </div>
              </div>
              
              {pendentesExpandido && (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-hide">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-surface z-10">
                      <tr className="border-b border-default">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted">
                          Nome
                        </th>
                        {abaAtiva === "ddsma" && (
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted">
                            Progresso
                          </th>
                        )}
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted">
                          Cargo
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted">
                          Turno
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pessoasPendentesUnicas.length === 0 ? (
                        <tr>
                          <td colSpan={abaAtiva === "ddsma" ? "4" : "3"} className="text-center py-8 text-muted">
                            Nenhum pendente
                          </td>
                        </tr>
                      ) : (
                        pessoasPendentesUnicas.map((reg, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-default hover:bg-surface-3 transition-colors"
                          >
                            <td className="py-3 px-4 text-sm">{reg.responsavel}</td>
                            {abaAtiva === "ddsma" && (
                              <td className="py-3 px-4 text-sm">
                                <span className="px-2 py-1 rounded text-xs font-medium bg-[#FF9F0A]/20 text-[#FF9F0A]">
                                  {reg.progresso || `0/5`}
                                </span>
                              </td>
                            )}
                            <td className="py-3 px-4 text-sm text-muted">{reg.cargo || '-'}</td>
                            <td className="py-3 px-4 text-sm">
                              <span className="px-2 py-1 rounded text-xs font-medium bg-surface-2 text-muted">
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

            {/* REALIZADOS */}
            <div className="bg-surface border border-default rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Responsáveis Realizados</h3>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#34C759]/20 text-[#34C759]">
                    {pessoasRealizadasUnicas.length} realizados
                  </span>
                  <button
                    onClick={() => setRealizadosExpandido(!realizadosExpandido)}
                    className="p-1 hover:bg-surface-2 rounded transition-colors"
                  >
                    {realizadosExpandido ? (
                      <ChevronUp size={20} className="text-muted" />
                    ) : (
                      <ChevronDown size={20} className="text-muted" />
                    )}
                  </button>
                </div>
              </div>
              
              {realizadosExpandido && (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-hide">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-surface z-10">
                      <tr className="border-b border-default">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted">
                          Nome
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted">
                          Cargo
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted">
                          Turno
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pessoasRealizadasUnicas.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="text-center py-8 text-muted">
                            Nenhum realizado
                          </td>
                        </tr>
                      ) : (
                        pessoasRealizadasUnicas.map((reg, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-default hover:bg-surface-3 transition-colors"
                          >
                            <td className="py-3 px-4 text-sm">{reg.responsavel}</td>
                            <td className="py-3 px-4 text-sm text-muted">{reg.cargo || '-'}</td>
                            <td className="py-3 px-4 text-sm">
                              <span className="px-2 py-1 rounded text-xs font-medium bg-surface-2 text-muted">
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

          {/* ADERÊNCIA POR TURNO */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Aderência por Turno</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {dados?.conclusaoPorTurno
                ?.filter((t) => t.turno === "T1" || t.turno === "T2" || t.turno === "T3")
                .map((turno) => {
                  const pendentes = turno.total - turno.realizadas;
                  const cor = turno.percentual >= 80 ? "#34C759" : turno.percentual >= 50 ? "#FF9F0A" : "#FF453A";
                  
                  // Gráfico circular para DDSMA, barra horizontal para Safety, barra vertical para OPA
                  if (abaAtiva === "ddsma") {
                    const radius = 70;
                    const circumference = 2 * Math.PI * radius;
                    const strokeDashoffset = circumference - (turno.percentual / 100) * circumference;
                    
                    return (
                      <div
                        key={turno.turno}
                        className="bg-surface border border-default rounded-xl p-6 flex flex-col items-center"
                      >
                        <div className="relative w-40 h-40 mb-4">
                          <svg className="transform -rotate-90 w-40 h-40">
                            <circle
                              cx="80"
                              cy="80"
                              r={radius}
                              stroke="#2A2A2C"
                              strokeWidth="16"
                              fill="none"
                            />
                            <circle
                              cx="80"
                              cy="80"
                              r={radius}
                              stroke={cor}
                              strokeWidth="16"
                              fill="none"
                              strokeDasharray={circumference}
                              strokeDashoffset={strokeDashoffset}
                              strokeLinecap="round"
                              className="transition-all duration-1000 ease-out"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold" style={{ color: cor }}>
                              {turno.percentual}%
                            </span>
                            <span className="text-xs text-[#6F6F73] mt-1">
                              {turno.realizadas}/{turno.total}
                            </span>
                          </div>
                        </div>
                        <h4 className="text-lg font-semibold mb-3">{turno.turno}</h4>
                        <div className="w-full space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted">✓ Realizadas</span>
                            <span className="font-medium text-[#34C759]">{turno.realizadas}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted">⏰ Pendentes</span>
                            <span className="font-medium text-[#FF9F0A]">{pendentes}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm pt-2 border-t border-default">
                            <span className="text-muted">Total</span>
                            <span className="font-medium text-white">{turno.total}</span>
                          </div>
                        </div>
                      </div>
                    );
                  } else if (abaAtiva === "opa") {
                    // OPA - Barra vertical
                    return (
                      <div
                        key={turno.turno}
                        className="bg-surface border border-default rounded-xl p-6 flex flex-col items-center"
                      >
                        <h4 className="text-lg font-semibold mb-4">{turno.turno}</h4>
                        <div className="flex items-end justify-center gap-4 h-48 mb-4">
                          {/* Barra de Realizadas */}
                          <div className="flex flex-col items-center">
                            <div className="relative w-16 bg-surface-2 rounded-t-lg overflow-hidden" style={{ height: '192px' }}>
                              <div
                                className="absolute bottom-0 w-full bg-[#34C759] transition-all duration-1000 ease-out rounded-t-lg flex items-end justify-center pb-2"
                                style={{
                                  height: `${(turno.realizadas / turno.total) * 100}%`,
                                }}
                              >
                                <span className="text-xs font-bold text-white">{turno.realizadas}</span>
                              </div>
                            </div>
                            <span className="text-xs text-muted mt-2">Realizadas</span>
                          </div>
                          {/* Barra de Pendentes */}
                          <div className="flex flex-col items-center">
                            <div className="relative w-16 bg-surface-2 rounded-t-lg overflow-hidden" style={{ height: '192px' }}>
                              <div
                                className="absolute bottom-0 w-full bg-[#FF9F0A] transition-all duration-1000 ease-out rounded-t-lg flex items-end justify-center pb-2"
                                style={{
                                  height: `${(pendentes / turno.total) * 100}%`,
                                }}
                              >
                                <span className="text-xs font-bold text-white">{pendentes}</span>
                              </div>
                            </div>
                            <span className="text-xs text-muted mt-2">Pendentes</span>
                          </div>
                        </div>
                        <div className="w-full text-center">
                          <p className="text-3xl font-bold mb-1" style={{ color: cor }}>
                            {turno.percentual}%
                          </p>
                          <p className="text-xs text-[#6F6F73]">
                            {turno.realizadas}/{turno.total} concluídas
                          </p>
                        </div>
                      </div>
                    );
                  } else {
                    // Safety Walk - Barra horizontal
                    return (
                      <div
                        key={turno.turno}
                        className="bg-surface border border-default rounded-xl p-6"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm font-medium text-muted">
                            {turno.turno}
                          </span>
                          <span
                            className="text-3xl font-bold"
                            style={{ color: cor }}
                          >
                            {turno.percentual}%
                          </span>
                        </div>
                        <div className="w-full bg-surface-2 rounded-full h-3 mb-3">
                          <div
                            className="h-3 rounded-full transition-all"
                            style={{
                              width: `${turno.percentual}%`,
                              backgroundColor: cor,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#34C759]">
                            ✓ {turno.realizadas} {turno.realizadas === 1 ? 'pessoa' : 'pessoas'}
                          </span>
                          <span className="text-[#FF9F0A]">
                            ⏰ {pendentes} {pendentes === 1 ? 'pendente' : 'pendentes'}
                          </span>
                        </div>
                      </div>
                    );
                  }
                })}
            </div>
          </div>

          {/* GRÁFICO DE ADERÊNCIA GERAL */}
          <div className="bg-surface border border-default rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-6">
              Aderência Geral - Todos os Turnos
            </h3>
            <div className="space-y-6">
              <div className="text-center py-6 border-b border-default">
                <p className="text-sm text-muted mb-2">
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
                  {dados?.realizadas || 0} de {dados?.totalInspecoes || 0} pessoas realizaram
                </p>

                <div className="flex justify-center gap-8 mt-6 pt-4 border-t border-default">
                  {dados?.conclusaoPorTurno
                    ?.filter((t) => t.turno === "T1" || t.turno === "T2" || t.turno === "T3")
                    .map((turno) => (
                      <div key={turno.turno} className="text-center">
                        <p className="text-xs text-muted mb-1">{turno.turno}</p>
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

              <div className="space-y-4">
                <p className="text-sm font-medium text-muted mb-4">
                  Comparativo por Turno
                </p>
                {dados?.conclusaoPorTurno?.map((turno) => (
                  <div key={turno.turno} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-white min-w-[60px]">
                        {turno.turno}
                      </span>
                      <div className="flex-1 mx-4">
                        <div className="w-full bg-surface-2 rounded-full h-8 relative overflow-hidden">
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
                      <span className="text-sm text-muted min-w-[100px] text-right">
                        {turno.realizadas}/{turno.total}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </MainLayout>
    </div>
  );
}