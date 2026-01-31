import { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";

import { TreinamentosAPI } from "../../services/treinamentos";
import { ColaboradoresAPI } from "../../services/colaboradores";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";

/* =====================================================
   PAGE — NOVO TREINAMENTO
===================================================== */
export default function NovoTreinamento() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [estacoes, setEstacoes] = useState([]);
  const [lideres, setLideres] = useState([]);

  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);

  /* ================= FORM ================= */
  const [form, setForm] = useState({
    dataTreinamento: "",
    processo: "",
    tema: "",
    soc: "",
    liderResponsavelOpsId: "",
    setores: [],
    participantes: [],
  });

  /* ================= LISTAS ================= */
  const [setores, setSetores] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [search, setSearch] = useState("");

  /* ================= LOAD ================= */
  useEffect(() => {
    async function loadBase() {
      try {
        // Carrega dados necessários para o formulário em paralelo
        const [setoresRes, colaboradoresRes, estacoesRes] = await Promise.all([
          api.get("/setores"),
          api.get("/colaboradores", { 
            params: { 
                status: "ATIVO", 
                limit: 1000,
            } }),
          api.get("/estacoes"),
          // CARREGAMENTO DOS LÍDERES REMOVIDO:
          // Não é mais necessário carregar líderes pois o select de instrutor foi removido
          // ColaboradoresAPI.listarLideres(),
        ]);

        setSetores(setoresRes.data.data || setoresRes.data);
        setColaboradores(colaboradoresRes.data.data || colaboradoresRes.data);
        setEstacoes(estacoesRes.data.data || estacoesRes.data || []);
        // Lista de líderes não é mais necessária
        // setLideres(lideresRes || []);
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
    setForm((f) => ({
      ...f,
      setores: f.setores.includes(idSetor)
        ? f.setores.filter((s) => s !== idSetor)
        : [...f.setores, idSetor],
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

const submit = async () => {
  // VALIDAÇÃO DOS CAMPOS OBRIGATÓRIOS:
  // Removida a validação do instrutor (liderResponsavelOpsId)
  // Campos obrigatórios: data, tema e processo
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
    // Envia o formulário sem o campo do instrutor
    const treinamento = await TreinamentosAPI.criar(form);
    navigate(`/treinamentos/${treinamento.idTreinamento}`);
  } catch (err) {
    alert("Erro ao criar treinamento");
  } finally {
    setLoading(false);
  }
};

const colaboradoresFiltrados = colaboradores.filter((c) => {
  const termo = search.toLowerCase();

  return (
    c.nomeCompleto?.toLowerCase().includes(termo) ||
    c.cpf?.includes(termo) ||
    c.opsId?.toLowerCase().includes(termo)
  );
});


  /* ================= RENDER ================= */
  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 space-y-8 max-w-6xl">
          {/* HEADER */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/treinamentos")}
              className="text-[#BFBFC3] hover:text-white"
            >
              <ArrowLeft />
            </button>

            <div>
              <h1 className="text-2xl font-semibold">Novo Treinamento</h1>
              <p className="text-sm text-[#BFBFC3]">
                Cadastro de treinamento (status em aberto)
              </p>
            </div>
          </div>

          {/* FORM */}
          <div className="bg-[#1A1A1C] rounded-2xl p-6 space-y-8">
            {/* DADOS */}
            <h3 className="text-sm font-medium text-[#BFBFC3]">
              Dados do Treinamento
            </h3>

            {/* LINHA 1 - DATA E SOC */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* DATA */}
              <div className="space-y-1">
                <label className="text-xs text-[#BFBFC3]">
                  Data do Treinamento
                </label>

                <input
                  type="date"
                  className="input"
                  value={form.dataTreinamento}
                  onChange={(e) =>
                    setForm({ ...form, dataTreinamento: e.target.value })
                  }
                />
              </div>

              {/* SOC */}
              <div className="space-y-1">
                <label className="text-xs text-[#BFBFC3]">
                  SOC
                </label>

                <select
                  className="input"
                  value={form.soc}
                  onChange={(e) =>
                    setForm({ ...form, soc: e.target.value })
                  }
                >
                  <option value="">Selecione o SOC</option>

                  {estacoes.map((e) => (
                    <option
                      key={e.idEstacao}
                      value={e.stationCode || e.codigo}
                    >
                      {e.stationCode || e.codigo} — {e.nomeEstacao}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* LINHA 2 - TEMA E PROCESSO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 
                INSTRUTOR - CAMPO REMOVIDO TEMPORARIAMENTE
                Este bloco continha o select para seleção do instrutor responsável pelo treinamento
                O campo utilizava a lista de líderes carregada via ColaboradoresAPI.listarLideres()
                e armazenava o opsId do líder selecionado em form.liderResponsavelOpsId
              */}
              {/* 
              <div className="space-y-1">
                <label className="text-xs text-[#BFBFC3]">
                  Instrutor *
                </label>

                <select
                  className="input"
                  value={form.liderResponsavelOpsId}
                  onChange={(e) =>
                    setForm({ ...form, liderResponsavelOpsId: e.target.value })
                  }
                >
                  <option value="">Selecione o instrutor</option>

                  {lideres.map((lider) => (
                    <option
                      key={lider.opsId}
                      value={lider.opsId}
                    >
                      {lider.nomeCompleto} ({lider.opsId}) {lider.cargo?.nomeCargo ? `- ${lider.cargo.nomeCargo}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              */}

              {/* TEMA */}
              <div className="space-y-1">
                <label className="text-xs text-[#BFBFC3]">
                  Tema do Treinamento
                </label>

                <input
                  type="text"
                  placeholder="Tema do Treinamento"
                  className="input"
                  value={form.tema}
                  onChange={(e) =>
                    setForm({ ...form, tema: e.target.value })
                  }
                />
              </div>

              {/* PROCESSO */}
              <div className="space-y-1">
                <label className="text-xs text-[#BFBFC3]">
                  Processo
                </label>

                <input
                  type="text"
                  placeholder="Processo"
                  className="input"
                  value={form.processo}
                  onChange={(e) =>
                    setForm({ ...form, processo: e.target.value })
                  }
                />
              </div>
            </div>

            {/* SETORES */}
            <div>
              <h3 className="text-sm font-medium text-[#BFBFC3] mb-2">
                Setores Impactados
              </h3>

              <div className="flex flex-wrap gap-2">
                {setores.map((s) => (
                  <button
                    key={s.idSetor}
                    onClick={() => toggleSetor(s.idSetor)}
                    className={`px-3 py-1 rounded-full text-xs transition
                      ${
                        form.setores.includes(s.idSetor)
                          ? "bg-[#FA4C00] text-white"
                          : "bg-[#262628] text-[#BFBFC3] hover:bg-[#3A3A3C]"
                      }`}
                  >
                    {s.nomeSetor}
                  </button>
                ))}
              </div>
            </div>

            {/* PARTICIPANTES */}
            <div>
            <h3 className="text-sm font-medium text-[#BFBFC3] mb-2">
            Participantes Selecionados ({form.participantes.length})
            </h3>

            <input
            type="text"
            placeholder="Buscar por nome, CPF ou OpsId..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input mb-2"
            />

            <div className="max-h-[260px] overflow-y-auto border border-[#2A2A2C] rounded-xl">
            {colaboradoresFiltrados.length === 0 ? (
                <div className="px-4 py-6 text-sm text-[#8E8E93] text-center">
                Nenhum colaborador encontrado
                </div>
            ) : (
                colaboradoresFiltrados.map((c) => {
                  const selected = form.participantes.some(
                    (p) => p.opsId === c.opsId
                  );

                  return (
                    <div
                      key={c.opsId}
                      onClick={() => toggleParticipante(c)}
                      className={`px-4 py-2 flex justify-between items-center text-sm cursor-pointer
                        ${
                          selected
                            ? "bg-[#FA4C00]/20"
                            : "hover:bg-[#1F1F22]"
                        }`}
                    >
                      <span>{c.nomeCompleto}</span>
                      <span className="text-xs text-[#BFBFC3]">
                        {c.cpf || "-"}
                      </span>
                    </div>
                  );
                })
            )}
              </div>
            </div>

            {/* ACTION */}
            <div className="flex justify-end">
              <button
                onClick={submit}
                disabled={loading || form.participantes.length === 0}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl transition
                  ${
                    loading || form.participantes.length === 0
                      ? "bg-[#3A3A3C] cursor-not-allowed"
                      : "bg-[#FA4C00] hover:bg-[#D84300]"
                  }`}
              >
                <Save size={16} />
                Criar Treinamento
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
