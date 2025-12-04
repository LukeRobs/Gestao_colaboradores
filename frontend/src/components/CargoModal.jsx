import { useState } from "react";

export default function CargoModal({ cargo, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    nomeCargo: cargo?.nomeCargo || "",
    nivel: cargo?.nivel || "",
    descricao: cargo?.descricao || "",
    ativo: cargo?.ativo ?? true,
  }));

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl w-full max-w-lg border border-gray-300 dark:border-gray-700 shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          {cargo ? "Editar Cargo" : "Novo Cargo"}
        </h2>

        <div className="space-y-3">
          <input
            name="nomeCargo"
            value={form.nomeCargo}
            onChange={handleChange}
            placeholder="Nome do cargo"
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-xl"
          />

          <input
            name="nivel"
            value={form.nivel}
            onChange={handleChange}
            placeholder="Nível (ex: Júnior, Pleno...)"
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-xl"
          />

          <textarea
            name="descricao"
            value={form.descricao}
            onChange={handleChange}
            placeholder="Descrição"
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-xl"
            rows={3}
          />

          <label className="flex items-center gap-2">
            <input type="checkbox" name="ativo" checked={form.ativo} onChange={handleChange} />
            <span className="text-gray-800 dark:text-gray-300">Ativo</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-xl">
            Cancelar
          </button>

          <button
            onClick={() => onSave(form)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
