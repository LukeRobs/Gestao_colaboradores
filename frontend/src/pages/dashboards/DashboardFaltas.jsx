"use client"
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useEstacao } from "../../context/EstacaoContext"
import MainLayout from "../../components/MainLayout"
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LabelList,
} from "recharts"
import api from "../../services/api"
import Sidebar from "../../components/Sidebar"
import Header from "../../components/Header"

/* ─── TOKENS ─────────────────────────────────────────────────────── */
const BRAND   = "#FA4C00"
const COLORS  = ["#FA4C00", "#3B82F6", "#F59E0B", "#22C55E", "#A855F7", "#EC4899", "#14B8A6", "#F97316", "#8B5CF6", "#06B6D4"]
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

const MD_CFG = {
  ASSINADA: { label: "MD Assinada",        color: "#22C55E", bg: "#22C55E14" },
  GERADA:   { label: "MD Gerada",          color: "#F59E0B", bg: "#F59E0B14" },
  PARCIAL:  { label: "Parcialmente Tratado", color: "#3B82F6", bg: "#3B82F614" },
  SEM_MD:   { label: "Sem MD",             color: "#6B7280", bg: "#6B728014" },
}

const PAGE_SIZE = 10

/* ─── HELPERS ────────────────────────────────────────────────────── */
function isoToday()        { return new Date().toISOString().slice(0, 10) }
function isoFirstOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10) }

function fmtDate(iso) {
  if (!iso) return "—"
  const [y, m, d] = iso.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

function getStatusDisciplinar({ totalFaltas, mdAssinadas, mdGeradas }) {
  const semMD = Math.max(0, totalFaltas - mdAssinadas - mdGeradas)
  if (semMD === totalFaltas)                          return "SEM_MD"
  if (mdAssinadas === totalFaltas)                   return "ASSINADA"
  if (mdGeradas + mdAssinadas === totalFaltas && mdGeradas > 0) return "GERADA"
  return "PARCIAL"
}

function toArr(obj) {
  return Object.entries(obj).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

/* ─── SKELETON ───────────────────────────────────────────────────── */
function Sk({ w = "100%", h = 16, r = 8 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "var(--color-border)",
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  )
}

function Empty() {
  return (
    <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-subtle)", fontSize: 13 }}>
      Sem dados no período
    </div>
  )
}

/* ─── TOOLTIP ────────────────────────────────────────────────────── */
function CTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: "10px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
      {label && <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: "var(--color-text)", fontSize: 14, fontWeight: 600, margin: 0 }}>
          <span style={{ color: p.color || BRAND }}>● </span>{p.value}
        </p>
      ))}
    </div>
  )
}

/* ─── BADGE ─────────────────────────────────────────────────── */
function MDBadge({ status, small }) {
  const cfg = MD_CFG[status] || MD_CFG.SEM_MD
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: small ? "2px 8px" : "4px 10px",
      borderRadius: 99,
      background: cfg.bg,
      color: cfg.color,
      fontSize: small ? 10 : 11,
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
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

/* ─── SECTION LABEL ──────────────────────────────────────────────── */
function SL({ num, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: BRAND, textTransform: "uppercase", letterSpacing: "0.16em" }}>{num}</span>
      <span style={{ fontSize: 10, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: "0.16em" }}>{title}</span>
    </div>
  )
}

/* ─── KPI CARD ───────────────────────────────────────────────────── */
function KpiCard({ label, value, desc, color = BRAND, loading }) {
  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderLeft: `3px solid ${color}`,
      borderRadius: 12,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      <p style={{ fontSize: 10, color: "var(--color-muted)", fontWeight: 500, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
      {loading
        ? <Sk h={26} w="55%" />
        : <p style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text)", margin: 0, lineHeight: 1 }}>{value ?? "—"}</p>
      }
      {desc && <p style={{ fontSize: 10, color: "var(--color-subtle)", margin: 0 }}>{desc}</p>}
    </div>
  )
}

/* ─── ACTIVE FILTERS ─────────────────────────────────────────────── */
const CF_LABELS = {
  turno: "Turno", setor: "Setor", empresa: "Empresa", lider: "Líder",
  diaSemana: "Dia", escala: "Escala", statusMd: "Status MD",
}

function ActiveFilters({ cf, onClear, onRemove }) {
  const active = Object.entries(cf).filter(([, v]) => v !== null)
  if (!active.length) return null

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 11, color: "var(--color-subtle)" }}>Filtros ativos:</span>
      {active.map(([key, val]) => (
        <span key={key} style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 99,
          background: `${BRAND}20`, border: `1px solid ${BRAND}50`,
          color: BRAND, fontSize: 11, fontWeight: 600,
        }}>
          <span style={{ color: "var(--color-subtle)", fontWeight: 400 }}>{CF_LABELS[key]}:</span>
          {key === "statusMd" ? (MD_CFG[val]?.label || val) : val}
          <button
            onClick={() => onRemove(key)}
            style={{ background: "none", border: "none", cursor: "pointer", color: BRAND, padding: 0, lineHeight: 1, fontSize: 14 }}
          >×</button>
        </span>
      ))}
      <button
        onClick={onClear}
        style={{
          background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 99,
          color: "var(--color-muted)", fontSize: 11, padding: "4px 10px", cursor: "pointer",
        }}
      >
        Limpar tudo
      </button>
    </div>
  )
}

/* ─── DATE INPUT ─────────────────────────────────────────────────── */
function DateInput({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 10, color: "var(--color-text)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</label>
      <input
        type="date" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ background: "var(--color-surface)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--color-text)", fontSize: 13, borderRadius: 12, padding: "9px 14px", outline: "none", cursor: "pointer", colorScheme: "dark" }}
        onFocus={(e) => (e.target.style.borderColor = "rgba(250,76,0,0.5)")}
        onBlur={(e)  => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
      />
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
        style={{ background: "var(--color-surface)", border: `1px solid ${open ? "rgba(250,76,0,0.5)" : "rgba(255,255,255,0.08)"}`, color: "var(--color-text)", fontSize: 13, borderRadius: 12, padding: "9px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minWidth: 180, userSelect: "none" }}
      >
        <span style={{ color: selected ? "#fff" : "var(--color-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
          {selected ? selected.razaoSocial : "Todas as empresas"}
        </span>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--color-subtle)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </div>
      {open && (
        <div className="hide-scrollbar" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 9999, background: "var(--color-surface)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, maxHeight: 240, overflowY: "auto", boxShadow: "0 16px 40px rgba(0,0,0,0.7)", minWidth: "100%" }}>
          <div onClick={() => { onChange(""); setOpen(false) }} style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: !value ? BRAND : "var(--color-muted)", fontWeight: !value ? 600 : 400, borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-border)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >Todas as empresas</div>
          {options.map((e) => (
            <div key={e.idEmpresa} onClick={() => { onChange(String(e.idEmpresa)); setOpen(false) }}
              style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: String(value) === String(e.idEmpresa) ? BRAND : "var(--color-muted)", fontWeight: String(value) === String(e.idEmpresa) ? 600 : 400 }}
              onMouseEnter={(e2) => (e2.currentTarget.style.background = "rgba(250,76,0,0.08)")}
              onMouseLeave={(e2) => (e2.currentTarget.style.background = "transparent")}
            >{e.razaoSocial}</div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── CLICKABLE BAR (vertical) ───────────────────────────────────── */
function ClickBar({ data, activeValue, onFilter, loading, height = 250 }) {
  if (loading) return <Sk h={height} />
  if (!data?.length) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 22, right: 16, bottom: 0, left: -12 }}
        onClick={(e) => { if (e?.activeLabel != null) onFilter(e.activeLabel) }}
        style={{ cursor: "pointer" }}
      >
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickMargin={8}
          tickFormatter={(v) => (v?.length > 10 ? v.slice(0, 10) + "…" : v)} />
        <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={26} />
        <Tooltip content={<CTip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={44}>
          <LabelList dataKey="value" position="top" style={{ fill: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 600 }} />
          {data.map((d, i) => (
            <Cell key={i} fill={!activeValue || d.name === activeValue ? BRAND : `${BRAND}33`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ─── CLICKABLE BAR (horizontal) ────────────────────────────────── */
function ClickBarH({ data, activeValue, onFilter, loading }) {
  if (loading) return <Sk h={280} />
  if (!data?.length) return <Empty />
  const fmt = (n = "") => { const p = n.split(" "); return p.length >= 2 ? `${p[0]} ${p[1]}` : n }
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const h = Math.max(280, sorted.length * 38)
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart layout="vertical" data={sorted.map((d) => ({ ...d, name: fmt(d.name) }))}
        margin={{ top: 0, right: 36, bottom: 0, left: 0 }}
        onClick={(e) => { if (e?.activeLabel != null) onFilter(e.activeLabel) }}
        style={{ cursor: "pointer" }}
      >
        <CartesianGrid stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis dataKey="name" type="category" tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} width={96} />
        <Tooltip content={<CTip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={18}>
          <LabelList dataKey="value" position="right" style={{ fill: "var(--color-muted)", fontSize: 11, fontWeight: 600 }} />
          {sorted.map((d, i) => (
            <Cell key={i} fill={!activeValue || d.name === activeValue ? BRAND : `${BRAND}33`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ─── CLICKABLE PIE ──────────────────────────────────────────────── */
function ClickPie({ data, activeValue, onFilter, loading }) {
  if (loading) return <Sk h={210} />
  if (!data?.length) return <Empty />
  const total = data.reduce((a, b) => a + b.value, 0)
  return (
    <div style={{ position: "relative" }}>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={54} outerRadius={78} paddingAngle={3} strokeWidth={0}
            onClick={(d) => onFilter(d.name)} style={{ cursor: "pointer" }}
          >
            {data.map((d, i) => (
              <Cell key={i}
                fill={!activeValue || d.name === activeValue
                  ? COLORS[i % COLORS.length]
                  : `${COLORS[i % COLORS.length]}44`
                }
              />
            ))}
          </Pie>
          <Tooltip content={<CTip />} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", paddingBottom: 8 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)", margin: 0, lineHeight: 1 }}>{total}</p>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: "3px 0 0" }}>total</p>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 14px", justifyContent: "center", marginTop: 8 }}>
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", opacity: !activeValue || d.name === activeValue ? 1 : 0.4 }}
              onClick={() => onFilter(d.name)}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS[i % COLORS.length], flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{d.name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: COLORS[i % COLORS.length] }}>{d.value}</span>
              <span style={{ fontSize: 10, color: "var(--color-subtle)" }}>({pct}%)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── AREA CHART ─────────────────────────────────────────────────── */
function AreaBlock({ data, loading }) {
  if (loading) return <Sk h={290} />
  if (!data?.length) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={290}>
      <AreaChart data={data} margin={{ top: 26, right: 16, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="aG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={BRAND} stopOpacity={0.28} />
            <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="data" tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickMargin={8} />
        <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
        <Tooltip content={<CTip />} cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }} />
        <Area dataKey="total" stroke={BRAND} strokeWidth={2.5} fill="url(#aG)"
          dot={{ fill: BRAND, r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: BRAND, strokeWidth: 0 }}>
          <LabelList dataKey="total" position="top" style={{ fill: "var(--color-muted)", fontSize: 10, fontWeight: 600 }} />
        </Area>
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ─── STATUS PIE (disciplinar) ───────────────────────────────────── */
function StatusMDPie({ data, activeValue, onFilter, loading }) {
  if (loading) return <Sk h={200} />
  if (!data?.length) return <Empty />
  const total = data.reduce((a, b) => a + b.value, 0)
  const colorOf = (name) => MD_CFG[name]?.color || "#6B7280"
  return (
    <div style={{ position: "relative" }}>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={54} outerRadius={78} paddingAngle={3} strokeWidth={0}
            onClick={(d) => onFilter(d.name)} style={{ cursor: "pointer" }}>
            {data.map((d, i) => (
              <Cell key={i}
                fill={!activeValue || d.name === activeValue ? colorOf(d.name) : `${colorOf(d.name)}44`}
              />
            ))}
          </Pie>
          <Tooltip content={<CTip />} formatter={(v, n, p) => [v, MD_CFG[p.payload.name]?.label || p.payload.name]} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", paddingBottom: 8 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)", margin: 0, lineHeight: 1 }}>{total}</p>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: "3px 0 0" }}>colabs</p>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 14px", justifyContent: "center", marginTop: 8 }}>
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
          const col = colorOf(d.name)
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", opacity: !activeValue || d.name === activeValue ? 1 : 0.4 }}
              onClick={() => onFilter(d.name)}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: col, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{MD_CFG[d.name]?.label || d.name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: col }}>{d.value}</span>
              <span style={{ fontSize: 10, color: "var(--color-subtle)" }}>({pct}%)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── SORT HEADER ────────────────────────────────────────────────── */
function Th({ label, col, sort, onSort, align = "left" }) {
  const active = sort.key === col
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        textAlign: align,
        padding: "12px 16px",
        fontSize: 10,
        color: active ? BRAND : "var(--color-subtle)",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.10em",
        whiteSpace: "nowrap",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {label}
      {active && (
        <span style={{ marginLeft: 4 }}>{sort.dir === "asc" ? "↑" : "↓"}</span>
      )}
    </th>
  )
}

/* ─── TABLE ──────────────────────────────────────────────────────── */
function AbsenceTable({ data, loading, statusMdFilter, onStatusMdFilter }) {
  const [search, setSearch] = useState("")
  const [sort, setSort]     = useState({ key: "totalFaltas", dir: "desc" })
  const [page, setPage]     = useState(1)

  function handleSort(col) {
    setSort((prev) => ({ key: col, dir: prev.key === col && prev.dir === "desc" ? "asc" : "desc" }))
    setPage(1)
  }

  const filtered = useMemo(() => {
    let list = data
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c) =>
        c.nome?.toLowerCase().includes(q) ||
        c.setor?.toLowerCase().includes(q) ||
        c.empresa?.toLowerCase().includes(q) ||
        c.lider?.toLowerCase().includes(q)
      )
    }
    if (statusMdFilter) {
      list = list.filter((c) => c.statusDisciplinar === statusMdFilter)
    }
    return [...list].sort((a, b) => {
      const va = a[sort.key] ?? ""
      const vb = b[sort.key] ?? ""
      const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb))
      return sort.dir === "asc" ? cmp : -cmp
    })
  }, [data, search, statusMdFilter, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function exportCSV() {
    const cols = ["Nome", "Empresa", "Setor", "Turno", "Escala", "Tempo de Casa",
      "Faltas", "MD Geradas", "MD Assinadas", "Status Disciplinar",
      "Última Falta", "Última MD Gerada", "Última MD Assinada"]
    const rows = [
      cols,
      ...filtered.map((c) => [
        c.nome, c.empresa, c.setor, c.turno, c.escala, c.tempoCasa,
        c.totalFaltas, c.mdGeradas, c.mdAssinadas,
        MD_CFG[c.statusDisciplinar]?.label || c.statusDisciplinar,
        fmtDate(c.ultimaFalta), fmtDate(c.ultimaMDGerada), fmtDate(c.ultimaMDAssinada),
      ]),
    ]
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url; a.download = "faltantes.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* BUSCA + EXPORT */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", maxWidth: 320, flex: 1 }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-subtle)", pointerEvents: "none" }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </div>
          <input type="text" placeholder="Buscar por nome, setor, líder…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            style={{ width: "100%", background: "var(--color-surface)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--color-text)", fontSize: 13, borderRadius: 12, padding: "9px 14px 9px 38px", outline: "none", boxSizing: "border-box" }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(250,76,0,0.45)")}
            onBlur={(e)  => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />
        </div>
        <button onClick={exportCSV} disabled={loading || filtered.length === 0}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "var(--color-surface)", color: "var(--color-muted)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(250,76,0,0.45)"; e.currentTarget.style.color = "#fff" }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "var(--color-muted)" }}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          Exportar CSV
        </button>
      </div>

      {/* TABLE */}
      <div style={{ overflowX: "auto", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000, fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--color-page)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <Th label="Nome"              col="nome"            sort={sort} onSort={handleSort} />
              <Th label="Empresa"           col="empresa"         sort={sort} onSort={handleSort} />
              <Th label="Setor"             col="setor"           sort={sort} onSort={handleSort} />
              <Th label="Turno"             col="turno"           sort={sort} onSort={handleSort} />
              <Th label="Escala"            col="escala"          sort={sort} onSort={handleSort} />
              <Th label="Casa"              col="tempoCasa"       sort={sort} onSort={handleSort} />
              <Th label="Faltas"            col="totalFaltas"     sort={sort} onSort={handleSort} align="center" />
              <Th label="MD Geradas"        col="mdGeradas"       sort={sort} onSort={handleSort} align="center" />
              <Th label="MD Assinadas"      col="mdAssinadas"     sort={sort} onSort={handleSort} align="center" />
              <Th label="Status"            col="statusDisciplinar" sort={sort} onSort={handleSort} />
              <Th label="Última Falta"      col="ultimaFalta"     sort={sort} onSort={handleSort} />
              <Th label="Última MD Gerada"  col="ultimaMDGerada"  sort={sort} onSort={handleSort} />
              <Th label="Última MD Assind." col="ultimaMDAssinada" sort={sort} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {Array.from({ length: 13 }).map((_, j) => (
                    <td key={j} style={{ padding: "12px 16px" }}><Sk h={13} w="80%" /></td>
                  ))}
                </tr>
              ))
            ) : pageData.length === 0 ? (
              <tr><td colSpan={13} style={{ padding: "48px 16px", textAlign: "center", color: "var(--color-subtle)", fontSize: 13 }}>Nenhum resultado encontrado</td></tr>
            ) : (
              pageData.map((c, i) => {
                const fColor = c.totalFaltas >= 3 ? "#EF4444" : c.totalFaltas >= 2 ? "#F59E0B" : BRAND
                const fBg    = c.totalFaltas >= 3 ? "#EF444418" : c.totalFaltas >= 2 ? "#F59E0B18" : `${BRAND}14`
                return (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 16px", fontWeight: 500, color: "var(--color-text)", whiteSpace: "nowrap" }}>
                      {c.nome?.split(" ").slice(0, 2).join(" ")}
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--color-muted)", whiteSpace: "nowrap" }}>{c.empresa}</td>
                    <td style={{ padding: "10px 16px", color: "var(--color-muted)", whiteSpace: "nowrap" }}>{c.setor}</td>
                    <td style={{ padding: "10px 16px", color: "var(--color-muted)", whiteSpace: "nowrap" }}>{c.turno}</td>
                    <td style={{ padding: "10px 16px", color: "var(--color-muted)", whiteSpace: "nowrap" }}>{c.escala}</td>
                    <td style={{ padding: "10px 16px", color: "var(--color-muted)", whiteSpace: "nowrap" }}>{c.tempoCasa}</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: fBg, color: fColor, fontWeight: 700, fontSize: 13 }}>
                        {c.totalFaltas}
                      </span>
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>
                      {c.mdGeradas > 0
                        ? <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: "#F59E0B14", color: "#F59E0B", fontWeight: 700, fontSize: 13 }}>{c.mdGeradas}</span>
                        : <span style={{ color: "var(--color-subtle)" }}>—</span>
                      }
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>
                      {c.mdAssinadas > 0
                        ? <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: "#22C55E14", color: "#22C55E", fontWeight: 700, fontSize: 13 }}>{c.mdAssinadas}</span>
                        : <span style={{ color: "var(--color-subtle)" }}>—</span>
                      }
                    </td>
                    <td style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>
                      <MDBadge status={c.statusDisciplinar} small />
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--color-muted)", whiteSpace: "nowrap", fontSize: 12 }}>{fmtDate(c.ultimaFalta)}</td>
                    <td style={{ padding: "10px 16px", color: c.ultimaMDGerada ? "#F59E0B" : "var(--color-subtle)", whiteSpace: "nowrap", fontSize: 12 }}>{fmtDate(c.ultimaMDGerada)}</td>
                    <td style={{ padding: "10px 16px", color: c.ultimaMDAssinada ? "#22C55E" : "var(--color-subtle)", whiteSpace: "nowrap", fontSize: 12 }}>{fmtDate(c.ultimaMDAssinada)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* PAGINATION */}
        {!loading && filtered.length > 0 && (
          <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <p style={{ fontSize: 11, color: "var(--color-subtle)", margin: 0 }}>
              {filtered.length} colaborador{filtered.length !== 1 ? "es" : ""} •{" "}
              Página {page} de {totalPages}
            </p>
            <div style={{ display: "flex", gap: 4 }}>
              <PagBtn label="«" onClick={() => setPage(1)}      disabled={page === 1} />
              <PagBtn label="‹" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} />
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = page - 2 + i
                if (p < 1) p = 1 + i
                if (p > totalPages) p = totalPages - (4 - i)
                return <PagBtn key={p} label={p} onClick={() => setPage(p)} active={p === page} />
              })}
              <PagBtn label="›" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} />
              <PagBtn label="»" onClick={() => setPage(totalPages)} disabled={page === totalPages} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PagBtn({ label, onClick, disabled, active }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        minWidth: 32, height: 32, borderRadius: 8,
        border: active ? `1px solid ${BRAND}` : "1px solid rgba(255,255,255,0.08)",
        background: active ? `${BRAND}20` : "transparent",
        color: active ? BRAND : disabled ? "var(--color-subtle)" : "var(--color-muted)",
        fontSize: 12, fontWeight: active ? 700 : 400, cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s",
      }}
    >{label}</button>
  )
}

/* ─── MAIN PAGE ──────────────────────────────────────────────────── */
const EMPTY_CF = { turno: null, setor: null, empresa: null, lider: null, diaSemana: null, escala: null, statusMd: null }

export default function DashboardFaltas() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { estacaoId } = useEstacao()

  /* global API filters */
  const [inicio,    setInicio]    = useState(isoFirstOfMonth())
  const [fim,       setFim]       = useState(isoToday())
  const [empresaId, setEmpresaId] = useState("")
  const [empresas,  setEmpresas]  = useState([])

  /* raw data */
  const [rawFaltas, setRawFaltas] = useState([])
  const [totalHC,   setTotalHC]   = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState("")

  /* cross-filter state */
  const [cf, setCf] = useState(EMPTY_CF)

  /* load companies */
  useEffect(() => {
    api.get("/empresas").then((r) => {
      const p = r.data?.data ?? r.data
      setEmpresas(Array.isArray(p) ? p : p?.items ?? [])
    }).catch(() => {})
  }, [])

  /* fetch raw data */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const res = await api.get("/dashboard/faltas/raw", {
        params: { inicio, fim, empresaId: empresaId || undefined },
      })
      setRawFaltas(res.data?.data?.faltas ?? [])
      setTotalHC(res.data?.data?.totalHC ?? 0)
    } catch (err) {
      console.error("❌ DASHBOARD FALTAS RAW:", err)
      setError("Erro ao carregar dados de faltas.")
    } finally {
      setLoading(false)
    }
  }, [inicio, fim, empresaId, estacaoId])

  useEffect(() => { fetchData() }, [fetchData])

  /* toggle cross filter */
  function toggleCF(key, value) {
    setCf((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }))
  }
  function clearCF()     { setCf(EMPTY_CF) }
  function removeCF(key) { setCf((prev) => ({ ...prev, [key]: null })) }

  /* ── DERIVED DATA ─────────────────────────────────────────────── */

  /* 1) faltas após cross-filter de dimensões de falta */
  const filteredFaltas = useMemo(() => {
    return rawFaltas.filter((f) => {
      if (cf.turno    && f.turno    !== cf.turno)    return false
      if (cf.setor    && f.setor    !== cf.setor)    return false
      if (cf.empresa  && f.empresa  !== cf.empresa)  return false
      if (cf.lider) {
        const fmtLider = (n = "") => n.split(" ").slice(0, 2).join(" ")
        if (fmtLider(f.lider) !== cf.lider) return false
      }
      if (cf.diaSemana) {
        const ds = DIAS_SEMANA[new Date(f.dataReferencia + "T12:00:00").getDay()]
        if (ds !== cf.diaSemana) return false
      }
      if (cf.escala   && f.escala   !== cf.escala)   return false
      return true
    })
  }, [rawFaltas, cf])

  /* 2) agregação por colaborador */
  const colabsData = useMemo(() => {
    const map = {}
    for (const f of filteredFaltas) {
      if (!map[f.opsId]) {
        map[f.opsId] = {
          opsId: f.opsId, nome: f.nome, empresa: f.empresa, setor: f.setor,
          turno: f.turno, lider: f.lider, escala: f.escala, genero: f.genero,
          tempoCasa: f.tempoCasa, dataAdmissao: f.dataAdmissao,
          totalFaltas: 0, mdGeradas: 0, mdAssinadas: 0,
          ultimaFalta: null, ultimaMDGerada: null, ultimaMDAssinada: null,
        }
      }
      const c = map[f.opsId]
      c.totalFaltas++
      if (f.mdStatus === "ASSINADA") c.mdAssinadas++
      else if (f.mdStatus === "GERADA") c.mdGeradas++

      if (!c.ultimaFalta || f.dataReferencia > c.ultimaFalta)
        c.ultimaFalta = f.dataReferencia
      if (f.mdStatus === "GERADA" && f.md?.dataAplicacao) {
        if (!c.ultimaMDGerada || f.md.dataAplicacao > c.ultimaMDGerada)
          c.ultimaMDGerada = f.md.dataAplicacao
      }
      if (f.mdStatus === "ASSINADA" && f.md?.dataAtualizacao) {
        if (!c.ultimaMDAssinada || f.md.dataAtualizacao > c.ultimaMDAssinada)
          c.ultimaMDAssinada = f.md.dataAtualizacao
      }
    }
    return Object.values(map).map((c) => ({
      ...c,
      recorrencia: c.totalFaltas >= 2,
      statusDisciplinar: getStatusDisciplinar(c),
    }))
  }, [filteredFaltas])

  /* 3) filteredColabs (por statusMd filter + search feita dentro da table) */
  const filteredColabs = useMemo(() => {
    if (!cf.statusMd) return colabsData
    return colabsData.filter((c) => c.statusDisciplinar === cf.statusMd)
  }, [colabsData, cf.statusMd])

  /* ── KPIs GERAIS ──────────────────────────────────────────────── */
  const kpis = useMemo(() => {
    const total      = filteredFaltas.length
    const opsIds     = new Set(filteredFaltas.map((f) => f.opsId))
    const impactados = opsIds.size
    const recorr     = colabsData.filter((c) => c.totalFaltas >= 2).length
    const recorrPct  = impactados > 0 ? Number(((recorr / impactados) * 100).toFixed(2)) : 0
    const hcPct      = totalHC > 0 ? Number(((impactados / totalHC) * 100).toFixed(2)) : 0

    const hoje   = isoToday()
    const agora  = new Date()
    const dow    = agora.getDay()
    const diff   = dow === 0 ? 6 : dow - 1
    const seg    = new Date(agora); seg.setDate(agora.getDate() - diff)
    const inicioSem = seg.toISOString().slice(0, 10)
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().slice(0, 10)

    const fHoje  = filteredFaltas.filter((f) => f.dataReferencia === hoje).length
    const fSem   = filteredFaltas.filter((f) => f.dataReferencia >= inicioSem && f.dataReferencia <= hoje).length
    const fMes   = filteredFaltas.filter((f) => f.dataReferencia >= inicioMes && f.dataReferencia <= hoje).length

    return { total, impactados, recorrPct, hcPct, hoje: fHoje, semana: fSem, mes: fMes }
  }, [filteredFaltas, colabsData, totalHC])

  /* ── KPIs MD ──────────────────────────────────────────────────── */
  const mdKpis = useMemo(() => {
    const total        = filteredFaltas.length
    const comAssinada  = filteredFaltas.filter((f) => f.mdStatus === "ASSINADA").length
    const comGerada    = filteredFaltas.filter((f) => f.mdStatus === "GERADA").length
    const semMD        = filteredFaltas.filter((f) => f.mdStatus === "SEM_MD").length
    const pctAssinada  = total > 0 ? Number(((comAssinada / total) * 100).toFixed(1)) : 0
    const pctGerada    = total > 0 ? Number(((comGerada   / total) * 100).toFixed(1)) : 0
    const pctSemMD     = total > 0 ? Number(((semMD       / total) * 100).toFixed(1)) : 0
    return { comAssinada, comGerada, semMD, pctAssinada, pctGerada, pctSemMD }
  }, [filteredFaltas])

  /* ── CHARTS ───────────────────────────────────────────────────── */
  const tendencia = useMemo(() => {
    const m = {}
    filteredFaltas.forEach((f) => { m[f.dataReferencia] = (m[f.dataReferencia] || 0) + 1 })
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])).map(([data, total]) => ({ data, total }))
  }, [filteredFaltas])

  const porEmpresa   = useMemo(() => toArr(filteredFaltas.reduce((a, f) => ({ ...a, [f.empresa]: (a[f.empresa] || 0) + 1 }), {})), [filteredFaltas])
  const porSetor     = useMemo(() => toArr(filteredFaltas.reduce((a, f) => ({ ...a, [f.setor]:   (a[f.setor]   || 0) + 1 }), {})), [filteredFaltas])
  const porTurno     = useMemo(() => toArr(filteredFaltas.reduce((a, f) => ({ ...a, [f.turno]:   (a[f.turno]   || 0) + 1 }), {})), [filteredFaltas])
  const porGenero    = useMemo(() => toArr(filteredFaltas.reduce((a, f) => ({ ...a, [f.genero]:  (a[f.genero]  || 0) + 1 }), {})), [filteredFaltas])
  const porEscala    = useMemo(() => toArr(filteredFaltas.reduce((a, f) => ({ ...a, [f.escala]:  (a[f.escala]  || 0) + 1 }), {})), [filteredFaltas])
  const porTempoCasa = useMemo(() => toArr(filteredFaltas.reduce((a, f) => ({ ...a, [f.tempoCasa]: (a[f.tempoCasa] || 0) + 1 }), {})), [filteredFaltas])

  const porLider = useMemo(() => {
    const m = {}
    filteredFaltas.forEach((f) => {
      const key = f.lider?.split(" ").slice(0, 2).join(" ") || "Sem líder"
      m[key] = (m[key] || 0) + 1
    })
    return toArr(m).slice(0, 10)
  }, [filteredFaltas])

  const porDiaSemana = useMemo(() => {
    const m = {}
    filteredFaltas.forEach((f) => {
      const ds = DIAS_SEMANA[new Date(f.dataReferencia + "T12:00:00").getDay()]
      m[ds] = (m[ds] || 0) + 1
    })
    return toArr(m)
  }, [filteredFaltas])

  const topOfensores = useMemo(() =>
    [...colabsData].sort((a, b) => b.totalFaltas - a.totalFaltas).slice(0, 10)
      .map((c) => ({ name: c.nome?.split(" ").slice(0, 2).join(" "), value: c.totalFaltas })),
    [colabsData])

  const statusMdDist = useMemo(() =>
    toArr(colabsData.reduce((a, c) => ({ ...a, [c.statusDisciplinar]: (a[c.statusDisciplinar] || 0) + 1 }), {})),
    [colabsData])

  /* active status md filter label for charts */
  const activeLiderCF = cf.lider

  /* ── RENDER ───────────────────────────────────────────────────── */
  const css = `
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; }
    .recharts-wrapper, .recharts-surface { overflow: visible !important; }
    .hide-scrollbar::-webkit-scrollbar { display: none; }
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-page)", color: "var(--color-text)" }}>
      <style>{css}</style>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <MainLayout style={{ display: "flex", flexDirection: "column" }}>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main style={{ flex: 1, padding: "32px 24px 64px", maxWidth: 1600, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 36 }}>

          {/* ── PAGE HEADER ──────────────────────────────── */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 4, height: 26, borderRadius: 4, background: BRAND }} />
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>Dashboard de Faltas</h1>
              </div>
              <p style={{ margin: "0 0 0 14px", fontSize: 13, color: "var(--color-subtle)" }}>
                Panorama completo de ausências — impacto, recorrência, distribuição e tratativas
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
              <DateInput label="Início" value={inicio} onChange={setInicio} />
              <DateInput label="Fim"    value={fim}    onChange={setFim} />
              <SelectEmpresa value={empresaId} onChange={setEmpresaId} options={empresas} />
              <button onClick={fetchData} disabled={loading}
                style={{ height: 42, padding: "0 24px", borderRadius: 12, background: loading ? "#333" : BRAND, color: "#fff", fontWeight: 700, fontSize: 13, border: "none", cursor: loading ? "not-allowed" : "pointer" }}
                onMouseEnter={(e) => !loading && (e.target.style.background = "#e64500")}
                onMouseLeave={(e) => !loading && (e.target.style.background = BRAND)}
              >{loading ? "Carregando…" : "Atualizar"}</button>
            </div>
          </div>

          {/* ERROR */}
          {error && (
            <div style={{ borderRadius: 14, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              <p style={{ margin: 0, fontSize: 13, color: "#EF4444" }}>{error}</p>
            </div>
          )}

          {/* ACTIVE FILTERS */}
          <ActiveFilters cf={cf} onClear={clearCF} onRemove={removeCF} />

          {/* ── 01 PANORAMA GERAL ─────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SL num="01" title="Panorama Geral" />
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
              <KpiCard label="Total de Faltas"    value={kpis.total}                    color={BRAND}    desc="No período filtrado" loading={loading} />
              <KpiCard label="Recorrência"         value={`${kpis.recorrPct}%`}          color="#F59E0B"  desc="Faltaram 2+ vezes"  loading={loading} />
              <KpiCard label="Impactados"          value={kpis.impactados}               color="#3B82F6"  desc="Colaboradores únicos" loading={loading} />
              <KpiCard label="% HC Afetado"        value={`${kpis.hcPct}%`}             color="#A855F7"  desc={`de ${totalHC} ativos`} loading={loading} />
              <KpiCard label="Hoje"                value={kpis.hoje}                     color="#EF4444"  desc="Faltas hoje"         loading={loading} />
              <KpiCard label="Esta Semana"         value={kpis.semana}                   color="#F59E0B"  desc="Na semana atual"     loading={loading} />
              <KpiCard label="Este Mês"            value={kpis.mes}                      color="#22C55E"  desc="No mês atual"        loading={loading} />
            </div>
          </section>

          {/* ── 02 MEDIDAS DISCIPLINARES ──────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SL num="02" title="Medidas Disciplinares" />
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              <KpiCard label="Faltas c/ MD Assinada" value={mdKpis.comAssinada} color="#22C55E" desc="MD efetivada"              loading={loading} />
              <KpiCard label="Faltas c/ MD Gerada"   value={mdKpis.comGerada}   color="#F59E0B" desc="Aguardando assinatura"     loading={loading} />
              <KpiCard label="Faltas sem MD"          value={mdKpis.semMD}       color="#6B7280" desc="Sem tratativa iniciada"    loading={loading} />
              <KpiCard label="% Tratativa Concluída" value={`${mdKpis.pctAssinada}%`} color="#22C55E" desc="MD assinada / total" loading={loading} />
              <KpiCard label="% Pend. Assinatura"    value={`${mdKpis.pctGerada}%`}   color="#F59E0B" desc="MD gerada / total"   loading={loading} />
              <KpiCard label="% Sem Tratativa"       value={`${mdKpis.pctSemMD}%`}    color="#EF4444" desc="Sem MD / total"      loading={loading} />
            </div>
          </section>

          {/* ── 03 EVOLUÇÃO ──────────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SL num="03" title="Evolução no Período" />
            <Card title="Faltas por dia" subtitle="Volume de ausências ao longo do tempo"
              icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>}
            >
              <AreaBlock data={tendencia} loading={loading} />
            </Card>
          </section>

          {/* ── 04 DISTRIBUIÇÃO ──────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SL num="04" title="Onde Estão as Faltas?" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Por Empresa" subtitle="Clique para filtrar">
                <ClickBar data={porEmpresa} activeValue={cf.empresa} onFilter={(v) => toggleCF("empresa", v)} loading={loading} />
              </Card>
              <Card title="Por Setor" subtitle="Clique para filtrar">
                <ClickBar data={porSetor} activeValue={cf.setor} onFilter={(v) => toggleCF("setor", v)} loading={loading} />
              </Card>
            </div>
          </section>

          {/* ── 05 LÍDERES E OFENSORES ───────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SL num="05" title="Quem Lidera a Ausência?" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Top Líderes" subtitle="Equipes com maior índice — clique para filtrar">
                <ClickBarH data={porLider} activeValue={activeLiderCF} onFilter={(v) => toggleCF("lider", v)} loading={loading} />
              </Card>
              <Card title="Top 10 Ofensores" subtitle="Colaboradores com mais faltas">
                <ClickBarH data={topOfensores} activeValue={null} onFilter={() => {}} loading={loading} />
              </Card>
            </div>
          </section>

          {/* ── 06 PERFIL ────────────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SL num="06" title="Perfil dos Faltantes" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card title="Por Turno" subtitle="Clique para filtrar">
                <ClickPie data={porTurno} activeValue={cf.turno} onFilter={(v) => toggleCF("turno", v)} loading={loading} />
              </Card>
              <Card title="Por Gênero" subtitle="Distribuição por gênero">
                <ClickPie data={porGenero} activeValue={null} onFilter={() => {}} loading={loading} />
              </Card>
              <Card title="Tempo de Casa" subtitle="Maturidade vs. ausências">
                <ClickBar data={porTempoCasa} activeValue={null} onFilter={() => {}} loading={loading} height={220} />
              </Card>
            </div>
          </section>

          {/* ── 07 CONTEXTO ──────────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SL num="07" title="Faltas por Contexto" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card title="Por Dia da Semana" subtitle="Clique para filtrar">
                <ClickBar data={porDiaSemana} activeValue={cf.diaSemana} onFilter={(v) => toggleCF("diaSemana", v)} loading={loading} height={230} />
              </Card>
              <Card title="Por Escala" subtitle="Clique para filtrar">
                <ClickPie data={porEscala} activeValue={cf.escala} onFilter={(v) => toggleCF("escala", v)} loading={loading} />
              </Card>
            </div>
          </section>

          {/* ── 08 STATUS DISCIPLINAR ───────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SL num="08" title="Status Disciplinar" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card title="Distribuição por Status" subtitle="Clique para filtrar a tabela abaixo">
                <StatusMDPie data={statusMdDist} activeValue={cf.statusMd} onFilter={(v) => toggleCF("statusMd", v)} loading={loading} />
              </Card>
              <Card title="Legenda dos Status" subtitle="Critérios de classificação por colaborador">
                <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0" }}>
                  {[
                    { key: "ASSINADA", desc: "Todas as faltas possuem MD assinada" },
                    { key: "GERADA",   desc: "Todas as faltas têm MD gerada, nenhuma assinada ainda" },
                    { key: "PARCIAL",  desc: "Algumas faltas têm MD, outras não — ou mix de estados" },
                    { key: "SEM_MD",   desc: "Nenhuma falta possui medida disciplinar vinculada" },
                  ].map(({ key, desc }) => (
                    <div key={key}
                      onClick={() => toggleCF("statusMd", key)}
                      style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "8px 10px", borderRadius: 10, background: cf.statusMd === key ? `${MD_CFG[key].color}14` : "transparent", border: `1px solid ${cf.statusMd === key ? MD_CFG[key].color + "50" : "transparent"}`, transition: "all 0.15s" }}
                    >
                      <MDBadge status={key} />
                      <p style={{ margin: 0, fontSize: 12, color: "var(--color-muted)", lineHeight: 1.5 }}>{desc}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </section>

          {/* ── 09 TABELA ────────────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SL num="09" title="Lista de Faltantes" />
            <Card title="Faltantes no período" subtitle={`${filteredColabs.length} colaboradores — ordenável por qualquer coluna · paginado`}
              icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>}
            >
              <AbsenceTable
                data={filteredColabs}
                loading={loading}
                statusMdFilter={cf.statusMd}
                onStatusMdFilter={(v) => toggleCF("statusMd", v)}
              />
            </Card>
          </section>

        </main>
      </MainLayout>
    </div>
  )
}
