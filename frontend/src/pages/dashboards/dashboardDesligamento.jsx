import { useEffect, useState } from "react";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Card from "../../components/dashboard/desligamentos/cardKPI";
import ChartPie from "../../components/dashboard/desligamentos/ChartPie";
import ChartBar from "../../components/dashboard/desligamentos/ChartBar";
import Ranking from "../../components/dashboard/desligamentos/RankingLider";
import Insights from "../../components/dashboard/desligamentos/InsightsDesligamento";
import ChartBarHorizontal from "../../components/dashboard/desligamentos/ChartBarHorizontal";
import TurnoSelector from "../../components/dashboard/TurnoSelector";
import DateFilter from "../../components/dashboard/DateFilter";

function toChartData(obj = {}) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  return Object.entries(obj).map(([name, value]) => ({
    name,
    value: Number(value) || 0,
  }));
}

function toChartDataClean(obj = {}) {
  if (!obj || typeof obj !== "object") return [];

  return Object.entries(obj)
    .map(([name, value]) => ({
      name,
      value: Number(value) || 0,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

/* ─── Shimmer skeleton ─────────────────────────────────────── */
function Skeleton({ h = "h-48" }) {
  return (
    <div className={`${h} rounded-2xl bg-white/[0.04] overflow-hidden relative`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-8 w-full">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <Skeleton h="h-10" />
        <div className="flex flex-col sm:flex-row gap-4">
          <Skeleton h="h-12" />
          <Skeleton h="h-12" />
        </div>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} h="h-24" />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} h="h-72" />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Skeleton h="h-72" />
        <Skeleton h="h-72" />
      </div>
    </div>
  );
}

/* ─── Debug panel ──────────────────────────────────────────── */
function DebugPanel({ raw }) {
  const [open, setOpen] = useState(false);

  const checks = [
    { label: "data.total", val: raw?.total },
    {
      label: "data.indicadores.tempoMedioCasa",
      val: raw?.indicadores?.tempoMedioCasa,
    },
    {
      label: "data.indicadores.desligamentoPrecoce",
      val: raw?.indicadores?.desligamentoPrecoce,
    },
    { label: "data.motivos", val: raw?.motivos, isObj: true },
    { label: "data.tempoCasa", val: raw?.tempoCasa, isObj: true },
    { label: "data.turno", val: raw?.turno, isObj: true },
    { label: "data.empresa", val: raw?.empresa, isObj: true },
    { label: "data.setor", val: raw?.setor, isObj: true },
    { label: "data.tipo", val: raw?.tipo, isObj: true },
    { label: "data.lider", val: raw?.lider, isObj: true },
    { label: "data.genero", val: raw?.genero, isObj: true },
    { label: "data.insights", val: raw?.insights, isObj: true },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 font-mono text-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between bg-[#1C1C1F] border border-white/10 rounded-xl px-3 py-2 text-white/60 hover:text-white transition-colors shadow-xl"
      >
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          🔍 Debug API
        </span>
        <span className="text-white/30">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-1 bg-[#141416] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          <p className="px-3 py-2 border-b border-white/[0.06] text-white/40 text-[10px] uppercase tracking-widest">
            Mapeamento de campos
          </p>

          <ul className="divide-y divide-white/[0.05] max-h-72 overflow-y-auto">
            {checks.map((c, i) => {
              const hasKeys = c.isObj && c.val && typeof c.val === "object";
              const keyCount = hasKeys ? Object.keys(c.val).length : 0;
              const isOk = c.isObj
                ? keyCount > 0
                : c.val !== null && c.val !== undefined && c.val !== 0;
              const isZero = !c.isObj && c.val === 0;

              return (
                <li key={i} className="flex items-start gap-2 px-3 py-2">
                  <span className="mt-0.5 flex-shrink-0 text-sm">
                    {isOk ? "✅" : isZero ? "⚠️" : "❌"}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-white/40">{c.label}</p>
                    <p
                      className={`truncate font-bold ${
                        isOk
                          ? "text-green-400"
                          : isZero
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                    >
                      {c.val === null || c.val === undefined
                        ? "null / undefined"
                        : c.isObj
                        ? `{ ${keyCount} chaves }`
                        : String(c.val)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <details className="border-t border-white/[0.06]">
            <summary className="px-3 py-2 text-white/30 text-[10px] uppercase tracking-widest cursor-pointer hover:text-white/50">
              Raw JSON ▸
            </summary>
            <pre className="px-3 pb-3 text-white/40 text-[9px] max-h-48 overflow-auto whitespace-pre-wrap break-all">
              {JSON.stringify(raw, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

/* ─── Section label ────────────────────────────────────────── */
function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="h-px flex-1 bg-white/[0.07]" />
      <span className="text-[11px] font-semibold tracking-widest uppercase text-white/30 px-2">
        {children}
      </span>
      <span className="h-px flex-1 bg-white/[0.07]" />
    </div>
  );
}

/* ─── Date badge ───────────────────────────────────────────── */
function DateBadge({ inicio, fim, turno }) {
  const fmt = (s) =>
    new Date(`${s}T00:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/40 font-medium">
      <div className="bg-white/[0.05] border border-white/[0.07] px-3 py-1.5 rounded-full">
        📅 {fmt(inicio)} → {fmt(fim)}
      </div>
      <div className="bg-white/[0.05] border border-white/[0.07] px-3 py-1.5 rounded-full">
        Turno: {turno === "ALL" ? "Todos" : turno}
      </div>
    </div>
  );
}

/* ─── Main ─────────────────────────────────────────────────── */
export default function DashboardDesligamento() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(null);
  const [rawResp, setRawResp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [turno, setTurno] = useState("ALL");
  const [dateRange, setDateRange] = useState({
    inicio: "2026-01-01",
    fim: new Date().toISOString().slice(0, 10),
  });

  async function fetchData() {
    try {
      setLoading(true);
      setError(false);

      const params = {
        turno: turno === "ALL" ? undefined : turno,
        inicio: dateRange?.inicio,
        fim: dateRange?.fim,
      };

      const res = await api.get("/dashboard/desligamento", { params });

      console.log("▶ RESPOSTA COMPLETA DA API:", res.data);

      setRawResp(res.data);
      setData(res.data?.data ?? res.data);
    } catch (err) {
      console.error("Erro dashboard desligamento:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [turno, dateRange]);

  return (
    <>
      <style>{`
        @keyframes shimmer { to { transform: translateX(200%); } }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .fadeUp { animation: fadeUp .4s ease both; }
        .d1 { animation-delay:.05s; }
        .d2 { animation-delay:.1s; }
        .d3 { animation-delay:.15s; }
        .d4 { animation-delay:.2s; }
      `}</style>

      <div className="flex min-h-screen bg-[#0F0F10] text-white overflow-x-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col min-w-0 lg:ml-64 overflow-x-hidden overflow-y-visible">
          <Header
            title="Dashboard Desligamento"
            onMenuClick={() => setSidebarOpen(true)}
          />

          {loading && <LoadingState />}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 py-24 text-center px-6">
              <span className="text-3xl">⚠️</span>
              <p className="text-white/50 text-sm">
                Erro ao carregar dados da API.
              </p>
              <button
                onClick={fetchData}
                className="px-5 py-2 rounded-xl bg-[#E8410A] hover:bg-[#c93509] text-white text-sm font-medium transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-8 w-full">
              <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6 fadeUp">
                <div>
                  <h1 className="text-xl sm:text-2xl font-semibold">
                    Dashboard de Desligamento
                  </h1>
                  <p className="text-xs sm:text-sm text-[#BFBFC3]">
                    Dados consolidados de desligamentos
                  </p>
                </div>

                <div className="relative z-50 flex flex-col sm:flex-row flex-wrap gap-4 sm:items-end w-full xl:w-auto">
                  <TurnoSelector
                    value={turno}
                    onChange={setTurno}
                    options={["ALL", "T1", "T2", "T3"]}
                  />

                  <DateFilter
                    value={dateRange}
                    onApply={setDateRange}
                  />
                </div>
              </div>

              <div className="fadeUp">
                <DateBadge
                  inicio={dateRange.inicio}
                  fim={dateRange.fim}
                  turno={turno}
                />
              </div>

              <section className="fadeUp d1">
                <SectionLabel>Indicadores-chave</SectionLabel>

                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                  <Card
                    title="Total"
                    value={data.total ?? 0}
                    accent="#E8410A"
                  />

                  <Card
                    title="Tempo Médio de Casa"
                    value={
                      data.indicadores?.tempoMedioCasa != null
                        ? `${data.indicadores.tempoMedioCasa} dias`
                        : "0 dias"
                    }
                    accent="#F97316"
                  />

                  <Card
                    title="Deslig. Precoce (< 30 Dias)"
                    value={data.indicadores?.desligamentoPrecoce ?? 0}
                    accent="#FBBF24"
                  />

                  <Card
                    title="Motivo Principal"
                    value={data.insights?.principalMotivo?.label ?? "-"}
                    sub={`${data.insights?.principalMotivo?.value ?? 0} casos`}
                    accent="#34D399"
                  />

                  <Card
                    title="Turno Crítico"
                    value={data.insights?.turnoCritico?.label ?? "-"}
                    sub={`${data.insights?.turnoCritico?.value ?? 0} casos`}
                    accent="#60A5FA"
                  />

                  <Card
                    title="Líder Ofensor"
                    value={data.insights?.liderDestaque?.label ?? "-"}
                    sub={`${data.insights?.liderDestaque?.value ?? 0} casos`}
                    accent="#A78BFA"
                  />
                </div>
              </section>

              <section className="fadeUp d2">
                <SectionLabel>Distribuição e Tendências</SectionLabel>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  <ChartBarHorizontal
                    title="Motivos de Desligamento"
                    data={toChartDataClean(data.motivos).slice(0, 6)}
                  />

                  <ChartBar
                    title="Motivos por Turno"
                    data={toChartDataClean(data.turno)}
                  />

                  <ChartBar
                    title="Motivos por Setor"
                    data={toChartDataClean(data.setor)}
                  />

                  <ChartBar
                    title="Tempo de Casa"
                    data={toChartDataClean(data.tempoCasa)}
                  />

                  <ChartBar
                    title="Motivos por Empresa"
                    data={toChartDataClean(data.empresa)}
                  />

                  <ChartPie
                    title="Tipo de Desligamento"
                    data={toChartDataClean(data.tipo)}
                  />
                </div>
              </section>

              <section className="fadeUp d3">
                <SectionLabel>Lideranças e Diversidade</SectionLabel>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  <Ranking
                    title="Top Líderes com Mais Desligamentos"
                    data={toChartDataClean(data.lider)}
                  />

                  <ChartBar
                    title="Motivo por Gênero"
                    data={toChartDataClean(data.genero)}
                  />
                </div>
              </section>

            </div>
          )}
        </div>
      </div>

      {!loading && data && <DebugPanel raw={data} />}
    </>
  );
}