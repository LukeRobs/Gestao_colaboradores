"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
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
  Legend,
  LineChart,
  Line,
} from "recharts"
import api from "../../services/api"
import Sidebar from "../../components/Sidebar"
import Header from "../../components/Header"
import { useEstacao } from "../../context/EstacaoContext"

/* ─── TOKENS ─────────────────────────────────────────────────────── */
const BRAND = "#FA4C00"
const CHART_COLORS = ["#FA4C00","#3B82F6","#F59E0B","#22C55E","#A855F7","#EC4899","#14B8A6"]

/* ─── UTILS ──────────────────────────────────────────────────────── */
function isoToday() { return new Date().toISOString().slice(0, 10) }
function isoFirstDayOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

const CID_DESCRICOES = {
  A09: "Sintomas Gripais", J11: "Sintomas Gripais", J069: "Sintomas Gripais",
  B349: "Sintomas Gripais", H920: "Sintomas Gripais",
  M545: "Dor lombar (lombalgia)", M796: "Dor em membros",
  R11: "Náuseas e vômitos", R52: "Dor não especificada", R520: "Dor aguda",
}

// Mapa invertido: sintoma → [códigos CID]
const SINTOMA_CIDS = Object.entries(CID_DESCRICOES).reduce((acc, [codigo, sintoma]) => {
  if (!acc[sintoma]) acc[sintoma] = []
  acc[sintoma].push(codigo)
  return acc
}, {})

/* ─── SKELETON ───────────────────────────────────────────────────── */
function Skeleton({ style = {} }) {
  return (
    <div style={{ background: "var(--color-border)", borderRadius: 10, animation: "pulse 1.5s ease-in-out infinite", ...style }} />
  )
}

/* ─── SVG ICONS ──────────────────────────────────────────────────── */
const IconDoc      = ({ c = "currentColor", s = 18 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
const IconRepeat   = ({ c = "currentColor", s = 18 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" /></svg>
const IconUsers    = ({ c = "currentColor", s = 18 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
const IconPercent  = ({ c = "currentColor", s = 18 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>
const IconCalDay   = ({ c = "currentColor", s = 18 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 14h.01" /></svg>
const IconCalWeek  = ({ c = "currentColor", s = 18 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h8" /></svg>
const IconCalMonth = ({ c = "currentColor", s = 18 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h2M14 14h2M8 18h2M14 18h2" /></svg>
const IconAlert    = ({ c = "currentColor", s = 18 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
const IconChevronDown = ({ c = "currentColor", s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>

/* ─── KPI CONFIG ─────────────────────────────────────────────────── */
const KPI_META = {
  "Atestados":   { Icon: IconDoc,      color: "#FA4C00", desc: "Total no período" },
  "Recorrência": { Icon: IconRepeat,   color: "#F59E0B", desc: "Atestaram 2+ vezes" },
  "Impactados":  { Icon: IconUsers,    color: "#3B82F6", desc: "Colaboradores únicos" },
  "% HC":        { Icon: IconPercent,  color: "#A855F7", desc: "Headcount afetado" },
  "Hoje":        { Icon: IconCalDay,   color: "#EF4444", desc: "Atestados hoje" },
  "Semana":      { Icon: IconCalWeek,  color: "#F59E0B", desc: "Esta semana" },
  "Mês":         { Icon: IconCalMonth, color: "#22C55E", desc: "Este mês" },
}

/* ─── KPI CARD ───────────────────────────────────────────────────── */
function KpiCard({ label, value, loading }) {
  const { Icon = IconDoc, color = BRAND, desc = "" } = KPI_META[label] || {}
  return (
    <div
      style={{ background: "var(--color-surface)", border: "1px solid rgba(255,255,255,0.07)", borderLeft: `3px solid ${color}`, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, cursor: "default", transition: "background 0.2s" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-3)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-surface-2)")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon c={color} s={13} />
        <p style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 500, margin: 0 }}>{label}</p>
      </div>
      {loading ? <Skeleton style={{ height: 28, width: "55%" }} /> : (
        <p style={{ fontSize: 26, fontWeight: 700, color: "var(--color-text)", margin: 0, lineHeight: 1, letterSpacing: "-0.02em" }}>{value ?? "—"}</p>
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
    <div style={{ background: "var(--color-surface)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, minWidth: 0, width: "100%", boxSizing: "border-box", ...style }}>
      {title && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {icon && (
            <div style={{ width: 30, height: 30, borderRadius: 9, background: `${BRAND}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
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
      <label style={{ fontSize: 10, color: "var(--color-text)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ background: "var(--color-surface)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--color-text)", fontSize: 13, borderRadius: 12, padding: "9px 14px", outline: "none", cursor: "pointer" }}
      />
    </div>
  )
}

/* ─── SELECT EMPRESA ─────────────────────────────────────────────── */
function SelectEmpresa({ value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const selected = options.find((e) => String(e.idEmpresa) === String(value))
  useEffect(() => {
    function handleClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])
  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 5, position: "relative" }}>
      <label style={{ fontSize: 10, color: "var(--color-text)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em" }}>Empresa</label>
      <div
        onClick={() => setOpen(!open)}
        style={{ background: "var(--color-surface)", border: `1px solid ${open ? "rgba(250,76,0,0.5)" : "var(--color-border)"}`, color: "var(--color-text)", fontSize: 13, borderRadius: 12, padding: "9px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minWidth: 180, userSelect: "none", transition: "border-color 0.2s" }}
      >
        <span style={{ color: selected ? "#fff" : "var(--color-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
          {selected ? selected.razaoSocial : "Todas as empresas"}
        </span>
        <IconChevronDown c="var(--color-subtle)" />
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

/* ─── SELECT CID ─────────────────────────────────────────────────── */
function SelectCID({ value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const selected = options.find((c) => c.codigo === value)
  useEffect(() => {
    function handleClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])
  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 5, position: "relative" }}>
      <label style={{ fontSize: 10, color: "var(--color-text)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em" }}>CID</label>
      <div
        onClick={() => setOpen(!open)}
        style={{ background: "var(--color-surface)", border: `1px solid ${open ? "rgba(250,76,0,0.5)" : "var(--color-border)"}`, color: "var(--color-text)", fontSize: 13, borderRadius: 12, padding: "9px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minWidth: 160, userSelect: "none", transition: "border-color 0.2s" }}
      >
        <span style={{ color: selected ? "#fff" : "var(--color-subtle)" }}>
          {selected ? `${selected.codigo} (${selected.total})` : "Todos os CIDs"}
        </span>
        <IconChevronDown c="var(--color-subtle)" />
      </div>
      {open && (
        <div className="hide-scrollbar" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 9999, background: "var(--color-surface)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, maxHeight: 240, overflowY: "auto", boxShadow: "0 16px 40px rgba(0,0,0,0.7)", minWidth: "100%" }}>
          <div
            onClick={() => { onChange(""); setOpen(false) }}
            style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: !value ? BRAND : "var(--color-muted)", fontWeight: !value ? 600 : 400, borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-border)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Todos os CIDs
          </div>
          {options.map((c) => (
            <div
              key={c.codigo}
              onClick={() => { onChange(c.codigo); setOpen(false) }}
              style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: value === c.codigo ? BRAND : "var(--color-muted)", fontWeight: value === c.codigo ? 600 : 400 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(250,76,0,0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {c.codigo} — {CID_DESCRICOES[c.codigo] || "CID"}{" "}
              <span style={{ color: "var(--color-subtle)" }}>({c.total})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── SELECT SINTOMA ─────────────────────────────────────────────── */
function SelectSintoma({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const sintomas = Object.keys(SINTOMA_CIDS)
  useEffect(() => {
    function handleClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])
  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 5, position: "relative" }}>
      <label style={{ fontSize: 10, color: "var(--color-text)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em" }}>Sintoma</label>
      <div
        onClick={() => setOpen(!open)}
        style={{ background: "var(--color-surface)", border: `1px solid ${open ? "rgba(250,76,0,0.5)" : value ? "rgba(250,76,0,0.35)" : "var(--color-border)"}`, color: "var(--color-text)", fontSize: 13, borderRadius: 12, padding: "9px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minWidth: 180, userSelect: "none", transition: "border-color 0.2s" }}
      >
        <span style={{ color: value ? "#fff" : "var(--color-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
          {value || "Todos os sintomas"}
        </span>
        <IconChevronDown c="var(--color-subtle)" />
      </div>
      {open && (
        <div className="hide-scrollbar" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 9999, background: "var(--color-surface)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, maxHeight: 240, overflowY: "auto", boxShadow: "0 16px 40px rgba(0,0,0,0.7)", minWidth: "100%" }}>
          <div
            onClick={() => { onChange(""); setOpen(false) }}
            style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: !value ? BRAND : "var(--color-muted)", fontWeight: !value ? 600 : 400, borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-border)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Todos os sintomas
          </div>
          {sintomas.map((s) => (
            <div
              key={s}
              onClick={() => { onChange(s); setOpen(false) }}
              style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: value === s ? BRAND : "var(--color-muted)", fontWeight: value === s ? 600 : 400 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(250,76,0,0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span>{s}</span>
              <span style={{ marginLeft: 8, fontSize: 11, color: "var(--color-subtle)" }}>
                ({SINTOMA_CIDS[s].join(", ")})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── BAR BLOCK ──────────────────────────────────────────────────── */
function BarBlock({ data }) {
  const safeData = Array.isArray(data) ? data : []
  if (!safeData.length) return <p className="text-sm text-white/60">Sem dados no período.</p>
  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={safeData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid stroke="var(--color-border)" />
          <XAxis dataKey="name" tick={{ fill: "var(--color-muted)", fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted)", fontSize: 12 }} />
          <Tooltip contentStyle={{ background: "var(--color-surface-2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
          <Bar dataKey="value" fill={BRAND}>
            <LabelList dataKey="value" position="top" style={{ fill: "#FFF", fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ─── BAR BLOCK HORIZONTAL ───────────────────────────────────────── */
function BarBlockHorizontal({ data }) {
  const safeData = Array.isArray(data) ? data : []
  if (!safeData.length) return <p className="text-sm text-white/60">Sem dados no período.</p>
  const formatName = (name) => {
    const parts = String(name || "").trim().split(" ")
    return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : name
  }
  const formatted = safeData.map((d) => ({ ...d, name: formatName(d.name) }))
  return (
    <div className="h-[280px] sm:h-80 lg:h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid stroke="var(--color-border)" />
          <XAxis type="number" allowDecimals={false} domain={[0, "dataMax + 2"]} tick={{ fill: "var(--color-muted)", fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
          <Tooltip contentStyle={{ background: "var(--color-surface-2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
          <Bar dataKey="value" fill={BRAND}>
            <LabelList dataKey="value" position="right" style={{ fill: "#FFF", fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ─── BAR BLOCK HORIZONTAL CID ───────────────────────────────────── */
function BarBlockHorizontalCID({ data }) {
  const safeData = Array.isArray(data) ? data : []
  if (!safeData.length) return <p className="text-sm text-white/60">Sem dados no período.</p>
  const height = Math.max(260, safeData.length * 34)
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={safeData} layout="vertical" barSize={18} barCategoryGap="18%" margin={{ top: 5, right: 28, left: 10, bottom: 5 }}>
          <CartesianGrid stroke="var(--color-border)" />
          <XAxis type="number" allowDecimals={false} domain={[0, (dataMax) => dataMax + 0.3]} tick={{ fill: "var(--color-muted)", fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fill: "var(--color-muted)", fontSize: 12 }} />
          <Tooltip
            formatter={(value, _, props) => [`${value} atestados`, props.payload.full || props.payload.name]}
            contentStyle={{ background: "var(--color-surface-2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
          />
          <Bar dataKey="value" fill={BRAND} radius={[0, 6, 6, 0]}>
            <LabelList dataKey="value" position="right" style={{ fill: "#FFFFFF", fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ─── PIE BLOCK ──────────────────────────────────────────────────── */
function PieBlock({ data }) {
  const safeData = Array.isArray(data) ? data : []
  if (!safeData.length) return <p className="text-sm text-white/60">Sem dados no período.</p>
  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={safeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
            {safeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: "var(--color-surface-2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ─── TOP OFENSORES TABLE ────────────────────────────────────────── */
function TopOfensoresTable({ rows, loading }) {
  if (loading) return <p className="text-sm text-white/60">Carregando…</p>
  if (!rows?.length) return <p className="text-sm text-white/60">Sem ofensores no período.</p>
  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table className="w-full text-sm" style={{ minWidth: 480, borderCollapse: "collapse" }}>
        <thead className="text-white/60">
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <th className="text-left py-2 pr-2" style={{ width: 28 }}>#</th>
            <th className="text-left py-2 pr-2">Colaborador</th>
            <th className="text-left py-2 pr-2 hidden sm:table-cell">Empresa</th>
            <th className="text-left py-2 pr-2">Setor</th>
            <th className="text-left py-2 pr-2">Turno</th>
            <th className="text-left py-2 pr-2 hidden md:table-cell">Tempo</th>
            <th className="text-right py-2 pr-2">Atst.</th>
            <th className="text-right py-2">Dias</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.opsId} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }} className="hover:bg-white/5 transition">
              <td className="py-2 pr-2 text-white/50" style={{ fontSize: 12 }}>{r.rank}</td>
              <td className="py-2 pr-2 font-medium" style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.nome}>{r.nome}</td>
              <td className="py-2 pr-2 text-white/70 hidden sm:table-cell" style={{ fontSize: 12, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.empresa}>{r.empresa || "N/I"}</td>
              <td className="py-2 pr-2 text-white/70" style={{ fontSize: 12, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.setor}>{r.setor || "N/I"}</td>
              <td className="py-2 pr-2 text-white/70" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{r.turno || "N/I"}</td>
              <td className="py-2 pr-2 hidden md:table-cell">
                <span className={`px-2 py-1 rounded-md text-xs font-semibold ${r.tempoCasaFaixa === "0 a 7" || r.tempoCasaFaixa === "8 a 15" || r.tempoCasaFaixa === "16 a 30" ? "bg-[#FF453A]/20 text-[#FF453A]" : r.tempoCasaFaixa === "31 a 89" ? "bg-[#FF9F0A]/20 text-[#FF9F0A]" : "bg-[#34C759]/20 text-[#34C759]"}`}>
                  {r.tempoCasaFaixa || "N/I"}
                </span>
              </td>
              <td className="py-2 pr-2 text-right font-semibold" style={{ fontSize: 13 }}>{r.totalAtestados}</td>
              <td className="py-2 text-right font-semibold text-[#FA4C00]" style={{ fontSize: 13 }}>{r.diasAfastados}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── COLABORADORES TABLE ────────────────────────────────────────── */
const COLS = ["Colaborador", "Empresa", "Setor", "Turno", "Escala", "Tempo Casa", "Atestados"]

function ColaboradoresTable({ data, loading, filtroTempoCasa, setFiltroTempoCasa, filtroTurno, setFiltroTurno, colaboradores }) {
  const filtered = useMemo(() => {
    const tempoCasaMap = { "0 a 7": ["0 a 7"], "8 a 15": ["8 a 15"], "16 a 30": ["16 a 30"], "31 a 89": ["31 a 89"], "90+": ["90+"] }
    return data.filter((c) => {
      if (filtroTempoCasa && !tempoCasaMap[filtroTempoCasa]?.includes(c.tempoCasa)) return false
      if (filtroTurno && c.turno !== filtroTurno) return false
      return true
    })
  }, [data, filtroTempoCasa, filtroTurno])

  return (
    <Card title="Colaboradores com Atestados">
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select value={filtroTempoCasa} onChange={(e) => setFiltroTempoCasa(e.target.value)} className="bg-[#1c1c1c] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="">Tempo de casa (Todos)</option>
          <option value="0 a 7">0 a 7</option>
          <option value="8 a 15">8 a 15</option>
          <option value="16 a 30">16 a 30</option>
          <option value="31 a 89">31 a 89</option>
          <option value="90+">90+</option>
        </select>
        <select value={filtroTurno} onChange={(e) => setFiltroTurno(e.target.value)} className="bg-[#1c1c1c] border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="">Turno (Todos)</option>
          {[...new Set(colaboradores.map((c) => c.turno))].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div style={{ overflowX: "auto", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700, fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--color-page)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {COLS.map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 10, color: "var(--color-subtle)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {COLS.map((_, j) => <td key={j} style={{ padding: "12px 16px" }}><Skeleton style={{ height: 14, width: "80%" }} /></td>)}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={COLS.length} style={{ padding: "48px 16px", textAlign: "center", color: "var(--color-subtle)", fontSize: 13 }}>Nenhum resultado encontrado</td></tr>
            ) : (
              filtered.map((c, i) => {
                const atst = c.totalAtestados || 0
                const atstColor = atst >= 3 ? "#EF4444" : atst >= 2 ? "#F59E0B" : BRAND
                const atstBg = atst >= 3 ? "#EF444418" : atst >= 2 ? "#F59E0B18" : `${BRAND}14`
                return (
                  <tr key={c.opsId || i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", transition: "background 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "11px 16px", fontWeight: 500, color: "var(--color-text)", whiteSpace: "nowrap" }}>{c.nome}</td>
                    <td style={{ padding: "11px 16px", color: "var(--color-muted)", whiteSpace: "nowrap" }}>{c.empresa}</td>
                    <td style={{ padding: "11px 16px", color: "var(--color-muted)", whiteSpace: "nowrap" }}>{c.setor}</td>
                    <td style={{ padding: "11px 16px", color: "var(--color-muted)", whiteSpace: "nowrap" }}>{c.turno}</td>
                    <td style={{ padding: "11px 16px", color: "var(--color-muted)", whiteSpace: "nowrap" }}>{c.escala}</td>
                    <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 8, background: "var(--color-border)", color: "var(--color-muted)", fontSize: 12 }}>{c.tempoCasa}</span>
                    </td>
                    <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: atstBg, color: atstColor, fontWeight: 700, fontSize: 13 }}>{atst}</span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        {!loading && filtered.length > 0 && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 11, color: "var(--color-subtle)", margin: 0 }}>{filtered.length} de {data.length} colaboradores</p>
          </div>
        )}
      </div>
    </Card>
  )
}

/* ─── MAIN PAGE ──────────────────────────────────────────────────── */
export default function DashboardAtestados() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [inicio, setInicio] = useState(isoFirstDayOfMonth())
  const [fim, setFim] = useState(isoToday())
  const [cid, setCid] = useState("")
  const [cids, setCids] = useState([])
  const [sintoma, setSintoma] = useState("")
  const [empresaId, setEmpresaId] = useState("")
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [kpis, setKpis] = useState(null)
  const [dist, setDist] = useState(null)
  const [tendencia, setTendencia] = useState([])
  const [topOfensores, setTopOfensores] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [filtroTempoCasa, setFiltroTempoCasa] = useState("")
  const [filtroTurno, setFiltroTurno] = useState("")
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
      const params = { inicio, fim, cid: cid || undefined, empresaId: empresaId || undefined }
      // se sintoma selecionado, envia os CIDs do grupo (ignora filtro de CID individual)
      if (sintoma && SINTOMA_CIDS[sintoma]) {
        delete params.cid
        params.cids = SINTOMA_CIDS[sintoma]
      }
      const [resResumo, resDist, resTend, resRisco, resCids, resColab] = await Promise.all([
        api.get("/dashboard/atestados/resumo", { params }),
        api.get("/dashboard/atestados/distribuicoes", { params }),
        api.get("/dashboard/atestados/tendencia", { params }),
        api.get("/dashboard/atestados/risco", { params }),
        api.get("/dashboard/atestados/cids", { params }),
        api.get("/dashboard/atestados/colaboradores", { params }),
      ])
      setKpis(resResumo.data?.data?.kpis ?? resResumo.data?.kpis ?? null)
      setDist(resDist.data?.data ?? resDist.data ?? null)
      setCids(resCids.data?.data || [])
      setColaboradores(resColab.data?.data || [])
      setTendencia(Array.isArray(resTend.data?.data) ? resTend.data.data : Array.isArray(resTend.data) ? resTend.data : [])
      setTopOfensores(resRisco.data?.data?.topOfensores ?? resRisco.data?.topOfensores ?? [])
    } catch (err) {
      console.error("❌ DASHBOARD ATESTADOS:", err)
      setError("Erro ao carregar dashboard de atestados.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [inicio, fim, cid, sintoma, empresaId, estacaoId])

  const porEmpresa   = useMemo(() => dist?.porEmpresa   || [], [dist])
  const porSetor     = useMemo(() => dist?.porSetor     || [], [dist])
  const porTurno     = useMemo(() => dist?.porTurno     || [], [dist])
  const porGenero    = useMemo(() => dist?.porGenero    || [], [dist])
  const porLider     = useMemo(() => (dist?.porLider    || []).slice(0, 10), [dist])
  const porTempoCasa = useMemo(() => dist?.porTempoCasa || [], [dist])

  const porCidChart = useMemo(() => {
    if (!dist?.porCid) return []
    return dist.porCid.map((item) => ({ ...item, name: `${item.name} — ${CID_DESCRICOES[item.name] || "Outros"}`, full: `${item.name} — ${CID_DESCRICOES[item.name] || "Outros"}` })).slice(0, 10)
  }, [dist])

  const cidTableData = useMemo(() => {
    const agrupado = {}
    ;(dist?.porCid || []).forEach((c) => {
      const categoria = CID_DESCRICOES[c.name] || "Outros"
      agrupado[categoria] = (agrupado[categoria] || 0) + c.value
    })
    const relevantes = []
    let outrosTotal = 0
    Object.entries(agrupado).forEach(([name, value]) => {
      if (value <= 2) outrosTotal += value
      else relevantes.push({ name, value })
    })
    if (outrosTotal > 0) relevantes.push({ name: "Outros", value: outrosTotal })
    return relevantes.sort((a, b) => b.value - a.value)
  }, [dist])

  const pulseStyle = `
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; }
    .recharts-wrapper, .recharts-surface { overflow: visible !important; }
    select option { background: #1A1A1A; }
    .hide-scrollbar::-webkit-scrollbar { display: none; }
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-page)", color: "var(--color-text)" }}>
      <style>{pulseStyle}</style>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }} className="lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main style={{ flex: 1, padding: "32px 24px 64px", maxWidth: 1600, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 40 }}>

          {/* PAGE HEADER */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 4, height: 26, borderRadius: 4, background: BRAND }} />
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>Dashboard de Atestados</h1>
              </div>
              <p style={{ margin: "0 0 0 14px", fontSize: 13, color: "var(--color-subtle)" }}>
                Visão completa de impacto, recorrência e diagnóstico de ausências médicas
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
              <DateInput label="Início" value={inicio} onChange={setInicio} />
              <DateInput label="Fim" value={fim} onChange={setFim} />
              <SelectEmpresa value={empresaId} onChange={setEmpresaId} options={empresas} />
              <SelectSintoma
                value={sintoma}
                onChange={(v) => { setSintoma(v); if (v) setCid("") }}
              />
              <SelectCID
                value={cid}
                onChange={(v) => { setCid(v); if (v) setSintoma("") }}
                options={cids}
              />
              <button
                onClick={fetchAll}
                disabled={loading}
                style={{ height: 42, padding: "0 24px", borderRadius: 12, background: loading ? "#333" : BRAND, color: "var(--color-text)", fontWeight: 700, fontSize: 13, border: "none", cursor: loading ? "not-allowed" : "pointer", transition: "background 0.2s", whiteSpace: "nowrap", alignSelf: "flex-end" }}
                onMouseEnter={(e) => !loading && (e.target.style.background = "#e64500")}
                onMouseLeave={(e) => !loading && (e.target.style.background = BRAND)}
              >
                {loading ? "Carregando…" : "Atualizar"}
              </button>
            </div>
          </div>

          {/* ERROR */}
          {error && (
            <div style={{ borderRadius: 14, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
              <IconAlert c="#EF4444" s={17} />
              <p style={{ margin: 0, fontSize: 13, color: "#EF4444" }}>{error}</p>
            </div>
          )}

          {/* 01 — PANORAMA GERAL */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="01" title="Panorama Geral" />
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
              <KpiCard label="Atestados"   value={kpis?.totalPeriodo}              loading={loading} />
              <KpiCard label="Recorrência" value={`${kpis?.recorrencia ?? 0}%`}    loading={loading} />
              <KpiCard label="Impactados"  value={kpis?.colaboradoresImpactados}   loading={loading} />
              <KpiCard label="% HC"        value={`${kpis?.percentualHC ?? 0}%`}   loading={loading} />
              <KpiCard label="Hoje"        value={kpis?.hoje}                      loading={loading} />
              <KpiCard label="Semana"      value={kpis?.semana}                    loading={loading} />
              <KpiCard label="Mês"         value={kpis?.mes}                       loading={loading} />
            </div>
          </section>

          {/* 02 — TENDÊNCIA */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="02" title="Tendência" />
            <Card title="Atestados por dia">
              <div className="h-[220px] sm:h-[260px] lg:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={Array.isArray(tendencia) ? tendencia : []}>
                    <CartesianGrid stroke="var(--color-border)" />
                    <XAxis dataKey="data" tick={{ fill: "var(--color-muted)", fontSize: 12 }} minTickGap={20} />
                    <YAxis tick={{ fill: "var(--color-muted)", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="total" stroke={BRAND} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }}>
                      <LabelList dataKey="total" position="top" style={{ fill: "#FFFFFF", fontSize: 12, fontWeight: 600 }} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </section>

          {/* 03 — DISTRIBUIÇÕES */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="03" title="Distribuições" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Atestados por Empresa"><BarBlock data={porEmpresa} /></Card>
              <Card title="Atestados por Setor"><BarBlock data={porSetor} /></Card>
              <Card title="Top 10 Líderes"><BarBlockHorizontal data={porLider} /></Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card title="Por Turno"><PieBlock data={porTurno} /></Card>
                <Card title="Por Gênero"><PieBlock data={porGenero} /></Card>
              </div>
            </div>
          </section>

          {/* 04 — TEMPO DE CASA + CID */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="04" title="Tempo de Casa & CID" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Atestados por Tempo de Casa">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porTempoCasa}>
                      <CartesianGrid stroke="var(--color-border)" />
                      <XAxis dataKey="name" tick={{ fill: "var(--color-muted)", fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted)", fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: "var(--color-surface-2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                      <Bar dataKey="value" fill={BRAND}>
                        <LabelList dataKey="value" position="top" style={{ fill: "#FFF", fontSize: 12, fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="CID — Distribuição Completa">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-white/60">
                      <tr>
                        <th className="text-left py-2">Categoria</th>
                        <th className="text-right py-2">Qtd</th>
                        <th className="text-right py-2">% Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const total = cidTableData.reduce((acc, i) => acc + i.value, 0)
                        return cidTableData.map((c, index) => (
                          <tr key={index} className="border-t border-white/5 hover:bg-white/5">
                            <td className="py-2 font-medium">{c.name === "Outros" ? <span className="text-white/50">{c.name}</span> : c.name}</td>
                            <td className="py-2 text-right font-semibold">{c.value}</td>
                            <td className="py-2 text-right text-[#FA4C00] font-semibold">{total > 0 ? ((c.value / total) * 100).toFixed(1) : 0}%</td>
                          </tr>
                        ))
                      })()}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </section>

          {/* 05 — RANKING */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="05" title="Ranking" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Top 10 CID (dado sensível)"><BarBlockHorizontalCID data={porCidChart} /></Card>
              <Card title="Top 10 Ofensores (colaboradores)"><TopOfensoresTable rows={topOfensores} loading={loading} /></Card>
            </div>
          </section>

          {/* 06 — COLABORADORES */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel num="06" title="Colaboradores" />
            <ColaboradoresTable
              data={colaboradores}
              loading={loading}
              filtroTempoCasa={filtroTempoCasa}
              setFiltroTempoCasa={setFiltroTempoCasa}
              filtroTurno={filtroTurno}
              setFiltroTurno={setFiltroTurno}
              colaboradores={colaboradores}
            />
          </section>

        </main>
      </div>
    </div>
  )
}
