import { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";import MainLayout from "../../components/MainLayout";
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Printer,
  Users,
  Search,
  X,
  Plus,
  Pencil,
  XCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";

import { printAtaTreinamento } from "../../utils/printAtaTreinamento";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import api from "../../services/api";
import { TreinamentosAPI } from "../../services/treinamentos";
import { AuthContext } from "../../context/AuthContext";

/* =====================================================
   PAGE — DETALHES DO TREINAMENTO
===================================================== */
export default function DetalhesTreinamento() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { logout, user } = useContext(AuthContext);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [treinamento, setTreinamento] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  /* ---- modal edição de participantes ---- */
  const [modalOpen, setModalOpen] = useState(false);
  const [colaboradores, setColaboradores] = useState([]);
  const [search, setSearch] = useState("");
  const [setorFiltro, setSetorFiltro] = useState(null);
  const [turnoFiltro, setTurnoFiltro] = useState(null);
  const [setores, setSetores] = useState([]);
  const [turnosList, setTurnosList] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [salvando, setSalvando] = useState(false);

  /* ---- modal cancelamento ---- */
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const [downloadingAta, setDownloadingAta] = useState(false);

  /* ================= LOAD ================= */
  async function load() {
    try {
      const res = await api.get(`/treinamentos`);
      const found = res.data.data.find((t) => t.idTreinamento === Number(id));
      if (!found) { navigate("/treinamentos"); return; }
      setTreinamento(found);
    } catch (e) {
      if (e.response?.status === 401) { logout(); navigate("/login"); }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  /* ================= ABRIR MODAL ================= */
  const abrirModal = async () => {
    try {
      const [colabRes, setoresRes, turnosRes] = await Promise.all([
        api.get("/colaboradores", { params: { status: "ATIVO", limit: 1000 } }),
        api.get("/setores"),
        api.get("/turnos"),
      ]);
      setColaboradores(colabRes.data.data || colabRes.data);
      setSetores(setoresRes.data.data || setoresRes.data);
      setTurnosList(turnosRes.data.data || turnosRes.data);
      // pré-seleciona os participantes atuais
      setSelecionados(
        treinamento.participantes.map((p) => ({ opsId: p.opsId, cpf: p.cpf || null }))
      );
      setSearch("");
      setSetorFiltro(null);
      setTurnoFiltro(null);
      setModalOpen(true);
    } catch (e) {
      alert("Erro ao carregar colaboradores");
    }
  };

  /* ================= TOGGLE PARTICIPANTE ================= */
  const toggle = (colab) => {
    setSelecionados((prev) => {
      const exists = prev.some((p) => p.opsId === colab.opsId);
      if (exists) return prev.filter((p) => p.opsId !== colab.opsId);
      return [...prev, { opsId: colab.opsId, cpf: colab.cpf || null }];
    });
  };

  const selecionarTodos = () => {
    setSelecionados((prev) => {
      const novos = filtrados
        .filter((c) => !prev.some((p) => p.opsId === c.opsId))
        .map((c) => ({ opsId: c.opsId, cpf: c.cpf || null }));
      return [...prev, ...novos];
    });
  };

  const limparFiltrados = () => {
    const ids = filtrados.map((c) => c.opsId);
    setSelecionados((prev) => prev.filter((p) => !ids.includes(p.opsId)));
  };

  /* ================= SALVAR ================= */
  const salvarParticipantes = async () => {
    if (selecionados.length === 0) {
      alert("Selecione ao menos um participante");
      return;
    }
    setSalvando(true);
    try {
      const updated = await TreinamentosAPI.atualizarParticipantes(id, selecionados);
      setTreinamento(updated);
      setModalOpen(false);
    } catch (e) {
      alert("Erro ao salvar participantes");
    } finally {
      setSalvando(false);
    }
  };

  /* ================= CANCELAR ================= */
  const cancelarTreinamento = async () => {
    if (!motivoCancelamento.trim()) return;
    setCancelando(true);
    try {
      await TreinamentosAPI.cancelar(id, motivoCancelamento);
      setCancelModalOpen(false);
      navigate("/treinamentos");
    } catch (err) {
      console.error(err);
      alert("Erro ao cancelar treinamento");
    } finally {
      setCancelando(false);
    }
  };

  /* ================= FINALIZAR ================= */
  const finalizarTreinamento = async () => {
    if (!file) { alert("Selecione o PDF da ata"); return; }
    setUploading(true);
    try {
      const presign = await api.post(`/treinamentos/${treinamento.idTreinamento}/presign-ata`);
      const { uploadUrl, key } = presign.data;
      const uploadRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: file });
      if (!uploadRes.ok) {
        throw new Error(`Falha no upload para o R2 (${uploadRes.status})`);
      }
      await api.post(`/treinamentos/${treinamento.idTreinamento}/finalizar`, {
        documentoKey: key, nome: file.name, mime: file.type, size: file.size,
      });
      alert("Treinamento finalizado com sucesso");
      navigate("/treinamentos");
    } catch (err) {
      console.error(err);
      alert("Erro ao finalizar treinamento");
    } finally {
      setUploading(false);
    }
  };

  /* ================= FILTRO ================= */
  const filtrados = colaboradores.filter((c) => {
    const termo = (search || "").toLowerCase();
    const matchBusca =
      c.nomeCompleto?.toLowerCase().includes(termo) ||
      c.cpf?.includes(termo) ||
      c.opsId?.toLowerCase().includes(termo);
    const matchSetor = !setorFiltro || Number(c.idSetor) === Number(setorFiltro);
    const matchTurno = !turnoFiltro || Number(c.idTurno) === Number(turnoFiltro);
    return matchBusca && matchSetor && matchTurno;
  });

  /* ================= RENDER ================= */
  if (loading) {
    return <div className="h-screen flex items-center justify-center text-muted">Carregando…</div>;
  }
  if (!treinamento) return null;

  const statusColor =
    treinamento.status === "FINALIZADO"
      ? "text-[#34C759]"
      : treinamento.status === "CANCELADO"
      ? "text-[#FF453A]"
      : "text-[#FFD60A]";

  return (
    <>
      <div className="flex min-h-screen bg-page text-page">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />

        <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 space-y-8 max-w-6xl">
          {/* HEADER */}
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/treinamentos")} className="text-muted hover:text-white">
              <ArrowLeft />
            </button>
            <div>
              <h1 className="text-2xl font-semibold">Detalhes do Treinamento</h1>
              <p className={`text-sm ${statusColor}`}>Status: {treinamento.status}</p>
            </div>
          </div>

          {/* CARD PRINCIPAL */}
          <div className="bg-surface rounded-2xl p-6 space-y-6">
            {/* INFO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted">Data</span>
                <p>{new Date(treinamento.dataTreinamento).toLocaleDateString("pt-BR")}</p>
              </div>
              <div>
                <span className="text-muted">SOC</span>
                <p>{treinamento.soc}</p>
              </div>
              <div>
                <span className="text-muted">Processo</span>
                <p>{treinamento.processo}</p>
              </div>
              <div>
                <span className="text-muted">Tema</span>
                <p>{treinamento.tema}</p>
              </div>
              <div>
                <span className="text-muted">Líder Responsável</span>
                <p>{treinamento.liderResponsavel?.nomeCompleto}</p>
              </div>
            </div>

            {/* SETORES */}
            <div>
              <h3 className="text-sm text-muted mb-2">Setores</h3>
              <div className="flex flex-wrap gap-2">
                {treinamento.setores.map((s) => (
                  <span key={s.idTreinamentoSetor} className="px-3 py-1 rounded-full text-xs bg-surface-2">
                    {s.setor?.nomeSetor}
                  </span>
                ))}
              </div>
            </div>

            {/* PARTICIPANTES */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm text-muted">
                  Participantes ({treinamento.participantes.length})
                </h3>
                {treinamento.status === "ABERTO" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={abrirModal}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FA4C00]/10 hover:bg-[#FA4C00]/20 text-[#FA4C00] text-xs font-medium transition-colors"
                    >
                      <Pencil size={13} />
                      Editar participantes
                    </button>
                    {(user?.role === "ADMIN" || user?.id === treinamento.criadoPor) && (
                      <button
                        onClick={() => { setMotivoCancelamento(""); setCancelModalOpen(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF453A]/10 hover:bg-[#FF453A]/20 text-[#FF453A] text-xs font-medium transition-colors cursor-pointer"
                      >
                        <XCircle size={13} />
                        Cancelar treinamento
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="border border-default rounded-xl overflow-hidden">
                {treinamento.participantes.map((p) => (
                  <div
                    key={p.idTreinamentoParticipante}
                    className="px-4 py-2 flex justify-between text-sm border-b border-default last:border-b-0"
                  >
                    <span>{p.colaborador?.nomeCompleto || p.opsId}</span>
                    <span className="text-muted">{p.cpf || "-"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AÇÕES */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => printAtaTreinamento(treinamento)}
                className="flex items-center gap-2 px-6 py-2 rounded-xl bg-surface-2 hover:bg-[#3A3A3C]"
              >
                <Printer size={16} />
                Imprimir Ata
              </button>
            </div>

            {/* FINALIZAÇÃO */}
            {treinamento.status === "ABERTO" && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white/70">Finalizar Treinamento</h3>

                {/* DROP ZONE */}
                <label
                  className={`flex flex-col items-center justify-center gap-3 w-full py-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                    file
                      ? "border-[#FA4C00]/60 bg-[#FA4C00]/5"
                      : "border-white/10 bg-white/[0.02] hover:border-[#FA4C00]/40 hover:bg-[#FA4C00]/5"
                  }`}
                >
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                  <div className={`p-3 rounded-xl ${file ? "bg-[#FA4C00]/15" : "bg-white/5"}`}>
                    <FileText size={24} className={file ? "text-[#FA4C00]" : "text-white/30"} />
                  </div>
                  {file ? (
                    <div className="text-center">
                      <p className="text-sm font-medium text-white">{file.name}</p>
                      <p className="text-xs text-white/40 mt-0.5">{(file.size / 1024).toFixed(0)} KB • clique para trocar</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm font-medium text-white/70">Anexar ATA em PDF</p>
                      <p className="text-xs text-white/30 mt-0.5">Clique para selecionar o arquivo</p>
                    </div>
                  )}
                </label>

                <button
                  onClick={finalizarTreinamento}
                  disabled={uploading || !file}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                    uploading || !file
                      ? "bg-white/5 text-white/30 cursor-not-allowed"
                      : "bg-[#FA4C00] hover:bg-[#D84300] text-white"
                  }`}
                >
                  <CheckCircle size={16} />
                  {uploading ? "Enviando..." : "Finalizar Treinamento"}
                </button>
              </div>
            )}

            {/* PDF FINAL */}
            {treinamento.status === "FINALIZADO" && treinamento.ataPdfUrl && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-400">ATA do Treinamento</p>
                    <p className="text-xs text-white/40 truncate mt-0.5">
                      {treinamento.ataPdfNome || "ata-treinamento.pdf"}
                    </p>
                  </div>
                  <button
                    disabled={downloadingAta}
                    onClick={async () => {
                      try {
                        setDownloadingAta(true);
                        const res = await api.get(`/treinamentos/${treinamento.idTreinamento}/presign-download`);
                        window.open(res.data.data.url, "_blank");
                      } catch {
                        alert("Erro ao abrir a ATA. Tente novamente.");
                      } finally {
                        setDownloadingAta(false);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {downloadingAta
                      ? <Loader2 size={15} className="animate-spin" />
                      : <ExternalLink size={15} />
                    }
                    {downloadingAta ? "Abrindo…" : "Visualizar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </MainLayout>
    </div>

    {/* ===================== MODAL EDITAR PARTICIPANTES ===================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-white/10 shadow-2xl">
            {/* HEADER MODAL */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-[#FA4C00]" />
                <h2 className="font-semibold text-base">Editar Participantes</h2>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* FILTROS */}
            <div className="px-5 py-3 space-y-2 border-b border-white/5">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  placeholder="Buscar por nome, CPF ou OPS ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/50"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={setorFiltro || ""}
                  onChange={(e) => setSetorFiltro(e.target.value || null)}
                  className="flex-1 px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/50 appearance-none"
                >
                  <option value="">Todos os setores</option>
                  {setores.map((s) => (
                    <option key={s.idSetor} value={s.idSetor}>{s.nomeSetor}</option>
                  ))}
                </select>
                <select
                  value={turnoFiltro || ""}
                  onChange={(e) => setTurnoFiltro(e.target.value || null)}
                  className="flex-1 px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/50 appearance-none"
                >
                  <option value="">Todos os turnos</option>
                  {turnosList.map((t) => (
                    <option key={t.idTurno} value={t.idTurno}>{t.nomeTurno}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between text-xs text-white/40">
                <span>{filtrados.length} colaboradores • {selecionados.length} selecionados</span>
                <div className="flex gap-3">
                  <button onClick={selecionarTodos} className="text-[#FA4C00] hover:text-[#FF6B35]">Selecionar todos</button>
                  <button onClick={limparFiltrados} className="hover:text-white">Limpar</button>
                </div>
              </div>
            </div>

            {/* LISTA */}
            <div className="flex-1 overflow-y-auto px-5 py-2">
              {filtrados.length === 0 ? (
                <p className="text-center text-white/30 text-sm py-8">Nenhum colaborador encontrado</p>
              ) : (
                filtrados.map((c) => {
                  const selected = selecionados.some((p) => p.opsId === c.opsId);
                  return (
                    <button
                      key={c.opsId}
                      onClick={() => toggle(c)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl mb-1 text-sm transition-colors ${
                        selected ? "bg-[#FA4C00]/15 border border-[#FA4C00]/30" : "hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <span className={selected ? "text-white" : "text-white/70"}>{c.nomeCompleto}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-white/30 text-xs">{c.opsId}</span>
                        {selected && <CheckCircle size={15} className="text-[#FA4C00]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* FOOTER */}
            <div className="px-5 py-4 border-t border-white/5 flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarParticipantes}
                disabled={salvando}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-colors ${
                  salvando ? "bg-[#FA4C00]/50 cursor-not-allowed" : "bg-[#FA4C00] hover:bg-[#D84300]"
                }`}
              >
                <Plus size={15} />
                {salvando ? "Salvando..." : "Salvar participantes"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ===================== MODAL CANCELAR TREINAMENTO ===================== */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <XCircle size={18} className="text-[#FF453A]" />
                <h2 className="font-semibold text-base">Cancelar Treinamento</h2>
              </div>
              <button onClick={() => setCancelModalOpen(false)} className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-muted">
                Informe o motivo do cancelamento. Esta ação não pode ser desfeita.
              </p>
              <textarea
                value={motivoCancelamento}
                onChange={(e) => setMotivoCancelamento(e.target.value)}
                placeholder="Descreva o motivo do cancelamento..."
                rows={4}
                className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#FF453A]/50 resize-none"
              />
            </div>

            <div className="px-5 py-4 border-t border-white/5 flex justify-end gap-3">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={cancelarTreinamento}
                disabled={cancelando || !motivoCancelamento.trim()}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-colors ${
                  cancelando || !motivoCancelamento.trim()
                    ? "bg-[#FF453A]/30 text-white/30 cursor-not-allowed"
                    : "bg-[#FF453A] hover:bg-[#D93025] text-white"
                }`}
              >
                <XCircle size={15} />
                {cancelando ? "Cancelando..." : "Confirmar cancelamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}