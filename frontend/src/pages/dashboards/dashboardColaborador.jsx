"use client"

import { useEffect, useState, useContext } from "react"
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts"

import Sidebar from "../../components/Sidebar"
import Header from "../../components/Header"
import LoadingScreen from "../../components/LoadingScreen"
import api from "../../services/api"
import TurnoSelector from "../../components/dashboard/TurnoSelector"
import DateFilter from "../../components/dashboard/DateFilter"
import DashboardHeader from "../../components/dashboard/DashboardHeader"
import { AuthContext } from "../../context/AuthContext"
import { useNavigate } from "react-router-dom"

const COLORS = ["#FA4C00", "#3b82f6", "#FFB37A", "#34C759", "#A855F7"]

export default function DashboardColaboradoresExecutivo() {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [turno, setTurno] = useState("ALL")
  const [dateRange, setDateRange] = useState({})
  const { permissions } = useContext(AuthContext)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await api.get("/dashboard/colaboradores", {
        params: {
          turno: turno === "ALL" ? undefined : turno,
          ...dateRange,
        },
      })
      setDados(res.data.data)
      setLoading(false)
    }

    load()
  }, [turno, dateRange])


  if (loading || !dados) {
    return <LoadingScreen message="Carregando dashboard de internalização..." />;
  }

  const { kpis, series, donut, rankings, distribuicoes, hc, candidatosInternalizacao, semFaltaComTempo, reprovadosComTempo } = dados
  

  const tempoCasaData = Object.entries(
    donut?.tempoEmpresaDistribuicao || {}
  ).map(([name, value]) => ({ name, value }))

  const generoData = Object.entries(
    donut?.generoDistribuicao || {}
  ).map(([name, value]) => ({ name, value }))

  const turnoData = Object.entries(
    donut?.turnoDistribuicao || {}
  ).map(([name, value]) => ({ name, value }))

  const headcountMensal = series?.headcountMensal || []

  const hcLider = hc?.hcPorLider || []
  const hcSetor = hc?.hcPorSetor || []
  const hcEscala = hc?.hcPorEscala || []

  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">
      <Sidebar />
      <div className="flex-1 lg:ml-64">
        <Header />

        <main className="p-8 space-y-10">
        <DashboardHeader
          title="Dashboard de Internalização"
          subtitle="Período"
          date={
            dados?.periodo?.inicio && dados?.periodo?.fim
              ? `${dados.periodo.inicio} → ${dados.periodo.fim}`
              : "-"
          }
          badges={[`Turno: ${turno === "ALL" ? "Todos" : turno}`]}
        />

        <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:items-center">
          <TurnoSelector
            value={turno}
            onChange={setTurno}
            options={["ALL", "T1", "T2", "T3"]}
        />

          <DateFilter value={dateRange} onApply={setDateRange} />
        </div>

          {/* ================= KPIs ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            <KpiCard label="Colaboradores Ativos" value={kpis.ativos} />
            <KpiCard label="Turnover" value={`${Number(kpis.turnover ?? 0).toFixed(2)}%`} />
            <KpiCard label="Absenteísmo" value={`${kpis.absenteismoPeriodo}%`} />
            <KpiCard label="Média Idade" value={`${kpis.mediaIdade} anos`} />
            <KpiCard label="Tempo Médio Empresa" value={`${kpis.tempoMedioEmpresa} anos`} />
          </div>

          {/* ================= HEADCOUNT + MOVIMENTAÇÃO ================= */}
          <Card title="Headcount & Movimentações">
            <ResponsiveContainer width="100%" height={window.innerWidth < 768 ? 260 : 350}>
              <ComposedChart
                data={headcountMensal.map((h, index) => ({
                  mes: h.mes,
                  headcount: h.total,
                  admissoes: series?.admissoesMensal?.[index]?.total || 0,
                  desligamentos: series?.desligamentosMensal?.[index]?.total || 0,
                }))}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />

                <XAxis dataKey="mes" stroke="#BFBFC3" />
                <YAxis stroke="#BFBFC3" />

                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1F1F22",
                    border: "none",
                    borderRadius: 12,
                  }}
                />

                <Legend />

                {/* 🔵 Linha HC */}
                <Line
                  type="monotone"
                  dataKey="headcount"
                  stroke="#FA4C00"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  name="Headcount"
                  label={{
                    position: "top",
                    fill: "#FFFFFF",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                />

                {/* 🟢 Admissões */}
                <Bar
                  dataKey="admissoes"
                  fill="#34C759"
                  radius={[6, 6, 0, 0]}
                  name="Admissões">
                  <LabelList
                  dataKey="admissoes"
                  position="top"
                  fill="#34C759"
                  fontSize={12}
                  fontWeight={600}
                  />
                </Bar>

                {/* 🔴 Demissões */}
                <Bar
                  dataKey="desligamentos"
                  fill="#FF453A"
                  radius={[6, 6, 0, 0]}
                  name="Demissões">
                  <LabelList
                    dataKey="desligamentos"
                    position="top"
                    fill="#FF453A"
                    fontSize={12}
                    fontWeight={600}
                  />  
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </Card>


          {/* ================= DONUTS ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">

            {/* TEMPO DE CASA */}
            <Card title="Tempo de Casa">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={tempoCasaData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={window.innerWidth < 768 ? 70 : 100}
                    innerRadius={window.innerWidth < 768 ? 40 : 60}
                    label={window.innerWidth >= 768}
                  >
                    {tempoCasaData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{
                      paddingTop: 20,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            {/* GÊNERO */}
            <Card title="Distribuição por Gênero">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={generoData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={100}
                    innerRadius={60}
                    label
                  >
                    {generoData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            {/* TURNO */}
            <Card title="Distribuição por Turno">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={turnoData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={100}
                    innerRadius={60}
                    label
                  >
                    {turnoData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
                    
          </div>
          {/* HC por Líder / Setor / Escala — oculto */}
                    
          {/* ================= TOP 10 ================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card title="+90 dias · Sem Falta · Sem Medida">
              <p className="text-xs text-[#BFBFC3] mb-3">+90 dias, sem falta, sem medida e exatamente 1 atestado (candidatos plenos estão em Internalização)</p>
              <RankingListCriterios data={semFaltaComTempo || []} />
            </Card>

            <Card title="+90 dias · Reprovados">
              <p className="text-xs text-[#BFBFC3] mb-3">Têm tempo de casa mas falharam em outro critério</p>
              <RankingListReprovados data={reprovadosComTempo || []} />
            </Card>
          </div>

          {/* ================= CANDIDATOS À INTERNALIZAÇÃO ================= */}
          <CandidatosInternalizacaoTable data={candidatosInternalizacao || []} isAdmin={permissions?.isAdmin} navigate={navigate} />

        </main>
      </div>
    </div>
  )
}

/* ================= COMPONENTS ================= */

function Card({ title, children }) {
  return (
    <div className="bg-[#1A1A1C] rounded-xl p-6">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </div>
  )
}

function KpiCard({ label, value }) {
  return (
    <div className="bg-[#1A1A1C] rounded-xl p-6">
      <div className="text-xs text-[#BFBFC3]">{label}</div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
    </div>
  )
}

function RankingList({ data }) {
  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex justify-between text-sm">
          <span className="truncate max-w-[70%]">{item.colaborador}</span>
          <span className="text-[#FA4C00]">{item.qtd}</span>
        </div>
      ))}
    </div>
  )
}

function RankingListCriterios({ data }) {
  if (!data.length) return <p className="text-xs text-[#BFBFC3] text-center py-4">Nenhum colaborador.</p>
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {data.map((c, i) => (
        <div key={i} className="flex items-center justify-between text-sm gap-2">
          <span className="truncate text-white">{c.nome}</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#34C759]/20 text-[#34C759]">0 faltas</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.qtdAtestados === 0 ? "bg-[#34C759]/20 text-[#34C759]" : "bg-[#FFB37A]/20 text-[#FFB37A]"}`}>
              {c.qtdAtestados} atestado{c.qtdAtestados !== 1 ? "s" : ""}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#34C759]/20 text-[#34C759]">0 medidas</span>
            <span className="text-[#BFBFC3] font-semibold">{c.diasCasa}d</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function RankingListReprovados({ data }) {
  if (!data.length) return <p className="text-xs text-[#BFBFC3] text-center py-4">Nenhum colaborador.</p>
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {data.map((c, i) => (
        <div key={i} className="flex items-center justify-between text-sm gap-2">
          <span className="truncate text-white">{c.nome}</span>
          <div className="flex items-center gap-1 shrink-0">
            {c.qtdFaltas > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[#FF453A]/20 text-[#FF453A]">
                {c.qtdFaltas} falta{c.qtdFaltas !== 1 ? "s" : ""}
              </span>
            )}
            {c.qtdAtestados > 1 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[#FFB37A]/20 text-[#FFB37A]">
                {c.qtdAtestados} atestados
              </span>
            )}
            {c.qtdMedidas > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[#A855F7]/20 text-[#A855F7]">
                {c.qtdMedidas} medida{c.qtdMedidas !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
function RankingListHC({ data }) {
  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex justify-between text-sm">
          <span>{item.name}</span>
          <span className="text-[#3b82f6] font-semibold">
            {item.total}
          </span>
        </div>
      ))}
    </div>
  )
}

function exportarCSV(data) {
  const headers = ["Nome", "Empresa", "Turno", "Setor", "Líder", "Admissão", "Dias de Casa"]
  const rows = data.map(c => [
    c.nome, c.empresa, c.turno, c.setor, c.lider, c.dataAdmissao, c.diasCasa
  ])
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n")
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `candidatos_internalizacao_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function CandidatosInternalizacaoTable({ data, isAdmin, navigate }) {
  const [filtroTurno, setFiltroTurno] = useState("ALL")
  const [filtroLider, setFiltroLider] = useState("ALL")

  const turnos = ["ALL", ...Array.from(new Set(data.map(c => c.turno))).sort()]
  const lideres = ["ALL", ...Array.from(new Set(data.map(c => c.lider))).sort()]

  const filtrado = data.filter(c => {
    if (filtroTurno !== "ALL" && c.turno !== filtroTurno) return false
    if (filtroLider !== "ALL" && c.lider !== filtroLider) return false
    return true
  })

  const selectClass = "bg-[#0D0D0D] border border-white/10 text-[#BFBFC3] text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#FA4C00]"

  return (
    <div className="bg-[#1A1A1C] rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="font-semibold text-white">Candidatos à Internalização</h2>
          <p className="text-xs text-[#BFBFC3] mt-1">
            BPO · Ativos · +90 dias de casa · Sem atestado, falta ou medida disciplinar
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={filtroTurno} onChange={e => setFiltroTurno(e.target.value)} className={selectClass}>
            {turnos.map(t => <option key={t} value={t}>{t === "ALL" ? "Todos os turnos" : t}</option>)}
          </select>
          <select value={filtroLider} onChange={e => setFiltroLider(e.target.value)} className={selectClass}>
            {lideres.map(l => <option key={l} value={l}>{l === "ALL" ? "Todos os líderes" : l}</option>)}
          </select>
          <span className="text-sm text-[#BFBFC3]">{filtrado.length} colaborador{filtrado.length !== 1 ? "es" : ""}</span>
          <button
            onClick={() => exportarCSV(filtrado)}
            disabled={filtrado.length === 0}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#34C759]/20 text-[#34C759] hover:bg-[#34C759]/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Baixar CSV
          </button>
        </div>
      </div>

      {filtrado.length === 0 ? (
        <p className="text-sm text-[#BFBFC3] text-center py-8">Nenhum candidato encontrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#BFBFC3] border-b border-white/10">
                <th className="text-left py-2 pr-4 font-medium">Nome</th>
                <th className="text-left py-2 pr-4 font-medium">Empresa</th>
                <th className="text-left py-2 pr-4 font-medium">Turno</th>
                <th className="text-left py-2 pr-4 font-medium">Setor</th>
                <th className="text-left py-2 pr-4 font-medium">Líder</th>
                <th className="text-left py-2 pr-4 font-medium">Admissão</th>
                <th className="text-right py-2 pr-4 font-medium">Dias de Casa</th>
                <th className="text-right py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtrado.map((c, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-2 pr-4 text-white">{c.nome}</td>
                  <td className="py-2 pr-4 text-[#BFBFC3]">{c.empresa}</td>
                  <td className="py-2 pr-4 text-[#BFBFC3]">{c.turno}</td>
                  <td className="py-2 pr-4 text-[#BFBFC3]">{c.setor}</td>
                  <td className="py-2 pr-4 text-[#BFBFC3]">{c.lider}</td>
                  <td className="py-2 pr-4 text-[#BFBFC3]">{c.dataAdmissao}</td>
                  <td className="py-2 pr-4 text-right text-[#34C759] font-semibold">{c.diasCasa}d</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => isAdmin && navigate(`/colaboradores/${c.opsId}/movimentar`)}
                      disabled={!isAdmin}
                      title={isAdmin ? "Ir para movimentação" : "Apenas administradores"}
                      className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                        isAdmin
                          ? "bg-[#FA4C00]/20 text-[#FA4C00] hover:bg-[#FA4C00]/40 cursor-pointer"
                          : "bg-[#FA4C00]/10 text-[#FA4C00] opacity-30 cursor-not-allowed"
                      }`}
                    >
                      Internalizar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
