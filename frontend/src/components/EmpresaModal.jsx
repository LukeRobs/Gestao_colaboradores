import { useState, useEffect } from "react";
import { Button } from "../components/UIComponents";
import { X } from "lucide-react";

export default function EmpresaModal({ empresa = null, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    idEmpresa: empresa?.idEmpresa ?? null,
    razaoSocial: empresa?.razaoSocial ?? "",
    cnpj: empresa?.cnpj ?? "",
    ativo: empresa?.ativo ?? true,
  }));
  const [saving, setSaving] = useState(false);

  const handle = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async () => {
    if (!form.razaoSocial || !form.cnpj) return;
    setSaving(true);
    try {
      await onSave({ ...form, ativo: Boolean(form.ativo) });
    } finally {
      setSaving(false);
    }
  };

  // 🔒 Bloqueia scroll do body
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
            {form.idEmpresa ? "Editar Empresa" : "Nova Empresa"}
          </h2>

          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-surface-2 text-muted"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTENT (scrollável) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          
          {form.idEmpresa && (
            <div>
              <label className="block text-xs text-muted mb-1">ID</label>
              <input
                disabled
                value={form.idEmpresa}
                className="
                  w-full px-3 sm:px-4 py-2.5 sm:py-3
                  rounded-lg
                  bg-surface-2
                  border border-default
                  text-muted
                  text-sm
                "
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-muted mb-1">
              Razão Social
            </label>
            <input
              value={form.razaoSocial}
              onChange={(e) => handle("razaoSocial", e.target.value)}
              className="
                w-full px-3 sm:px-4 py-2.5 sm:py-3
                rounded-lg
                bg-surface-2
                border border-default
                text-page text-sm
                focus:outline-none focus:ring-1 focus:ring-[#FA4C00]
              "
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">
              CNPJ
            </label>
            <input
              value={form.cnpj}
              onChange={(e) => handle("cnpj", e.target.value)}
              className="
                w-full px-3 sm:px-4 py-2.5 sm:py-3
                rounded-lg
                bg-surface-2
                border border-default
                text-page text-sm
                focus:outline-none focus:ring-1 focus:ring-[#FA4C00]
              "
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">
              Status
            </label>
            <select
              value={form.ativo ? "true" : "false"}
              onChange={(e) => handle("ativo", e.target.value === "true")}
              className="
                w-full px-3 sm:px-4 py-2.5 sm:py-3
                rounded-lg
                bg-surface-2
                border border-default
                text-page text-sm
              "
            >
              <option value="true">Ativa</option>
              <option value="false">Inativa</option>
            </select>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 px-4 sm:px-6 py-4 border-t border-default">
          <Button.Secondary
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button.Secondary>

          <Button.Primary
            onClick={submit}
            disabled={saving || !form.razaoSocial || !form.cnpj}
            className="w-full sm:w-auto"
          >
            {saving ? "Salvando..." : form.idEmpresa ? "Salvar alterações" : "Criar empresa"}
          </Button.Primary>
        </div>
      </div>
    </div>
  );
}