import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import api from "../../services/api";

export default function NovoColaborador() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* ================= STATE ================= */
  const [form, setForm] = useState({
    opsId: "",
    nomeCompleto: "",
    cpf: "",
    email: "",
    telefone: "",
    genero: "",
    matricula: "",
    idEmpresa: "",
    idSetor: "",
    idCargo: "",
    idTurno: "",
    idEscala: "",
    dataAdmissao: "",
    horarioInicioJornada: "",
    status: "ATIVO",
  });

  const [empresas, setEmpresas] = useState([]);
  const [setores, setSetores] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [escalas, setEscalas] = useState([]);


  /* ================= LOAD SELECTS ================= */
  useEffect(() => {
    async function loadData() {
      try {
        const [e, s, c, t, esc] = await Promise.all([
          api.get("/empresas"),
          api.get("/setores"),
          api.get("/cargos", {
            params: {
              page: 1,
              limit: 1000,
              ativo: true,
            },
          }),
          api.get("/turnos"),
          api.get("/escalas"),
        ]);

        setEmpresas(e.data.data || []);
        setSetores(s.data.data || []);
        setCargos(c.data.data || []);
        setTurnos(t.data.data || []);
        setEscalas(esc.data || []);
      } catch (err) {
        console.error(err);
        alert("Erro ao carregar dados auxiliares");
      }
    }

    loadData();
  }, []);

  /* ================= HANDLERS ================= */
  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
  if (!form.idEscala) {
    alert("Selecione uma escala");
    return;
  }

  try {
    await api.post("/colaboradores", form);
    navigate("/colaboradores");
  } catch (err) {
    console.error(err);
    alert("Erro ao salvar colaborador");
  }
}


  /* ================= UI ================= */
  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-8 max-w-5xl mx-auto space-y-10">

          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/colaboradores")}
                className="p-2 rounded-lg bg-[#1A1A1C] hover:bg-[#2A2A2C]"
              >
                <ArrowLeft size={18} />
              </button>

              <div>
                <h1 className="text-2xl font-semibold">Novo Colaborador</h1>
                <p className="text-sm text-[#BFBFC3]">
                  Cadastro de colaborador ativo
                </p>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#FA4C00] hover:bg-[#ff5a1a] rounded-xl font-medium"
            >
              <Save size={16} />
              Salvar
            </button>
          </div>

          {/* ================= INFORMAÇÕES BÁSICAS ================= */}
          <Section title="Informações Básicas">
            <Input label="OPS ID" name="opsId" onChange={handleChange} />
            <Input label="Nome Completo" name="nomeCompleto" onChange={handleChange} />
            <Input label="CPF" name="cpf" onChange={handleChange} />
            <Input label="E-mail" name="email" onChange={handleChange} />
            <Input label="Telefone" name="telefone" onChange={handleChange} />
            <Input label="Matrícula" name="matricula" onChange={handleChange} />

            <Select
              label="Gênero"
              name="genero"
              onChange={handleChange}
              options={["MASCULINO", "FEMININO"]}
            />
          </Section>

          {/* ================= VÍNCULO ================= */}
          <Section title="Vínculo Organizacional">
            <Select
              label="Empresa"
              name="idEmpresa"
              onChange={handleChange}
              options={empresas.map(e => ({
                value: e.idEmpresa,
                label: e.razaoSocial,
              }))}
            />

            <Select
              label="Setor"
              name="idSetor"
              onChange={handleChange}
              options={setores.map(s => ({
                value: s.idSetor,
                label: s.nomeSetor,
              }))}
            />

            <Select
              label="Cargo"
              name="idCargo"
              onChange={handleChange}
              options={cargos.map(c => ({
                value: c.idCargo,
                label: c.nomeCargo,
              }))}
            />

            <Select
              label="Turno"
              name="idTurno"
              onChange={handleChange}
              options={turnos.map(t => ({
                value: t.idTurno,
                label: t.nomeTurno,
              }))}
            />

            <Select
              label="Escala *"
              name="idEscala"
              value={form.idEscala}
              onChange={(e) =>
                setForm(prev => ({
                  ...prev,
                  idEscala: Number(e.target.value), // 🔑 garante número
                }))
              }
              options={escalas.map((e) => ({
                value: e.idEscala,
                label: `${e.nomeEscala} — ${e.descricao}`,
              }))}
            />

          </Section>
          
          {/* ================= JORNADA ================= */}
          <Section title="Jornada">
            <Input
              type="date"
              label="Data de Admissão"
              name="dataAdmissao"
              onChange={handleChange}
            />

            <Select
              label="Início da Jornada"
              name="horarioInicioJornada"
              onChange={handleChange}
              options={["05:25", "13:20", "21:00"]}
            />

            <Select
              label="Status"
              name="status"
              value={form.status}
              onChange={handleChange}
              options={["ATIVO", "INATIVO"]}
            />
          </Section>

        </main>
      </div>
    </div>
  );
}

/* ================= COMPONENTES AUX ================= */

function Section({ title, children }) {
  return (
    <div className="bg-[#1A1A1C] border border-[#3D3D40] rounded-2xl p-6">
      <h2 className="text-xs font-semibold text-[#BFBFC3] mb-6 uppercase">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {children}
      </div>
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
            <option key={o} value={o}>{o}</option>
          ) : (
            <option key={o.value} value={o.value}>{o.label}</option>
          )
        )}
      </select>
    </div>
  );
}
