"use client"
import { useMemo, useRef } from "react"
import {
  ResponsiveContainer,
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { ArrowLeft } from "lucide-react"
import domtoimage from "dom-to-image-more"
import api from "../services/api"
import { useNavigate } from "react-router-dom"
/* ================= ROOT ================= */
export default function OperationalReport({ report }) {
  const {
    header,
    kpis,
    graficoPlanejadoVsReal,
    empresas = [],
    genero = [],
    statusColaboradores = [],
    vinculo = [],
    setores = [],
    ausenciasHoje = [],
    insights,
  } = report
  const reportRef = useRef(null)
  const navigate = useNavigate()
  const isExporting = useMemo(() => {
    if (typeof document === "undefined") return false
    return document.body.classList.contains("exporting-report")
  }, [])
  function handleExportSeatalk() {
    console.log("Exportar relatório no SeaTalk", report)
  }
  async function handleExportEmail() {
    const original = document.getElementById("operational-report")
    if (!original) return
    document.body.classList.add("exporting-report")
    await new Promise(r => setTimeout(r, 50))
    const clone = original.cloneNode(true)
    clone.id = "operational-report-clone"
    
    Object.assign(clone.style, {
      width: "1280px",
      maxWidth: "1280px",
      minHeight: "auto",
      margin: "0",
      padding: "24px",
      position: "fixed",
      top: "0",
      left: "-99999px",
      background: "#232323",
      overflow: "visible",
      transform: "none",
      filter: "none",
      border: "none",
      outline: "none",
      boxShadow: "none",
    })
    clone.querySelectorAll(".export-hide, [data-export-hide]").forEach(el => el.remove())
    document.body.appendChild(clone)
    await new Promise(r => setTimeout(r, 100))
    clone.offsetHeight
    await new Promise(r => setTimeout(r, 400))
    try {
      const dataUrl = await domtoimage.toPng(clone, {
        bgcolor: "#232323",
        width: 1280,
        height: clone.scrollHeight,
        cacheBust: true,
        quality: 1,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
          border: "none",
          outline: "none",
        },
      })
      await api.post("/reports/email", {
        image: dataUrl,
        assunto: "Relatório Operacional",
        periodo: report.header.periodo,
        turno: report.header.turno,
      })
      alert("Relatório enviado com sucesso ✅")
    } catch (err) {
      console.error("Erro ao exportar:", err)
      alert("Erro ao exportar relatório")
    } finally {
      document.body.removeChild(clone)
      document.body.classList.remove("exporting-report")
    }
  }
  return (
    <div className="bg-[#232323] min-h-screen py-6">
      {/* Botão de voltar - FORA do container do relatório */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-6">
        <button
          onClick={() => navigate("/dashboard/operacional")}
          className="
            flex items-center gap-2
            px-4 py-2
            rounded-lg
            text-[#BFBFC3] hover:text-white
            bg-[#1c1c1c] hover:bg-[#2A2A2C]
            transition
          "
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Voltar ao Dashboard</span>
        </button>
      </div>
      <div
        id="operational-report"
        ref={reportRef}
        className="bg-[#232323] text-white p-4 sm:p-6 space-y-6 sm:space-y-8 max-w-7xl mx-auto"
      >
        {/* ================= HEADER ================= */}
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg sm:text-xl font-semibold">Relatório Operacional</h1>
              <p className="text-xs sm:text-sm text-[#BFBFC3]">
                {header.periodo} • Turno {header.turno}
              </p>
            </div>
            <div className="flex gap-2 export-hide" data-export-hide>
              <ExportButton variant="email" label="Enviar por e-mail" onClick={handleExportEmail} />
              <ExportButton variant="seatalk" label="Enviar no SeaTalk" onClick={handleExportSeatalk} />
            </div>
          </div>
        </Card>
        {/* ================= KPIs ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <KpiCard label="Colaboradores Planejados" value={kpis.colaboradoresPlanejados} />
          <KpiCard label="Colaboradores Presentes" value={kpis.colaboradoresPresentes} />
          <KpiCard label="Ausências" value={kpis.ausencias} highlight="error" />
          <KpiCard label="Absenteísmo" value={`${kpis.absenteismo}%`} highlight="warning" />
          <KpiCard label="Diaristas Planejados" value={kpis.diaristasPlanejados} />
          <KpiCard label="Diaristas Presentes" value={kpis.diaristasPresentes} />
          <KpiCard label="Aderência DW" value={`${kpis.aderenciaDW}%`} highlight="success" />
          <KpiCard label="Aderência Total" value={`${kpis.aderenciaTotal}%`} highlight="success" />
        </div>
        {/* ================= QUANTIDADE POR EMPRESA ================= */}
        <Card>
          <h2 className="font-medium mb-4">Quantidade por Empresa</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {empresas.length > 0 ? (
              empresas.map((e) => (
                <div
                  key={e.name}
                  className="relative bg-[#1c1c1c] rounded-xl p-4 overflow-hidden"
                >
                  <div className="absolute left-0 top-0 h-full w-1 bg-[#FA4C00]" />
                  <p className="text-xs text-[#BFBFC3]">{e.name}</p>
                  <p className="text-2xl font-semibold mt-1">{e.total}</p>
                  <div className="mt-3 flex justify-between text-xs">
                    <span className="text-[#BFBFC3]">Absenteísmo</span>
                    <span className={e.absenteismo > 4 ? "text-[#FF453A]" : "text-[#34C759]"}>
                      {e.absenteismo}%
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs">
                    <span className="text-[#BFBFC3]">Atestados</span>
                    <span className="text-[#FF9F0A]">{e.atestados}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#BFBFC3]">Nenhuma empresa encontrada para este turno</p>
            )}
          </div>
        </Card>
        {/* ================= GRÁFICO ================= */}
        <Card>
          <h2 className="font-medium mb-4">Planejado vs Real</h2>
          <ChartContainer>
            <RBarChart
              width={isExporting ? 1180 : undefined}
              height={isExporting ? 320 : undefined}
              data={graficoPlanejadoVsReal}
              margin={{ top: 32, right: 16, left: 8, bottom: 8 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="0" />
              <XAxis dataKey="name" tick={{ fill: "#BFBFC3", fontSize: 12 }} stroke="rgba(255,255,255,0.1)" />
              <YAxis tick={{ fill: "#BFBFC3", fontSize: 12 }} stroke="rgba(255,255,255,0.1)" />
              <Tooltip contentStyle={{ background: "#1c1c1c", border: "none" }} />
              <Bar dataKey="Planejado" fill="#3b82f6">
                <LabelList position="top" fill="#fff" fontSize={12} />
              </Bar>
              <Bar dataKey="Real" fill="#FA4C00">
                <LabelList position="top" fill="#fff" fontSize={12} />
              </Bar>
            </RBarChart>
          </ChartContainer>
        </Card>
        {/* ================= DISTRIBUIÇÕES ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <PieCard title="Gênero" data={genero} />
          <PieCard title="SPX x BPO" data={vinculo} />
          <PieCard title="Status" data={statusColaboradores} />
        </div>
        {/* ================= SETORES ================= */}
        <Card>
          <h2 className="font-medium mb-4">Presença por Setor</h2>
          <ul className="space-y-2 text-sm">
            {setores.map((s) => (
              <li key={s.name} className="flex justify-between">
                <span>{s.name}</span>
                <span className="font-medium text-[#FA4C00]">{s.value}</span>
              </li>
            ))}
          </ul>
        </Card>
        {/* ================= AUSENTES ================= */}
        <Card>
          <h2 className="font-medium mb-4">Ausentes no Turno</h2>
          <div className="overflow-x-auto">
            <table className="min-w-[600px] w-full text-sm">
              <thead className="text-[#BFBFC3]">
                <tr>
                  <th className="text-left py-2">Colaborador</th>
                  <th className="py-2">Motivo</th>
                  <th className="py-2">Setor</th>
                  <th className="py-2">Empresa</th>
                </tr>
              </thead>
              <tbody>
                {ausenciasHoje.map((a) => (
                  <tr key={a.colaboradorId} className="border-t border-white/5">
                    <td className="py-2">{a.nome}</td>
                    <td className="text-center text-[#FF9F0A]">{a.motivo}</td>
                    <td className="text-center">{a.setor}</td>
                    <td className="text-center">{a.empresa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        {/* ================= INSIGHTS ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <InsightCard type="warning" text={`${insights.atestados} atestados`} />
          <InsightCard type="error" text={`${insights.faltas} faltas`} />
          <InsightCard type="success" text={`Aderência ${insights.aderenciaTotal}%`} />
        </div>
      </div>
    </div>
  )
}
/* ================= COMPONENTS ================= */
function Card({ children }) {
  return <div className="bg-[#1c1c1c] rounded-xl p-4">{children}</div>
}
function KpiCard({ label, value, highlight }) {
  const bar =
    highlight === "success"
      ? "bg-[#34C759]"
      : highlight === "warning"
      ? "bg-[#FF9F0A]"
      : highlight === "error"
      ? "bg-[#FF453A]"
      : "bg-[#FA4C00]"
  return (
    <div className="relative rounded-xl bg-[#1c1c1c] p-4 overflow-hidden">
      <div className={`absolute left-0 top-0 h-full w-1 ${bar}`} />
      <p className="text-xs text-[#BFBFC3]">{label}</p>
      <p className="text-xl sm:text-2xl font-semibold mt-1">{value}</p>
    </div>
  )
}
function ChartContainer({ children }) {
  const isExporting = typeof document !== "undefined" && document.body.classList.contains("exporting-report")
  
  if (isExporting) {
    return <div className="h-80">{children}</div>
  }
  return (
    <div className="h-56 sm:h-64 md:h-80">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}
function PieCard({ title, data }) {
  const COLORS = ["#FA4C00", "#3b82f6", "#FFB37A", "#FFD2B0"]
  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0)
  const isExporting = typeof document !== "undefined" && document.body.classList.contains("exporting-report")
  return (
    <Card>
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      <div className={isExporting ? "h-56" : "h-48 sm:h-56"}>
        <ChartContainer>
          <PieChart width={isExporting ? 360 : undefined} height={isExporting ? 220 : undefined}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={45}
              outerRadius={70}
              label={({ value }) => (value > 0 ? value : "")}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "#1c1c1c", border: "none" }} />
          </PieChart>
        </ChartContainer>
      </div>
      <div className="mt-3 space-y-1 text-xs">
        {data.map((d, i) => {
          const percent = total > 0 ? Math.round(((Number(d.value) || 0) / total) * 100) : 0
          return (
            <div key={`${d.name}-${i}`} className="flex justify-between">
              <span className="text-white/70">{d.name}</span>
              <span className="font-medium">
                {d.value} ({percent}%)
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
function InsightCard({ type, text }) {
  const styles = {
    warning: "text-[#FFD28A] bg-[rgba(255,159,10,0.28)]",
    error: "text-[#FF9A92] bg-[rgba(255,69,58,0.28)]",
    success: "text-[#8CFFB0] bg-[rgba(52,199,89,0.28)]",
  }
  return <div className={`rounded-xl p-4 ${styles[type]}`}>{text}</div>
}
function ExportButton({ variant, label, onClick }) {
  const styles = {
    email: {
      bar: "bg-[#FF9F0A]",
      text: "text-[#FFD28A]",
      bg: "bg-[rgba(255,159,10,0.28)] hover:bg-[rgba(255,159,10,0.38)]",
    },
    seatalk: {
      bar: "bg-[#FA4C00]",
      text: "text-[#FFD2B0]",
      bg: "bg-[rgba(250,76,0,0.28)] hover:bg-[rgba(250,76,0,0.38)]",
    },
  }
  const s = styles[variant]
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-2 rounded-lg transition ${s.bg}`}
    >
      <span className={`absolute left-0 top-0 h-full w-1 ${s.bar}`} />
      <span className={`text-xs sm:text-sm font-medium ${s.text}`}>{label}</span>
    </button>
  )
}