import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import api from "../../services/api";

const HORARIOS = ["05:25", "13:20", "21:00"];

export default function EditarColaborador() {
  const { opsId } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [escalas, setEscalas] = useState([]);

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
    dataAdmissao: "",
    horarioInicioJornada: "",
    status: "ATIVO",
  });

  /* ================= LOAD ================= */
  useEffect(() => {
    async function load() {
      try {
        const [resColab, resEscalas] = await Promise.all([
          api.get(`/colaboradores/${opsId}`),
          api.get("/escalas"),
        ]);

        const c = resColab.data.data.colaborador;

        setEscalas(resEscalas.data || []);

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
          dataAdmissao: c.dataAdmissao
            ? c.dataAdmissao.substring(0, 10)
            : "",
          horarioInicioJornada: c.horarioInicioJornada
            ? c.horarioInicioJornada.substring(11, 16)
            : "",
          status: c.status || "ATIVO",
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
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    try {
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
        dataAdmissao: form.dataAdmissao
          ? new Date(form.dataAdmissao)
          : null,
        horarioInicioJornada: form.horarioInicioJornada
          ? new Date(`1970-01-01T${form.horarioInicioJornada}:00`)
          : null,
        status: form.status,
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
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] text-[#BFBFC3]">
        Carregando colaborador…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 max-w-5xl mx-auto space-y-8">
          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/colaboradores/${opsId}`)}
                className="p-2 rounded-lg bg-[#1A1A1C] hover:bg-[#2A2A2C]"
              >
                <ArrowLeft size={18} />
              </button>

              <div>
                <h1 className="text-2xl font-semibold">Editar Colaborador</h1>
                <p className="text-sm text-[#BFBFC3]">
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
                label: `${e.nomeEscala} — ${e.descricao}`,
              }))}
            />
          </Section>

          <Section title="Jornada">
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
              options={HORARIOS}
            />

            <Select
              name="status"
              label="Status"
              value={form.status}
              onChange={handleChange}
              options={["ATIVO", "INATIVO", "AFASTADO", "FERIAS"]}
            />
          </Section>
        </main>
      </div>
    </div>
  );
}

/* ================= COMPONENTES ================= */

function Section({ title, children }) {
  return (
    <div className="bg-[#1A1A1C] border border-[#3D3D40] rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-[#BFBFC3] mb-6 uppercase">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{children}</div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[#BFBFC3]">{label}</label>
      <input
        {...props}
        className="px-4 py-2.5 bg-[#2A2A2C] border border-[#3D3D40] rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
      />
    </div>
  );
}

function Select({ label, options, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[#BFBFC3]">{label}</label>
      <select
        {...props}
        className="px-4 py-2.5 bg-[#2A2A2C] border border-[#3D3D40] rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
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
