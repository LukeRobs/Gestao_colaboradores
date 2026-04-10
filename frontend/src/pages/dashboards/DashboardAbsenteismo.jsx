"use client"
import React, { useEffect, useMemo, useState } from "react"
import { useEstacao } from "../../context/EstacaoContext"
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
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
  ReferenceLine,
} from "recharts"
import api from "../../services/api"
import Sidebar from "../../components/Sidebar"
import Header from "../../components/Header"

/* ─── TOKENS ─────────────────────────────────────────────────────── */
const BRAND = "#FA4C00"
const COLOR_FALTA    = "#FA4C00"
const COLOR_ATESTADO = "#3B82F6"
const CHART_COLORS = [
  "#FA4C00", "#3B82F6", "#F59E0B", "#22C55E",
  "#A855F7", "#EC4899", "#14B8A6",
]

/* ─── UTILS ──────────────────────────────────────────────────────── */
function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
function isoFirstDayOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

/* ─── CUSTOM TOOLTIP ─────────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 12,
      padding: "10px 16px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
    }}>
      {label && (
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 4 }}>{label}</p>
      )}
      {payload.map((p, i) => (
        <p key={i} style={{ color: "var(--color-text)", fontSize: 14, fontWeight: 600, margin: 0 }}>
          <span style={{ color: p.color || BRAND }}>● </span>
          {p.name ? `${p.name}: ` : ""}{p.value}
        </p>
      ))}
    </div>
  )
}

/* ─── SKELETON ───────────────────────────────────────────────────── */
function Skeleton({ style = {} }) {
  return (
    <div style={{
      background: "var(--color-border)",
      borderRadius: 10,
      animation: "pulse 1.5s ease-in-out infinite",
      ...style,
    }} />
  )
}

/* ─── SVG ICONS ──────────────────────────────────────────────────── */
const IconAbsence  = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M9 14l2 2 4-4" />
  </svg>
)
const IconFalta    = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M9 14l2 2 4-4" />
  </svg>
)
const IconMedico   = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
)
const IconRepeat   = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
  </svg>
)
const IconUsers    = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
)
const IconPercent  = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
)
const IconCalDay   = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 14h.01" />
  </svg>
)
const IconCalWeek  = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h8" />
  </svg>
)
const IconCalMonth = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h2M14 14h2M8 18h2M14 18h2" />
  </svg>
)
const IconBed      = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4v16M2 8h20v12M2 12h6M20 20v-8" />
  </svg>
)
const IconTrend    = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
  </svg>
)
const IconGrid     = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
)
const IconAlert    = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)
const IconList     = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
)
const IconSearch   = ({ c = "currentColor", s = 16 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)
const IconDownload = ({ s = 16 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

/* ─── KPI CONFIG ─────────────────────────────────────────────────── */
const KPI_META = {
  "Ausências":    { Icon: IconAbsence,  color: "#FA4C00", desc: "Total no período" },
  "Faltas":       { Icon: IconFalta,    color: "#F97316", desc: "Dias de falta registrados" },
  "Atestados":    { Icon: IconMedico,   color: "#3B82F6", desc: "Atestados médicos" },
  "Dias Afastado":{ Icon: IconBed,      color: "#A855F7", desc: "Dias de falta + dias por atestado" },
  "Recorrência":  { Icon: IconRepeat,   color: "#F59E0B", desc: "Ausentes 2+ vezes" },
  "Impactados":   { Icon: IconUsers,    color: "#22C55E", desc: "Colaboradores únicos" },
  "% HC":         { Icon: IconPercent,  color: "#EC4899", desc: "Headcount afetado" },
  "Hoje":         { Icon: IconCalDay,   color: "#EF4444", desc: "Ausências hoje" },
  "Semana":       { Icon: IconCalWeek,  color: "#F59E0B", desc: "Esta semana" },
  "Mês":          { Icon: IconCalMonth, color: "#22C55E", desc: "Este mês" },
}

/* ─── KPI CARD ───────────────────────────────────────────────────── */
function KpiCard({ label, value, loading }) {
  const { Icon = IconAbsence, color = BRAND, desc = "" } = KPI_META[label] || {}
  return (
    <div
      style={{
        background: "var(--color-surface)",
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
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-3)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-surface-2)")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon c={color} s={13} />
        <p style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 500, margin: 0 }}>{label}</p>
      </div>
      {loading ? (
        <Skeleton style={{ height: 28, width: "55%" }} />
      ) : (
        <p style={{ fontSize: 26, fontWeight: 700, color: "var(--color-text)", margin: 0, lineHeight: 1, letterSpacing: "-0.02em" }}>
          {value ?? "—"}
        </p>
      )}
      <p style={{ fontSize: 10, color: "var(--color-subtle)", margin: 0 }}>{desc}</p>
    </div>
  )
}

/* ─── SECTION LABEL ──────────────────────────────────────────────── */
function SectionLabel({ num, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: BRAND, textTransform: "uppercase", letterSpacing: "0.16em" }}>{num}</span>
      <span style={{ fontSize: 10, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: "0.16em" }}>{title}</span>
    </div>
  )
}

/* ─── CARD ───────────────────────────────────────────────────────── */
function Card({ title, subtitle, icon, children, style = {} }) {
  return (
    <div style={{
      background: "var(--color-surface)",
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
    }}>
      {title && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {icon && (
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: `${BRAND}14`, display: "flex",
              alignItems: "center", justifyContent: "center",
              flexShrink: 0, marginTop: 2,
            }}>
              {icon}
            </div>
          )}
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>{title}</h2>
            {subtitle && <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--color-subtle)" }}>{subtitle}</p>}
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
      <label style={{ fontSize: 10, color: "var(--color-text)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em" }}>
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "var(--color-surface)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "var(--color-text)",
          fontSize: 13,
          borderRadius: 12,
          padding: "9px 14px",
          outline: "none",
          cursor: "pointer",
          colorScheme: "dark",
        }}
        onFocus={(e) => (e.target.style.borderColor = "rgba(250,76,0,0.5)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
      />
    </div>
  )
}

/* ─── SELECT EMPRESA ─────────────────────────────────────────────── */
function SelectEmpresa({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 10, color: "var(--color-text)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em" }}>
        Empresa
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "var(--color-surface)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: value ? "var(--color-text)" : "var(--color-subtle)",
          fontSize: 13,
          borderRadius: 12,
          padding: "9px 14px",
          outline: "none",
          cursor: "pointer",
          colorScheme: "dark",
          minWidth: 160,
        }}
        onFocus={(e) => (e.target.style.borderColor = "rgba(250,76,0,0.5)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
      >
        <option value="">Todas as empresas</option>
        {options.map((e) => (
          <option key={e.idEmpresa} value={e.idEmpresa}>{e.razaoSocial}</option>
        ))}
      </select>
    </div>
  )
}

/* ─── EMPTY ──────────────────────────────────────────────────────── */
function Empty() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, color: "var(--color-subtle)", fontSize: 13 }}>
      Sem dados no período
    </div>
  )
}

/* ─── CHARTS ─────────────────────────────────────────────────────── */
/* label customizado acima de cada ponto */
function DotLabel({ cx, cy, value, fill }) {
  if (!value) return null
  return (
    <text x={cx} y={cy - 8} textAnchor="middle" fill={fill} fontSize={10} fontWeight={700}>
      {value}
    </text>
  )
}

function AreaBlock({ data, onDateClick, selectedDate }) {
  if (!data?.length) return <Empty />
  const hasAtestados = data.some(d => d.atestados > 0)

  const makeDot = (color) => (props) => {
    const { cx, cy, value, payload } = props
    const isSelected = selectedDate && payload?.data === selectedDate
    const r = isSelected ? 6 : 4
    return (
      <g key={`d-${color}-${cx}-${cy}`}>
        {isSelected && <circle cx={cx} cy={cy} r={r + 5} fill={color} opacity={0.18} />}
        <circle cx={cx} cy={cy} r={r} fill={color} stroke="#111" strokeWidth={1.5} />
        <DotLabel cx={cx} cy={cy} value={value} fill={color} />
      </g>
    )
  }

  return (
    <div style={{ position: "relative" }}>
      <p style={{ position: "absolute", top: 0, right: 0, margin: 0, fontSize: 10, color: "var(--color-subtle)", display: "flex", alignItems: "center", gap: 4 }}>
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M2 12h20" /></svg>
        Clique em um dia para filtrar
      </p>
      <ResponsiveContainer width="100%" height={320}>
        {/* ComposedChart: barras invisíveis = área de clique confiável em todo o eixo X */}
        <ComposedChart
          data={data}
          margin={{ top: 32, right: 20, bottom: 0, left: -8 }}
          style={{ cursor: "pointer" }}
        >
          <defs>
            <linearGradient id="areaFalta" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLOR_FALTA} stopOpacity={0.28} />
              <stop offset="95%" stopColor={COLOR_FALTA} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="areaAtestado" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLOR_ATESTADO} stopOpacity={0.22} />
              <stop offset="95%" stopColor={COLOR_ATESTADO} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="data" tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickMargin={8} />
          <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickMargin={4} />
          <Tooltip content={<CustomTooltip />} />

          {selectedDate && (
            <ReferenceLine
              x={selectedDate}
              stroke={BRAND}
              strokeWidth={2}
              strokeDasharray="4 3"
              label={{ value: "▼ " + selectedDate, position: "insideTopLeft", fill: BRAND, fontSize: 10, fontWeight: 700 }}
            />
          )}

          {/* barra invisível para capturar cliques em toda a largura da coluna */}
          <Bar
            dataKey="total"
            fill="transparent"
            maxBarSize={60}
            onClick={(barData) => { if (onDateClick && barData?.data) onDateClick(barData.data) }}
            cursor="pointer"
          />

          <Area type="monotone" dataKey="faltas" name="Faltas" stroke={COLOR_FALTA} strokeWidth={2}
            fill="url(#areaFalta)" dot={makeDot(COLOR_FALTA)}
            activeDot={{ r: 6, fill: COLOR_FALTA, stroke: "#111", strokeWidth: 2 }} />
          {hasAtestados && (
            <Area type="monotone" dataKey="atestados" name="Atestados" stroke={COLOR_ATESTADO} strokeWidth={2}
              fill="url(#areaAtestado)" dot={makeDot(COLOR_ATESTADO)}
              activeDot={{ r: 6, fill: COLOR_ATESTADO, stroke: "#111", strokeWidth: 2 }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function BarBlock({ data, onBarClick, activeBar }) {
  if (!data?.length) return <Empty />
  const h = Math.max(200, data.length * 46)
  const clickable = !!onBarClick
  return (
    <div style={{ position: "relative" }}>
      {clickable && (
        <p style={{ position: "absolute", top: 0, right: 0, margin: 0, fontSize: 10, color: "var(--color-subtle)" }}>
          Clique para filtrar
        </p>
      )}
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={data} margin={{ top: clickable ? 18 : 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickMargin={6}
            tickFormatter={(v) => v?.length > 14 ? v.slice(0, 12) + "…" : v} />
          <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar
            dataKey="value"
            name="Ausências"
            radius={[6, 6, 0, 0]}
            maxBarSize={40}
            cursor={clickable ? "pointer" : "default"}
            onClick={clickable ? (d) => onBarClick(d.name) : undefined}
          >
            {data.map((d, i) => {
              const isActive = activeBar && d.name === activeBar
              return (
                <Cell
                  key={i}
                  fill={isActive ? "#ffffff" : BRAND}
                  opacity={activeBar && !isActive ? 0.35 : 1}
                />
              )
            })}
            <LabelList dataKey="value" position="top" style={{ fill: "var(--color-muted)", fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function BarBlockH({ data, onBarClick, activeBar }) {
  if (!data?.length) return <Empty />
  const h = Math.max(200, data.length * 40)
  const clickable = !!onBarClick
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={130} tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false}
          tickFormatter={(v) => v?.length > 18 ? v.slice(0, 16) + "…" : v} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar
          dataKey="value"
          name="Ausências"
          radius={[0, 6, 6, 0]}
          maxBarSize={22}
          cursor={clickable ? "pointer" : "default"}
          onClick={clickable ? (d) => onBarClick(d.name) : undefined}
        >
          {data.map((d, i) => {
            const isActive = activeBar && d.name === activeBar
            return (
              <Cell
                key={i}
                fill={isActive ? "#ffffff" : BRAND}
                opacity={activeBar && !isActive ? 0.35 : 1}
              />
            )
          })}
          <LabelList dataKey="value" position="right" style={{ fill: "var(--color-muted)", fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function PieBlock({ data }) {
  if (!data?.length) return <Empty />
  const total = data.reduce((s, d) => s + d.value, 0)

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }) => {
    const RADIAN = Math.PI / 180
    if (percent < 0.06) return null
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
        {value}
      </text>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={76}
            innerRadius={34}
            paddingAngle={2}
            labelLine={false}
            label={renderCustomLabel}
          >
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* legenda customizada centralizada com valor + % */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", paddingTop: 6, justifyContent: "center", alignItems: "center" }}>
        {data.map((d, i) => {
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(0) : 0
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{d.name}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text)" }}>{d.value}</span>
              <span style={{ fontSize: 10, color: "var(--color-subtle)" }}>({pct}%)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── TIPO SPLIT CARD ────────────────────────────────────────────── */
function TipoSplitCard({ totalFaltas, totalAtestados, loading }) {
  const total = (totalFaltas || 0) + (totalAtestados || 0)
  const pctFalta    = total > 0 ? Math.round((totalFaltas    / total) * 100) : 0
  const pctAtestado = total > 0 ? Math.round((totalAtestados / total) * 100) : 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* barra */}
      <div style={{ height: 8, borderRadius: 99, overflow: "hidden", background: "rgba(255,255,255,0.06)", display: "flex" }}>
        {loading ? (
          <div style={{ flex: 1, background: "var(--color-border)" }} />
        ) : (
          <>
            <div style={{ width: `${pctFalta}%`, background: COLOR_FALTA, transition: "width 0.6s" }} />
            <div style={{ width: `${pctAtestado}%`, background: COLOR_ATESTADO, transition: "width 0.6s" }} />
          </>
        )}
      </div>
      {/* legenda */}
      <div style={{ display: "flex", gap: 24 }}>
        {[
          { label: "Faltas",    value: totalFaltas,    color: COLOR_FALTA,    pct: pctFalta },
          { label: "Atestados", value: totalAtestados, color: COLOR_ATESTADO, pct: pctAtestado },
        ].map(({ label, value, color, pct }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: 11, color: "var(--color-subtle)" }}>{label}</p>
              {loading ? (
                <Skeleton style={{ height: 18, width: 50, marginTop: 2 }} />
              ) : (
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--color-text)" }}>
                  {value ?? 0}
                  <span style={{ fontSize: 11, fontWeight: 400, color: "var(--color-subtle)", marginLeft: 5 }}>{pct}%</span>
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── TABLE ──────────────────────────────────────────────────────── */
function AbsenceTable({ data, loading }) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(
      (c) =>
        c.nome?.toLowerCase().includes(q) ||
        c.setor?.toLowerCase().includes(q) ||
        c.empresa?.toLowerCase().includes(q)
    )
  }, [data, search])

  const cols = ["Nome", "Empresa", "Setor", "Turno", "Escala", "Tempo de Casa", "Ausências", "Faltas", "Atestados", "Recorrente"]

  function exportCSV() {
    const rows = [
      cols,
      ...filtered.map((c) => [
        c.nome || "",
        c.empresa || "",
        c.setor || "",
        c.turno || "",
        c.escala || "",
        c.tempoCasa || "",
        c.totalAusencias || 0,
        c.totalFaltas || 0,
        c.totalAtestados || 0,
        c.recorrencia ? "Sim" : "Não",
      ]),
    ]
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "absenteismo.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative", maxWidth: 300, flex: 1 }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-subtle)", pointerEvents: "none", display: "flex" }}>
            <IconSearch />
          </div>
          <input
            type="text"
            placeholder="Buscar por nome, setor, empresa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              background: "var(--color-surface)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--color-text)",
              fontSize: 13,
              borderRadius: 12,
              padding: "9px 14px 9px 38px",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(250,76,0,0.45)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
          />
        </div>
        <button
          onClick={exportCSV}
          disabled={loading || filtered.length === 0}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 14px", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "var(--color-surface)",
            color: loading || filtered.length === 0 ? "var(--color-subtle)" : "var(--color-muted)",
            fontSize: 13, fontWeight: 500, cursor: loading || filtered.length === 0 ? "not-allowed" : "pointer",
            whiteSpace: "nowrap", transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => { if (!loading && filtered.length > 0) { e.currentTarget.style.borderColor = "rgba(250,76,0,0.45)"; e.currentTarget.style.color = "#fff" } }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.color = loading || filtered.length === 0 ? "var(--color-subtle)" : "var(--color-muted)" }}
        >
          <IconDownload />
          Exportar CSV
        </button>
      </div>

      <div style={{ overflowX: "auto", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900, fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--color-page)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {cols.map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 10, color: "var(--color-subtle)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {cols.map((_, j) => (
                    <td key={j} style={{ padding: "12px 16px" }}>
                      <Skeleton style={{ height: 14, width: "80%" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={cols.length} style={{ padding: "48px 16px", textAlign: "center", color: "var(--color-subtle)", fontSize: 13 }}>
                  Nenhum resultado encontrado
                </td>
              </tr>
            ) : (
              filtered.map((c, i) => {
                const aus = c.totalAusencias || 0
                const ausColor = aus >= 3 ? "#EF4444" : aus >= 2 ? "#F59E0B" : BRAND
                const ausBg    = aus >= 3 ? "#EF444418" : aus >= 2 ? "#F59E0B18" : `${BRAND}14`
                return (
                  <tr
                    key={i}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", transition: "background 0.15s", cursor: "default" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "11px 16px", fontWeight: 500, color: "var(--color-text)", whiteSpace: "nowrap" }}>
                      {c.nome?.split(" ").slice(0, 2).join(" ")}
                    </td>
                    <td style={{ padding: "11px 16px", color: "var(--color-muted)", whiteSpace: "nowrap" }}>{c.empresa}</td>
                    <td style={{ padding: "11px 16px", color: "var(--color-muted)", whiteSpace: "nowrap" }}>{c.setor}</td>
                    <td style={{ padding: "11px 16px", color: "var(--color-muted)", whiteSpace: "nowrap" }}>{c.turno}</td>
                    <td style={{ padding: "11px 16px", color: "var(--color-muted)", whiteSpace: "nowrap" }}>{c.escala}</td>
                    <td style={{ padding: "11px 16px", color: "var(--color-muted)", whiteSpace: "nowrap" }}>{c.tempoCasa}</td>
                    <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 30, height: 30, borderRadius: 8,
                        background: ausBg, color: ausColor, fontWeight: 700, fontSize: 13,
                      }}>
                        {aus}
                      </span>
                    </td>
                    <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
                      <span style={{ color: c.totalFaltas > 0 ? COLOR_FALTA : "var(--color-subtle)", fontWeight: c.totalFaltas > 0 ? 600 : 400 }}>
                        {c.totalFaltas || 0}
                      </span>
                    </td>
                    <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
                      <span style={{ color: c.totalAtestados > 0 ? COLOR_ATESTADO : "var(--color-subtle)", fontWeight: c.totalAtestados > 0 ? 600 : 400 }}>
                        {c.totalAtestados || 0}
                      </span>
                    </td>
                    <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
                      {c.recorrencia ? (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "3px 10px", borderRadius: 99,
                          background: "#EF444414", color: "#EF4444",
                          fontSize: 11, fontWeight: 600,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#EF4444" }} />
                          Sim
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-subtle)", fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {!loading && filtered.length > 0 && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 11, color: "var(--color-subtle)", margin: 0 }}>
              {filtered.length} de {data.length} colaboradores
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── DRILL PILL ─────────────────────────────────────────────────── */
function DrillPill({ label, onRemove }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 99,
      border: `1px solid ${BRAND}55`, background: `${BRAND}18`,
      color: BRAND, fontSize: 11, fontWeight: 600,
    }}>
      {label}
      <button
        onClick={onRemove}
        style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: BRAND, padding: 0, lineHeight: 1 }}
      >
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════════ */
export default function DashboardAbsenteismo() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [inicio, setInicio] = useState(isoFirstDayOfMonth())
  const [fim, setFim] = useState(isoToday())
  const [empresaId, setEmpresaId] = useState("")
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [kpis, setKpis] = useState(null)
  const [dist, setDist] = useState(null)
  const [tendencia, setTendencia] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [topOfensores, setTopOfensores] = useState([])
  const [porTempoCasa, setPorTempoCasa] = useState([])
  /* ── filtros de drill-down ── */
  const [drillDate,  setDrillDate]  = useState(null)   // dia clicado no gráfico
  const [drillSetor, setDrillSetor] = useState(null)   // setor clicado
  const [drillTurno, setDrillTurno] = useState(null)   // turno clicado
  const [savedRange, setSavedRange] = useState(null)   // período antes do drill de data
  const { estacaoId } = useEstacao()

  /* ── drill: clique em dia no gráfico ── */
  function handleDateClick(date) {
    setSavedRange({ inicio, fim })
    setDrillDate(date)
    setInicio(date)
    setFim(date)
  }

  /* ── drill: clique em setor ── */
  function handleSetorClick(nome) {
    setDrillSetor(prev => prev === nome ? null : nome)
  }

  /* ── drill: clique em turno ── */
  function handleTurnoClick(nome) {
    setDrillTurno(prev => prev === nome ? null : nome)
  }

  /* ── drill: clique em empresa (usa dropdown existente) ── */
  function handleEmpresaClick(nome) {
    const found = empresas.find(e => e.razaoSocial === nome)
    setEmpresaId(prev => (found && prev !== String(found.idEmpresa)) ? String(found.idEmpresa) : "")
  }

  /* ── limpar tudo ── */
  function clearAllDrills() {
    if (savedRange) { setInicio(savedRange.inicio); setFim(savedRange.fim) }
    setDrillDate(null); setDrillSetor(null); setDrillTurno(null)
    setEmpresaId(""); setSavedRange(null)
  }

  const hasDrill = drillDate || drillSetor || drillTurno || empresaId

  useEffect(() => {
    api.get("/empresas").then((res) => {
      const payload = res.data?.data ?? res.data
      setEmpresas(Array.isArray(payload) ? payload : payload?.items ?? [])
    }).catch(() => {})
  }, [])

  async function fetchAll() {
    try {
      setLoading(true)
      setError("")
      const params = {
        inicio,
        fim,
        empresaId:  empresaId  || undefined,
        setorNome:  drillSetor || undefined,
        turnoNome:  drillTurno || undefined,
      }
      const [resResumo, resDist, resTend, resColab] = await Promise.all([
        api.get("/dashboard/absenteismo/resumo",        { params }),
        api.get("/dashboard/absenteismo/distribuicoes", { params }),
        api.get("/dashboard/absenteismo/tendencia",     { params }),
        api.get("/dashboard/absenteismo/colaboradores", { params }),
      ])
      setKpis(resResumo.data?.data?.kpis ?? null)
      setDist(resDist.data?.data ?? null)
      setTendencia(Array.isArray(resTend.data?.data) ? resTend.data.data : resTend.data || [])
      const tabela = resColab.data?.data?.tabela || []
      const top    = resColab.data?.data?.topOfensores || []
      setColaboradores(tabela)
      setTopOfensores(top)
      const mapaTempo = {}
      tabela.forEach((c) => { mapaTempo[c.tempoCasa] = (mapaTempo[c.tempoCasa] || 0) + 1 })
      setPorTempoCasa(Object.entries(mapaTempo).map(([name, value]) => ({ name, value })))
    } catch (err) {
      console.error("❌ DASHBOARD ABSENTEISMO:", err)
      setError("Erro ao carregar dashboard de absenteísmo.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [inicio, fim, empresaId, drillSetor, drillTurno, estacaoId])

  const porEmpresa   = dist?.porEmpresa   || []
  const porSetor     = dist?.porSetor     || []
  const porTurno     = dist?.porTurno     || []
  const porGenero    = dist?.porGenero    || []
  const porLider     = (dist?.porLider    || []).slice(0, 10)
  const porDiaSemana = dist?.porDiaSemana || []
  const porEscala    = dist?.porEscala    || []

  const pulseStyle = `
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; }
    .recharts-wrapper, .recharts-surface { overflow: visible !important; }
  `

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-page)", color: "var(--color-text)" }}>
      <style>{pulseStyle}</style>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }} className="lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main style={{ flex: 1, padding: "32px 24px 64px", maxWidth: 1600, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 40 }}>

          {/* ── PAGE HEADER ─────────────────────────────────── */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 4, height: 26, borderRadius: 4, background: BRAND }} />
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
                  Dashboard de Absenteísmo
                </h1>
              </div>
              <p style={{ margin: "0 0 0 14px", fontSize: 13, color: "var(--color-subtle)" }}>
                Consolidado de Faltas + Atestados Médicos — impacto, recorrência e distribuição
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
              <DateInput label="Início" value={inicio} onChange={setInicio} />
              <DateInput label="Fim"    value={fim}    onChange={setFim} />
              <SelectEmpresa value={empresaId} onChange={setEmpresaId} options={empresas} />
              <button
                onClick={fetchAll}
                disabled={loading}
                style={{
                  height: 42, padding: "0 24px", borderRadius: 12,
                  background: loading ? "#333" : BRAND,
                  color: "var(--color-text)", fontWeight: 700, fontSize: 13,
                  border: "none", cursor: loading ? "not-allowed" : "pointer",
                  transition: "background 0.2s", whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => !loading && (e.target.style.background = "#e64500")}
                onMouseLeave={(e) => !loading && (e.target.style.background = BRAND)}
              >
                {loading ? "Carregando…" : "Atualizar"}
              </button>
            </div>
          </div>

          {/* ── banner: filtros de drill ativos ─────────── */}
          {hasDrill && (
            <div style={{
              borderRadius: 14,
              border: `1px solid ${BRAND}44`,
              background: `${BRAND}0d`,
              padding: "11px 16px",
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}>
              <span style={{ fontSize: 11, color: "var(--color-subtle)", marginRight: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>Filtros ativos:</span>

              {drillDate && (
                <DrillPill
                  label={`📅 ${new Date(drillDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`}
                  onRemove={() => {
                    if (savedRange) { setInicio(savedRange.inicio); setFim(savedRange.fim) }
                    setDrillDate(null); setSavedRange(null)
                  }}
                />
              )}
              {drillSetor && (
                <DrillPill label={`Setor: ${drillSetor}`} onRemove={() => setDrillSetor(null)} />
              )}
              {drillTurno && (
                <DrillPill label={`Turno: ${drillTurno}`} onRemove={() => setDrillTurno(null)} />
              )}
              {empresaId && (
                <DrillPill
                  label={`Empresa: ${empresas.find(e => String(e.idEmpresa) === empresaId)?.razaoSocial || empresaId}`}
                  onRemove={() => setEmpresaId("")}
                />
              )}

              <button
                onClick={clearAllDrills}
                style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-subtle)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Limpar tudo
              </button>
            </div>
          )}

          {/* error */}
          {error && (
            <div style={{ borderRadius: 14, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
              <IconAlert c="#EF4444" s={17} />
              <p style={{ margin: 0, fontSize: 13, color: "#EF4444" }}>{error}</p>
            </div>
          )}

          {/* ── 01 — PANORAMA ───────────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="01" title="Panorama Geral" />

            {/* Split Faltas x Atestados */}
            <Card
              title="Composição das Ausências"
              subtitle="Proporção entre faltas e atestados médicos no período"
              icon={<IconAbsence c={BRAND} s={15} />}
            >
              <TipoSplitCard
                totalFaltas={kpis?.totalFaltas}
                totalAtestados={kpis?.totalAtestados}
                loading={loading}
              />
            </Card>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
              <KpiCard label="Ausências"     value={kpis?.totalPeriodo}             loading={loading} />
              <KpiCard label="Dias Afastado" value={kpis?.diasAfastados}            loading={loading} />
              <KpiCard label="Recorrência"   value={`${kpis?.recorrencia || 0}%`}   loading={loading} />
              <KpiCard label="Impactados"    value={kpis?.colaboradoresImpactados}  loading={loading} />
              <KpiCard label="% HC"          value={`${kpis?.percentualHC || 0}%`}  loading={loading} />
              <KpiCard label="Hoje"          value={kpis?.hoje}                     loading={loading} />
              <KpiCard label="Semana"        value={kpis?.semana}                   loading={loading} />
              <KpiCard label="Mês"           value={kpis?.mes}                      loading={loading} />
            </div>
          </section>

          {/* ── 02 — EVOLUÇÃO ───────────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="02" title="Evolução no Período" />
            <Card
              title="Ausências por dia"
              subtitle="Faltas e atestados médicos ao longo do tempo"
              icon={<IconTrend c={BRAND} s={15} />}
            >
              {loading ? <Skeleton style={{ height: 320 }} /> : (
                <AreaBlock
                  data={tendencia}
                  onDateClick={handleDateClick}
                  selectedDate={drillDate}
                />
              )}
            </Card>
          </section>

          {/* ── 03 — DISTRIBUIÇÃO ───────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="03" title="Onde Estão as Ausências?" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minWidth: 0 }}>
              <Card title="Por Empresa" subtitle="Clique para filtrar por empresa" icon={<IconGrid c={BRAND} s={15} />}>
                {loading ? <Skeleton style={{ height: 260 }} /> : (
                  <BarBlock
                    data={porEmpresa}
                    onBarClick={handleEmpresaClick}
                    activeBar={empresaId ? empresas.find(e => String(e.idEmpresa) === empresaId)?.razaoSocial : null}
                  />
                )}
              </Card>
              <Card title="Por Setor" subtitle="Clique para filtrar por setor" icon={<IconGrid c={BRAND} s={15} />}>
                {loading ? <Skeleton style={{ height: 260 }} /> : (
                  <BarBlock data={porSetor} onBarClick={handleSetorClick} activeBar={drillSetor} />
                )}
              </Card>
            </div>
          </section>

          {/* ── 04 — LIDERANÇAS E OFENSORES ─────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="04" title="Quem Lidera a Ausência?" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minWidth: 0 }}>
              <Card title="Top Líderes" subtitle="Equipes com maior índice de ausência" icon={<IconAlert c="#F59E0B" s={15} />}>
                {loading ? <Skeleton style={{ height: 320 }} /> : <BarBlockH data={porLider} />}
              </Card>
              <Card title="Top 10 Ofensores" subtitle="Colaboradores com mais ausências no período" icon={<IconAlert c="#EF4444" s={15} />}>
                {loading ? (
                  <Skeleton style={{ height: 320 }} />
                ) : (
                  <BarBlockH data={topOfensores.map((c) => ({ name: c.nome, value: c.totalAusencias }))} />
                )}
              </Card>
            </div>
          </section>

          {/* ── 05 — PERFIL ─────────────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="05" title="Perfil dos Ausentes" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" style={{ minWidth: 0 }}>
              <Card title="Por Turno" subtitle="Clique para filtrar por turno">
                {loading ? <Skeleton style={{ height: 210 }} /> : (
                  <BarBlock data={porTurno} onBarClick={handleTurnoClick} activeBar={drillTurno} />
                )}
              </Card>
              <Card title="Por Gênero" subtitle="Perfil de gênero dos ausentes">
                {loading ? <Skeleton style={{ height: 210 }} /> : <PieBlock data={porGenero} />}
              </Card>
              <Card title="Tempo de Casa" subtitle="Maturidade vs. frequência de ausências">
                {loading ? <Skeleton style={{ height: 260 }} /> : <BarBlock data={porTempoCasa} />}
              </Card>
            </div>
          </section>

          {/* ── 06 — CONTEXTO ───────────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="06" title="Ausências por Contexto" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ minWidth: 0 }}>
              <Card title="Por Dia da Semana" subtitle="Quais dias concentram mais ausências">
                {loading ? <Skeleton style={{ height: 210 }} /> : <BarBlock data={porDiaSemana} />}
              </Card>
              <Card title="Por Escala" subtitle="Distribuição de ausências por escala de trabalho">
                {loading ? <Skeleton style={{ height: 210 }} /> : <PieBlock data={porEscala} />}
              </Card>
            </div>
          </section>

          {/* ── 07 — TABELA ─────────────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="07" title="Lista de Ausentes" />
            <Card
              title="Ausentes no período"
              subtitle="Todos os colaboradores com falta ou atestado registrado"
              icon={<IconList c={BRAND} s={15} />}
            >
              <AbsenceTable data={colaboradores} loading={loading} />
            </Card>
          </section>

        </main>
      </div>
    </div>
  )
}
