"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Upload, ArrowLeft, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import MainLayout from "../../components/MainLayout";

import Sidebar from "../../components/Sidebar"
import Header from "../../components/Header"
import api from "../../services/api"
import { EmpresasAPI } from "../../services/empresas"
import { SetoresAPI } from "../../services/setores"
import { TurnosAPI } from "../../services/turnos"
import { EscalasAPI } from "../../services/escalas"
import { CargosAPI } from "../../services/cargos"
import { EstacoesAPI } from "../../services/estacoes"
import { ColaboradoresAPI } from "../../services/colaboradores"

export default function ImportarColaboradores() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [refs, setRefs] = useState(null)
  const [refsError, setRefsError] = useState(false)
  const [status, setStatus] = useState({ message: "", type: "" })
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [skippedDetails, setSkippedDetails] = useState([])

  // FIX #1: guardar o interval em uma ref para poder limpar corretamente
  const intervalRef = useRef(null)
  const MAX_STATUS_ERRORS = 5
  const statusErrorCount = useRef(0)

  // FIX #1: limpar o interval quando o componente desmontar
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  useEffect(() => {
    async function fetchRefs() {
      try {
        const [empresas, setores, turnos, escalasRaw, cargos, estacoes, lideres] = await Promise.all([
          EmpresasAPI.listar(),
          SetoresAPI.listar(),
          TurnosAPI.listar(),
          EscalasAPI.listar(),
          CargosAPI.listar({ limit: 200 }),
          EstacoesAPI.listar(),
          ColaboradoresAPI.listarLideres(),
        ])
        const escalas = Array.isArray(escalasRaw?.data)
          ? escalasRaw.data
          : Array.isArray(escalasRaw)
          ? escalasRaw
          : []
        setRefs({ empresas, setores, turnos, escalas, cargos, estacoes, lideres })
      } catch (err) {
        console.error("Erro ao carregar referências:", err)
        // FIX #5: sinalizar erro visível ao usuário
        setRefsError(true)
      }
    }
    fetchRefs()
  }, [])

  function validateFile(f) {
    if (!f) return false
    if (!f.name.toLowerCase().endsWith(".csv") && !f.name.toLowerCase().endsWith(".xlsx")) {
      setStatus({ message: "Apenas arquivos CSV ou XLSX são permitidos", type: "error" })
      return false
    }
    if (f.size > 10 * 1024 * 1024) {
      setStatus({ message: "Arquivo muito grande (máx. 10MB)", type: "error" })
      return false
    }
    return true
  }

  function handleFile(f) {
    if (!validateFile(f)) return
    setFile(f)
    setStatus({ message: "Arquivo válido. Pronto para importação.", type: "success" })
  }

  // FIX #1 + #3: startStatusCheck com ref, limpeza de erro e desmontagem
  const startStatusCheck = useCallback(() => {
    setCheckingStatus(true)
    statusErrorCount.current = 0

    intervalRef.current = setInterval(async () => {
      try {
        const res = await api.get("/colaboradores/import-status")
        statusErrorCount.current = 0 // reset contador ao ter sucesso

        if (res.data.status === "completed") {
          clearInterval(intervalRef.current)
          intervalRef.current = null
          setCheckingStatus(false)

          // FIX #2: atualizar os dois estados juntos via um único setState em batch
          setStatus({
            message: `Importação finalizada ✔\n\nCriados: ${res.data.criados}\nAtualizados: ${res.data.atualizados}\nIgnorados: ${res.data.skipped}\nErros: ${res.data.erros}`,
            type: res.data.erros > 0 ? "error" : "success",
          })
          if (res.data.skippedDetails?.length) {
            setSkippedDetails(res.data.skippedDetails)
          }
        }
      } catch (err) {
        console.error("Erro ao verificar status:", err)
        statusErrorCount.current += 1

        // FIX #3: parar o interval após N erros consecutivos
        if (statusErrorCount.current >= MAX_STATUS_ERRORS) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
          setCheckingStatus(false)
          setStatus({
            message: "Não foi possível verificar o status da importação. Verifique manualmente.",
            type: "error",
          })
        }
      }
    }, 3000)
  }, [])

  async function handleImport() {
    if (!file) {
      setStatus({ message: "Selecione um arquivo CSV", type: "error" })
      return
    }

    const formData = new FormData()
    formData.append("file", file)

    try {
      setLoading(true)
      setProgress(0)

      const res = await api.post("/colaboradores/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 20000,
        onUploadProgress: (e) => setProgress(Math.round((e.loaded * 100) / e.total)),
      })

      setStatus({ message: res.data?.message || "Importação iniciada com sucesso.", type: "success" })
      startStatusCheck()
      setSkippedDetails([])
      setFile(null)
      setProgress(0)

      const input = document.getElementById("fileInput")
      if (input) input.value = ""
    } catch (err) {
      setStatus({
        message: err.response?.data?.message || "Erro ao enviar o arquivo. Verifique o CSV.",
        type: "error",
      })
    } finally {
      setLoading(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const refGroups = refs
    ? [
        { label: "id_estacao", items: refs.estacoes.map((e) => ({ id: e.idEstacao, nome: e.nomeEstacao })) },
        { label: "id_empresa", items: refs.empresas.map((e) => ({ id: e.idEmpresa, nome: e.razaoSocial })) },
        { label: "id_setor",   items: refs.setores.map((s)  => ({ id: s.idSetor,   nome: s.nomeSetor })) },
        { label: "id_cargo",   items: refs.cargos.map((c)   => ({ id: c.idCargo,   nome: c.nomeCargo })) },
        { label: "id_turno",   items: refs.turnos.map((t)   => ({ id: t.idTurno,   nome: t.nomeTurno })) },
        { label: "id_escala",  items: refs.escalas.map((e)  => ({ id: e.idEscala,  nome: e.nomeEscala, detalhe: e.descricao })) },
        { label: "id_lider",   items: refs.lideres.map((l)  => ({ id: l.opsId,     nome: l.nomeCompleto })) },
      ]
    : []

  // FIX #4: botão desabilitado também durante o checkingStatus
  const isSubmitDisabled = !file || loading || checkingStatus

  return (
    <div className="flex min-h-screen bg-page text-page">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />
      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-8 max-w-2xl mx-auto space-y-6">

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/colaboradores")}
              className="p-2 rounded-lg bg-surface hover:bg-surface-2"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-semibold">Importar Colaboradores</h1>
              <p className="text-sm text-muted">Envie um CSV para iniciar a importação automática</p>
            </div>
          </div>

          {/* FIX #5: erro ao carregar referências */}
          {refsError && (
            <div className="p-4 rounded-xl flex items-start gap-2 border bg-yellow-500/10 border-yellow-500/30 text-yellow-400">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>Não foi possível carregar as referências de IDs. Verifique sua conexão e recarregue a página.</span>
            </div>
          )}

          {status.message && (
            <div
              className={`p-4 rounded-xl flex items-start gap-2 border ${
                status.type === "success"
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
            >
              {status.type === "success" ? (
                <CheckCircle size={18} className="mt-0.5 shrink-0" />
              ) : (
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
              )}
              <span className="whitespace-pre-line">{status.message}</span>
            </div>
          )}

          {/* FIX #2: banner de "processando" some junto com o status final */}
          {checkingStatus && (
            <div className="p-4 rounded-xl border bg-blue-500/10 border-blue-500/30 text-blue-400 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin shrink-0" />
              Processando importação... aguarde
            </div>
          )}

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="bg-surface border border-dashed border-default rounded-2xl p-8 text-center hover:border-orange-500 transition"
          >
            <Upload size={30} className="mx-auto text-orange-400 mb-3" />
            <p className="text-sm text-muted mb-3">Arraste o arquivo CSV ou XLSX aqui</p>
            <input
              id="fileInput"
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => handleFile(e.target.files[0])}
              className="hidden"
            />
            <button
              onClick={() => document.getElementById("fileInput").click()}
              className="px-4 py-2 rounded-lg bg-surface-2 hover:bg-[#3D3D40]"
            >
              Selecionar arquivo
            </button>
          </div>

          {file && (
            <div className="bg-surface border border-default rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="text-orange-400" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-muted">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button onClick={() => setFile(null)} className="text-red-400 text-sm hover:underline">
                remover
              </button>
            </div>
          )}

          {loading && (
            <div className="bg-surface border border-default rounded-xl p-4">
              <div className="flex justify-between text-xs mb-1">
                <span>Enviando arquivo...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-surface-2 h-2 rounded">
                <div
                  style={{ width: `${progress}%` }}
                  className="bg-orange-500 h-2 rounded transition-all"
                />
              </div>
            </div>
          )}

          {/* FIX #4: desabilita durante checkingStatus também */}
          <button
            onClick={handleImport}
            disabled={isSubmitDisabled}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition ${
              isSubmitDisabled
                ? "bg-surface-2 text-muted cursor-not-allowed"
                : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            {loading ? "Enviando..." : checkingStatus ? "Processando..." : "Iniciar Importação"}
          </button>

          {/* IGNORADOS COM MOTIVO */}
          {skippedDetails.length > 0 && (
            <div className="bg-surface border border-yellow-500/30 rounded-2xl p-6 space-y-3">
              <p className="text-sm font-semibold text-yellow-400">
                Registros ignorados ({skippedDetails.length})
              </p>
              <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                {skippedDetails.map((d, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-muted border-b border-default pb-1">
                    <span className="font-mono text-white shrink-0">L{d.linha}</span>
                    <span className="text-[#6B6B6F] shrink-0">·</span>
                    <span className="font-mono text-yellow-400 shrink-0">{d.ops_id}</span>
                    <span className="text-[#6B6B6F] shrink-0">→</span>
                    <span>{d.motivo}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-surface border border-default rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Modelo CSV</p>
              <button
                onClick={() => {
                  const header =
                    "ops_id,nome_completo,matricula,cpf,data_admissao,id_estacao,id_setor,id_cargo,id_empresa,id_turno,id_escala,id_lider,genero,data_nascimento,email,telefone,hora_inicio_jornada"
                  const example =
                    "Ops123456,João da Silva,MAT001,123.456.789-00,01/03/2024,1,1,1,1,1,1,Ops000001,M,15/06/1995,joao@email.com,11999999999,05:25"
                  const blob = new Blob([header + "\n" + example], { type: "text/csv" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = "modelo_colaboradores.csv"
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-[#3D3D40] text-sm text-orange-400 transition"
              >
                <FileText size={14} />
                Baixar modelo
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted font-medium uppercase tracking-wide">Campos obrigatórios</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "ops_id","nome_completo","matricula","cpf","data_admissao",
                  "id_estacao","id_setor","id_cargo","id_empresa","id_turno","id_escala","id_lider",
                ].map((campo) => (
                  <span
                    key={campo}
                    className="px-2 py-1 rounded-md bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-mono"
                  >
                    {campo}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted font-medium uppercase tracking-wide">Campos opcionais</p>
              <div className="flex flex-wrap gap-2">
                {["genero","data_nascimento","email","telefone","hora_inicio_jornada"].map((campo) => (
                  <span
                    key={campo}
                    className="px-2 py-1 rounded-md bg-surface-2 border border-default text-muted text-xs font-mono"
                  >
                    {campo}
                  </span>
                ))}
              </div>
            </div>

            <div className="text-xs text-muted space-y-1 pt-1 border-t border-default">
              <p>📅 Datas: <span className="font-mono">DD/MM/YYYY</span> ou <span className="font-mono">YYYY-MM-DD</span></p>
              <p>⏰ Horário: <span className="font-mono">HH:MM</span> — padrão <span className="font-mono">05:25</span> se omitido</p>
              <p>✅ Todos os colaboradores importados entram com status <span className="font-mono">ATIVO</span> automaticamente</p>
            </div>

            {refs && (
              <div className="space-y-4 pt-2 border-t border-default">
                <p className="text-xs text-muted font-medium uppercase tracking-wide">Referências de IDs</p>
                {refGroups.map(
                  ({ label, items }) =>
                    items.length > 0 && (
                      <div key={label}>
                        <p className="text-xs font-mono text-orange-400 mb-1">{label}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                          {items.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 text-xs text-muted">
                              <span className="font-mono text-white">{item.id}</span>
                              <span className="text-[#6B6B6F]">→</span>
                              <span className="truncate">
                                {item.nome}
                                {item.detalhe && (
                                  <span className="ml-1 text-[#6B6B6F]">({item.detalhe})</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                )}
              </div>
            )}
          </div>

        </main>
      </MainLayout>
    </div>
  )
}