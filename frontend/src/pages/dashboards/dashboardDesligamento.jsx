"use client"

import { useEffect, useState, useMemo } from "react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts"
import api from "../../services/api"
import Sidebar from "../../components/Sidebar"
import Header from "../../components/Header"
import { useEstacao } from "../../context/EstacaoContext"

/* ─── TOKENS ─────────────────────────────────────────────────────── */
const BRAND = "#FA4C00"
const CHART_COLORS = [
  "#FA4C00",
  "#3B82F6",
  "#F59E0B",
  "#22C55E",
  "#A855F7",
  "#EC4899",
  "#14B8A6",
]

/* ─── UTILS ──────────────────────────────────────────────────────── */
function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function toChartData(obj = {}) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return []
  return Object.entries(obj)
    .map(([name, value]) => ({ name, value: Number(value) || 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
}

/* ─── CUSTOM TOOLTIP ─────────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: "#1A1A1A",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 12,
        padding: "10px 16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      }}
    >
      {label && (
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 4 }}>
          {label}
        </p>
      )}
      {payload.map((p, i) => (
        <p key={i} style={{ color: "#fff", fontSize: 14, fontWeight: 600, margin: 0 }}>
          <span style={{ color: p.color || BRAND }}>● </span>
          {p.value}
        </p>
      ))}
    </div>
  )
}

/* ─── SKELETON ───────────────────────────────────────────────────── */
function Skeleton({ style = {} }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        borderRadius: 10,
        animation: "pulse 1.5s ease-in-out infinite",
        ...style,
      }}
    />
  )
}

/* ─── EMPTY ──────────────────────────────────────────────────────── */
function Empty() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 160,
        color: "rgba(255,255,255,0.18)",
        fontSize: 13,
      }}
    >
      Sem dados no período
    </div>
  )
}

/* ─── SVG ICONS ──────────────────────────────────────────────────── */
const IconLogOut  = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)
const IconClock   = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)
const IconZap     = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)
const IconFlag    = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
  </svg>
)
const IconSun     = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)
const IconUser    = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
const IconGrid    = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
)
const IconAlert   = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const IconPieIcon = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.21 15.89A10 10 0 118 2.83"/><path d="M22 12A10 10 0 0012 2v10z"/>
  </svg>
)
const IconUsers   = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
)

/* ─── KPI CONFIG ─────────────────────────────────────────────────── */
const KPI_META = {
  "Total":             { Icon: IconLogOut,  color: "#FA4C00", desc: "Desligamentos no período"    },
  "Tempo Médio":       { Icon: IconClock,   color: "#F59E0B", desc: "Dias médios de casa"          },
  "Precoce < 30d":     { Icon: IconZap,     color: "#EF4444", desc: "Saíram em menos de 30 dias"  },
  "Motivo Principal":  { Icon: IconFlag,    color: "#22C55E", desc: "CID mais frequente"           },
  "Turno Crítico":     { Icon: IconSun,     color: "#3B82F6", desc: "Turno com maior volume"       },
  "Líder Ofensor":     { Icon: IconUser,    color: "#A855F7", desc: "Líder com mais desligamentos" },
}

/* ─── KPI CARD ───────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, loading }) {
  const { Icon = IconLogOut, color = BRAND, desc = "" } = KPI_META[label] || {}
  return (
    <div
      style={{
        background: "#111111",
        border: "1px solid rgba(255,255,255,0.07)",
        borderLeft: `3px solid ${color}`,
        borderRadius: 12,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        cursor: "default",
        transition: "background 0.2s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#161616")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "#111111")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon c={color} s={13} />
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 500, margin: 0 }}>
          {label}
        </p>
      </div>
      {loading ? (
        <Skeleton style={{ height: 28, width: "60%" }} />
      ) : (
        <p style={{ fontSize: 24, fontWeight: 700, color: "#F0F0F0", margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          {value ?? "—"}
        </p>
      )}
      {sub && !loading && (
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", margin: 0 }}>{sub}</p>
      )}
      {!sub && (
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", margin: 0 }}>{desc}</p>
      )}
    </div>
  )
}

/* ─── SECTION LABEL ──────────────────────────────────────────────── */
function SectionLabel({ num, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: BRAND, textTransform: "uppercase", letterSpacing: "0.16em" }}>
        {num}
      </span>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.16em" }}>
        {title}
      </span>
    </div>
  )
}

/* ─── CARD ───────────────────────────────────────────────────────── */
function Card({ title, subtitle, icon, children, style = {} }) {
  return (
    <div
      style={{
        background: "#111111",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 18,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minWidth: 0,
        width: "100%",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {title && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {icon && (
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: `${BRAND}14`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {icon}
            </div>
          )}
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>
              {title}
            </h2>
            {subtitle && (
              <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(255,255,255,0.30)" }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

/* ─── DATE INPUT ─────────────────────────────────────────────────── */
function DateInput({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.35)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
      >
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "#1A1A1A",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#fff",
          fontSize: 13,
          borderRadius: 12,
          padding: "9px 14px",
          outline: "none",
          cursor: "pointer",
          colorScheme: "dark",
        }}
        onFocus={(e) => (e.target.style.borderColor = "rgba(250,76,0,0.5)")}
        onBlur={(e)  => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
      />
    </div>
  )
}

/* ─── TURNO SELECTOR ─────────────────────────────────────────────── */
function TurnoSelector({ value, onChange }) {
  const options = ["ALL", "T1", "T2", "T3"]
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.35)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
      >
        Turno
      </label>
      <div style={{ display: "flex", gap: 4, background: "#1A1A1A", borderRadius: 12, padding: 4, border: "1px solid rgba(255,255,255,0.08)" }}>
        {options.map((opt) => {
          const active = value === opt
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              style={{
                padding: "5px 14px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                background: active ? BRAND : "transparent",
                color: active ? "#fff" : "rgba(255,255,255,0.40)",
                transition: "all 0.18s",
              }}
            >
              {opt === "ALL" ? "Todos" : opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ─── CHARTS ─────────────────────────────────────────────────────── */
function BarBlock({ data }) {
  if (!data?.length) return <Empty />
  const sorted = [...data].sort((a, b) => b.value - a.value)
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={sorted} margin={{ top: 22, right: 16, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: "var(--color-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          tickFormatter={(v) => (v?.length > 10 ? v.slice(0, 10) + "…" : v)}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "var(--color-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={26}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="value" fill={BRAND} radius={[6, 6, 0, 0]} maxBarSize={44}>
          <LabelList dataKey="value" position="top" style={{ fill: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function BarBlockH({ data }) {
  if (!data?.length) return <Empty />
  const fmt = (n = "") => {
    const p = String(n).trim().split(" ")
    return p.length >= 2 ? `${p[0]} ${p[1]}` : n
  }
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const h = Math.max(280, sorted.length * 40)
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart
        layout="vertical"
        data={sorted.map((d) => ({ ...d, name: fmt(d.name) }))}
        margin={{ top: 0, right: 36, bottom: 0, left: 0 }}
      >
        <CartesianGrid stroke="var(--color-border)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: "var(--color-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          dataKey="name"
          type="category"
          tick={{ fill: "var(--color-muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="value" fill={BRAND} radius={[0, 6, 6, 0]} maxBarSize={20}>
          <LabelList dataKey="value" position="right" style={{ fill: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function PieBlock({ data }) {
  if (!data?.length) return <Empty />
  const total = data.reduce((a, b) => a + b.value, 0)
  return (
    <div style={{ position: "relative" }}>
      <ResponsiveContainer width="100%" height={210}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={58}
            outerRadius={82}
            paddingAngle={3}
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {/* center total */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          paddingBottom: 12,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1 }}>{total}</p>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: "3px 0 0" }}>total</p>
        </div>
      </div>
      {/* legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", justifyContent: "center", marginTop: 8 }}>
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{d.name}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: CHART_COLORS[i % CHART_COLORS.length] }}>
                {d.value} ({pct}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── MAIN ───────────────────────────────────────────────────────── */
export default function DashboardDesligamento() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(false)
  const [turno,       setTurno]       = useState("ALL")
  const [inicio,      setInicio]      = useState("2026-01-01")
  const [fim,         setFim]         = useState(isoToday())
  const { estacaoId } = useEstacao()

  async function fetchData() {
    try {
      setLoading(true)
      setError(false)
      const params = {
        turno: turno === "ALL" ? undefined : turno,
        inicio,
        fim,
      }
      const res = await api.get("/dashboard/desligamento", { params })
      setData(res.data?.data ?? res.data)
    } catch (err) {
      console.error("❌ DASHBOARD DESLIGAMENTO:", err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [turno, inicio, fim, estacaoId])

  /* ─── memos ─── */
  const motivos   = useMemo(() => toChartData(data?.motivos),   [data])
  const porTurno  = useMemo(() => toChartData(data?.turno),     [data])
  const porSetor  = useMemo(() => toChartData(data?.setor),     [data])
  const porEmpresa= useMemo(() => toChartData(data?.empresa),   [data])
  const tempoCasa = useMemo(() => toChartData(data?.tempoCasa), [data])
  const porTipo   = useMemo(() => toChartData(data?.tipo),      [data])
  const porLider  = useMemo(() => toChartData(data?.lider).slice(0, 10), [data])
  const porGenero = useMemo(() => toChartData(data?.genero),    [data])

  /* pulse keyframes */
  const css = `
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; }
    .recharts-wrapper, .recharts-surface { overflow: visible !important; }
  `

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080808", color: "#fff" }}>
      <style>{css}</style>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}
           className="lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main
          style={{
            flex: 1,
            padding: "32px 24px 64px",
            maxWidth: 1600,
            width: "100%",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 40,
          }}
        >

          {/* ── PAGE HEADER ──────────────────────────────── */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 4, height: 26, borderRadius: 4, background: BRAND }} />
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
                  Dashboard de Desligamentos
                </h1>
              </div>
              <p style={{ margin: "0 0 0 14px", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
                Dados consolidados de turnover — motivos, perfil e lideranças
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
              <DateInput label="Início" value={inicio} onChange={setInicio} />
              <DateInput label="Fim"    value={fim}    onChange={setFim}    />
              <TurnoSelector value={turno} onChange={setTurno} />
              <button
                onClick={fetchData}
                disabled={loading}
                style={{
                  height: 42,
                  padding: "0 24px",
                  borderRadius: 12,
                  background: loading ? "#333" : BRAND,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "background 0.2s",
                  whiteSpace: "nowrap",
                  alignSelf: "flex-end",
                }}
                onMouseEnter={(e) => !loading && (e.target.style.background = "#e64500")}
                onMouseLeave={(e) => !loading && (e.target.style.background = BRAND)}
              >
                {loading ? "Carregando…" : "Atualizar"}
              </button>
            </div>
          </div>

          {/* error */}
          {error && (
            <div
              style={{
                borderRadius: 14,
                border: "1px solid rgba(239,68,68,0.2)",
                background: "rgba(239,68,68,0.06)",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <IconAlert c="#EF4444" s={17} />
              <p style={{ margin: 0, fontSize: 13, color: "#EF4444", flex: 1 }}>
                Erro ao carregar dados da API.
              </p>
              <button
                onClick={fetchData}
                style={{
                  padding: "6px 16px",
                  borderRadius: 10,
                  background: BRAND,
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 12,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* ── 01 — PANORAMA GERAL ─────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="01" title="Panorama Geral" />
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              <KpiCard
                label="Total"
                value={data?.total ?? 0}
                loading={loading}
              />
              <KpiCard
                label="Tempo Médio"
                value={data?.indicadores?.tempoMedioCasa != null
                  ? `${data.indicadores.tempoMedioCasa} dias`
                  : "0 dias"}
                loading={loading}
              />
              <KpiCard
                label="Precoce < 30d"
                value={data?.indicadores?.desligamentoPrecoce ?? 0}
                loading={loading}
              />
              <KpiCard
                label="Motivo Principal"
                value={data?.insights?.principalMotivo?.label ?? "—"}
                sub={data?.insights?.principalMotivo?.value != null
                  ? `${data.insights.principalMotivo.value} casos`
                  : undefined}
                loading={loading}
              />
              <KpiCard
                label="Turno Crítico"
                value={data?.insights?.turnoCritico?.label ?? "—"}
                sub={data?.insights?.turnoCritico?.value != null
                  ? `${data.insights.turnoCritico.value} casos`
                  : undefined}
                loading={loading}
              />
              <KpiCard
                label="Líder Ofensor"
                value={data?.insights?.liderDestaque?.label ?? "—"}
                sub={data?.insights?.liderDestaque?.value != null
                  ? `${data.insights.liderDestaque.value} casos`
                  : undefined}
                loading={loading}
              />
            </div>
          </section>

          {/* ── 02 — POR QUÊ SAEM? ──────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="02" title="Por Que Saem?" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minWidth: 0 }}>
              <Card
                title="Motivos de Desligamento"
                subtitle="Principais razões registradas no período"
                icon={<IconFlag c={BRAND} s={15} />}
              >
                {loading ? <Skeleton style={{ height: 300 }} /> : <BarBlockH data={motivos.slice(0, 8)} />}
              </Card>
              <Card
                title="Tipo de Desligamento"
                subtitle="Voluntário vs. involuntário e outros"
                icon={<IconPieIcon c={BRAND} s={15} />}
              >
                {loading ? <Skeleton style={{ height: 260 }} /> : <PieBlock data={porTipo} />}
              </Card>
            </div>
          </section>

          {/* ── 03 — ONDE OCORREM? ──────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="03" title="Onde Ocorrem os Desligamentos?" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minWidth: 0 }}>
              <Card
                title="Por Empresa"
                subtitle="Volume por unidade"
                icon={<IconGrid c={BRAND} s={15} />}
              >
                {loading ? <Skeleton style={{ height: 260 }} /> : <BarBlock data={porEmpresa} />}
              </Card>
              <Card
                title="Por Setor"
                subtitle="Áreas com maior concentração"
                icon={<IconGrid c={BRAND} s={15} />}
              >
                {loading ? <Skeleton style={{ height: 260 }} /> : <BarBlock data={porSetor} />}
              </Card>
              <Card
                title="Por Turno"
                subtitle="Distribuição por horário de trabalho"
                icon={<IconSun c={BRAND} s={15} />}
              >
                {loading ? <Skeleton style={{ height: 260 }} /> : <BarBlock data={porTurno} />}
              </Card>
            </div>
          </section>

          {/* ── 04 — PERFIL DOS DESLIGADOS ──────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="04" title="Perfil dos Desligados" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ minWidth: 0 }}>
              <Card
                title="Tempo de Casa"
                subtitle="Maturidade no momento do desligamento"
                icon={<IconClock c={BRAND} s={15} />}
              >
                {loading ? <Skeleton style={{ height: 260 }} /> : <BarBlock data={tempoCasa} />}
              </Card>
              <Card
                title="Por Gênero"
                subtitle="Perfil de gênero dos desligados"
                icon={<IconUsers c={BRAND} s={15} />}
              >
                {loading ? <Skeleton style={{ height: 210 }} /> : <PieBlock data={porGenero} />}
              </Card>
            </div>
          </section>

          {/* ── 05 — LIDERANÇAS ─────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="05" title="Lideranças com Maior Turnover" />
            <Card
              title="Top Líderes"
              subtitle="Equipes com mais desligamentos — atenção para padrões recorrentes"
              icon={<IconAlert c="#F59E0B" s={15} />}
            >
              {loading ? <Skeleton style={{ height: 380 }} /> : <BarBlockH data={porLider} />}
            </Card>
          </section>

        </main>
      </div>
    </div>
  )
}
