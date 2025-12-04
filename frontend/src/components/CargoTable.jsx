import { Pencil, Trash } from "lucide-react";

export default function CargoTable({ cargos, onEdit, onDelete }) {
  return (
    <table className="w-full text-left">
      <thead>
        <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
          <th className="py-2">Cargo</th>
          <th className="py-2">Nível</th>
          <th className="py-2">Ativo</th>
          <th className="py-2 text-right">Ações</th>
        </tr>
      </thead>

      <tbody>
        {cargos.map((c) => (
          <tr key={c.idCargo} className="border-b border-gray-200 dark:border-gray-800">
            <td className="py-3">{c.nomeCargo}</td>
            <td className="py-3">{c.nivel || "-"}</td>
            <td className="py-3">{c.ativo ? "Sim" : "Não"}</td>

            <td className="py-3 flex justify-end gap-3">
              <button onClick={() => onEdit(c)} className="text-blue-600">
                <Pencil size={18} />
              </button>
              <button onClick={() => onDelete(c)} className="text-red-600">
                <Trash size={18} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
