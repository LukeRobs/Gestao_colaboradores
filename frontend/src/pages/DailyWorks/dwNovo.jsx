// src/pages/DailyWorks/dwNovo.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import api from "../../services/api";

/* ==============================
   EMPRESAS FIXAS
============================== */
const EMPRESAS = [
  { idEmpresa: 12, nome: "SRM" },
  { idEmpresa: 13, nome: "Fenix" },
  { idEmpresa: 14, nome: "Horeca" },
];

export default function DwNovoPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    data: "",
    idTurno: "",
    observacao: "",
    quantidades: {
      12: "",
      13: "",
      14: "",
    },
  });

  /* ================= HANDLERS ================= */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleQuantidade = (idEmpresa, value) => {
    setForm((prev) => ({
      ...prev,
      quantidades: {
        ...prev.quantidades,
        [idEmpresa]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!form.data || !form.idTurno) {
      alert("Data e Turno são obrigatórios");
      return;
    }

    const valores = Object.values(form.quantidades);
    if (valores.some((v) => v === "")) {
      alert("Informe a quantidade real de todas as empresas");
      return;
    }

    try {
      setSaving(true);

      // 🔁 cria 3 lançamentos (1 por empresa)
      await Promise.all(
        EMPRESAS.map((e) =>
          api.post("/dw/real", {
            data: form.data,
            idTurno: Number(form.idTurno),
            idEmpresa: e.idEmpresa,
            quantidade: Number(form.quantidades[e.idEmpresa]),
            observacao: form.observacao || null,
          })
        )
      );

      navigate("/dw");
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar Daily Work");
    } finally {
      setSaving(false);
    }
  };

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

        <main className="p-8 max-w-4xl mx-auto space-y-8">
          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/dw")}
                className="p-2 rounded-lg bg-[#1A1A1C] hover:bg-[#2A2A2C]"
              >
                <ArrowLeft size={18} />
              </button>

              <div>
                <h1 className="text-2xl font-semibold">Novo Daily Work</h1>
                <p className="text-sm text-[#BFBFC3]">
                  Lançamento de DW Real por empresa e turno
                </p>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="
                flex items-center gap-2
                px-5 py-2.5
                bg-[#FA4C00]
                hover:bg-[#ff5a1a]
                rounded-xl
                font-medium
                disabled:opacity-60
              "
            >
              <Save size={16} />
              Salvar
            </button>
          </div>

          {/* ================= DADOS ================= */}
          <Section title="Dados do Daily Work">
            <Input
              type="date"
              label="Data *"
              value={form.data}
              onChange={(e) =>
                setForm((p) => ({ ...p, data: e.target.value }))
              }
            />

            <Select
              label="Turno *"
              value={form.idTurno}
              onChange={(e) =>
                setForm((p) => ({ ...p, idTurno: e.target.value }))
              }
              options={[
                { value: "1", label: "T1" },
                { value: "2", label: "T2" },
                { value: "3", label: "T3" },
              ]}
            />
          </Section>

          {/* ================= QUANTIDADES ================= */}
          <Section title="Quantidade Real por Empresa">
            {EMPRESAS.map((e) => (
              <Input
                key={e.idEmpresa}
                type="number"
                min="0"
                label={`${e.nome} *`}
                value={form.quantidades[e.idEmpresa]}
                onChange={(ev) =>
                  handleQuantidade(e.idEmpresa, ev.target.value)
                }
              />
            ))}
          </Section>

          {/* ================= OBS ================= */}
          <Section title="Observações">
            <Textarea
              label="Observação"
              value={form.observacao}
              onChange={(e) =>
                setForm((p) => ({ ...p, observacao: e.target.value }))
              }
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
        className="
          px-4 py-2.5
          bg-[#2A2A2C]
          border border-[#3D3D40]
          rounded-xl
          outline-none
          focus:ring-1 focus:ring-[#FA4C00]
        "
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
        className="
          px-4 py-2.5
          bg-[#2A2A2C]
          border border-[#3D3D40]
          rounded-xl
          outline-none
          focus:ring-1 focus:ring-[#FA4C00]
        "
      >
        <option value="">Selecione</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Textarea({ label, ...props }) {
  return (
    <div className="flex flex-col gap-1 md:col-span-2">
      <label className="text-xs text-[#BFBFC3]">{label}</label>
      <textarea
        rows={4}
        {...props}
        className="
          px-4 py-2.5
          bg-[#2A2A2C]
          border border-[#3D3D40]
          rounded-xl
          outline-none
          focus:ring-1 focus:ring-[#FA4C00]
        "
      />
    </div>
  );
}
