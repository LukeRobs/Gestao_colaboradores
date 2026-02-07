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

import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";

export default function DashboardOperacional() {
  /* =====================================================
     STATES
  ===================================================== */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dados, setDados] = useState(null);
  const [turnoSelecionado, setTurnoSelecionado] = useState("T2"); // default UX
  const [turnoAtual, setTurnoAtual] = useState(null); // informativo
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  /* 📅 DATE PICKER */
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draftRange, setDraftRange] = useState({ from: null, to: null });
  const [appliedRange, setAppliedRange] = useState({ from: null, to: null });

  const calendarRef = useRef(null);

  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);

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

  /* LOAD INICIAL */
  useEffect(() => {
    loadDashboard();
  }, []);

  /* LOAD QUANDO RANGE APLICADO MUDA */
  useEffect(() => {
    loadDashboard(appliedRange);
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
     KPIs
  ===================================================== */
  const totalColaboradores = turnoData.totalEscalados;
  const presentes = turnoData.presentes;
  const ausentes = turnoData.ausentes;
  const diaristasPresentes = turnoData.diaristasPresentes || 0;

  const absenteismo = useMemo(() => {
    if (!totalColaboradores) return 0;
    return ((ausentes / totalColaboradores) * 100).toFixed(2);
  }, [ausentes, totalColaboradores]);

  const kpis = useMemo(
    () => [
      { icon: Users, label: "Colaboradores", value: totalColaboradores },
      { icon: Clock, label: "Presentes no turno", value: presentes },
      { icon: Users, label: "Diaristas presentes", value: diaristasPresentes },
      {
        icon: TrendingUp,
        label: "Absenteísmo",
        value: absenteismo,
        suffix: "%",
        color: absenteismo > 10 ? "#FF453A" : "#34C759",
      },
      {
        icon: Building2,
        label: "Empresas",
        value: dados?.empresas?.length || 0,
      },
    ],
    [totalColaboradores, presentes, diaristasPresentes, absenteismo, dados]
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
        label: e.empresa,
        value: e.quantidade,
      })),
    [dados, turnoSelecionado]
  );

  /* =====================================================
     RENDER
  ===================================================== */
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
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 space-y-10">
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
              className="bg-[#1A1A1C] border border-[#2A2A2C] px-4 py-2 rounded-lg text-sm hover:bg-[#222]"
            >
              📅{" "}
              {appliedRange.from
                ? appliedRange.to
                  ? `${appliedRange.from.toLocaleDateString("pt-BR")} - ${appliedRange.to.toLocaleDateString("pt-BR")}`
                  : appliedRange.from.toLocaleDateString("pt-BR")
                : "Selecionar período"}
            </button>

            {calendarOpen && (
              <div className="absolute z-50 mt-2 bg-[#0D0D0D] border border-[#2A2A2C] rounded-xl p-4 shadow-xl">
                <DayPicker
                  mode="range"
                  selected={draftRange}
                  onSelect={setDraftRange}
                  numberOfMonths={2}
                  locale={ptBR}
                />

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => {
                      setDraftRange({ from: null, to: null });
                      setCalendarOpen(false);
                    }}
                    className="text-xs text-[#BFBFC3]"
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

          <TurnoSelector
            value={turnoSelecionado}
            onChange={setTurnoSelecionado}
            options={["T1", "T2", "T3"]}
          />

          <KpiCardsRow items={kpis} />

          <EmpresasSection title="Quantidade por Empresa" items={empresasItems} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <DistribuicaoGeneroChart
              title="Distribuição por Gênero"
              data={dados.generoPorTurno?.[turnoSelecionado] || []}
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
            ]}
            getRowKey={(row) => row.colaboradorId}
            emptyMessage="Nenhum ausente no turno"
          />
        </main>
      </div>
    </div>
  );
}
