// src/pages/folgaDominical/folgaDominical.jsx
"use client";

import { useEffect, useState, useCallback, useContext, useMemo } from "react";
import {
  CalendarDays, RefreshCcw, Trash2, Play,
  AlertTriangle, CheckCircle2, Users, Calendar,
  Filter, X, ChevronRight, Clock, Sun,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar  from "../../components/Sidebar";
import Header   from "../../components/Header";
import MainLayout from "../../components/MainLayout";
import api      from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { ThemeContext } from "../../context/ThemeContext";

/* --- TOKENS -------------------------------------------------------- */
const BRAND   = "#FA4C00"
const GREEN   = "#22C55E"
const RED     = "#EF4444"
const YELLOW  = "#F59E0B"
const BLUE    = "#3B82F6"

/* --- STATIC DATA --------------------------------------------------- */
const MESES = [
  { value: 1,  label: "Janeiro"   },
  { value: 2,  label: "Fevereiro" },
  { value: 3,  label: "Mar�o"     },
  { value: 4,  label: "Abril"     },
  { value: 5,  label: "Maio"      },
  { value: 6,  label: "Junho"     },
  { value: 7,  label: "Julho"     },
  { value: 8,  label: "Agosto"    },
  { value: 9,  label: "Setembro"  },
  { value: 10, label: "Outubro"   },
  { value: 11, label: "Novembro"  },
  { value: 12, label: "Dezembro"  },
];

/* --- UTILS --------------------------------------------------------- */
function getMesAtual() {
  const now = new Date();
  return { ano: now.getFullYear(), mes: now.getMonth() + 1 };
}
function formatDateBR(dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}
function formatDateWithWeekday(dateStr) {
  if (!dateStr) return "-";

  const iso = String(dateStr).slice(0, 10); // YYYY-MM-DD
  const d = new Date(iso + "T12:00:00");

  return d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

/* --- CSS GLOBAL ---------------------------------------------------- */
const CSS = `
  @keyframes shimmer {
    0%   { background-position: -600px 0 }
    100% { background-position:  600px 0 }
  }
  @keyframes fadeIn {
    from { opacity:0; transform:translateY(8px) }
    to   { opacity:1; transform:translateY(0)   }
  }
  .fd-fade { animation: fadeIn 0.28s ease both }
  .fd-skeleton {
    background: linear-gradient(90deg, var(--color-surface-2) 25%, var(--color-surface-3) 50%, var(--color-surface-2) 75%);
    background-size: 600px 100%;
    animation: shimmer 1.4s infinite linear;
    border-radius: 10px;
  }
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; }
  ::-webkit-scrollbar        { width:5px; height:5px }
  ::-webkit-scrollbar-track  { background: var(--color-surface) }
  ::-webkit-scrollbar-thumb  { background: var(--color-border); border-radius:4px }
`

/* --- SKELETON ------------------------------------------------------ */
function Sk({ h = 40, w = "100%", r = 10 }) {
  return <div className="fd-skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}

/* --- SECTION LABEL ------------------------------------------------- */
function SectionLabel({ num, title, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
      <span style={{
        width: 26, height: 26, borderRadius: 8, fontSize: 11, fontWeight: 800,
        background: `${BRAND}20`, color: BRAND, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{num}</span>
      <div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "var(--color-muted)" }}>
          {title}
        </p>
        {sub && <p style={{ margin: 0, fontSize: 11, color: "var(--color-subtle)" }}>{sub}</p>}
      </div>
    </div>
  )
}

/* --- CARD ---------------------------------------------------------- */
function SurfaceCard({ children, style = {} }) {
  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: 18,
      padding: "22px 24px",
      ...style,
    }}>
      {children}
    </div>
  )
}

/* --- KPI CARD ------------------------------------------------------ */
function KpiCard({ label, value, icon: Icon, color = BRAND, sub, onClick, active, loading }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? `${color}12` : "var(--color-surface)",
        border: `1px solid ${active ? color : "var(--color-border)"}`,
        borderRadius: 16,
        padding: "16px 18px",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.borderColor = color)}
      onMouseLeave={(e) => onClick && !active && (e.currentTarget.style.borderColor = "var(--color-border)")}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, width: 3,
        height: "100%", background: active ? color : "transparent",
        borderRadius: "16px 0 0 16px", transition: "background 0.2s",
      }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 11, color: "var(--color-muted)",
            fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            {label}
          </p>
          {loading
            ? <Sk h={28} w={60} />
            : <p style={{ margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1,
                color: active ? color : "var(--color-text)" }}>
                {value ?? "�"}
              </p>
          }
          {sub && <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--color-subtle)" }}>{sub}</p>}
        </div>
        {Icon && (
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: `${color}18`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Icon size={16} color={color} />
          </div>
        )}
      </div>
    </div>
  )
}

/* --- BADGE --------------------------------------------------------- */
const TURNO_COLORS = { T1: "#3B82F6", T2: BRAND, T3: "#A855F7" }
const ESCALA_COLORS = { B: "#22C55E", C: "#F59E0B", G: "#EC4899" }

function Badge({ value, map }) {
  const color = map?.[value] || "var(--color-muted)"
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      padding: "2px 10px", borderRadius: 99,
      background: `${color}18`, color, fontSize: 11, fontWeight: 700,
      border: `1px solid ${color}30`,
    }}>
      {value || "�"}
    </span>
  )
}

/* --- DIAS SEM FOLGA BADGE ------------------------------------------ */
function DiasBadge({ dias }) {
  if (dias == null) return <span style={{ color: "var(--color-subtle)" }}>�</span>
  const color = dias >= 30 ? RED : dias >= 20 ? YELLOW : GREEN
  return (
    <span style={{
      fontWeight: 700, color,
      background: `${color}14`,
      padding: "2px 10px", borderRadius: 99, fontSize: 12,
    }}>
      {dias}d
    </span>
  )
}

/* --- ALERT BANNER -------------------------------------------------- */
function AlertBanner({ type = "error", children }) {
  const cfg = {
    error:   { bg: `${RED}10`,   border: `${RED}40`,   icon: AlertTriangle,  color: RED    },
    warning: { bg: `${YELLOW}10`,border: `${YELLOW}40`,icon: AlertTriangle,  color: YELLOW },
    success: { bg: `${GREEN}10`, border: `${GREEN}40`, icon: CheckCircle2,   color: GREEN  },
  }[type]
  const Icon = cfg.icon
  return (
    <div className="fd-fade" style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 14, padding: "14px 18px",
    }}>
      <Icon size={16} color={cfg.color} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 13, color: cfg.color, lineHeight: 1.5 }}>{children}</span>
    </div>
  )
}

/* --- SELECT -------------------------------------------------------- */
function StyledSelect({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
        color: "var(--color-text)", fontSize: 13, borderRadius: 12, padding: "9px 14px",
        outline: "none", cursor: "pointer", transition: "border-color 0.2s",
      }}
      onFocus={(e)  => (e.target.style.borderColor = `${BRAND}60`)}
      onBlur={(e)   => (e.target.style.borderColor = "var(--color-border)")}
    >
      {children}
    </select>
  )
}

/* --- TABLE HEADER CELL --------------------------------------------- */
function TH({ children, center = false }) {
  return (
    <th style={{
      padding: "12px 16px", fontSize: 11, fontWeight: 700,
      color: "var(--color-muted)", textTransform: "uppercase",
      letterSpacing: "0.08em", textAlign: center ? "center" : "left",
      whiteSpace: "nowrap", background: "var(--color-surface-2)",
      borderBottom: "1px solid var(--color-border)",
    }}>
      {children}
    </th>
  )
}

/* --- TABLE DATA CELL ----------------------------------------------- */
function TD({ children, center = false, style = {} }) {
  return (
    <td style={{
      padding: "11px 16px", fontSize: 13,
      color: "var(--color-text)",
      textAlign: center ? "center" : "left",
      borderBottom: "1px solid var(--color-border)",
      ...style,
    }}>
      {children}
    </td>
  )
}

/* --- CAPACIDADE MINI CARD ------------------------------------------ */
function CapacidadeCard({ turno, dias }) {
  const color = TURNO_COLORS[turno] || BRAND
  return (
    <div style={{
      background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
      borderRadius: 14, padding: "16px 18px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8,
          background: `${color}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Clock size={13} color={color} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{turno}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Object.entries(dias || {}).map(([data, info]) => {
          const planejadas  = info?.folgasPlanejadas     ?? 0
          const capacidade  = info?.capacidadeMaximaFolgas ?? 0
          const pct         = capacidade > 0 ? Math.min((planejadas / capacidade) * 100, 100) : 0
          const barColor    = info?.saldoDisponivel <= 0 ? RED : GREEN
          return (
            <div key={data}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: "var(--color-muted)" }}>
                  {formatDateBR(data)}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: info?.saldoDisponivel <= 0 ? RED : GREEN,
                }}>
                  {planejadas} / {capacidade}
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 4, background: "var(--color-border)" }}>
                <div style={{
                  height: "100%", width: `${pct}%`, borderRadius: 4,
                  background: barColor, transition: "width 0.5s ease",
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* --- MAIN ---------------------------------------------------------- */
export default function FolgaDominicalPage() {
  const navigate = useNavigate();
  const { user }  = useContext(AuthContext);

  const isAdmin     = user?.role === "ADMIN";
  const isAltaGestao = user?.role === "ALTA_GESTAO";
  const isLideranca = user?.role === "LIDERANCA";
  const atual       = getMesAtual();

  const [sidebarOpen, setSidebarOpen]         = useState(false);
  const [ano,  setAno]                         = useState(atual.ano);
  const [mes,  setMes]                         = useState(atual.mes);
  const [loading,      setLoading]             = useState(false);
  const [resumo,       setResumo]              = useState(null);
  const [erro,         setErro]                = useState("");
  const [domingoSelecionado, setDomingoSelecionado] = useState(null);
  const [turnoSelecionado,   setTurnoSelecionado]   = useState("");
  const [escalaSelecionada,  setEscalaSelecionada]  = useState("");
  const [liderSelecionado, setLiderSelecionado] = useState("");
  const [previewData,    setPreviewData]        = useState(null);
  const [previewLoading, setPreviewLoading]    = useState(false);
  const [previewErro,    setPreviewErro]       = useState("");
  const [previewTurno,   setPreviewTurno]      = useState("");
  const [previewDomingo, setPreviewDomingo]    = useState("");

  const previewInvalido    = !!previewData && Array.isArray(previewData.naoAlocados) && previewData.naoAlocados.length > 0;
  const previewNaoExecutado = !previewData;

  /* -- fetch ----------------------------------- */
  const load = useCallback(async () => {
    setLoading(true); setErro("");
    try {
      const res = await api.get(`/folga-dominical?ano=${ano}&mes=${mes}`);
      setResumo(res.data?.data || null);
    } catch (e) {
      setResumo(null);
      setErro(e?.response?.data?.error || "Nenhum planejamento encontrado para este per�odo.");
    } finally { setLoading(false); }
  }, [ano, mes]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setDomingoSelecionado(null); setTurnoSelecionado("");
    setPreviewData(null); setPreviewErro("");
  }, [ano, mes]);

  /* -- actions ---------------------------------- */
  async function gerar() {
    if (!isAdmin && !isAltaGestao) return;
    if (previewInvalido) { setErro("Existem colaboradores n�o alocados na simula��o. Ajuste antes de gerar."); return; }
    if (!window.confirm("Deseja gerar o planejamento deste m�s?")) return;
    setLoading(true); setErro("");
    try { await api.post("/folga-dominical", { ano, mes }); await load(); }
    catch (e) { setErro(e?.response?.data?.error || "Erro ao gerar planejamento."); }
    finally { setLoading(false); }
  }

  async function reprocessar() {
    if (!isAdmin && !isAltaGestao) return;
    if (!window.confirm("Isso ir� remover o planejamento atual e apagar DSRs autom�ticos.\nDeseja continuar?")) return;
    setLoading(true); setErro("");
    try {
      await api.delete(`/folga-dominical?ano=${ano}&mes=${mes}`);
      await api.post("/folga-dominical", { ano, mes });
      await load();
    } catch (e) { setErro(e?.response?.data?.error || "Erro ao reprocessar planejamento."); }
    finally { setLoading(false); }
  }

  async function preview() {
    setPreviewLoading(true); setPreviewErro(""); setErro("");
    try {
      const res = await api.post("/folga-dominical/preview", { ano, mes });
      setPreviewData(res.data?.data || null);
    } catch (e) {
      setPreviewErro(e?.response?.data?.error || "Erro ao gerar simula��o.");
      setPreviewData(null);
    } finally { setPreviewLoading(false); }
  }

  /* -- memos ------------------------------------ */
  const total      = resumo?.total    ?? 0;
  const porDomingo = resumo?.porDomingo ?? {};

  const lideres = useMemo(() => {
    if (!resumo?.colaboradores) return [];

    const unique = new Set(
      resumo.colaboradores
        .map((c) => c.lider)
        .filter(Boolean)
    );

    return Array.from(unique).sort();
  }, [resumo]);
  const colaboradoresFiltrados = useMemo(() => {
    if (!resumo?.colaboradores) return [];
    return resumo.colaboradores.filter((c) => {
      const data = String(c.dataDomingo).slice(0, 10);
      return (
        (!domingoSelecionado || data === domingoSelecionado) &&
        (!turnoSelecionado   || c.turno  === turnoSelecionado) &&
        (!escalaSelecionada  || c.escala === escalaSelecionada) &&
        (!liderSelecionado || c.lider === liderSelecionado)
      );
    });
  }, [resumo, domingoSelecionado, turnoSelecionado, escalaSelecionada, liderSelecionado]);

  const previewFiltrado = useMemo(() => {
    if (!previewData?.preview) return [];
    return previewData.preview.filter((c) =>
      (!previewTurno   || c.turno  === previewTurno) &&
      (!previewDomingo || c.domingo === previewDomingo)
    );
  }, [previewData, previewTurno, previewDomingo]);

  const hasActiveFilter = domingoSelecionado || turnoSelecionado || escalaSelecionada || liderSelecionado;

  /* ---------------------------------------------- */
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-page)", color: "var(--color-text)" }}>
      <style>{CSS}</style>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main style={{ padding: "32px 24px 80px", maxWidth: 1400, margin: "0 auto",
          display: "flex", flexDirection: "column", gap: 36 }}>

          {/* -- PAGE HEADER ----------------------------------- */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between",
            alignItems: "flex-end", gap: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                <div style={{ width: 4, height: 28, borderRadius: 4, background: BRAND }} />
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
                  Proje��o de Folgas Dominicais
                </h1>
              </div>
              <p style={{ margin: "0 0 0 14px", fontSize: 13, color: "var(--color-muted)" }}>
                Distribui��o autom�tica de DSR aos domingos � Escalas B, C e G
              </p>
            </div>

            {/* Controls */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 10 }}>
              {/* Ano */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 10, color: "var(--color-muted)", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.12em" }}>Ano</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8,
                  background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
                  borderRadius: 12, padding: "9px 14px" }}>
                  <CalendarDays size={14} color={BRAND} />
                  <input
                    type="number" value={ano}
                    onChange={(e) => setAno(Number(e.target.value))}
                    style={{ background: "transparent", outline: "none", color: "var(--color-text)",
                      fontSize: 13, width: 52, border: "none" }}
                  />
                </div>
              </div>

              {/* M�s */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 10, color: "var(--color-muted)", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.12em" }}>M�s</label>
                <StyledSelect value={mes} onChange={(v) => setMes(Number(v))}>
                  {MESES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </StyledSelect>
              </div>

              {/* Refresh */}
              <button
                onClick={load}
                disabled={loading || previewLoading}
                style={{
                  height: 40, padding: "0 18px", borderRadius: 12,
                  background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
                  color: "var(--color-text)", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                  opacity: (loading || previewLoading) ? 0.5 : 1, transition: "all 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-border-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
              >
                <RefreshCcw size={14} style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }} />
                Atualizar
              </button>

              {/* Simular */}
              {(isAdmin || isAltaGestao || isLideranca) && (
                <button
                  onClick={preview}
                  disabled={previewLoading || loading}
                  style={{
                    height: 40, padding: "0 20px", borderRadius: 12,
                    background: BLUE, color: "#fff", fontSize: 13, fontWeight: 700,
                    border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                    opacity: (previewLoading || loading) ? 0.5 : 1, transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#1d4ed8")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = BLUE)}
                >
                  <Play size={14} style={{ animation: previewLoading ? "spin 0.8s linear infinite" : "none" }} />
                  {previewLoading ? "Simulando�" : "Simular"}
                </button>
              )}

              {/* Gerar */}
              {(isAdmin || isAltaGestao) && (
                <>
                  <button
                    onClick={gerar}
                    disabled={loading || previewLoading || previewInvalido || previewNaoExecutado}
                    title={previewNaoExecutado ? "Execute a simula��o antes de gerar" : previewInvalido ? "Existem colaboradores n�o alocados" : "Gerar planejamento"}
                    style={{
                      height: 40, padding: "0 20px", borderRadius: 12,
                      background: (previewInvalido || previewNaoExecutado) ? "var(--color-surface-3)" : BRAND,
                      color: "#fff", fontSize: 13, fontWeight: 700,
                      border: "none", cursor: (previewInvalido || previewNaoExecutado) ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", gap: 7,
                      opacity: (loading || previewLoading) ? 0.5 : 1, transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => !(previewInvalido || previewNaoExecutado) && (e.currentTarget.style.background = "#e04400")}
                    onMouseLeave={(e) => !(previewInvalido || previewNaoExecutado) && (e.currentTarget.style.background = BRAND)}
                  >
                    <CalendarDays size={14} />
                    Gerar
                  </button>

                  <button
                    onClick={reprocessar}
                    disabled={loading || previewLoading}
                    style={{
                      height: 40, padding: "0 18px", borderRadius: 12,
                      background: `${RED}18`, border: `1px solid ${RED}40`,
                      color: RED, fontSize: 13, fontWeight: 700,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                      opacity: (loading || previewLoading) ? 0.5 : 1, transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = `${RED}30`)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = `${RED}18`)}
                  >
                    <Trash2 size={14} />
                    Reprocessar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* -- ERRO GLOBAL ------------------------------------ */}
          {!loading && erro && (
            <div className="fd-fade">
              <AlertBanner type="error">{erro}</AlertBanner>
            </div>
          )}

          {/* -- LOADING SKELETON ------------------------------- */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => <Sk key={i} h={88} />)}
              </div>
              <Sk h={400} />
            </div>
          )}

          {/* --------------------------------------------------- */}
          {/* -- SECTION 01: SIMULA��O -------------------------- */}
          {/* --------------------------------------------------- */}
          {previewLoading && (
            <SurfaceCard>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Sk h={24} w={180} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[...Array(3)].map((_, i) => <Sk key={i} h={80} />)}
                </div>
                <Sk h={260} />
              </div>
            </SurfaceCard>
          )}

          {!previewLoading && previewErro && (
            <AlertBanner type="error">{previewErro}</AlertBanner>
          )}

          {!previewLoading && previewData && (
            <section style={{ display: "flex", flexDirection: "column", gap: 14 }} className="fd-fade">
              <SectionLabel num="01" title="Simula��o" sub="Dados n�o persistidos � apenas visualiza��o" />

              <SurfaceCard>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                  {/* header simula��o */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Simula��o de Folgas</h2>
                      <span style={{
                        padding: "2px 10px", borderRadius: 99, fontSize: 10, fontWeight: 800,
                        background: `${BLUE}20`, color: BLUE, border: `1px solid ${BLUE}30`,
                        textTransform: "uppercase", letterSpacing: "0.1em",
                      }}>Preview</span>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
                      {MESES.find(m => m.value === mes)?.label} {ano}
                    </span>
                  </div>

                  {/* alerta de n�o alocados */}
                  {previewInvalido && (
                    <AlertBanner type="warning">
                      {previewData.naoAlocados.length} colaborador(es) n�o alocado(s).
                      Revise a capacidade antes de gerar o planejamento.
                    </AlertBanner>
                  )}

                  {/* KPIs simula��o */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <KpiCard
                      label="Eleg�veis"
                      value={previewData.totalElegiveis ?? 0}
                      icon={Users}
                      color={BLUE}
                    />
                    <KpiCard
                      label="Alocados"
                      value={previewData.totalPreview ?? 0}
                      icon={CheckCircle2}
                      color={GREEN}
                    />
                    <KpiCard
                      label="N�o alocados"
                      value={previewData.naoAlocados?.length ?? 0}
                      icon={AlertTriangle}
                      color={(previewData.naoAlocados?.length ?? 0) > 0 ? RED : GREEN}
                    />
                  </div>

                  {/* Capacidade por turno */}
                  {Object.keys(previewData.capacidade || {}).length > 0 && (
                    <div>
                      <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 600,
                        color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Capacidade por Turno
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(previewData.capacidade).map(([turno, dias]) => (
                          <CapacidadeCard key={turno} turno={turno} dias={dias} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* N�o alocados */}
                  {previewData.naoAlocados?.length > 0 && (
                    <div>
                      <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700,
                        color: RED, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Colaboradores n�o alocados ({previewData.naoAlocados.length})
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6,
                        maxHeight: 240, overflowY: "auto" }}>
                        {previewData.naoAlocados.map((c) => (
                          <div key={c.opsId} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            gap: 12, background: "var(--color-surface-2)", borderRadius: 10, padding: "10px 14px",
                            border: `1px solid ${RED}20`,
                          }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>{c.nome}</span>
                            <span style={{ fontSize: 11, color: "var(--color-muted)", textAlign: "right" }}>
                              {c.turno} � Slot {c.slotBase}{c.motivo ? ` � ${c.motivo}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview detalhado */}
                  {previewData.preview?.length > 0 && (
                    <div>
                      {/* Filtros preview */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10,
                        flexWrap: "wrap", marginBottom: 14 }}>
                        <Filter size={13} color="var(--color-muted)" />
                        <StyledSelect value={previewTurno} onChange={setPreviewTurno}>
                          <option value="">Todos os turnos</option>
                          <option value="T1">T1</option>
                          <option value="T2">T2</option>
                          <option value="T3">T3</option>
                        </StyledSelect>
                        <StyledSelect value={previewDomingo} onChange={setPreviewDomingo}>
                          <option value="">Todos os domingos</option>
                          {(previewData.domingos || []).map((d) => (
                            <option key={d} value={d}>{formatDateBR(d)}</option>
                          ))}
                        </StyledSelect>
                        {(previewTurno || previewDomingo) && (
                          <button
                            onClick={() => { setPreviewTurno(""); setPreviewDomingo(""); }}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                              borderRadius: 8, background: "var(--color-surface-2)",
                              border: "1px solid var(--color-border)", color: "var(--color-muted)", fontSize: 12,
                              cursor: "pointer", transition: "background 0.2s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-3)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-surface-2)")}
                          >
                            <X size={12} /> Limpar
                          </button>
                        )}
                        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-muted)" }}>
                          {previewFiltrado.length} registros
                        </span>
                      </div>

                      {/* Tabela preview */}
                      <div style={{ overflowX: "auto", borderRadius: 12,
                        border: "1px solid var(--color-border)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                          <thead>
                            <tr>
                              <TH>OPS ID</TH>
                              <TH>Nome</TH>
                              <TH center>Turno</TH>
                              <TH center>Escala</TH>
                              <TH center>Slot</TH>
                              <TH center>Domingo</TH>
                              <TH center>�ltima Folga</TH>
                              <TH center>Dias sem folga</TH>
                            </tr>
                          </thead>
                          <tbody>
                            {previewFiltrado.map((item) => (
                              <tr key={`${item.opsId}-${item.domingo}`}
                                style={{ transition: "background 0.15s" }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-2)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              >
                                <TD><span style={{ fontWeight: 700, color: BLUE }}>{item.opsId}</span></TD>
                                <TD>{item.nome}</TD>
                                <TD center><Badge value={item.turno} map={TURNO_COLORS} /></TD>
                                <TD center><Badge value={item.escala} map={ESCALA_COLORS} /></TD>
                                <TD center>{item.slot || "�"}</TD>
                                <TD center>{item.domingo ? formatDateBR(item.domingo) : "�"}</TD>
                                <TD center style={{ color: "var(--color-muted)" }}>
                                  {item.ultimaFolgaAnterior ? formatDateBR(item.ultimaFolgaAnterior) : "�"}
                                </TD>
                                <TD center><DiasBadge dias={item.diasDesdeUltimaFolga} /></TD>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </SurfaceCard>
            </section>
          )}

          {/* --------------------------------------------------- */}
          {/* -- SECTION 02: RESUMO DO PLANEJAMENTO ------------- */}
          {/* --------------------------------------------------- */}
          {!loading && resumo && (
            <section style={{ display: "flex", flexDirection: "column", gap: 14 }} className="fd-fade">
              <SectionLabel num={previewData ? "02" : "01"} title="Resumo do Planejamento"
                sub="Clique em um domingo para filtrar a tabela" />

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <KpiCard
                  label="Total Colaboradores"
                  value={total}
                  icon={Users}
                  color={BRAND}
                  active={!domingoSelecionado}
                />
                {Object.entries(porDomingo).map(([data, qtd]) => {
                  const ativo = domingoSelecionado === data;
                  return (
                    <KpiCard
                      key={data}
                      label={formatDateBR(data)}
                      value={qtd}
                      icon={Sun}
                      color={BRAND}
                      active={ativo}
                      onClick={() => setDomingoSelecionado(ativo ? null : data)}
                      sub={ativo ? "Filtro ativo" : undefined}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* --------------------------------------------------- */}
          {/* -- SECTION 03: TABELA DE COLABORADORES ----------- */}
          {/* --------------------------------------------------- */}
          {!loading && resumo && (
            <section style={{ display: "flex", flexDirection: "column", gap: 14 }} className="fd-fade">
              <SectionLabel num={previewData ? "03" : "02"} title="Colaboradores no Planejamento" />

              <SurfaceCard style={{ padding: 0, overflow: "hidden" }}>
                {/* Table header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  flexWrap: "wrap", gap: 14, padding: "18px 22px",
                  borderBottom: "1px solid var(--color-border)",
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                      Escala de folgas
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--color-muted)" }}>
                      {colaboradoresFiltrados.length} de {resumo?.colaboradores?.length ?? 0} colaboradores
                      {hasActiveFilter && " (filtro ativo)"}
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <Filter size={13} color="var(--color-muted)" />

                    <StyledSelect value={turnoSelecionado} onChange={setTurnoSelecionado}>
                      <option value="">Todos os turnos</option>
                      <option value="T1">T1</option>
                      <option value="T2">T2</option>
                      <option value="T3">T3</option>
                    </StyledSelect>

                    <StyledSelect value={escalaSelecionada} onChange={setEscalaSelecionada}>
                      <option value="">Todas as escalas</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="G">G</option>
                    </StyledSelect>

                    <StyledSelect value={liderSelecionado} onChange={setLiderSelecionado}>
                      <option value="">Todos os l�deres</option>
                      {lideres.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </StyledSelect>

                    {/* Tag domingo ativo */}
                    {domingoSelecionado && (
                      <button
                        onClick={() => setDomingoSelecionado(null)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "6px 12px", borderRadius: 8,
                          background: `${BRAND}18`, border: `1px solid ${BRAND}40`,
                          color: BRAND, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        <Sun size={12} />
                        {formatDateBR(domingoSelecionado)}
                        <X size={11} style={{ marginLeft: 2 }} />
                      </button>
                    )}

                    {hasActiveFilter && (
                      <button
                        onClick={() => {
                          setDomingoSelecionado(null);
                          setTurnoSelecionado("");
                          setEscalaSelecionada("");
                          setLiderSelecionado("");
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                          borderRadius: 8, background: "var(--color-surface-2)",
                          border: "1px solid var(--color-border)", color: "var(--color-muted)",
                          fontSize: 12, cursor: "pointer", transition: "background 0.2s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-3)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-surface-2)")}
                      >
                        <X size={12} /> Limpar filtros
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabela */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
                    <thead>
                      <tr>
                        <TH>OPS ID</TH>
                        <TH>Nome</TH>
                        <TH center>Turno</TH>
                        <TH center>Escala</TH>
                        <TH>L�der</TH>
                        <TH>Setor</TH>
                        <TH center>Domingo</TH>
                        <TH center>�ltima Folga</TH>
                        <TH center>Dias sem DSR</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {colaboradoresFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{
                            padding: "48px 24px", textAlign: "center",
                            color: "var(--color-subtle)", fontSize: 13,
                          }}>
                            Nenhum colaborador encontrado com os filtros aplicados.
                          </td>
                        </tr>
                      ) : (
                        colaboradoresFiltrados.map((colab) => (
                          <tr
                            key={`${colab.opsId}-${colab.dataDomingo}`}
                            style={{ transition: "background 0.15s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-2)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <TD>
                              <span style={{ fontWeight: 700, color: BRAND }}>{colab.opsId}</span>
                            </TD>
                            <TD>
<<<<<<< Updated upstream
                              <span style={{ color: "#fff", fontWeight: 500 }}>
                                {colab.nome}
=======
                              <span style={{ color: "var(--color-text)", fontWeight: 500 }}>
                                {colab.nome?.split(" ").slice(0, 3).join(" ")}
>>>>>>> Stashed changes
                              </span>
                            </TD>
                            <TD center><Badge value={colab.turno} map={TURNO_COLORS} /></TD>
                            <TD center><Badge value={colab.escala} map={ESCALA_COLORS} /></TD>
                            <TD>{colab.lider || "�"}</TD>
                            <TD>{colab.setor || "�"}</TD>
                            <TD center style={{ color: "var(--color-text)", fontWeight: 600 }}>
                              {colab.dataDomingo ? formatDateWithWeekday(colab.dataDomingo) : "�"}
                            </TD>
                            <TD center style={{ color: "var(--color-muted)", fontSize: 12 }}>
                              {colab.ultimoDSR ? formatDateWithWeekday(colab.ultimoDSR) : "�"}
                            </TD>
                            <TD center><DiasBadge dias={colab.diasSemDSR} /></TD>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SurfaceCard>
            </section>
          )}

        </main>
      </MainLayout>
    </div>
  );
}

