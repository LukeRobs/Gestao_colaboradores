import { useState, useEffect, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  TrendingUp,
  AlertTriangle,
  FileText,
  ShieldAlert,
  Clock,
  User,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import LoadingScreen from "../../components/LoadingScreen";

import DashboardHeader from "../../components/dashboard/DashboardHeader";
import TurnoSelector from "../../components/dashboard/TurnoSelector";
import DateFilter from "../../components/dashboard/DateFilter";
import KpiCardsRow from "../../components/dashboard/KpiCardsRow";
import DistribuicaoGeneroChart from "../../components/dashboard/DistribuicaoGeneroChart";
import StatusColaboradoresSection from "../../components/dashboard/StatusColaboradoresSection";
import AusentesHojeTable from "../../components/dashboard/AusentesHojeTable";
import EmpresasResumoSection from "../../components/dashboard/EmpresasResumoSection";
import ResumoOperacaoCard from "../../components/dashboard/ResumoOperacaoCard";
import DistribuicaoColaboradoresCadastradosChart from "../../components/dashboard/DistribuicaoColaboradoresCadastradosChart";
import HierarquiaSection from "../../components/HierarquiaSection";
import InputsManuaisTable from "../../components/dashboard/InputsManuaisTable";
import FaltasPorTempoCasaChart from "../../components/dashboard/FaltasPorTempoCasaChart";


import { AuthContext } from "../../context/AuthContext";
import { useEstacao } from "../../context/EstacaoContext";
import api from "../../services/api";

/* =====================================================
   ESTADO INICIAL (ALINHADO AO BACKEND)
===================================================== */
const INITIAL_DATA = {
  periodo: { inicio: "", fim: "" },

  kpis: {
    headcountTotal: 0,
    headcountOperacao: 0,
    headcountReturns: 0,
    totalColaboradores: 0,
    presentes: 0,
    absenteismo: 0,
    turnover: 0,
    atestados: 0,
    faltas: 0,
    medidasDisciplinares: 0,
    acidentes: 0,
    idadeMedia: 0,
    tempoMedioEmpresaDias: 0,
  },

  statusColaboradores: {
    ativos: 0,
    afastadosCurto: 0,
    inss: 0,
    ferias: 0,
    inativos: 0,
    indisponiveis: 0,
    percentualIndisponivel: 0,
  },

  genero: [],
  empresasResumo: [],
  escalas: [], 
  setores: [],   
  lideres: [],   
  eventos: [],
  inputsManuais: { total: 0, porColaborador: [], porJustificativa: [] },
  faltasPorTempoCasa: [],
  series: { headcountMensal: [], admissoesMensal: [], desligamentosMensal: [] },
};

export default function DashboardAdmin() {
  /* ================= STATES ================= */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dados, setDados] = useState(INITIAL_DATA);
  const [turno, setTurno] = useState("ALL");
  const [dateRange, setDateRange] = useState({});

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const navigate = useNavigate();
  const { logout, permissions } = useContext(AuthContext);
  const { estacaoId } = useEstacao();

  /* ================= LOAD ================= */
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.get("/dashboard/admin", {
          params: { turno, ...dateRange },
        });

        setDados({
          ...INITIAL_DATA,
          ...res.data?.data,
        });
      } catch (e) {
        if (e.response?.status === 401) {
          logout();
          navigate("/login");
        } else {
          setErro("Erro ao carregar dashboard administrativo");
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [turno, dateRange, logout, navigate, estacaoId]);

  /* ================= KPI CARDS ================= */
  const kpisEstrutura = useMemo(() => {
    const k = dados.kpis;

    return [
      {
        icon: Users,
        label: "Headcount Total (Ativos)",
        value: k.headcountTotal || 0,
      },
      {
        icon: Users,
        label: "Operação",
        value: k.headcountOperacao || 0,
        color: "#3b82f6",
      },
      {
        icon: Users,
        label: "Returns",
        value: k.headcountReturns || 0,
        color: "#FA4C00",
      },
      {
        icon: Users,
        label: "HC Operacional Escalado",
        value: k.totalColaboradores || 0,
      },
    ];
  }, [dados.kpis]);

  const kpisPerformance = useMemo(() => {
    const k = dados.kpis;

    return [
      {
        icon: TrendingUp,
        label: "Absenteísmo",
        value: k.absenteismo || 0,
        suffix: "%",
        color: k.absenteismo > 10 ? "#FF453A" : "#34C759",
      },
      {
        icon: TrendingUp,
        label: "Turnover",
        value: k.turnover || 0,
        suffix: "%",
        color: k.turnover > 5 ? "#FF9F0A" : "#34C759",
      },
      {
        icon: AlertTriangle,
        label: "Faltas",
        value: k.faltas || 0,
        color: "#FF453A",
      },
      {
        icon: FileText,
        label: "Atestados",
        value: k.atestados || 0,
      },
    ];
  }, [dados.kpis]);

  const kpisPessoas = useMemo(() => {
    const k = dados.kpis;

    const idadeMedia = Number.isFinite(k.idadeMedia)
      ? Math.round(k.idadeMedia)
      : 0;

    const mesesEmpresa = Number.isFinite(k.tempoMedioEmpresaDias)
      ? Math.max(0, Math.round(k.tempoMedioEmpresaDias / 30.44))
      : 0;

    return [
      {
        icon: ShieldAlert,
        label: "Medidas Disciplinares",
        value: k.medidasDisciplinares || 0,
      },
      {
        icon: AlertTriangle,
        label: "Acidentes",
        value: k.acidentes || 0,
        color: "#FFD60A",
      },
      {
        icon: User,
        label: "Idade Média",
        value: idadeMedia,
        suffix: " anos",
      },
      {
        icon: Clock,
        label: "Tempo Médio de Empresa",
        value: mesesEmpresa,
        suffix: " meses",
      },
    ];
  }, [dados.kpis]);

  /* ================= COLABORADORES CADASTRADOS ================= */
  const colaboradoresCadastradosData = useMemo(() => {
    const empresas = dados.empresasResumo || [];

    const spx = empresas.find(
      e => e.empresa?.toUpperCase() === "SPX"
    );

    const totalBpo = empresas.find(
      e => e.empresa?.toUpperCase() === "TOTAL BPO"
    );

    return [
      {
        name: "SPX",
        value: spx?.totalColaboradoresCadastrados || 0,
      },
      {
        name: "BPO",
        value: totalBpo?.totalColaboradoresCadastrados || 0,
      },
    ];
  }, [dados.empresasResumo]);

  /* ================= STATUS ================= */
  const statusItems = useMemo(() => {
    const s = dados.statusColaboradores;

    return [
      { label: "Ativos", value: s.ativos },
      { label: "Férias", value: s.ferias },
      { label: "Afastados (≤15d)", value: s.afastadosCurto },
      { label: "INSS (≥16d)", value: s.inss },
      { label: "Inativos", value: s.inativos },
    ];
  }, [dados.statusColaboradores]);

/* ================= EVENTOS ================= */
  const tableColumns = useMemo(
    () => [
      { key: "nome", label: "Colaborador" },
      { key: "empresa", label: "Empresa" },
      { key: "setor", label: "Setor" },
      { key: "lider", label: "Líder" },
      {
        key: "tempoEmpresa",
        label: "Tempo de Empresa",
        render: (v) => v || "-",
      },
      { key: "evento", label: "Evento" },
      {
        key: "reincidente",
        label: "Status",
        render: (_, row) =>
          row.reincidente ? (
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-[#FF453A]/20 text-[#FF453A]">
              Reincidente ({row.qtdeEventos})
            </span>
          ) : (
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-[#34C759]/20 text-[#34C759]">
              Único
            </span>
          ),
      },
      {
        key: "data",
        label: "Data",
        render: (v) =>
          v ? new Date(v).toLocaleDateString("pt-BR") : "-",
      },
    ],
    []
  );

  const eventosOrdenados = useMemo(() => {
    return [...(dados.eventos || [])].sort((a, b) => {
      const peso = (row) => {
        if (row.reincidente) {
          return row.qtdeEventos || 1;
        }
        return 0;
      };

      const diff = peso(b) - peso(a);

      if (diff !== 0) return diff;

      // desempate por data (mais recente primeiro)
      return new Date(b.data) - new Date(a.data);
    });
  }, [dados.eventos]);
  /* ================= RENDER ================= */
  if (loading) {
    return <LoadingScreen message="Carregando dashboard..." />;
  }

  if (erro) {
    return (
      <div className="h-screen flex items-center justify-center text-[#FF453A]">
        {erro}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-page overflow-x-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <div className="lg:pl-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main
          className="
            w-full
            px-4
            sm:px-6
            lg:px-10
            xl:px-14
            2xl:px-20
            py-8
            space-y-10
            max-w-[1600px]
            2xl:max-w-[1750px]
            mx-auto
          "
        >
          <DashboardHeader
            title="Dashboard Administrativo"
            subtitle="Período"
            date={
              dados.periodo.inicio && dados.periodo.fim
                ? `${dados.periodo.inicio} → ${dados.periodo.fim}`
                : "-"
            }
            badges={[`Turno: ${turno === "ALL" ? "Todos" : turno}`]}
          />

          <div className="
            flex
            flex-col
            lg:flex-row
            lg:items-center
            lg:justify-between
            gap-6
          ">
            <TurnoSelector
              value={turno}
              onChange={setTurno}
              options={["ALL", "T1", "T2", "T3"]}
            />

            <DateFilter value={dateRange} onApply={setDateRange} />
          </div>
          
          <div className="
            grid
            grid-cols-1
            lg:grid-cols-3
            2xl:grid-cols-3
            gap-6
          ">

          {/* ================= ESTRUTURA ================= */}
          <div className="bg-page rounded-2xl p-6 border border-default h-full flex flex-col">
            <h3 className="text-sm text-muted mb-8">
              Estrutura do Time
            </h3>

            <div className="
              grid
              grid-cols-1
              md:grid-cols-2
              gap-6
            ">
              {kpisEstrutura.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="flex items-center gap-4 min-h-16">
                    <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center">
                      <Icon size={20} className="text-muted" />
                    </div>
                    <div>
                      <p className="text-sm text-muted leading-tight">{item.label}</p>
                      <p className="text-2xl font-semibold text-white">
                        {item.value}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================= PERFORMANCE ================= */}
          <div className="bg-page rounded-2xl p-6 border border-default h-full flex flex-col">
            <h3 className="text-sm text-muted mb-8">
              Performance Operacional
            </h3>

            <div className="
              grid
              grid-cols-1
              md:grid-cols-2
              gap-6
            ">
              {kpisPerformance.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="flex items-center gap-4 min-h-16">
                    <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center">
                      <Icon size={20} className={item.color || "text-muted"} />
                    </div>
                    <div>
                      <p className="text-sm text-muted leading-tight">{item.label}</p>
                      <p
                        className="text-2xl font-semibold"
                        style={{ color: item.color || "white" }}
                      >
                        {item.value}
                        {item.suffix || ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================= PESSOAS ================= */}
          <div className="bg-page rounded-2xl p-6 border border-default h-full flex flex-col">
            <h3 className="text-sm text-muted mb-8">
              Pessoas & Saúde
            </h3>

            <div className="
              grid
              grid-cols-1
              md:grid-cols-2
              gap-6
            ">
              {kpisPessoas.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="flex items-center gap-4 min-h-16">
                    <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center">
                      <Icon size={20} className={item.color || "text-muted"} />
                    </div>
                    <div>
                      <p className="text-sm text-muted leading-tight">{item.label}</p>
                      <p
                        className="text-2xl font-semibold"
                        style={{ color: item.color || "white" }}
                      >
                        {item.value}
                        {item.suffix || ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

          <div className="
            grid
            grid-cols-1
            md:grid-cols-2
            2xl:grid-cols-3
            gap-6
          ">
            <DistribuicaoGeneroChart
              title="Distribuição por Gênero"
              data={dados.genero}
            />

            <DistribuicaoColaboradoresCadastradosChart
              title="Total de Colaboradores"
              data={colaboradoresCadastradosData}
            />

            <StatusColaboradoresSection
              title="Status dos Colaboradores"
              items={statusItems}
              percentual={dados.statusColaboradores.percentualIndisponivel}
              footer={`${dados.statusColaboradores.percentualIndisponivel}% do time está indisponível hoje (${dados.statusColaboradores.indisponiveis} colaboradores)`}
            />
          </div>

          <EmpresasResumoSection empresas={dados.empresasResumo} />

          {/* ================= HEADCOUNT & MOVIMENTAÇÕES ================= */}
          <div className="bg-surface rounded-xl p-6">
            <h2 className="text-white font-semibold text-base mb-4">Headcount & Movimentações</h2>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart
                data={(dados.series?.headcountMensal || []).map((h, index) => ({
                  mes: h.mes,
                  headcount: h.total,
                  admissoes: dados.series?.admissoesMensal?.[index]?.total || 0,
                  desligamentos: dados.series?.desligamentosMensal?.[index]?.total || 0,
                }))}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="mes" stroke="#BFBFC3" />
                <YAxis stroke="#BFBFC3" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1F1F22", border: "none", borderRadius: 12 }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="headcount"
                  stroke="#FA4C00"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  name="Headcount"
                  label={{ position: "top", fill: "#FFFFFF", fontSize: 12, fontWeight: 600 }}
                />
                <Bar dataKey="admissoes" fill="#34C759" radius={[6, 6, 0, 0]} name="Admissões">
                  <LabelList dataKey="admissoes" position="top" fill="#34C759" fontSize={12} fontWeight={600} />
                </Bar>
                <Bar dataKey="desligamentos" fill="#FF453A" radius={[6, 6, 0, 0]} name="Demissões">
                  <LabelList dataKey="desligamentos" position="top" fill="#FF453A" fontSize={12} fontWeight={600} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="
            grid
            grid-cols-1
            md:grid-cols-2
            gap-6
          ">
            <ResumoOperacaoCard
              title="Escala × Colaborador"
              data={dados.escalas}
              labelKey="escala"
            />

            <ResumoOperacaoCard
              title="Setor × Colaborador"
              data={dados.setores}
              labelKey="setor"
            />
          </div>

          <HierarquiaSection
            resumo={dados.resumoHierarquia}
            hierarquia={dados.hierarquia}
          />

          {permissions?.isAdmin && (
            <InputsManuaisTable data={dados.inputsManuais} />
          )}

          <FaltasPorTempoCasaChart
            title="Faltas por Tempo de Casa"
            data={dados.faltasPorTempoCasa}
          />

          <AusentesHojeTable
            title="Eventos no período (Atestados Médicos, Medidas Disciplinares e Acidentes)"
            data={eventosOrdenados}
            columns={tableColumns}
            getRowKey={(row) => row.id}
            emptyMessage="Nenhum evento no período"
          />
        </main>
      </div>
    </div>
  );
}
