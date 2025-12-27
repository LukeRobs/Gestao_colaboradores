import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import api from "../../services/api";

export default function MovimentarColaborador() {
  const { opsId } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ================= FORM ================= */
  const [form, setForm] = useState({
    idEmpresa: "",
    idSetor: "",
    idCargo: "",
    idTurno: "",
    idLider: "",
    dataEfetivacao: "",
    motivo: "",
  });

  /* ================= LISTAS ================= */
  const [empresas, setEmpresas] = useState([]);
  const [setores, setSetores] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [turnos, setTurnos] = useState([]);

  /* ================= LOAD ================= */
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [
          empRes,
          setRes,
          carRes,
          turRes,
        ] = await Promise.all([
          api.get("/empresas"),
          api.get("/setores"),
          api.get("/cargos"),
          api.get("/turnos"),
        ]);

        if (!mounted) return;

        setEmpresas(empRes.data.data || empRes.data);
        setSetores(setRes.data.data || setRes.data);
        setCargos(carRes.data.data || carRes.data);
        setTurnos(turRes.data.data || turRes.data);
      } catch (err) {
        console.error("Erro ao carregar dados organizacionais", err);
        alert("Erro ao carregar dados organizacionais");
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /* ================= HANDLERS ================= */
  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    if (!form.dataEfetivacao || !form.motivo) {
      alert("Data efetiva e motivo são obrigatórios.");
      return;
    }

    try {
      setSaving(true);

      await api.post(`/colaboradores/${opsId}/movimentar`, {
        ...form,
      });

      navigate(`/colaboradores/${opsId}`);
    } catch (err) {
      console.error(err);
      alert("Erro ao realizar movimentação");
    } finally {
      setSaving(false);
    }
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

        <main className="p-8 max-w-4xl mx-auto space-y-8">
          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-lg bg-[#1A1A1C] hover:bg-[#2A2A2C]"
              >
                <ArrowLeft size={18} />
              </button>

              <div>
                <h1 className="text-2xl font-semibold">
                  Movimentar Colaborador
                </h1>
                <p className="text-sm text-[#BFBFC3]">
                  Alteração organizacional com histórico
                </p>
              </div>
            </div>

            <button
              disabled={saving}
              onClick={handleSave}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl
                ${
                  saving
                    ? "bg-[#FA4C00]/50 cursor-not-allowed"
                    : "bg-[#FA4C00] hover:bg-[#ff5a1a]"
                }`}
            >
              <Save size={16} />
              {saving ? "Salvando..." : "Confirmar movimentação"}
            </button>
          </div>

          {/* NOVO VÍNCULO */}
          <Section title="Novo Vínculo Organizacional">
            <Select
              label="Empresa"
              name="idEmpresa"
              value={form.idEmpresa}
              onChange={handleChange}
              options={empresas}
              labelKey="razaoSocial"
              valueKey="idEmpresa"
            />

            <Select
              label="Setor"
              name="idSetor"
              value={form.idSetor}
              onChange={handleChange}
              options={setores}
              labelKey="nomeSetor"
              valueKey="idSetor"
            />

            <Select
              label="Cargo"
              name="idCargo"
              value={form.idCargo}
              onChange={handleChange}
              options={cargos}
              labelKey="nomeCargo"
              valueKey="idCargo"
            />

            <Select
              label="Turno"
              name="idTurno"
              value={form.idTurno}
              onChange={handleChange}
              options={turnos}
              labelKey="nomeTurno"
              valueKey="idTurno"
            />

            <Input
              label="Líder (OPS ID)"
              name="idLider"
              value={form.idLider}
              onChange={handleChange}
              placeholder="Ex: OPS123"
            />
          </Section>

          {/* DETALHES */}
          <Section title="Detalhes da Movimentação">
            <Input
              type="date"
              label="Data efetiva"
              name="dataEfetivacao"
              value={form.dataEfetivacao}
              onChange={handleChange}
            />

            <Textarea
              label="Motivo da movimentação"
              name="motivo"
              value={form.motivo}
              onChange={handleChange}
            />
          </Section>
        </main>
      </div>
    </div>
  );
}

/* ================= UI ================= */

function Section({ title, children }) {
  return (
    <div className="bg-[#1A1A1C] border border-[#3D3D40] rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-[#BFBFC3] mb-6 uppercase">
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
        className="px-4 py-2.5 bg-[#2A2A2C] border border-[#3D3D40]
        rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
      />
    </div>
  );
}

function Textarea({ label, ...props }) {
  return (
    <div className="flex flex-col gap-1 md:col-span-2">
      <label className="text-xs text-[#BFBFC3]">{label}</label>
      <textarea
        {...props}
        rows={3}
        className="px-4 py-2.5 bg-[#2A2A2C] border border-[#3D3D40]
        rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
      />
    </div>
  );
}

function Select({ label, options, labelKey, valueKey, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[#BFBFC3]">{label}</label>
      <select
        {...props}
        className="px-4 py-2.5 bg-[#2A2A2C] border border-[#3D3D40]
        rounded-xl outline-none focus:ring-1 focus:ring-[#FA4C00]"
      >
        <option value="">Selecione</option>
        {options.map((opt) => (
          <option key={opt[valueKey]} value={opt[valueKey]}>
            {opt[labelKey]}
          </option>
        ))}
      </select>
    </div>
  );
}
