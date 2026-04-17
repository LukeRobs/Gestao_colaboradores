import { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Upload, FileText, Clock, User, AlertCircle, CheckCircle2, XCircle, ArrowLeft, Download, Printer, Mail, Settings, X } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { MedidasDisciplinaresAPI } from "../../services/medidasDisciplinares";
import { AuthContext } from "../../context/AuthContext";
import { printCartaMedidaDisciplinar } from "../../utils/Printcartamedidadisciplinar";
import MainLayout from "../../components/MainLayout";
import api from "../../services/api";

export default function MedidaDisciplinarDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { logout, user, permissions } = useContext(AuthContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [medida, setMedida] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);

  // Estado do modal de configuração de RH
  const [modalRhOpen, setModalRhOpen] = useState(false);
  const [emailsRh, setEmailsRh] = useState([]); // array de emails
  const [emailInput, setEmailInput] = useState("");
  const [salvandoRh, setSalvandoRh] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  async function load() {
    try {
      const data = await MedidasDisciplinaresAPI.buscar(id);
      setMedida(data);
    } catch (e) {
      if (e.response?.status === 401) {
        logout();
        navigate("/login");
      }
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function enviarPdf() {
    if (!file) {
      alert("Selecione um arquivo PDF");
      return;
    }

    if (file.type !== "application/pdf") {
      alert("Por favor, selecione apenas arquivos PDF");
      return;
    }

    setUploading(true);

    try {
      const presign = await MedidasDisciplinaresAPI.presignUpload(id);
      const { uploadUrl, key } = presign.data.data;

      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" }
      });

      await MedidasDisciplinaresAPI.finalizar(id, { documentoKey: key });

      alert("✅ Documento enviado e medida finalizada com sucesso!");
      load();
    } catch (err) {
      console.error(err);
      alert("❌ Erro ao enviar documento. Tente novamente.");
    } finally {
      setUploading(false);
    }
  }

  async function baixarCarta() {
    try {
      await MedidasDisciplinaresAPI.baixarCarta(id);
    } catch (err) {
      console.error(err);
      alert("❌ Erro ao baixar carta. Tente novamente.");
    }
  }

  async function baixarDocumentoAssinado() {
    try {
      await MedidasDisciplinaresAPI.baixarDocumentoAssinado(id);
    } catch (err) {
      console.error(err);
      alert("❌ Erro ao baixar documento. Tente novamente.");
    }
  }

  async function abrirModalRh() {
    const idEstacao = medida?.colaborador?.idEstacao;
    if (!idEstacao) return;
    try {
      const res = await api.get(`/estacoes/${idEstacao}`);
      const emails = res.data.data?.emailRh || [];
      setEmailsRh(Array.isArray(emails) ? emails : (emails ? [emails] : []));
    } catch {
      setEmailsRh([]);
    }
    setEmailInput("");
    setModalRhOpen(true);
  }

  function adicionarEmail() {
    const email = emailInput.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Informe um e-mail válido.");
      return;
    }
    if (emailsRh.includes(email)) {
      alert("Este e-mail já está na lista.");
      return;
    }
    setEmailsRh((prev) => [...prev, email]);
    setEmailInput("");
  }

  function removerEmail(email) {
    setEmailsRh((prev) => prev.filter((e) => e !== email));
  }

  async function handleEnviarEmail() {
    setEnviandoEmail(true);
    try {
      await MedidasDisciplinaresAPI.enviarEmailEvidencia(id);
      alert("✅ Evidência enviada por e-mail com sucesso!");
    } catch (err) {
      const data = err.response?.data;
      if (data?.semRh) {
        if (permissions?.isAdmin) {
          await abrirModalRh();
        } else {
          alert("❌ RH local não configurado. Por favor, entrar em contato com um administrador.");
        }
      } else {
        console.error(err);
        alert("❌ Erro ao enviar e-mail. Tente novamente.");
      }
    } finally {
      setEnviandoEmail(false);
    }
  }

  async function salvarEmailRh() {
    const idEstacao = medida?.colaborador?.idEstacao;
    if (!idEstacao) return;
    if (emailsRh.length === 0) {
      alert("Adicione ao menos um e-mail.");
      return;
    }
    setSalvandoRh(true);
    try {
      await api.put(`/estacoes/${idEstacao}`, { emailRh: emailsRh });
      setModalRhOpen(false);
      alert("✅ E-mails do RH configurados com sucesso!");
    } catch (err) {
      console.error(err);
      alert("❌ Erro ao salvar configuração.");
    } finally {
      setSalvandoRh(false);
    }
  }

  function getStatusInfo(status) {
    const statusMap = {
      PENDENTE_ASSINATURA: {
        label: "Pendente Assinatura",
        color: "text-[#FFD60A]",
        bgColor: "bg-[#FFD60A]/10",
        borderColor: "border-[#FFD60A]/40",
        icon: Clock
      },
      ASSINADO: {
        label: "Assinado",
        color: "text-[#34C759]",
        bgColor: "bg-[#34C759]/10",
        borderColor: "border-[#34C759]/40",
        icon: CheckCircle2
      },
      CANCELADO: {
        label: "Cancelado",
        color: "text-[#FF453A]",
        bgColor: "bg-[#FF453A]/10",
        borderColor: "border-[#FF453A]/40",
        icon: XCircle
      },
      RASCUNHO: {
        label: "Rascunho",
        color: "text-muted",
        bgColor: "bg-[#BFBFC3]/10",
        borderColor: "border-[#BFBFC3]/40",
        icon: FileText
      }
    };
    return statusMap[status] || statusMap.RASCUNHO;
  }

  function formatDate(dateString) {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-page text-muted">
        Carregando…
      </div>
    );
  }

  if (!medida) return null;

  const statusInfo = getStatusInfo(medida.status);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="flex min-h-screen bg-page text-page">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 space-y-8 max-w-6xl">
          {/* HEADER */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/medidas-disciplinares")}
                className="text-muted hover:text-white transition-colors"
              >
                <ArrowLeft size={24} />
              </button>
              <div>
                <h1 className="text-2xl font-semibold">
                  Medida Disciplinar #{medida.idMedida}
                </h1>
                <p className={`text-sm ${statusInfo.color}`}>
                  Status: {statusInfo.label}
                </p>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => printCartaMedidaDisciplinar(medida)}
                className="flex items-center gap-2 px-6 py-2 rounded-xl bg-surface-2 hover:bg-[#3A3A3C] transition-colors"
              >
                <Printer size={16} />
                Imprimir Carta
              </button>
              {medida.status === "ASSINADO" && (
                <button
                  onClick={handleEnviarEmail}
                  disabled={enviandoEmail}
                  className={`flex items-center gap-2 px-6 py-2 rounded-xl transition-colors ${
                    enviandoEmail
                      ? "bg-[#3A3A3C] text-muted cursor-not-allowed"
                      : "bg-surface-2 hover:bg-[#3A3A3C]"
                  }`}
                >
                  <Mail size={16} />
                  {enviandoEmail ? "Enviando..." : "Enviar evidência por e-mail"}
                </button>
              )}
              {permissions?.isAdmin && (
                <button
                  onClick={abrirModalRh}
                  title="Configurar e-mails do RH local"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-2 hover:bg-[#3A3A3C] transition-colors text-muted hover:text-white"
                >
                  <Settings size={16} />
                  RH Local
                </button>
              )}
            </div>
          </div>

          {/* Alerta para pendente assinatura */}
          {medida.status === "PENDENTE_ASSINATURA" && (
            <div className={`${statusInfo.bgColor} border ${statusInfo.borderColor} rounded-xl p-4 flex items-start gap-3`}>
              <AlertCircle className={statusInfo.color} size={20} />
              <div>
                <h3 className={`font-semibold ${statusInfo.color} mb-1`}>Ação Necessária</h3>
                <p className="text-sm text-muted">
                  Esta medida disciplinar está aguardando o upload do documento assinado para ser finalizada.
                </p>
              </div>
            </div>
          )}

          {/* CARD PRINCIPAL */}
          <div className="bg-surface rounded-2xl p-6 space-y-6">
            {/* Informações do Colaborador */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <User size={20} className="text-[#FA4C00]" />
                <h2 className="font-semibold text-lg">Informações do Colaborador</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted">Nome Completo</span>
                  <p className="text-page font-medium mt-1">
                    {medida.colaborador?.nomeCompleto || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted">Staff ID (OPS)</span>
                  <p className="text-page font-medium mt-1">{medida.opsId || "—"}</p>
                </div>
                <div>
                  <span className="text-muted">Cargo</span>
                  <p className="text-page font-medium mt-1">
                    {medida.colaborador?.cargo || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted">Matrícula</span>
                  <p className="text-page font-medium mt-1">
                    {medida.colaborador?.matricula || "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-default"></div>

            {/* Detalhes da Medida */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FileText size={20} className="text-[#FA4C00]" />
                <h2 className="font-semibold text-lg">Detalhes da Medida Disciplinar</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-5">
                <div>
                  <span className="text-muted">Tipo de Medida</span>
                  <p className="text-page font-medium mt-1">{medida.tipoMedida || "—"}</p>
                </div>
                <div>
                  <span className="text-muted">Violação</span>
                  <p className="text-page font-medium mt-1">{medida.violacao || "—"}</p>
                </div>
              </div>

              <div className="mb-5">
                <span className="text-muted text-sm block mb-2">Motivo / Descrição</span>
                <div className="bg-page border border-default rounded-xl p-4">
                  <p className="text-muted text-sm whitespace-pre-wrap">
                    {medida.motivo || "—"}
                  </p>
                </div>
              </div>

              {medida.observacoes && (
                <div className="mb-5">
                  <span className="text-muted text-sm block mb-2">Observações</span>
                  <div className="bg-page border border-default rounded-xl p-4">
                    <p className="text-muted text-sm whitespace-pre-wrap">
                      {medida.observacoes}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted">Data de Criação</span>
                  <p className="text-page font-medium mt-1">
                    {formatDate(medida.createdAt)}
                  </p>
                </div>
                {medida.dataFinalizacao && (
                  <div>
                    <span className="text-muted">Data de Finalização</span>
                    <p className="text-page font-medium mt-1">
                      {formatDate(medida.dataFinalizacao)}
                    </p>
                  </div>
                )}
                {medida.responsavel && (
                  <div>
                    <span className="text-muted">Responsável</span>
                    <p className="text-page font-medium mt-1">{medida.responsavel}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Upload de Documento */}
            {medida.status === "PENDENTE_ASSINATURA" && (
              <>
                <div className="border-t border-default"></div>
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Upload size={20} className="text-[#FA4C00]" />
                    <h2 className="font-semibold text-lg">Finalizar Medida (Upload da Carta Assinada)</h2>
                  </div>

                  <p className="text-muted text-sm mb-4">
                    Faça o upload do PDF da medida disciplinar devidamente assinado para finalizar o processo.
                  </p>

                  <label className={`flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed rounded-xl px-6 py-8 cursor-pointer transition
                    ${file
                      ? "border-[#FA4C00] bg-[#FA4C00]/5"
                      : "border-default bg-surface hover:border-[#FA4C00]/60 hover:bg-[#FA4C00]/5"
                    }`}
                  >
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setFile(e.target.files[0])}
                      className="hidden"
                    />
                    {file ? (
                      <>
                        <CheckCircle2 size={28} className="text-[#FA4C00]" />
                        <span className="text-sm font-medium text-page text-center break-all">{file.name}</span>
                        <span className="text-xs text-muted">Clique para trocar o arquivo</span>
                      </>
                    ) : (
                      <>
                        <Upload size={28} className="text-muted" />
                        <span className="text-sm font-medium text-page">Clique para selecionar o PDF</span>
                        <span className="text-xs text-muted">Apenas arquivos .pdf</span>
                      </>
                    )}
                  </label>

                  <button
                    onClick={enviarPdf}
                    disabled={uploading || !file}
                    className={`mt-4 flex items-center gap-2 px-6 py-2 rounded-xl font-medium transition
                      ${uploading || !file
                        ? "bg-[#3A3A3C] text-muted cursor-not-allowed"
                        : "bg-[#FA4C00] hover:bg-[#D84300] text-white"
                      }`}
                  >
                    <CheckCircle2 size={16} />
                    {uploading ? "Enviando..." : "Finalizar Medida"}
                  </button>
                </div>
              </>
            )}

            {/* Documento Finalizado */}
            {medida.status === "ASSINADO" && medida.documentoAssinadoUrl && (
              <>
                <div className="border-t border-default"></div>
                <div className={`${statusInfo.bgColor} border ${statusInfo.borderColor} rounded-xl p-4`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className={statusInfo.color} size={20} />
                      <div>
                        <h3 className={`font-semibold ${statusInfo.color} mb-1`}>Documento Enviado</h3>
                        <p className="text-sm text-muted">
                          O documento assinado foi enviado e a medida disciplinar foi finalizada com sucesso.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={baixarDocumentoAssinado}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#34C759]/20 hover:bg-[#34C759]/30 text-[#34C759] transition-colors whitespace-nowrap"
                    >
                      <Download size={16} />
                      Baixar
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </MainLayout>

      {/* MODAL CONFIGURAÇÃO RH */}
      {modalRhOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings size={20} className="text-[#FA4C00]" />
                <h2 className="font-semibold text-lg">Configurar RH Local</h2>
              </div>
              <button onClick={() => setModalRhOpen(false)} className="text-muted hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-muted">
              Gerencie os e-mails do RH responsável por esta estação. Todos receberão as evidências das medidas disciplinares.
            </p>

            {/* Lista de emails cadastrados */}
            {emailsRh.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs text-muted uppercase tracking-wide">E-mails configurados</span>
                <div className="space-y-1.5">
                  {emailsRh.map((email) => (
                    <div key={email} className="flex items-center justify-between gap-2 bg-page border border-default rounded-xl px-3 py-2">
                      <span className="text-sm text-page truncate">{email}</span>
                      <button
                        onClick={() => removerEmail(email)}
                        className="text-muted hover:text-[#FF453A] transition-colors flex-shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Adicionar novo email */}
            <div className="space-y-2">
              <label className="text-sm text-muted">Adicionar e-mail</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && adicionarEmail()}
                  placeholder="rh@empresa.com"
                  className="flex-1 bg-page border border-default rounded-xl px-4 py-2.5 text-sm text-page outline-none focus:border-[#FA4C00] transition-colors"
                />
                <button
                  onClick={adicionarEmail}
                  className="px-4 py-2 rounded-xl bg-[#FA4C00] hover:bg-[#D84300] text-white text-sm font-medium transition-colors"
                >
                  Adicionar
                </button>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => setModalRhOpen(false)}
                className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-[#3A3A3C] text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarEmailRh}
                disabled={salvandoRh}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  salvandoRh
                    ? "bg-[#3A3A3C] text-muted cursor-not-allowed"
                    : "bg-[#FA4C00] hover:bg-[#D84300] text-white"
                }`}
              >
                {salvandoRh ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
