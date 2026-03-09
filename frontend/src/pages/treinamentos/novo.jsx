import { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Search, Users, Calendar, BookOpen, MapPin, CheckCircle2, Circle } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { TreinamentosAPI } from "../../services/treinamentos";
import { ColaboradoresAPI } from "../../services/colaboradores";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";

/* =====================================================
   PAGE — NOVO TREINAMENTO (Mobile-First Redesign)
===================================================== */
export default function NovoTreinamento() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [estacoes, setEstacoes] = useState([]);
  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);
  const [setorSelecionado, setSetorSelecionado] = useState(null);
  const [turnoSelecionado, setTurnoSelecionado] = useState(null);
  /* ================= FORM ================= */
  const [form, setForm] = useState({
    dataTreinamento: "",
    processo: "",
    tema: "",
    soc: "",
    setores: [],
    participantes: [],
  });

  /* ================= LISTAS ================= */
  const [setores, setSetores] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [search, setSearch] = useState("");
  const [showParticipantsList, setShowParticipantsList] = useState(false);

  /* ================= LOAD ================= */
  useEffect(() => {
    async function loadBase() {
      try {
        const [setoresRes, colaboradoresRes, estacoesRes] = await Promise.all([
          api.get("/setores"),
          api.get("/colaboradores", { 
            params: { 
              status: "ATIVO", 
              limit: 1000,
            } 
          }),
          api.get("/estacoes"),
        ]);
        setSetores(setoresRes.data.data || setoresRes.data);
        setColaboradores(colaboradoresRes.data.data || colaboradoresRes.data);
        setEstacoes(estacoesRes.data.data || estacoesRes.data || []);
      } catch (e) {
        if (e.response?.status === 401) {
          logout();
          navigate("/login");
        }
      }
    }
    loadBase();
  }, [logout, navigate]);

  /* ================= HANDLERS ================= */
  const toggleSetor = (idSetor) => {

    setSetorSelecionado((prev) =>
      prev === idSetor ? null : idSetor
    );

    setForm((f) => ({
      ...f,
      setores: f.setores.includes(idSetor)
        ? []
        : [idSetor],
    }));

  };

  const toggleParticipante = (colab) => {
    setForm((f) => {
      const exists = f.participantes.some((p) => p.opsId === colab.opsId);
      if (exists) {
        return {
          ...f,
          participantes: f.participantes.filter(
            (p) => p.opsId !== colab.opsId
          ),
        };
      }
      return {
        ...f,
        participantes: [
          ...f.participantes,
          { opsId: colab.opsId, cpf: colab.cpf || null },
        ],
      };
    });
  };

  const selecionarTodos = () => {

    setForm((f) => {

      const novos = colaboradoresFiltrados
        .filter((c) => !f.participantes.some((p) => p.opsId === c.opsId))
        .map((c) => ({
          opsId: c.opsId,
          cpf: c.cpf || null,
        }));

      return {
        ...f,
        participantes: [...f.participantes, ...novos],
      };

    });

  };

  const limparSelecionados = () => {

    const idsFiltrados = colaboradoresFiltrados.map((c) => c.opsId);

    setForm((f) => ({
      ...f,
      participantes: f.participantes.filter(
        (p) => !idsFiltrados.includes(p.opsId)
      ),
    }));

  };

  const submit = async () => {
    if (!form.dataTreinamento || !form.tema || !form.processo) {
      alert("Preencha os campos obrigatórios (Data, Tema e Processo)");
      return;
    }
    if (form.participantes.length === 0) {
      alert("Selecione ao menos um participante");
      return;
    }
    setLoading(true);
    try {
      const treinamento = await TreinamentosAPI.criar(form);
      navigate(`/treinamentos/${treinamento.idTreinamento}`);
    } catch (err) {
      alert("Erro ao criar treinamento");
    } finally {
      setLoading(false);
    }
  };

  const colaboradoresFiltrados = colaboradores.filter((c) => {

    const termo = (search || "").toLowerCase();

    const matchBusca =
      c.nomeCompleto?.toLowerCase().includes(termo) ||
      c.cpf?.includes(termo) ||
      c.opsId?.toLowerCase().includes(termo);

    const matchSetor =
      !setorSelecionado || Number(c.idSetor) === Number(setorSelecionado);
    const matchTurno =
      !turnoSelecionado || Number(c.idTurno) === Number(turnoSelecionado);

    return matchBusca && matchSetor && matchTurno;

  });

  const isFormValid = form.dataTreinamento && form.tema && form.processo && form.participantes.length > 0;

  /* ================= RENDER ================= */
  return (
    <div className="flex min-h-screen bg-[#0A0A0B]">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />
      
      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="min-h-screen pb-24 lg:pb-8">
          {/* MOBILE HEADER */}
          <div className="sticky top-0 z-10 bg-[#0A0A0B]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 lg:hidden">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/treinamentos")}
                className="p-2 -ml-2 text-white/60 hover:text-white active:scale-95 transition-all"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-semibold text-white truncate">Novo Treinamento</h1>
                <p className="text-xs text-white/40">Cadastro de treinamento</p>
              </div>
            </div>
          </div>

          {/* DESKTOP HEADER */}
          <div className="hidden lg:block px-6 xl:px-8 pt-6 pb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/treinamentos")}
                className="p-2.5 rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-white">Novo Treinamento</h1>
                <p className="text-sm text-white/50 mt-0.5">
                  Cadastro de treinamento (status em aberto)
                </p>
              </div>
            </div>
          </div>

          {/* FORM CONTAINER */}
          <div className="px-4 lg:px-6 xl:px-8 space-y-4 lg:space-y-5 max-w-5xl">
            
            {/* SECTION: INFORMAÇÕES BÁSICAS */}
            <div className="bg-linear-to-br from-white/[0.07] to-white/2 rounded-2xl lg:rounded-3xl p-4 lg:p-6 border border-white/5 shadow-2xl">
              <div className="flex items-center gap-2.5 mb-4 lg:mb-5">
                <div className="p-2 rounded-lg bg-[#FA4C00]/10">
                  <BookOpen size={18} className="text-[#FA4C00]" />
                </div>
                <h2 className="text-sm lg:text-base font-semibold text-white">Informações Básicas</h2>
              </div>

              <div className="space-y-4">
                {/* DATA */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs lg:text-sm font-medium text-white/70">
                    <Calendar size={14} className="text-white/40" />
                    Data do Treinamento *
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 lg:py-3.5 bg-black/30 border border-white/10 rounded-xl lg:rounded-2xl text-white text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/50 focus:border-[#FA4C00]/50 transition-all placeholder:text-white/30"
                    value={form.dataTreinamento}
                    onChange={(e) =>
                      setForm({ ...form, dataTreinamento: e.target.value })
                    }
                  />
                </div>

                {/* TEMA */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs lg:text-sm font-medium text-white/70">
                    <BookOpen size={14} className="text-white/40" />
                    Tema do Treinamento *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Segurança no Trabalho, Uso de EPIs..."
                    className="w-full px-4 py-3 lg:py-3.5 bg-black/30 border border-white/10 rounded-xl lg:rounded-2xl text-white text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/50 focus:border-[#FA4C00]/50 transition-all placeholder:text-white/30"
                    value={form.tema}
                    onChange={(e) =>
                      setForm({ ...form, tema: e.target.value })
                    }
                  />
                </div>

                {/* PROCESSO */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs lg:text-sm font-medium text-white/70">
                    Processo *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Carga e Descarga, Separação..."
                    className="w-full px-4 py-3 lg:py-3.5 bg-black/30 border border-white/10 rounded-xl lg:rounded-2xl text-white text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/50 focus:border-[#FA4C00]/50 transition-all placeholder:text-white/30"
                    value={form.processo}
                    onChange={(e) =>
                      setForm({ ...form, processo: e.target.value })
                    }
                  />
                </div>

                {/* SOC */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs lg:text-sm font-medium text-white/70">
                    <MapPin size={14} className="text-white/40" />
                    SOC (Opcional)
                  </label>
                  <select
                    className="w-full px-4 py-3 lg:py-3.5 bg-black/30 border border-white/10 rounded-xl lg:rounded-2xl text-white text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/50 focus:border-[#FA4C00]/50 transition-all appearance-none cursor-pointer"
                    value={form.soc}
                    onChange={(e) =>
                      setForm({ ...form, soc: e.target.value })
                    }
                  >
                    <option value="" className="bg-[#1A1A1C]">Selecione o SOC</option>
                    {estacoes.map((e) => (
                      <option
                        key={e.idEstacao}
                        value={e.stationCode || e.codigo}
                        className="bg-[#1A1A1C]"
                      >
                        {e.stationCode || e.codigo} — {e.nomeEstacao}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION: SETORES */}
            <div className="bg-linear-to-br from-white/[0.07] to-white/2 rounded-2xl lg:rounded-3xl p-4 lg:p-6 border border-white/5 shadow-2xl">
              <div className="mb-4 lg:mb-5">
                <h2 className="text-sm lg:text-base font-semibold text-white mb-1">Setores Impactados</h2>
                <p className="text-xs text-white/40">Selecione os setores relacionados ao treinamento</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {setores.map((s) => {
                  const selected = form.setores.includes(s.idSetor);
                  return (
                    <button
                      key={s.idSetor}
                      onClick={() => toggleSetor(s.idSetor)}
                      className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-xs lg:text-sm font-medium transition-all active:scale-95
                        ${
                          selected
                            ? "bg-[#FA4C00] text-white shadow-lg shadow-[#FA4C00]/20"
                            : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10"
                        }`}
                    >
                      {s.nomeSetor}
                    </button>
                  );
                })}
              </div>
          </div>       
            {/* SECTION: PARTICIPANTES */}
            <div className="bg-linear-to-br from-white/[0.07] to-white/2 rounded-2xl lg:rounded-3xl p-4 lg:p-6 border border-white/5 shadow-2xl">
              <div className="flex items-center justify-between mb-4 lg:mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#FA4C00]/10">
                    <Users size={18} className="text-[#FA4C00]" />
                  </div>
                  <div>
                    <h2 className="text-sm lg:text-base font-semibold text-white">Participantes</h2>
                    <p className="text-xs text-white/40 mt-0.5">
                      {form.participantes.length} {form.participantes.length === 1 ? 'selecionado' : 'selecionados'}
                    </p>
                  </div>
                </div>
                
                {form.participantes.length > 0 && (
                  <div className="px-3 py-1.5 bg-[#FA4C00]/10 rounded-full">
                    <span className="text-xs font-semibold text-[#FA4C00]">
                      {form.participantes.length}
                    </span>
                  </div>
                )}
              </div>

              {/* SEARCH */}
              <div className="relative mb-3 lg:mb-4">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  placeholder="Buscar por nome, CPF ou OpsId..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setShowParticipantsList(true)}
                  className="w-full pl-11 pr-4 py-3 lg:py-3.5 bg-black/30 border border-white/10 rounded-xl lg:rounded-2xl text-white text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-[#FA4C00]/50 focus:border-[#FA4C00]/50 transition-all placeholder:text-white/30"
                />
              </div>

              <div className="flex gap-2 mb-3">
                {[
                  { id: 1, nome: "T1" },
                  { id: 2, nome: "T2" },
                  { id: 3, nome: "T3" },
                ].map((t) => {
                  const selected = turnoSelecionado === t.id;

                  return (
                    <button
                      key={t.id}
                      onClick={() =>
                        setTurnoSelecionado(selected ? null : t.id)
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
                        ${
                          selected
                            ? "bg-[#FA4C00] text-white"
                            : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                        }`}
                    >
                      {t.nome}
                    </button>
                  );
                })}
              </div>

              {/* SELECTED PARTICIPANTS (Chips - Mobile) */}
              {form.participantes.length > 0 && (
                <div className="mb-3 lg:hidden">
                  <div className="flex flex-wrap gap-2">
                    {form.participantes.slice(0, 3).map((p) => {
                      const colab = colaboradores.find(c => c.opsId === p.opsId);
                      return (
                        <div
                          key={p.opsId}
                          className="flex items-center gap-2 px-3 py-1.5 bg-[#FA4C00]/10 border border-[#FA4C00]/20 rounded-full"
                        >
                          <span className="text-xs text-white/90">{colab?.nomeCompleto?.split(' ')[0]}</span>
                          <button
                            onClick={() => toggleParticipante(colab)}
                            className="text-[#FA4C00] hover:text-white transition-colors"
                          >
                            <Circle size={14} className="fill-current" />
                          </button>
                        </div>
                      );
                    })}
                    {form.participantes.length > 3 && (
                      <div className="px-3 py-1.5 bg-white/5 rounded-full">
                        <span className="text-xs text-white/60">+{form.participantes.length - 3}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* AÇÕES DA LISTA */}
              {colaboradoresFiltrados.length > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-white/40">
                    {colaboradoresFiltrados.length} colaboradores encontrados
                  </span>

                  <div className="flex gap-2">
                    <button
                      onClick={selecionarTodos}
                      className="px-3 py-1.5 text-xs bg-[#FA4C00]/10 border border-[#FA4C00]/20 text-[#FA4C00] rounded-lg hover:bg-[#FA4C00]/20 transition"
                    >
                      Selecionar todos
                    </button>

                    <button
                      onClick={limparSelecionados}
                      className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 text-white/60 rounded-lg hover:bg-white/10 transition"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
              )}
              {/* PARTICIPANTS LIST */}
              <div className="border border-white/10 rounded-xl lg:rounded-2xl overflow-hidden bg-black/20">
                <div className="max-h-64 lg:max-h-80 overflow-y-auto custom-scrollbar">
                  {colaboradoresFiltrados.length === 0 ? (
                    <div className="px-4 py-12 text-center">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
                        <Users size={20} className="text-white/30" />
                      </div>
                      <p className="text-sm text-white/40">Nenhum colaborador encontrado</p>
                    </div>
                  ) : (
                    colaboradoresFiltrados.map((c, index) => {
                      const selected = form.participantes.some(
                        (p) => p.opsId === c.opsId
                      );
                      return (
                        <div
                          key={c.opsId}
                          onClick={() => toggleParticipante(c)}
                          className={`flex items-center justify-between px-4 py-3 lg:py-3.5 cursor-pointer transition-all active:scale-[0.98]
                            ${selected ? 'bg-[#FA4C00]/10 border-l-2 border-[#FA4C00]' : 'hover:bg-white/5'}
                            ${index !== 0 ? 'border-t border-white/5' : ''}`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`shrink-0 w-8 h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center transition-all
                              ${selected ? 'bg-[#FA4C00]' : 'bg-white/10'}`}
                            >
                              {selected ? (
                                <CheckCircle2 size={16} className="text-white" />
                              ) : (
                                <Circle size={16} className="text-white/40" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm lg:text-base font-medium truncate transition-colors
                                ${selected ? 'text-white' : 'text-white/80'}`}
                              >
                                {c.nomeCompleto}
                              </p>
                              <p className="text-xs text-white/40 truncate">
                                {c.cpf || c.opsId || "-"}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* MOBILE BOTTOM BAR */}
          <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-[#0A0A0B]/95 backdrop-blur-xl border-t border-white/10 p-4 z-20">
            <button
              onClick={submit}
              disabled={loading || !isFormValid}
              className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all
                ${
                  loading || !isFormValid
                    ? "bg-white/10 text-white/30 cursor-not-allowed"
                    : "bg-linear-to-r from-[#FA4C00] to-[#FF6B35] text-white shadow-lg shadow-[#FA4C00]/30 active:scale-[0.98]"
                }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Criar Treinamento
                </>
              )}
            </button>
          </div>

          {/* DESKTOP ACTION */}
          <div className="hidden lg:block px-6 xl:px-8 mt-6 max-w-5xl">
            <div className="flex justify-end">
              <button
                onClick={submit}
                disabled={loading || !isFormValid}
                className={`flex items-center gap-2.5 px-8 py-3.5 rounded-2xl font-semibold text-sm transition-all
                  ${
                    loading || !isFormValid
                      ? "bg-white/10 text-white/30 cursor-not-allowed"
                      : "bg-linear-to-r from-[#FA4C00] to-[#FF6B35] text-white shadow-xl shadow-[#FA4C00]/30 hover:shadow-2xl hover:shadow-[#FA4C00]/40 hover:scale-105 active:scale-100"
                  }`}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Criando Treinamento...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Criar Treinamento
                  </>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(250, 76, 0, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(250, 76, 0, 0.5);
        }
      `}</style>
    </div>
  );
}