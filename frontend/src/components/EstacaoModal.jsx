import { X } from "lucide-react";
import { useEffect, useState } from "react";
import api from "../services/api";

export default function EstacaoModal({ estacao, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    nome: estacao?.nomeEstacao || estacao?.nome || "",
    idRegional: estacao?.idRegional || "",
    sheetsMetaProducaoId: estacao?.sheetsMetaProducaoId || "",
  }));

  const [regionais, setRegionais] = useState([]);

  // 🔒 Bloqueia scroll do body
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  // 🔄 Carrega regionais
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

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    if (!form.nome || !form.idRegional) return;
    await onSave(form);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 sm:px-6">
      
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="
          relative z-10
          w-full
          max-w-lg
          max-h-[92vh]
          bg-[#1A1A1C]
          border border-[#3D3D40]
          rounded-t-2xl sm:rounded-xl
          shadow-2xl
          flex flex-col
        "
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#3D3D40]">
          <h2 className="text-base sm:text-lg font-semibold text-white">
            {estacao ? "Editar Estação" : "Nova Estação"}
          </h2>

          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-[#2A2A2C] text-[#BFBFC3]"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTENT (scrollável) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
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

          <Input
            label="ID da Planilha Google Sheets (Gestão Operacional)"
            name="sheetsMetaProducaoId"
            value={form.sheetsMetaProducaoId}
            onChange={handleChange}
            placeholder="Ex: 17Dpmr1Kn6ybvK3rah2JvoCBsAeOvotvM6k_7uaATPz0"
          />
        </div>

        {/* FOOTER */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 px-4 sm:px-6 py-4 border-t border-[#3D3D40]">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#2A2A2C]"
          >
            Cancelar
          </button>

          <button
            onClick={handleSave}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#FA4C00]"
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
        className="
          w-full mt-1
          px-3 sm:px-4 py-2.5
          bg-[#2A2A2C]
          border border-[#3D3D40]
          rounded-xl
          text-white text-sm
          focus:outline-none focus:ring-1 focus:ring-[#FA4C00]
        "
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
        className="
          w-full mt-1
          px-3 sm:px-4 py-2.5
          bg-[#2A2A2C]
          border border-[#3D3D40]
          rounded-xl
          text-white text-sm
        "
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