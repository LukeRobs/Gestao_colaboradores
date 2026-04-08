import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import MainLayout from "../../components/MainLayout";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import api from "../../services/api";

const HORARIOS = ["05:25", "13:20", "21:00"];

const TIPOS_DESLIGAMENTO = [
  { value: "DV", label: "DV: Desligamento Voluntário" },
  { value: "DF", label: "DF: Desligamento Forçado" },
  { value: "DP", label: "DP: Desligamento Planejado" },
];

const MOTIVOS_DESLIGAMENTO = [
  { value: "COMPLIANCE", label: "Compliance" },
  { value: "ALTO_INDICE_ABS", label: "Alto índice de ABS" },
  { value: "ABANDONO", label: "Abandono" },
  { value: "DESEMPENHO_BAIXO", label: "Desempenho baixo" },
  { value: "DESVIO_COMPORTAMENTAL", label: "Desvio comportamental" },
  { value: "TERMINO_CONTRATO", label: "Término de contrato" },
  { value: "NO_SHOW", label: "No Show" },
  { value: "DECLINIO", label: "Declínio" },
  { value: "NAO_CONFORMIDADE", label: "Não conformidade" },
  { value: "PEDIDO_DEMISSAO", label: "Pedido de demissão" },
  { value: "REDUCAO_QUADRO", label: "Redução de quadro" },
];

export default function EditarColaborador() {
  const { opsId } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [escalas, setEscalas] = useState([]);
  const [lideres, setLideres] = useState([]);

  const [form, setForm] = useState({
    nomeCompleto: "",
    cpf: "",
    email: "",
    telefone: "",
    genero: "",
    matricula: "",
    contatoEmergenciaNome: "",
    contatoEmergenciaTelefone: "",
    idEscala: "",
    idLider: "",
    dataAdmissao: "",
    horarioInicioJornada: "",
    status: "ATIVO",
    dataDemissao: "",
    motivoDesligamento: "",
    tipoDesligamento: "",
    dataInicioStatus: "",
    dataFimStatus: "",
  });

  /* ================= LOAD ================= */
  useEffect(() => {
    async function load() {
      try {
        const [resColab, resEscalas, resLideres] = await Promise.all([
          api.get(`/colaboradores/${opsId}`),
          api.get("/escalas"),
          api.get("/colaboradores/lideres"),
        ]);

        const c = resColab.data.data.colaborador;
        const listaLideres = resLideres.data.data || resLideres.data || [];

        // Garante que o líder atual do colaborador apareça na lista
        if (c.lider?.opsId && !listaLideres.find(l => l.opsId === c.lider.opsId)) {
          listaLideres.unshift({ opsId: c.lider.opsId, nomeCompleto: c.lider.nomeCompleto, cargo: null });
        }

        setEscalas(resEscalas.data.data || resEscalas.data || []);
        setLideres(listaLideres);

        setForm({
          nomeCompleto: c.nomeCompleto || "",
          cpf: c.cpf || "",
          email: c.email || "",
          telefone: c.telefone || "",
          genero: c.genero || "",
          matricula: c.matricula || "",
          contatoEmergenciaNome: c.contatoEmergenciaNome || "",
          contatoEmergenciaTelefone: c.contatoEmergenciaTelefone || "",
          idEscala: c.escala?.idEscala ?? "",
          idLider: c.lider?.opsId || c.idLider || "",
          dataAdmissao: c.dataAdmissao
            ? c.dataAdmissao.substring(0, 10)
            : "",
          horarioInicioJornada: c.horarioInicioJornada
          ? new Date(c.horarioInicioJornada).toISOString().substring(11,16)
          : "",
          status: c.status || "ATIVO",
          dataDemissao: c.dataDesligamento ? c.dataDesligamento.substring(0, 10) : "",
          motivoDesligamento: c.motivoDesligamento || "",
          tipoDesligamento: c.tipoDesligamento || "",
          dataInicioStatus: c.dataInicioStatus ? c.dataInicioStatus.substring(0, 10) : "",
          dataFimStatus: c.dataFimStatus ? c.dataFimStatus.substring(0, 10) : "",
        });
      } catch (err) {
        console.error(err);
        alert("Erro ao carregar colaborador");
        navigate("/colaboradores");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [opsId, navigate]);

  function handleChange(e) {
    const { name, value } = e.target;

    if (name === "status") {
      if (value === "INATIVO") {
        setForm(prev => ({
          ...prev,
          status: value,
          dataInicioStatus: "",
          dataFimStatus: "",
          tipoDesligamento: "",
        }));
        return;
      }

      if (value === "FERIAS" || value === "AFASTADO") {
        setForm(prev => ({
          ...prev,
          status: value,
          dataDemissao: "",
          motivoDesligamento: ""
        }));
        return;
      }

      // ATIVO
      setForm(prev => ({
        ...prev,
        status: value,
        dataDemissao: "",
        motivoDesligamento: "",
        dataInicioStatus: "",
        dataFimStatus: ""
      }));
      return;
    }

    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    try {

      // 🔥 ===== VALIDAÇÃO FRONT =====
      if (form.status === "INATIVO" && !form.dataDemissao) {
        return alert("Informe a data de demissão.");
      }
      if (form.status === "INATIVO" && !form.motivoDesligamento) {
        return alert("Informe o motivo do desligamento.");
      }
      if (form.status === "INATIVO" && !form.tipoDesligamento) {
        return alert("Informe o tipo de desligamento (DV, DF ou DP).");
      }
      if (
        form.status === "INATIVO" &&
        form.dataAdmissao &&
        form.dataDemissao &&
        form.dataDemissao < form.dataAdmissao
      ) {
        return alert("Data de demissão não pode ser anterior à admissão.");
      }

      if (
        (form.status === "FERIAS" || form.status === "AFASTADO") &&
        (!form.dataInicioStatus || !form.dataFimStatus)
      ) {
        return alert("Informe data início e data fim.");
      }
      const payload = {
        nomeCompleto: form.nomeCompleto || null,
        cpf: form.cpf || null,
        email: form.email || null,
        telefone: form.telefone || null,
        genero: form.genero || null,
        matricula: form.matricula || null,
        contatoEmergenciaNome: form.contatoEmergenciaNome || null,
        contatoEmergenciaTelefone: form.contatoEmergenciaTelefone || null,
        idEscala: form.idEscala ? Number(form.idEscala) : null,
        idLider: form.idLider || null,
        dataAdmissao: form.dataAdmissao || null,
        horarioInicioJornada: form.horarioInicioJornada || null,
        status: form.status,
        dataDesligamento: form.dataDemissao || null,
        motivoDesligamento: form.motivoDesligamento || null,
        tipoDesligamento: form.tipoDesligamento || null,
        dataInicioStatus: form.dataInicioStatus || null,
        dataFimStatus: form.dataFimStatus || null,
      };

      await api.put(`/colaboradores/${opsId}`, payload);
      navigate(`/colaboradores/${opsId}`);
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar colaborador");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page text-muted">
        Carregando colaborador…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-page text-page">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 max-w-5xl mx-auto space-y-8">
          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/colaboradores/${opsId}`)}
                className="p-2 rounded-lg bg-surface hover:bg-surface-2"
              >
                <ArrowLeft size={18} />
              </button>

              <div>
                <h1 className="text-2xl font-semibold">Editar Colaborador</h1>
                <p className="text-sm text-muted">
                  Atualização de dados cadastrais
                </p>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#FA4C00] hover:bg-[#ff5a1a] rounded-xl font-medium"
            >
              <Save size={16} />
              Salvar alterações
            </button>
          </div>

          <Section title="Informações Básicas">
            <Input label="OPS ID" value={opsId} disabled />
            <Input name="nomeCompleto" label="Nome Completo" value={form.nomeCompleto} onChange={handleChange} />
            <Input name="cpf" label="CPF" value={form.cpf} onChange={handleChange} />
            <Input name="email" label="E-mail" value={form.email} onChange={handleChange} />
            <Input name="telefone" label="Telefone" value={form.telefone} onChange={handleChange} />
            <Input name="matricula" label="Matrícula" value={form.matricula} onChange={handleChange} />

            <Select
              name="genero"
              label="Gênero"
              value={form.genero}
              onChange={handleChange}
              options={["MASCULINO", "FEMININO"]}
            />
          </Section>

          <Section title="Contato de Emergência">
            <Input
              name="contatoEmergenciaNome"
              label="Nome do Contato"
              value={form.contatoEmergenciaNome}
              onChange={handleChange}
            />

            <Input
              name="contatoEmergenciaTelefone"
              label="Telefone do Contato"
              value={form.contatoEmergenciaTelefone}
              onChange={handleChange}
              placeholder="(81) 9xxxx-xxxx"
            />
          </Section>

          <Section title="Vínculo Organizacional">
            <Select
              label="Escala *"
              name="idEscala"
              value={form.idEscala}
              onChange={handleChange}
              options={escalas.map((e) => ({
                value: e.idEscala,
                label: e.descricao ? `${e.nomeEscala} — ${e.descricao}` : e.nomeEscala,
              }))}
            />

            <Select
              label="Líder"
              name="idLider"
              value={form.idLider}
              onChange={handleChange}
              options={lideres.map(l => ({
                value: l.opsId,
                label: `${l.nomeCompleto} — ${l.opsId}`,
              }))}
            />
          </Section>

          <Section title="Jornada" className={form.status === "INATIVO" ? "border-red-500" : ""}>
            <Input
              type="date"
              name="dataAdmissao"
              label="Data de Admissão"
              value={form.dataAdmissao}
              onChange={handleChange}
            />

            <Select
              name="horarioInicioJornada"
              label="Início da Jornada"
              value={form.horarioInicioJornada}
              onChange={handleChange}
              options={
                form.horarioInicioJornada && !HORARIOS.includes(form.horarioInicioJornada)
                  ? [form.horarioInicioJornada, ...HORARIOS]
                  : HORARIOS
              }
            />

            <Select
              name="status"
              label="Status"
              value={form.status}
              onChange={handleChange}
              options={["ATIVO", "INATIVO", "AFASTADO", "FERIAS"]}
            />
          
            {form.status === "INATIVO" && (
              <>
                <Input
                  type="date"
                  name="dataDemissao"
                  label="Data de Demissão *"
                  value={form.dataDemissao}
                  onChange={handleChange}
                />

                <Select
                  name="motivoDesligamento"
                  label="Motivo do Desligamento *"
                  value={form.motivoDesligamento}
                  onChange={handleChange}
                  options={MOTIVOS_DESLIGAMENTO}
                />

                <Select
                  name="tipoDesligamento"
                  label="Tipo de Desligamento *"
                  value={form.tipoDesligamento}
                  onChange={handleChange}
                  options={TIPOS_DESLIGAMENTO}
                />
              </>
            )}

          {(form.status === "FERIAS" || form.status === "AFASTADO") && (
            <>
              <Input
                type="date"
                name="dataInicioStatus"
                label="Data Início *"
                value={form.dataInicioStatus}
                onChange={handleChange}
              />

              <Input
                type="date"
                name="dataFimStatus"
                label="Data Fim *"
                value={form.dataFimStatus}
                onChange={handleChange}
              />
            </>
          )}
          </Section>
        </main>
      </MainLayout>
    </div>
  );
}

/* ================= COMPONENTES ================= */

function Section({ title, children }) {
  return (
    <div className="bg-surface border border-default rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-muted mb-6 uppercase">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{children}</div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted">{label}</label>
      <input
        {...props}
        className="px-4 py-2.5 bg-surface-2 border border-default rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
      />
    </div>
  );
}

function Select({ label, options, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted">{label}</label>
      <select
        {...props}
        className="px-4 py-2.5 bg-surface-2 border border-default rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
      >
        <option value="">Selecione</option>
        {options.map((o) =>
          typeof o === "string" ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          )
        )}
      </select>
    </div>
  );
}