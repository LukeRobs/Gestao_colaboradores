"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts"
import api from "../../services/api"
import Sidebar from "../../components/Sidebar"
import Header from "../../components/Header"

/* =====================================================
   CONSTS / HELPERS
===================================================== */
const COLORS = [
  "#FA4C00",
  "#3b82f6",
  "#FFB37A",
  "#FFD2B0",
  "#34C759",
  "#FF9F0A",
  "#FF453A",
]

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function isoFirstDayOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
    .toISOString()
    .slice(0, 10)
}

/* =====================================================
   PAGE
===================================================== */
export default function DashboardAtestados() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [inicio, setInicio] = useState(isoFirstDayOfMonth())
  const [fim, setFim] = useState(isoToday())

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [kpis, setKpis] = useState(null)
  const [dist, setDist] = useState(null)
  const [tendencia, setTendencia] = useState([])
  const [topOfensores, setTopOfensores] = useState([])

  async function fetchAll() {
    try {
      setLoading(true)
      setError("")

      const params = { inicio, fim }

      const [resResumo, resDist, resTend, resRisco] = await Promise.all([
        api.get("/dashboard/atestados/resumo", { params }),
        api.get("/dashboard/atestados/distribuicoes", { params }),
        api.get("/dashboard/atestados/tendencia", { params }),
        api.get("/dashboard/atestados/risco", { params }),
      ])

      setKpis(resResumo.data?.data?.kpis ?? resResumo.data?.kpis ?? null)
      setDist(resDist.data?.data ?? resDist.data ?? null)

      setTendencia(
        Array.isArray(resTend.data?.data)
          ? resTend.data.data
          : Array.isArray(resTend.data)
          ? resTend.data
          : []
      )

      setTopOfensores(
        resRisco.data?.data?.topOfensores ?? resRisco.data?.topOfensores ?? []
      )
    } catch (err) {
      console.error("❌ DASHBOARD ATESTADOS:", err)
      setError("Erro ao carregar dashboard de atestados.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* =====================================================
     MEMOS — DADOS JÁ VÊM name/value DO BACKEND
  ===================================================== */
  const porEmpresaChart = useMemo(() => {
    if (!dist || !Array.isArray(dist.porEmpresa)) return []
    return dist.porEmpresa
  }, [dist])

  const porSetorChart = useMemo(() => {
    if (!dist || !Array.isArray(dist.porSetor)) return []
    return dist.porSetor
  }, [dist])

  const porTurnoChart = useMemo(() => {
    if (!dist || !Array.isArray(dist.porTurno)) return []
    return dist.porTurno
  }, [dist])

  const porGeneroChart = useMemo(() => {
    if (!dist || !Array.isArray(dist.porGenero)) return []
    return dist.porGenero
  }, [dist])

  const porLiderChart = useMemo(() => {
    if (!dist || !Array.isArray(dist.porLider)) return []
    return [...dist.porLider].slice(0, 10)
  }, [dist])

  const porCidChart = useMemo(() => {
    if (!dist || !Array.isArray(dist.porCid)) return []
    return [...dist.porCid].slice(0, 10)
  }, [dist])

  /* =====================================================
     RENDER (RESPONSIVO)
  ===================================================== */
  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">
      {/* SIDEBAR */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* CONTEÚDO */}
      <div className="flex-1 min-w-0 lg:ml-64 overflow-x-hidden">
        {/* HEADER */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* MAIN — padding responsivo */}
        <main className="px-4 sm:px-6 lg:px-8 py-6 space-y-8">
          {/* TÍTULO + FILTROS */}
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold">
                Dashboard de Atestados
              </h1>
              <p className="text-xs sm:text-sm text-[#BFBFC3]">
                Visão de impacto, distribuição e recorrência
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-end w-full lg:w-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto">
                <DateInput label="Início" value={inicio} onChange={setInicio} />
                <DateInput label="Fim" value={fim} onChange={setFim} />
              </div>

              <button
                onClick={fetchAll}
                className="
                  h-[54px]
                  w-full sm:w-auto
                  px-5
                  rounded-lg
                  bg-[#FA4C00]
                  hover:bg-[#e64500]
                  transition
                  text-sm
                  font-medium
                "
              >
                Atualizar
              </button>
            </div>
          </div>

          {/* ERRO */}
          {error && (
            <div className="bg-[#1A1A1C] border border-[#FF453A] rounded-lg p-4 text-sm text-[#FF453A]">
              {error}
            </div>
          )}

          {/* KPIs — quebra bonita em tablet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4">
            <KpiCard
              label="Atestados (Período)"
              value={kpis?.totalPeriodo}
              loading={loading}
            />

            <KpiCard
              label="Recorrência"
              value={
                loading
                  ? null
                  : typeof kpis?.recorrencia === "number"
                  ? `${kpis.recorrencia}%`
                  : "0%"
              }
              loading={loading}
              highlight={
                typeof kpis?.recorrencia === "number" && kpis.recorrencia >= 20
                  ? "error"
                  : undefined
              }
            />

            <KpiCard
              label="Colaboradores Impactados"
              value={kpis?.colaboradoresImpactados}
              loading={loading}
            />

            <KpiCard
              label="% sobre HC"
              value={
                loading
                  ? null
                  : typeof kpis?.percentualHC === "number"
                  ? `${kpis.percentualHC}%`
                  : "0%"
              }
              loading={loading}
              highlight="error"
            />

            <KpiCard label="Atestados Hoje" value={kpis?.hoje} loading={loading} />
            <KpiCard label="Semana Atual" value={kpis?.semana} loading={loading} />
            <KpiCard label="Mês Atual" value={kpis?.mes} loading={loading} />
          </div>

          {/* TENDÊNCIA */}
          <Card title="Atestados por dia">
            <div className="h-[220px] sm:h-[260px] lg:h-[300px] xl:h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={Array.isArray(tendencia) ? tendencia : []}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                  <XAxis
                    dataKey="data"
                    tick={{ fill: "#BFBFC3", fontSize: 12 }}
                    minTickGap={20}
                  />
                  <YAxis
                    tick={{ fill: "#BFBFC3", fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1A1A1C",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#FA4C00"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  >
                    <LabelList
                      dataKey="total"
                      position="top"
                      style={{ fill: "#FFFFFF", fontSize: 12, fontWeight: 600 }}
                    />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* DISTRIBUIÇÕES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Atestados por Empresa">
              <BarBlock data={porEmpresaChart} />
            </Card>

            <Card title="Atestados por Setor">
              <BarBlock data={porSetorChart} />
            </Card>

            <Card title="Top 10 Líderes">
              <BarBlockHorizontal data={porLiderChart} />
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card title="Por Turno">
                <PieBlock data={porTurnoChart} />
              </Card>

              <Card title="Por Gênero">
                <PieBlock data={porGeneroChart} />
              </Card>
            </div>
          </div>

          {/* CID + RANKING */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Top 10 CID (dado sensível)">
              <BarBlockHorizontalCID data={porCidChart} />
            </Card>

            <Card title="Top 10 Ofensores (colaboradores)">
              <TopOfensoresTable rows={topOfensores} loading={loading} />
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}

/* =====================================================
   UI COMPONENTS
===================================================== */
function DateInput({ label, value, onChange }) {
  return (
    <div className="bg-[#1c1c1c] rounded-xl p-3 w-full">
      <p className="text-[11px] text-white/60 mb-1">{label}</p>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-white outline-none text-sm w-full"
      />
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="bg-[#1c1c1c] rounded-xl p-4 border border-white/5 min-h-[120px]">
      {title && <h2 className="text-sm font-medium mb-3">{title}</h2>}
      {children}
    </div>
  )
}

function KpiCard({ label, value, loading, highlight }) {
  const bar =
    highlight === "warning"
      ? "bg-[#FF9F0A]"
      : highlight === "error"
      ? "bg-[#FF453A]"
      : "bg-[#FA4C00]"

  return (
    <div className="relative rounded-xl bg-[#1c1c1c] p-4 overflow-hidden border border-white/5">
      <div className={`absolute left-0 top-0 h-full w-1 ${bar}`} />
      <p className="text-[11px] text-white/60">{label}</p>
      <p className="text-xl font-semibold mt-1">
        {loading ? "…" : value ?? 0}
      </p>
    </div>
  )
}

function BarBlock({ data }) {
  const safeData = Array.isArray(data) ? data : []

  if (!safeData.length) {
    return <p className="text-sm text-white/60">Sem dados no período.</p>
  }

  const maxValue = Math.max(...safeData.map((d) => d.value || 0))

  return (
    <div className="h-[240px] sm:h-[280px] lg:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={safeData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="name" tick={{ fill: "#BFBFC3", fontSize: 11 }} minTickGap={12} />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#BFBFC3", fontSize: 12 }}
            domain={[0, maxValue]}
          />
          <Tooltip
            contentStyle={{
              background: "#232323",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
            }}
          />
          <Bar dataKey="value" fill="#FA4C00">
            <LabelList
              dataKey="value"
              position="top"
              style={{ fill: "#FFFFFF", fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function PieBlock({ data }) {
  const safeData = Array.isArray(data) ? data : []

  if (!safeData.length) {
    return <p className="text-sm text-white/60">Sem dados no período.</p>
  }

  const total = safeData.reduce((acc, d) => acc + d.value, 0)

  const renderLabel = ({ percent, value }) => {
    if (percent < 0.05) return null
    return `${value}`
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="h-[220px] sm:h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={safeData}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={80}
              stroke="none"
              label={renderLabel}
              labelLine={false}
            >
              {safeData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>

            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#FFFFFF"
              style={{ fontSize: 20, fontWeight: 700 }}
            >
              {total}
            </text>

            <Tooltip
              formatter={(value) => {
                const percent = ((value / total) * 100).toFixed(1)
                return `${value} (${percent}%)`
              }}
              contentStyle={{
                background: "#232323",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="text-xs mt-3 space-y-2 w-full px-1 sm:px-4">
        {safeData.map((item, i) => {
          const percent = ((item.value / total) * 100).toFixed(1)
          const color = COLORS[i % COLORS.length]

          return (
            <div key={i} className="flex justify-between items-center gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-white/80 truncate">{item.name}</span>
              </div>

              <span className="font-semibold text-white shrink-0">
                {item.value} ({percent}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TopOfensoresTable({ rows, loading }) {
  if (loading) return <p className="text-sm text-white/60">Carregando…</p>
  if (!rows?.length) return <p className="text-sm text-white/60">Sem ofensores no período.</p>

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[780px] w-full text-sm">
        <thead className="text-white/60">
          <tr>
            <th className="text-left py-2 w-10">#</th>
            <th className="text-left py-2">Colaborador</th>
            <th className="text-left py-2">Empresa</th>
            <th className="text-left py-2">Setor</th>
            <th className="text-left py-2">Tempo Casa</th>
            <th className="text-right py-2">Atest.</th>
            <th className="text-right py-2">Dias</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr
              key={r.opsId}
              className="border-t border-white/5 hover:bg-white/5 transition"
            >
              <td className="py-2 text-white/70">{r.rank}</td>
              <td className="py-2 font-medium">{r.nome}</td>
              <td className="py-2 text-white/80">{r.empresa || "N/I"}</td>
              <td className="py-2 text-white/80">{r.setor || "N/I"}</td>

              <td className="py-2">
                <span
                  className={`
                    px-2 py-1 rounded-md text-xs font-semibold
                    ${
                      r.tempoCasaFaixa === "< 30 dias"
                        ? "bg-[#FF453A]/20 text-[#FF453A]"
                        : r.tempoCasaFaixa === "30–89 dias"
                        ? "bg-[#FF9F0A]/20 text-[#FF9F0A]"
                        : "bg-[#34C759]/20 text-[#34C759]"
                    }
                  `}
                >
                  {r.tempoCasaFaixa || "N/I"}
                </span>
              </td>

              <td className="py-2 text-right font-semibold">{r.totalAtestados}</td>
              <td className="py-2 text-right font-semibold text-[#FA4C00]">
                {r.diasAfastados}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BarBlockHorizontal({ data }) {
  const safeData = Array.isArray(data) ? data : []
  if (!safeData.length) return <p className="text-sm text-white/60">Sem dados no período.</p>

  const formatName = (name) => {
    const parts = String(name || "").trim().split(" ")
    if (parts.length >= 2) return `${parts[0]} ${parts[1]}`
    return name
  }

  const formatted = safeData.map((d) => ({ ...d, name: formatName(d.name) }))

  return (
    <div className="h-[280px] sm:h-[320px] lg:h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
          <XAxis type="number" allowDecimals={false} domain={[0, "dataMax + 2"]} tick={{ fill: "#BFBFC3", fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fill: "#BFBFC3", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "#232323",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
            }}
          />
          <Bar dataKey="value" fill="#FA4C00">
            <LabelList dataKey="value" position="right" style={{ fill: "#FFF", fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function BarBlockHorizontalCID({ data }) {
  const safeData = Array.isArray(data) ? data : []
  if (!safeData.length) return <p className="text-sm text-white/60">Sem dados no período.</p>

  // 🔥 responsivo: altura mínima + cresce conforme itens (evita “vazio”)
  const height = Math.max(260, safeData.length * 34)

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={safeData}
          layout="vertical"
          barSize={18}
          barCategoryGap="18%"
          margin={{ top: 5, right: 28, left: 10, bottom: 5 }}
        >
          <CartesianGrid stroke="rgba(255,255,255,0.06)" />
          <XAxis type="number" allowDecimals={false} domain={[0, (dataMax) => dataMax + 0.3]} tick={{ fill: "#BFBFC3", fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={70} tick={{ fill: "#BFBFC3", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              background: "#232323",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
            }}
          />
          <Bar dataKey="value" fill="#FA4C00" radius={[0, 6, 6, 0]}>
            <LabelList dataKey="value" position="right" style={{ fill: "#FFFFFF", fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
