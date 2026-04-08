import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./UIComponents";

export default function EscalaModal({ escala, onClose, onSave }) {
  const [form, setForm] = useState({
    nomeEscala:      escala?.nomeEscala      || "",
    tipoEscala:      escala?.tipoEscala      || "",
    diasTrabalhados: escala?.diasTrabalhados != null ? String(escala.diasTrabalhados) : "",
    diasFolga:       escala?.diasFolga       != null ? String(escala.diasFolga)       : "",
    descricao:       escala?.descricao       || "",
    ativo:           escala?.ativo           ?? true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  const handle = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleSave = async () => {
    if (!form.nomeEscala.trim()) return;
    setSaving(true);
    try {
      await onSave({
        nomeEscala: form.nomeEscala.trim(),
        tipoEscala: form.tipoEscala.trim() || undefined,
        diasTrabalhados: form.diasTrabalhados !== "" ? parseInt(form.diasTrabalhados) : undefined,
        diasFolga: form.diasFolga !== "" ? parseInt(form.diasFolga) : undefined,
        descricao: form.descricao.trim() || undefined,
        ativo: form.ativo,
      });
    } finally {
      setSaving(false);
    }
  };

  const isValid = form.nomeEscala.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 sm:px-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg max-h-[92vh] bg-surface border border-default rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col">
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-default">
          <h2 className="text-base sm:text-lg font-semibold text-white">
            {escala ? "Editar Escala" : "Nova Escala"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-surface-2 text-muted">
            <X size={18} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* nome */}
          <div>
            <label className="block text-xs text-muted mb-1">Nome da Escala *</label>
            <input
              value={form.nomeEscala}
              onChange={(e) => handle("nomeEscala", e.target.value)}
              placeholder="Ex: 5x2, 6x1, 12x36"
              className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-default text-page text-sm focus:outline-none focus:ring-1 focus:ring-[#FA4C00]"
            />
          </div>

          {/* tipo */}
          <div>
            <label className="block text-xs text-muted mb-1">Tipo (opcional)</label>
            <input
              value={form.tipoEscala}
              onChange={(e) => handle("tipoEscala", e.target.value)}
              placeholder="Ex: Comercial, Operacional, Revezamento"
              className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-default text-page text-sm focus:outline-none focus:ring-1 focus:ring-[#FA4C00]"
            />
          </div>

          {/* dias trabalhados x folga */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1">Dias Trabalhados</label>
              <input
                type="number"
                min="1"
                value={form.diasTrabalhados}
                onChange={(e) => handle("diasTrabalhados", e.target.value)}
                placeholder="Ex: 5"
                className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-default text-page text-sm focus:outline-none focus:ring-1 focus:ring-[#FA4C00]"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Dias de Folga</label>
              <input
                type="number"
                min="1"
                value={form.diasFolga}
                onChange={(e) => handle("diasFolga", e.target.value)}
                placeholder="Ex: 2"
                className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-default text-page text-sm focus:outline-none focus:ring-1 focus:ring-[#FA4C00]"
              />
            </div>
          </div>

          {/* descrição */}
          <div>
            <label className="block text-xs text-muted mb-1">Descrição (opcional)</label>
            <textarea
              value={form.descricao}
              onChange={(e) => handle("descricao", e.target.value)}
              placeholder="Informações adicionais sobre a escala"
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-default text-page text-sm focus:outline-none focus:ring-1 focus:ring-[#FA4C00] resize-none"
            />
          </div>

          {/* status */}
          <div>
            <label className="block text-xs text-muted mb-1">Status</label>
            <select
              value={form.ativo ? "true" : "false"}
              onChange={(e) => handle("ativo", e.target.value === "true")}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-default text-page text-sm"
            >
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 px-6 py-4 border-t border-default">
          <Button.Secondary onClick={onClose} className="w-full sm:w-auto">Cancelar</Button.Secondary>
          <Button.Primary onClick={handleSave} disabled={saving || !isValid} className="w-full sm:w-auto">
            {saving ? "Salvando..." : escala ? "Salvar alterações" : "Criar escala"}
          </Button.Primary>
        </div>
      </div>
    </div>
  );
}
