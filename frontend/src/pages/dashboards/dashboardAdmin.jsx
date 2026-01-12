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

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";

import DashboardHeader from "../../components/dashboard/DashboardHeader";
import TurnoSelector from "../../components/dashboard/TurnoSelector";
import DateFilter from "../../components/dashboard/DateFilter";
import KpiCardsRow from "../../components/dashboard/KpiCardsRow";
import DistribuicaoGeneroChart from "../../components/dashboard/DistribuicaoGeneroChart";
import StatusColaboradoresSection from "../../components/dashboard/StatusColaboradoresSection";
import AusentesHojeTable from "../../components/dashboard/AusentesHojeTable";
import EmpresasResumoSection from "../../components/dashboard/EmpresasResumoSection";

import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";

/* =====================================================
   ESTADO INICIAL (ALINHADO AO BACKEND)
===================================================== */
const INITIAL_DATA = {
  periodo: { inicio: "", fim: "" },

  kpis: {
    totalColaboradores: 0,
    presentes: 0,
    absenteismo: 0,
    turnover: 0,
    atestados: 0,
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
  eventos: [],
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
  const { logout } = useContext(AuthContext);

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
          ...res.data.data,
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
  }, [turno, dateRange, logout, navigate]);

 /* ================= KPIs ================= */
const kpis = useMemo(() => {
  const k = dados.kpis;

  const idadeMedia = Number.isFinite(k.idadeMedia)
    ? Math.round(k.idadeMedia)
    : 0;

  // conversão correta: dias → meses reais
  const mesesEmpresa = Number.isFinite(k.tempoMedioEmpresaDias)
    ? Math.max(
        0,
        Math.round(k.tempoMedioEmpresaDias / 30.44)
      )
    : 0;

  return [
    {
      icon: Users,
      label: "Colaboradores",
      value: k.totalColaboradores || 0,
    },
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
      icon: FileText,
      label: "Atestados",
      value: k.atestados || 0,
    },
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
      { key: "evento", label: "Evento" },
      {
        key: "data",
        label: "Data",
        render: (v) =>
          v ? new Date(v).toLocaleDateString("pt-BR") : "-",
      },
    ],
    []
  );

  /* ================= RENDER ================= */
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-[#BFBFC3]">
        Carregando…
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

        <main className="p-8 space-y-10">
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

          <div className="flex flex-wrap gap-6 items-center">
            <TurnoSelector
              value={turno}
              onChange={setTurno}
              options={["ALL", "T1", "T2", "T3"]}
            />

            <DateFilter value={dateRange} onApply={setDateRange} />
          </div>

          <KpiCardsRow items={kpis} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <DistribuicaoGeneroChart
              title="Distribuição por Gênero"
              data={dados.genero}
            />

            <StatusColaboradoresSection
              title="Status dos Colaboradores"
              items={statusItems}
              footer={`Indisponíveis: ${dados.statusColaboradores.percentualIndisponivel}%`}
            />
          </div>

          <EmpresasResumoSection empresas={dados.empresasResumo} />

          <AusentesHojeTable
            title="Eventos no período"
            data={dados.eventos}
            columns={tableColumns}
            getRowKey={(row) => row.id}
            emptyMessage="Nenhum evento no período"
          />
        </main>
      </div>
    </div>
  );
}
