import { useState, useEffect } from "react";
import { Button } from "../components/UIComponents";
import { X } from "lucide-react";

export default function CargoModal({ cargo, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    nomeCargo: cargo?.nomeCargo || "",
    nivel: cargo?.nivel || "",
    descricao: cargo?.descricao || "",
    ativo: cargo?.ativo ?? true,
  }));
  const [saving, setSaving] = useState(false);

  const handle = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.nomeCargo.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  // 🔥 Bloqueia scroll do body enquanto modal aberto
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

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
          max-h-[90vh]
          bg-[#1A1A1C]
          rounded-t-2xl sm:rounded-xl
          border border-[#3D3D40]
          shadow-2xl
          flex flex-col
        "
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#3D3D40]">
          <h2 className="text-base sm:text-lg font-semibold text-white">
            {cargo ? "Editar Cargo" : "Novo Cargo"}
          </h2>

          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-[#2A2A2C] text-[#BFBFC3]"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTENT (SCROLLÁVEL) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          
          <div>
            <label className="block text-xs text-[#BFBFC3] mb-1">
              Nome do Cargo
            </label>
            <input
              value={form.nomeCargo}
              onChange={(e) => handle("nomeCargo", e.target.value)}
              className="
                w-full px-4 py-3 rounded-lg
                bg-[#2A2A2C] border border-[#3D3D40]
                text-white text-sm
                focus:outline-none focus:ring-1 focus:ring-[#FA4C00]
              "
            />
          </div>

          <div>
            <label className="block text-xs text-[#BFBFC3] mb-1">
              Nível
            </label>
            <input
              value={form.nivel}
              onChange={(e) => handle("nivel", e.target.value)}
              placeholder="Ex: Júnior, Pleno, Sênior"
              className="
                w-full px-4 py-3 rounded-lg
                bg-[#2A2A2C] border border-[#3D3D40]
                text-white text-sm
                focus:outline-none focus:ring-1 focus:ring-[#FA4C00]
              "
            />
          </div>

          <div>
            <label className="block text-xs text-[#BFBFC3] mb-1">
              Descrição
            </label>
            <textarea
              rows={3}
              value={form.descricao}
              onChange={(e) => handle("descricao", e.target.value)}
              className="
                w-full px-4 py-3 rounded-lg
                bg-[#2A2A2C] border border-[#3D3D40]
                text-white text-sm
                focus:outline-none focus:ring-1 focus:ring-[#FA4C00]
              "
            />
          </div>

          <div>
            <label className="block text-xs text-[#BFBFC3] mb-1">
              Status
            </label>
            <select
              value={form.ativo ? "true" : "false"}
              onChange={(e) => handle("ativo", e.target.value === "true")}
              className="
                w-full px-4 py-3 rounded-lg
                bg-[#2A2A2C] border border-[#3D3D40]
                text-white text-sm
              "
            >
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 px-4 sm:px-6 py-4 border-t border-[#3D3D40]">
          <Button.Secondary onClick={onClose} className="w-full sm:w-auto">
            Cancelar
          </Button.Secondary>

          <Button.Primary
            onClick={handleSave}
            disabled={saving || !form.nomeCargo.trim()}
            className="w-full sm:w-auto"
          >
            {saving ? "Salvando..." : cargo ? "Salvar alterações" : "Criar cargo"}
          </Button.Primary>
        </div>
      </div>
    </div>
  );
}