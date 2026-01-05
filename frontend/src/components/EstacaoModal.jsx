import { X } from "lucide-react";
import { useEffect, useState } from "react";
import api from "../services/api";

export default function EstacaoModal({ estacao, onClose, onSave }) {
  /* ================= FORM (DERIVADO DA PROP, SEM EFFECT) ================= */
  const [form, setForm] = useState(() => ({
    nome: estacao?.nome || "",
    idRegional: estacao?.idRegional || "",
  }));

  const [regionais, setRegionais] = useState([]);

  /* ================= LOAD REGIONAIS (EXTERNO = OK) ================= */
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await api.get("/regionais");
        if (!active) return;
        setRegionais(res.data.data || res.data);
      } catch (err) {
        console.error("Erro ao carregar regionais", err);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  /* ================= HANDLERS ================= */
  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    if (!form.nome || !form.idRegional) return;
    await onSave(form);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
      <div className="bg-[#1A1A1C] w-full max-w-lg rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">
            {estacao ? "Editar Estação" : "Nova Estação"}
          </h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <Input
            label="Nome da Estação"
            name="nome"
            value={form.nome}
            onChange={handleChange}
          />

          <Select
            label="Regional"
            name="idRegional"
            value={form.idRegional}
            onChange={handleChange}
            options={regionais}
            labelKey="nome"
            valueKey="idRegional"
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

/* ================= UI ================= */

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
