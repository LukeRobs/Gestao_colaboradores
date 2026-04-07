import { useState, useEffect, useContext, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Clock, TrendingUp, Building2 } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import "react-day-picker/dist/style.css";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";

import DashboardHeader from "../../components/dashboard/DashboardHeader";
import TurnoSelector from "../../components/dashboard/TurnoSelector";
import KpiCardsRow from "../../components/dashboard/KpiCardsRow";
import EmpresasSection from "../../components/dashboard/EmpresasSection";
import DistribuicaoGeneroChart from "../../components/dashboard/DistribuicaoGeneroChart";
import StatusColaboradoresSection from "../../components/dashboard/StatusColaboradoresSection";
import AusentesHojeTable from "../../components/dashboard/AusentesHojeTable";
import SetorDistribuicaoSection from "../../components/dashboard/SetorDistribuicaoSection";
import TendenciaAbsenteismoChart from "../../components/dashboard/TendenciaAbsenteismoChart";
import DistribuicaoVinculoChart from "../../components/dashboard/DistribuicaoVinculoChart";
import { exportOperationalReport } from "../../reports/exportOperationalReport";
import { Download } from "lucide-react";


import { AuthContext } from "../../context/AuthContext";
import { useEstacao } from "../../context/EstacaoContext";
import api from "../../services/api";

export default function DashboardOperacional() {
  /* =====================================================
     STATES
  ===================================================== */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dados, setDados] = useState(null);
  const [turnoSelecionado, setTurnoSelecionado] = useState("T1"); // default T1
  const [turnoAtual, setTurnoAtual] = useState(null); // informativo
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  /* 📅 DATE PICKER */
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draftRange, setDraftRange] = useState({ from: null, to: null });
  const [appliedRange, setAppliedRange] = useState(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return { from: hoje, to: hoje };
  });

  const calendarRef = useRef(null);
  const isFirstRender = useRef(true);

  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);
  const { estacaoId } = useEstacao();

  /* =====================================================
     LOAD DASHBOARD
  ===================================================== */
  async function loadDashboard(range = {}) {
    try {
      setLoading(true);

      const params = range.from
        ? {
            dataInicio: range.from.toISOString().slice(0, 10),
            dataFim: (range.to || range.from).toISOString().slice(0, 10),
          }
        : {};

      if (estacaoId) params.estacaoId = estacaoId;

      const res = await api.get("/dashboard", { params });
      const payload = res.data.data;

      setDados(payload);
      setTurnoAtual(payload.turnoAtual);
    } catch (e) {
      if (e.response?.status === 401) {
        logout();
        navigate("/login");
      } else {
        setErro("Erro ao carregar dashboard");
      }
    } finally {
      setLoading(false);
    }
  }
  async function handleExportReport() {
    try {
      const params = {
        turno: turnoSelecionado,
      };

      if (appliedRange?.from) {
        params.dataInicio = appliedRange.from
          .toISOString()
          .slice(0, 10);

        params.dataFim = (appliedRange.to || appliedRange.from)
          .toISOString()
          .slice(0, 10);
      }

      if (estacaoId) params.estacaoId = estacaoId;

      const res = await api.get("/dashboard", { params });

      navigate("/report", {
        state: {
          dashboardData: res.data.data, // 🔥 payload completo
          turno: turnoSelecionado,
          periodo: appliedRange,
        },
      });
    } catch (err) {
      console.error("Erro ao exportar relatório:", err);
      alert("Erro ao gerar relatório");
    }
  }

  /* LOAD INICIAL */
  useEffect(() => {
    isFirstRender.current = true;
    loadDashboard(appliedRange);
  }, [estacaoId]);

  /* LOAD QUANDO RANGE APLICADO MUDA — ignora o mount inicial */
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (appliedRange.from) loadDashboard(appliedRange);
  }, [appliedRange]);

  /* FECHAR CALENDÁRIO AO CLICAR FORA */
  useEffect(() => {
    function handleClickOutside(e) {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setCalendarOpen(false);
      }
    }

    if (calendarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [calendarOpen]);

  /* =====================================================
     TURNO SELECIONADO
  ===================================================== */
  const turnoData = useMemo(() => {
    return (
      dados?.distribuicaoTurnoSetor?.find((t) => t.turno === turnoSelecionado) || {
        totalEscalados: 0,
        presentes: 0,
        ausentes: 0,
        diaristasPresentes: 0,
        setores: [],
      }
    );
  }, [dados, turnoSelecionado]);

  /* =====================================================
    KPIs — POR TURNO (FONTE ÚNICA)
  ===================================================== */
  const totalColaboradores = turnoData.totalEscalados || 0;
  const presentes = turnoData.presentes || 0;
  const ausencias = turnoData.ausentes || 0;

  const diaristasPlanejados = turnoData.diaristasPlanejados || 0;
  const diaristasPresentes = turnoData.diaristasPresentes || 0;

  const aderenciaDW = Number(turnoData.aderenciaDW || 0);

  const shareDiaristas =
    presentes > 0
      ? Number(((diaristasPresentes / presentes) * 100).toFixed(2))
      : 0;

  const absenteismoTurno =
  totalColaboradores > 0
    ? Number(((ausencias / totalColaboradores) * 100).toFixed(2))
    : 0;


  const kpis = useMemo(
    () => [
      {
        icon: Users,
        label: "Colaboradores Planejados",
        value: totalColaboradores,
      },
      {
        icon: Clock,
        label: "Colaboradores Presentes",
        value: presentes,
      },
      {
        icon: Users,
        label: "Ausências",
        value: ausencias,
        color: "#d6000e",
      },
      {
        icon: TrendingUp,
        label: "Absenteísmo",
        value: absenteismoTurno,
        suffix: "%",
        color: absenteismoTurno <= 3.4 ? "#34C759" : "#d6000e",
      },
      {
        icon: Users,
        label: "Diaristas Planejados",
        value: diaristasPlanejados,
      },
      {
        icon: Users,
        label: "Diaristas Presentes",
        value: diaristasPresentes,
      },
      {
        icon: TrendingUp,
        label: "Aderência DW",
        value: aderenciaDW,
        suffix: "%",
        color: aderenciaDW >= 95 ? "#34C759" : "#FF9F0A",
      },
      {
        icon: TrendingUp,
        label: "Share de Diaristas",
        value: shareDiaristas,
        suffix: "%",
        color: shareDiaristas <= 10 ? "#34C759" : "#d6000e",
      },
    ],
    [
      totalColaboradores,
      presentes,
      ausencias,
      absenteismoTurno,
      diaristasPlanejados,
      diaristasPresentes,
      aderenciaDW,
      shareDiaristas,
    ]
  );


  /* =====================================================
     DADOS AUXILIARES
  ===================================================== */
  const tendenciaData = useMemo(
    () => dados?.tendenciaPorDia || [],
    [dados]
  );

  const statusItems = useMemo(
    () =>
      (dados?.statusColaboradoresPorTurno?.[turnoSelecionado] || []).map((s) => ({
        label: s.status,
        value: s.quantidade,
      })),
    [dados, turnoSelecionado]
  );

  const ausentesTurno = useMemo(
    () => dados?.ausenciasHoje?.filter((a) => a.turno === turnoSelecionado) || [],
    [dados, turnoSelecionado]
  );

  const setoresItems = useMemo(
    () =>
      (turnoData.setores || []).map((s) => ({
        label: s.setor,
        value: s.quantidade,
      })),
    [turnoData]
  );

  const empresasItems = useMemo(
    () =>
      (dados?.empresaPorTurno?.[turnoSelecionado] || []).map((e) => ({
        empresa: e.empresa,
        total: e.total,
        faltas: e.faltas,
        atestados: e.atestados,
        ausencias: e.ausencias,
        absenteismo: e.absenteismo,
      })),
    [dados, turnoSelecionado]
  );


  const vinculoData = useMemo(
    () => dados?.distribuicaoVinculoPorTurno?.[turnoSelecionado] || [],
    [dados, turnoSelecionado]
  );


  /* =====================================================
     RENDER
  ===================================================== */
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-muted">
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
    <div className="flex min-h-screen bg-page text-page overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:ml-64 min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />

      <main
        id="dashboard-operacional-export"
        className="
          p-6 
          xl:p-10 
          2xl:px-20
          space-y-10
          max-w-[1600px]
          mx-auto
        "
      >
          <DashboardHeader
            title="Dashboard Operacional"
            subtitle="Dia operacional"
            date={dados.dataOperacional}
            badges={[`Turno atual: ${turnoAtual}`]}
          />

          {/* DATE RANGE PICKER */}
          <div className="relative w-fit" ref={calendarRef}>
            <button
              onClick={() => setCalendarOpen((v) => !v)}
              className="bg-surface border border-default px-4 py-2 rounded-lg text-sm hover:bg-surface-3"
            >
              📅{" "}
              {appliedRange.from
                ? appliedRange.to
                  ? `${appliedRange.from.toLocaleDateString("pt-BR")} - ${appliedRange.to.toLocaleDateString("pt-BR")}`
                  : appliedRange.from.toLocaleDateString("pt-BR")
                : "Selecionar período"}
            </button>

            {calendarOpen && (
              <div className="absolute z-50 mt-2 bg-page border border-default rounded-xl p-4 shadow-xl">
                <DayPicker
                  mode="range"
                  selected={draftRange}
                  onSelect={setDraftRange}
                  numberOfMonths={window.innerWidth < 768 ? 1 : 2}
                  locale={ptBR}
                />

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => {
                      setDraftRange({ from: null, to: null });
                      setCalendarOpen(false);
                    }}
                    className="text-xs text-muted"
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={() => {
                      if (!draftRange.from) return;
                      setAppliedRange({
                        from: draftRange.from,
                        to: draftRange.to || draftRange.from,
                      });
                      setCalendarOpen(false);
                    }}
                    className="bg-[#FA4C00] px-4 py-1.5 rounded-md text-sm font-medium"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <TurnoSelector
              value={turnoSelecionado}
              onChange={setTurnoSelecionado}
              options={["T1", "T2", "T3"]}
            />
          <button
            type="button"
            onClick={handleExportReport}
            className="
              flex items-center gap-2
              bg-surface
              border border-default
              px-4 py-2
              rounded-lg
              text-sm
              hover:bg-surface-3
              transition
            "
          >
            <Download size={16} />
            Exportar relatório
          </button>
          </div>


          <KpiCardsRow items={kpis} />

          <EmpresasSection title="Quantidade por Empresa" items={empresasItems} />

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
            <DistribuicaoGeneroChart
              title="Distribuição por Gênero"
              data={dados.generoPorTurno?.[turnoSelecionado] || []}
            />
            <DistribuicaoVinculoChart
              title="Total Colaboradores - SPX x BPO"
              data={vinculoData}
            />
            <StatusColaboradoresSection
              title="Status dos Colaboradores"
              items={statusItems}
            />
          </div>

          <SetorDistribuicaoSection
            title="Presença por Setor"
            items={setoresItems}
          />

          <TendenciaAbsenteismoChart
            title="Curva de Absenteísmo (%)"
            data={tendenciaData}
          />

          <AusentesHojeTable
            title={`Ausentes no turno — ${turnoSelecionado}`}
            data={ausentesTurno}
            columns={[
              { key: "nome", label: "Colaborador" },
              { key: "motivo", label: "Motivo" },
              { key: "setor", label: "Setor" },
              { key: "empresa", label: "Empresa" },
              { key: "tempoCasa", label: "Tempo de Casa" }
            ]}
            getRowKey={(row) => row.colaboradorId}
            emptyMessage="Nenhum ausente no turno"
          />
        </main>
      </div>
    </div>
  );
}
