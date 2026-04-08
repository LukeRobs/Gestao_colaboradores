import { X } from "lucide-react";
import { useState, useEffect } from "react";

export default function RegionalModal({ regional, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    nome: regional?.nome || "",
  }));

  /* ================= BLOQUEIA SCROLL BODY ================= */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    if (!form.nome) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
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
          bg-surface
          border border-default
          rounded-t-2xl sm:rounded-xl
          shadow-2xl
          flex flex-col
        "
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-default">
          <h2 className="text-base sm:text-lg font-semibold text-white">
            {regional ? "Editar Regional" : "Nova Regional"}
          </h2>

          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-surface-2 text-muted"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          <Input
            label="Nome da Regional"
            name="nome"
            value={form.nome}
            onChange={handleChange}
          />
        </div>

        {/* FOOTER */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 px-4 sm:px-6 py-4 border-t border-default">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-surface-2"
          >
            Cancelar
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !form.nome}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#FA4C00] disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
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
      <label className="text-xs text-muted">{label}</label>
      <input
        {...props}
        className="
          w-full mt-1
          px-3 sm:px-4 py-2.5
          bg-surface-2
          border border-default
          rounded-xl
          text-page text-sm
          focus:outline-none focus:ring-1 focus:ring-[#FA4C00]
        "
      />
    </div>
  );
}