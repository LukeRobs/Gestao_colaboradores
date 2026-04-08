"use client"
import React, { useContext, useEffect, useMemo, useState } from "react"
import { AuthContext } from "../../context/AuthContext"
import { useEstacao } from "../../context/EstacaoContext"
import {
  ResponsiveContainer,
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
} from "recharts"
import api from "../../services/api"
import Sidebar from "../../components/Sidebar"
import Header from "../../components/Header"

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
function isoFirstDayOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

/* ─── CUSTOM TOOLTIP ─────────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: "var(--color-surface)",
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
        <p key={i} style={{ color: "var(--color-text)", fontSize: 14, fontWeight: 600, margin: 0 }}>
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
        background: "var(--color-border)",
        borderRadius: 10,
        animation: "pulse 1.5s ease-in-out infinite",
        ...style,
      }}
    />
  )
}

/* ─── SVG ICONS ──────────────────────────────────────────────────── */
const IconAbsence = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M9 14l2 2 4-4" />
  </svg>
)
const IconRepeat = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
  </svg>
)
const IconUsers = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
)
const IconPercent = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
)
const IconCalDay = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 14h.01" />
  </svg>
)
const IconCalWeek = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h8" />
  </svg>
)
const IconCalMonth = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h2M14 14h2M8 18h2M14 18h2" />
  </svg>
)
const IconTrend = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
  </svg>
)
const IconGrid = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
)
const IconAlert = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)
const IconUser = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
)
const IconList = ({ c = "currentColor", s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
)
const IconSearch = ({ c = "currentColor", s = 16 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

/* ─── KPI CONFIG ─────────────────────────────────────────────────── */
const KPI_META = {
  "Faltas":       { Icon: IconAbsence,  color: "#FA4C00", desc: "Total no período" },
  "Recorrência":  { Icon: IconRepeat,   color: "#F59E0B", desc: "Faltaram 2+ vezes" },
  "Impactados":   { Icon: IconUsers,    color: "#3B82F6", desc: "Colaboradores únicos" },
  "% HC":         { Icon: IconPercent,  color: "#A855F7", desc: "Headcount afetado" },
  "Hoje":         { Icon: IconCalDay,   color: "#EF4444", desc: "Faltas hoje" },
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
        <p style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 500, margin: 0 }}>
          {label}
        </p>
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
      <span style={{ fontSize: 10, fontWeight: 800, color: BRAND, textTransform: "uppercase", letterSpacing: "0.16em" }}>
        {num}
      </span>
      <span style={{ fontSize: 10, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: "0.16em" }}>
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
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
              {title}
            </h2>
            {subtitle && (
              <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--color-subtle)" }}>
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
          color: "var(--color-text)",
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

/* ─── EMPTY STATE ────────────────────────────────────────────────── */
function Empty() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 160,
        color: "var(--color-subtle)",
        fontSize: 13,
      }}
    >
      Sem dados no período
    </div>
  )
}

/* ─── CHARTS ─────────────────────────────────────────────────────── */
function AreaBlock({ data }) {
  if (!data?.length) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 26, right: 16, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={BRAND} stopOpacity={0.28} />
            <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="data"
          tick={{ fill: "var(--color-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "var(--color-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }} />
        <Area
          dataKey="total"
          stroke={BRAND}
          strokeWidth={2.5}
          fill="url(#areaG)"
          dot={{ fill: BRAND, r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: BRAND, strokeWidth: 0 }}
        >
          <LabelList
            dataKey="total"
            position="top"
            style={{ fill: "var(--color-muted)", fontSize: 10, fontWeight: 600 }}
          />
        </Area>
      </AreaChart>
    </ResponsiveContainer>
  )
}

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
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-border)" }} />
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
    const p = n.split(" ")
    return p.length >= 2 ? `${p[0]} ${p[1]}` : n
  }
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const h = Math.max(280, sorted.length * 38)
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
          width={96}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-border)" }} />
        <Bar dataKey="value" fill={BRAND} radius={[0, 6, 6, 0]} maxBarSize={18}>
          <LabelList dataKey="value" position="right" style={{ fill: "var(--color-muted)", fontSize: 11, fontWeight: 600 }} />
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
      {/* center label */}
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
          <p style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text)", margin: 0, lineHeight: 1 }}>
            {total}
          </p>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: "3px 0 0" }}>total</p>
        </div>
      </div>
      {/* legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", justifyContent: "center", marginTop: 8 }}>
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: CHART_COLORS[i % CHART_COLORS.length],
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{d.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: CHART_COLORS[i % CHART_COLORS.length] }}>
                {d.value}
              </span>
              <span style={{ fontSize: 10, color: "var(--color-subtle)" }}>({pct}%)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── SELECT EMPRESA ─────────────────────────────────────────────── */
function SelectEmpresa({ value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const selected = options.find((e) => String(e.idEmpresa) === String(value))
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, position: "relative" }}>
      <label style={{ fontSize: 10, color: "var(--color-text)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em" }}>Empresa</label>
      <div
        onClick={() => setOpen(!open)}
        style={{ background: "var(--color-surface)", border: `1px solid ${open ? "rgba(250,76,0,0.5)" : "var(--color-border)"}`, color: "var(--color-text)", fontSize: 13, borderRadius: 12, padding: "9px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minWidth: 180, userSelect: "none", transition: "border-color 0.2s" }}
      >
        <span style={{ color: selected ? "#fff" : "var(--color-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
          {selected ? selected.razaoSocial : "Todas as empresas"}
        </span>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--color-subtle)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </div>
      {open && (
        <div className="hide-scrollbar" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 9999, background: "var(--color-surface)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, maxHeight: 240, overflowY: "auto", boxShadow: "0 16px 40px rgba(0,0,0,0.7)", minWidth: "100%" }}>
          <div
            onClick={() => { onChange(""); setOpen(false) }}
            style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: !value ? BRAND : "var(--color-muted)", fontWeight: !value ? 600 : 400, borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-border)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Todas as empresas
          </div>
          {options.map((e) => (
            <div
              key={e.idEmpresa}
              onClick={() => { onChange(String(e.idEmpresa)); setOpen(false) }}
              style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: String(value) === String(e.idEmpresa) ? BRAND : "var(--color-muted)", fontWeight: String(value) === String(e.idEmpresa) ? 600 : 400 }}
              onMouseEnter={(e2) => (e2.currentTarget.style.background = "rgba(250,76,0,0.08)")}
              onMouseLeave={(e2) => (e2.currentTarget.style.background = "transparent")}
            >
              {e.razaoSocial}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── TABLE ──────────────────────────────────────────────────────── */
function IconDownload({ s = 16 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

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

  const cols = ["Nome", "Empresa", "Setor", "Turno", "Escala", "Tempo de Casa", "Faltas", "Recorrente"]

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
        c.totalFaltas || 0,
        c.recorrencia ? "Sim" : "Não",
      ]),
    ]
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "faltantes.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* search + export */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", maxWidth: 300, flex: 1 }}>
        <div
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--color-subtle)",
            pointerEvents: "none",
            display: "flex",
          }}
        >
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
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "var(--color-surface)",
            color: loading || filtered.length === 0 ? "var(--color-subtle)" : "var(--color-muted)",
            fontSize: 13,
            fontWeight: 500,
            cursor: loading || filtered.length === 0 ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => { if (!loading && filtered.length > 0) { e.currentTarget.style.borderColor = "rgba(250,76,0,0.45)"; e.currentTarget.style.color = "#fff" } }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.color = loading || filtered.length === 0 ? "var(--color-subtle)" : "var(--color-muted)" }}
        >
          <IconDownload />
          Exportar CSV
        </button>
      </div>

      {/* table wrapper */}
      <div
        style={{
          overflowX: "auto",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700, fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--color-page)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {cols.map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "12px 16px",
                    fontSize: 10,
                    color: "var(--color-subtle)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.10em",
                    whiteSpace: "nowrap",
                  }}
                >
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
                <td colSpan={8} style={{ padding: "48px 16px", textAlign: "center", color: "var(--color-subtle)", fontSize: 13 }}>
                  Nenhum resultado encontrado
                </td>
              </tr>
            ) : (
              filtered.map((c, i) => {
                const faltas = c.totalFaltas || 0
                const faltaColor = faltas >= 3 ? "#EF4444" : faltas >= 2 ? "#F59E0B" : BRAND
                const faltaBg = faltas >= 3 ? "#EF444418" : faltas >= 2 ? "#F59E0B18" : `${BRAND}14`
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
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          background: faltaBg,
                          color: faltaColor,
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {faltas}
                      </span>
                    </td>
                    <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
                      {c.recorrencia ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "3px 10px",
                            borderRadius: 99,
                            background: "#EF444414",
                            color: "#EF4444",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
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
          <div
            style={{
              padding: "10px 16px",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <p style={{ fontSize: 11, color: "var(--color-subtle)", margin: 0 }}>
              {filtered.length} de {data.length} colaboradores
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── MAIN ───────────────────────────────────────────────────────── */
export default function DashboardFaltas() {
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
  const { estacaoId } = useEstacao()

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
      const params = { inicio, fim, empresaId: empresaId || undefined }
      const [resResumo, resDist, resTend, resColab] = await Promise.all([
        api.get("/dashboard/faltas/resumo", { params }),
        api.get("/dashboard/faltas/distribuicoes", { params }),
        api.get("/dashboard/faltas/tendencia", { params }),
        api.get("/dashboard/faltas/colaboradores", { params }),
      ])
      setKpis(resResumo.data?.data?.kpis ?? resResumo.data?.kpis ?? null)
      setDist(resDist.data?.data ?? resDist.data ?? null)
      setTendencia(
        Array.isArray(resTend.data?.data) ? resTend.data.data : resTend.data || []
      )
      const tabela = resColab.data?.data?.tabela || []
      const top = resColab.data?.data?.topOfensores || []
      setColaboradores(tabela)
      setTopOfensores(top)
      const mapaTempo = {}
      tabela.forEach((c) => {
        mapaTempo[c.tempoCasa] = (mapaTempo[c.tempoCasa] || 0) + 1
      })
      setPorTempoCasa(
        Object.entries(mapaTempo).map(([name, value]) => ({ name, value }))
      )
    } catch (err) {
      console.error("❌ DASHBOARD FALTAS:", err)
      setError("Erro ao carregar dashboard de faltas.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [inicio, fim, empresaId, estacaoId])

  const porEmpresa = dist?.porEmpresa || []
  const porSetor   = dist?.porSetor   || []
  const porTurno   = dist?.porTurno   || []
  const porGenero  = dist?.porGenero  || []
  const porLider   = (dist?.porLider  || []).slice(0, 10)
  const porDiaSemana = dist?.porDiaSemana || []
  const porEscala    = dist?.porEscala    || []

  /* pulse keyframes injected once */
  const pulseStyle = `
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; }
    .recharts-wrapper, .recharts-surface { overflow: visible !important; }
    .hide-scrollbar::-webkit-scrollbar { display: none; }
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-page)", color: "var(--color-text)" }}>
      <style>{pulseStyle}</style>
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

          {/* ── PAGE HEADER ─────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 20,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 4, height: 26, borderRadius: 4, background: BRAND }} />
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
                  Dashboard de Faltas
                </h1>
              </div>
              <p style={{ margin: "0 0 0 14px", fontSize: 13, color: "var(--color-subtle)" }}>
                Panorama completo de ausências — impacto, recorrência e distribuição
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
              <DateInput label="Início" value={inicio} onChange={setInicio} />
              <DateInput label="Fim" value={fim} onChange={setFim} />
              <SelectEmpresa value={empresaId} onChange={setEmpresaId} options={empresas} />
              <button
                onClick={fetchAll}
                disabled={loading}
                style={{
                  height: 42,
                  padding: "0 24px",
                  borderRadius: 12,
                  background: loading ? "#333" : BRAND,
                  color: "var(--color-text)",
                  fontWeight: 700,
                  fontSize: 13,
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "background 0.2s",
                  whiteSpace: "nowrap",
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
                gap: 10,
              }}
            >
              <IconAlert c="#EF4444" s={17} />
              <p style={{ margin: 0, fontSize: 13, color: "#EF4444" }}>{error}</p>
            </div>
          )}

          {/* ── 01 — PANORAMA GERAL ─────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="01" title="Panorama Geral" />
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
              <KpiCard label="Faltas"      value={kpis?.totalPeriodo}              loading={loading} />
              <KpiCard label="Recorrência" value={`${kpis?.recorrencia || 0}%`}    loading={loading} />
              <KpiCard label="Impactados"  value={kpis?.colaboradoresImpactados}   loading={loading} />
              <KpiCard label="% HC"        value={`${kpis?.percentualHC || 0}%`}   loading={loading} />
              <KpiCard label="Hoje"        value={kpis?.hoje}                      loading={loading} />
              <KpiCard label="Semana"      value={kpis?.semana}                    loading={loading} />
              <KpiCard label="Mês"         value={kpis?.mes}                       loading={loading} />
            </div>

          </section>

          {/* ── 02 — EVOLUÇÃO ───────────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="02" title="Evolução no Período" />
            <Card
              title="Faltas por dia"
              subtitle="Como o volume de ausências variou ao longo do tempo"
              icon={<IconTrend c={BRAND} s={15} />}
            >
              {loading ? <Skeleton style={{ height: 280 }} /> : <AreaBlock data={tendencia} />}
            </Card>
          </section>

          {/* ── 03 — DISTRIBUIÇÃO ───────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="03" title="Onde Estão as Faltas?" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minWidth: 0 }}>
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
            </div>
          </section>

          {/* ── 04 — LIDERANÇAS E OFENSORES ─────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="04" title="Quem Lidera a Ausência?" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minWidth: 0 }}>
              <Card
                title="Top Líderes"
                subtitle="Equipes com maior índice de ausência"
                icon={<IconAlert c="#F59E0B" s={15} />}
              >
                {loading ? <Skeleton style={{ height: 320 }} /> : <BarBlockH data={porLider} />}
              </Card>
              <Card
                title="Top 10 Ofensores"
                subtitle="Colaboradores com mais faltas no período"
                icon={<IconAlert c="#EF4444" s={15} />}
              >
                {loading ? (
                  <Skeleton style={{ height: 320 }} />
                ) : (
                  <BarBlockH
                    data={topOfensores.map((c) => ({ name: c.nome, value: c.totalFaltas }))}
                  />
                )}
              </Card>
            </div>
          </section>

          {/* ── 05 — PERFIL ─────────────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="05" title="Perfil dos Faltantes" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" style={{ minWidth: 0 }}>
              <Card title="Por Turno" subtitle="Distribuição por horário de trabalho">
                {loading ? <Skeleton style={{ height: 210 }} /> : <PieBlock data={porTurno} />}
              </Card>
              <Card title="Por Gênero" subtitle="Perfil de gênero dos ausentes">
                {loading ? <Skeleton style={{ height: 210 }} /> : <PieBlock data={porGenero} />}
              </Card>
              <Card title="Tempo de Casa" subtitle="Maturidade vs. frequência de ausências">
                {loading ? <Skeleton style={{ height: 260 }} /> : <BarBlock data={porTempoCasa} />}
              </Card>
            </div>
          </section>

          {/* ── 06 — FALTAS POR CONTEXTO ────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="06" title="Faltas por Contexto" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ minWidth: 0 }}>
              <Card title="Por Dia da Semana" subtitle="Quais dias concentram mais ausências">
                {loading ? <Skeleton style={{ height: 210 }} /> : <BarBlock data={porDiaSemana} />}
              </Card>
              <Card title="Por Escala" subtitle="Distribuição de faltas por escala de trabalho">
                {loading ? <Skeleton style={{ height: 210 }} /> : <PieBlock data={porEscala} />}
              </Card>
            </div>
          </section>

          {/* ── 07 — TABELA ─────────────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="07" title="Lista de Faltantes" />
            <Card
              title="Faltantes no período"
              subtitle="Todos os colaboradores com ausência registrada"
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
