import { X } from "lucide-react";
import { useState } from "react";
import api from "../services/api";

export default function RegionalModal({ regional, onClose, onSave }) {
  const [empresas, setEmpresas] = useState([]);

  const [form, setForm] = useState(() => ({
    nome: regional?.nome || "",
    idEmpresa: regional?.idEmpresa || "",
  }));

  /* ================= LOAD EMPRESAS ================= */
  useState(() => {
    (async () => {
      const res = await api.get("/empresas");
      setEmpresas(res.data.data || res.data);
    })();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    if (!form.nome || !form.idEmpresa) return;
    await onSave(form);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
      <div className="bg-[#1A1A1C] w-full max-w-lg rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">
            {regional ? "Editar Regional" : "Nova Regional"}
          </h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <Input
            label="Nome da Regional"
            name="nome"
            value={form.nome}
            onChange={handleChange}
          />

          <Select
            label="Empresa"
            name="idEmpresa"
            value={form.idEmpresa}
            onChange={handleChange}
            options={empresas}
            labelKey="razaoSocial"
            valueKey="idEmpresa"
          />
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#2A2A2C]"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-[#FA4C00]"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== UI ===== */

function Input({ label, ...props }) {
  return (
    <div>
      <label className="text-xs text-[#BFBFC3]">{label}</label>
      <input
        {...props}
        className="w-full mt-1 px-4 py-2.5 bg-[#2A2A2C] rounded-xl"
      />
    </div>
  );
}

function Select({ label, options, labelKey, valueKey, ...props }) {
  return (
    <div>
      <label className="text-xs text-[#BFBFC3]">{label}</label>
      <select
        {...props}
        className="w-full mt-1 px-4 py-2.5 bg-[#2A2A2C] rounded-xl"
      >
        <option value="">Selecione</option>
        {options.map((o) => (
          <option key={o[valueKey]} value={o[valueKey]}>
            {o[labelKey]}
          </option>
        ))}
      </select>
    </div>
  );
}
