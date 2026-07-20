import { useEffect, useState, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X, Pencil, UserCheck, UserX, Users, ShieldCheck, Building2 } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MainLayout from "../../components/MainLayout";
import { AprovadoresTreinamentoAPI } from "../../services/aprovadoresTreinamento";
import { AuthContext } from "../../context/AuthContext";
import api from "../../services/api";

const TODAS_AS_ESTACOES = "TODAS";

function iniciais(nome) {
  const partes = (nome || "").trim().split(/\s+/);
  return ((partes[0]?.[0] || "") + (partes[1]?.[0] || "")).toUpperCase();
}

export default function AprovadoresTreinamentoPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aprovadores, setAprovadores] = useState([]);
  const [estacoes, setEstacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { logout, permissions } = useContext(AuthContext);
  const isAdmin = !!permissions?.isAdmin;

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nome: "", email: "", ativo: true, idEstacao: "" });
  const [salvando, setSalvando] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await AprovadoresTreinamentoAPI.listar();
      setAprovadores(data || []);
    } catch (e) {
      if (e.response?.status === 401) { logout(); navigate("/login"); }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!isAdmin) return;
    api.get("/estacoes", { params: { limit: 999 } })
      .then((res) => setEstacoes(res.data?.data || res.data || []))
      .catch(() => setEstacoes([]));
  }, [isAdmin]);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ nome: "", email: "", ativo: true, idEstacao: "" });
    setModalOpen(true);
  };

  const abrirEditar = (a) => {
    setEditando(a);
    setForm({
      nome: a.nome,
      email: a.email,
      ativo: a.ativo,
      idEstacao: a.idEstacao == null ? TODAS_AS_ESTACOES : String(a.idEstacao),
    });
    setModalOpen(true);
  };

  const salvar = async () => {
    if (!form.nome.trim() || !form.email.trim()) {
      alert("Nome e email são obrigatórios");
      return;
    }
    if (isAdmin && !form.idEstacao) {
      alert("Selecione a estação do aprovador (ou \"Todas as estações\")");
      return;
    }

    const payload = { nome: form.nome, email: form.email, ativo: form.ativo };
    if (isAdmin) {
      payload.idEstacao = form.idEstacao === TODAS_AS_ESTACOES ? null : Number(form.idEstacao);
    }

    setSalvando(true);
    try {
      if (editando) {
        await AprovadoresTreinamentoAPI.atualizar(editando.idAprovador, payload);
      } else {
        await AprovadoresTreinamentoAPI.criar(payload);
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      alert(e.response?.data?.message || "Erro ao salvar aprovador");
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (a) => {
    try {
      await AprovadoresTreinamentoAPI.atualizar(a.idAprovador, { ativo: !a.ativo });
      await load();
    } catch (e) {
      alert("Erro ao atualizar aprovador");
    }
  };

  const stats = useMemo(() => ({
    total: aprovadores.length,
    ativos: aprovadores.filter((a) => a.ativo).length,
    inativos: aprovadores.filter((a) => !a.ativo).length,
  }), [aprovadores]);

  return (
    <div className="flex min-h-screen bg-page text-page">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigate={navigate} />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
          <div className="flex items-center gap-4 flex-wrap">
            <button onClick={() => navigate("/treinamentos/solicitacoes")} className="p-2.5 rounded-xl bg-surface-2 text-muted hover:text-page transition-all cursor-pointer">
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-[200px]">
              <h1 className="text-2xl font-semibold">Aprovadores de Treinamento</h1>
              <p className="text-sm text-muted mt-0.5">Responsáveis por aprovar ou negar solicitações de treinamento</p>
            </div>
            <button
              onClick={abrirNovo}
              className="flex items-center gap-2 bg-[#FA4C00] hover:bg-[#D84300] text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
            >
              <Plus size={16} /> Novo Aprovador
            </button>
          </div>

          {!isAdmin && (
            <p className="text-xs text-muted bg-surface-2 border border-default rounded-xl px-4 py-3">
              Mostrando apenas os aprovadores da sua estação (e aprovadores válidos em todas as estações, cadastrados pelo Admin).
            </p>
          )}

          {/* ── STAT CARDS ── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-default flex items-center justify-between">
              <div>
                <p className="text-xs text-muted mb-1">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="p-2.5 bg-[#FA4C00]/10 rounded-xl"><Users size={20} className="text-[#FA4C00]" /></div>
            </div>
            <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-default flex items-center justify-between">
              <div>
                <p className="text-xs text-muted mb-1">Ativos</p>
                <p className="text-2xl font-bold text-[#34C759]">{stats.ativos}</p>
              </div>
              <div className="p-2.5 bg-[#34C759]/10 rounded-xl"><ShieldCheck size={20} className="text-[#34C759]" /></div>
            </div>
            <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-default flex items-center justify-between">
              <div>
                <p className="text-xs text-muted mb-1">Inativos</p>
                <p className="text-2xl font-bold text-muted">{stats.inativos}</p>
              </div>
              <div className="p-2.5 bg-surface-2 rounded-xl"><UserX size={20} className="text-muted" /></div>
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-default overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 border-b border-default">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Estação</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody>
                {!loading && aprovadores.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center">
                          <Users size={20} className="text-subtle" />
                        </div>
                        <p className="text-muted text-sm">Nenhum aprovador cadastrado</p>
                      </div>
                    </td>
                  </tr>
                )}
                {aprovadores.map((a) => {
                  const podeGerenciar = isAdmin || a.idEstacao != null;
                  return (
                  <tr key={a.idAprovador} className="border-t border-default hover:bg-surface-2/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#FA4C00]/10 text-[#FA4C00] flex items-center justify-center text-xs font-semibold shrink-0">
                          {iniciais(a.nome) || "?"}
                        </div>
                        <span className="font-medium">{a.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{a.email}</td>
                    <td className="px-4 py-3">
                      {a.estacao?.nomeEstacao ? (
                        <span className="text-muted">{a.estacao.nomeEstacao}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#0A84FF]/10 text-[#0A84FF]">
                          <Building2 size={11} /> Todas as estações
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${a.ativo ? "bg-[#34C759]/10 text-[#34C759]" : "bg-surface-2 text-muted"}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.ativo ? "#34C759" : "#71717A" }} />
                        {a.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => podeGerenciar && abrirEditar(a)}
                          disabled={!podeGerenciar}
                          className="p-1.5 rounded-lg text-muted hover:text-page hover:bg-surface-2 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title={podeGerenciar ? "Editar" : "Somente Admin pode editar um aprovador de todas as estações"}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => podeGerenciar && alternarAtivo(a)}
                          disabled={!podeGerenciar}
                          className="p-1.5 rounded-lg text-muted hover:text-page hover:bg-surface-2 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title={podeGerenciar ? (a.ativo ? "Desativar" : "Ativar") : "Somente Admin pode gerenciar um aprovador de todas as estações"}
                        >
                          {a.ativo ? <UserX size={15} /> : <UserCheck size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      </MainLayout>

      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md border border-default shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-default">
              <h2 className="font-semibold text-base">{editando ? "Editar Aprovador" : "Novo Aprovador"}</h2>
              <button onClick={() => setModalOpen(false)} className="text-muted hover:text-page transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted">Nome</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full px-3 py-2.5 bg-surface-2 border border-default rounded-xl text-sm text-page focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2.5 bg-surface-2 border border-default rounded-xl text-sm text-page focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/50"
                />
              </div>

              {isAdmin ? (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted">Estação</label>
                  <select
                    value={form.idEstacao}
                    onChange={(e) => setForm({ ...form, idEstacao: e.target.value })}
                    className="w-full px-3 py-2.5 bg-surface-2 border border-default rounded-xl text-sm text-page focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/50 appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Selecione a estação</option>
                    {estacoes.map((e) => (
                      <option key={e.idEstacao} value={e.idEstacao}>{e.nomeEstacao}</option>
                    ))}
                    <option value={TODAS_AS_ESTACOES}>Todas as estações</option>
                  </select>
                </div>
              ) : (
                <p className="text-xs text-muted bg-surface-2 border border-default rounded-xl px-3 py-2.5">
                  Este aprovador será cadastrado na sua estação atual.
                </p>
              )}

              <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                  className="accent-[#FA4C00]"
                />
                Ativo
              </label>
            </div>

            <div className="px-5 py-4 border-t border-default flex justify-end gap-3">
              <button onClick={() => setModalOpen(false)} className="px-5 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-sm transition-colors">
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-colors ${salvando ? "bg-[#FA4C00]/50 cursor-not-allowed" : "bg-[#FA4C00] hover:bg-[#D84300]"} text-white`}
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
