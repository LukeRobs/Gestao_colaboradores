// src/components/EmpresaModal.jsx
import { useState } from "react";

export default function EmpresaModal({ empresa = null, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    idEmpresa: empresa?.idEmpresa ?? null,
    razaoSocial: empresa?.razaoSocial ?? "",
    cnpj: empresa?.cnpj ?? "",
    ativo: empresa?.ativo ?? true,
  }));

  const handle = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submit = () => {
    if (!form.razaoSocial || !form.cnpj) {
      alert("Preencha pelo menos Razão Social e CNPJ.");
      return;
    }

    // garante boolean no campo ativo
    const payload = {
      ...form,
      ativo: Boolean(form.ativo),
    };

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 p-6 border-b dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {form.idEmpresa ? "Editar Empresa" : "Nova Empresa"}
          </h2>
          <button
            onClick={onClose}
            className="px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Fechar
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-4">
          {form.idEmpresa && (
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                ID
              </label>
              <input
                value={form.idEmpresa}
                disabled
                className="w-full px-4 py-2 rounded-xl border bg-gray-100 dark:bg-gray-800 dark:text-gray-300"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Razão Social
            </label>
            <input
              value={form.razaoSocial}
              onChange={(e) => handle("razaoSocial", e.target.value)}
              className="w-full px-4 py-2 rounded-xl border bg-gray-50 dark:bg-gray-800 dark:text-white"
              placeholder="Nome da empresa"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              CNPJ
            </label>
            <input
              value={form.cnpj}
              onChange={(e) => handle("cnpj", e.target.value)}
              className="w-full px-4 py-2 rounded-xl border bg-gray-50 dark:bg-gray-800 dark:text-white"
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={form.ativo ? "true" : "false"}
              onChange={(e) => handle("ativo", e.target.value === "true")}
              className="w-full px-4 py-2 rounded-xl border bg-gray-50 dark:bg-gray-800 dark:text-white"
            >
              <option value="true">Ativa</option>
              <option value="false">Inativa</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-700 dark:text-gray-200"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl"
          >
            {form.idEmpresa ? "Salvar Alterações" : "Criar Empresa"}
          </button>
        </div>
      </div>
    </div>
  );
}
