export default function SetorTable({ setores, onEdit, onDelete }) {
  return (
    <table className="w-full table-auto">
      <thead>
        <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
          <th className="py-3 text-left">Nome</th>
          <th className="py-3 text-left">Descrição</th>
          <th className="py-3 text-left">Ativo</th>
          <th className="py-3 text-right pr-4">Ações</th>
        </tr>
      </thead>

      <tbody>
        {setores.map((s) => (
          <tr
            key={s.idSetor}
            className="border-b border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-300"
          >
            <td className="py-3">{s.nomeSetor}</td>
            <td className="py-3">{s.descricao || "-"}</td>
            <td className="py-3">{s.ativo ? "Sim" : "Não"}</td>

            {/* AÇÕES — alinhadas totalmente à direita */}
            <td className="py-3">
              <div className="flex justify-end gap-2 pr-2">
                <button
                  onClick={() => onEdit(s)}
                  className="px-3 py-1 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Editar
                </button>

                <button
                  onClick={() => onDelete(s)}
                  className="px-3 py-1 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700"
                >
                  Excluir
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
