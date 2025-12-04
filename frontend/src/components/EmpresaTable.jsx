// src/components/EmpresaTable.jsx

export default function EmpresaTable({ empresas, onEdit, onDelete }) {
  if (!empresas || empresas.length === 0) {
    return (
      <p className="p-4 text-gray-500 dark:text-gray-400">
        Nenhuma empresa cadastrada.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
            <th className="py-2 px-2">ID</th>
            <th className="py-2 px-2">Razão Social</th>
            <th className="py-2 px-2">CNPJ</th>
            <th className="py-2 px-2 text-center">Colaboradores</th>
            <th className="py-2 px-2 text-center">Contratos</th>
            <th className="py-2 px-2 text-center">Status</th>
            <th className="py-2 px-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {empresas.map((e) => (
            <tr
              key={e.idEmpresa}
              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
            >
              <td className="py-2 px-2 text-gray-700 dark:text-gray-300">
                {e.idEmpresa}
              </td>
              <td className="py-2 px-2 text-gray-900 dark:text-gray-100 font-medium">
                {e.razaoSocial}
              </td>
              <td className="py-2 px-2 text-gray-700 dark:text-gray-300">
                {e.cnpj}
              </td>
              <td className="py-2 px-2 text-center text-gray-700 dark:text-gray-300">
                {e._count?.colaboradores ?? 0}
              </td>
              <td className="py-2 px-2 text-center text-gray-700 dark:text-gray-300">
                {e._count?.contratos ?? 0}
              </td>
              <td className="py-2 px-2 text-center">
                <span
                  className={`inline-flex px-2 py-1 text-xs rounded-full ${
                    e.ativo
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  }`}
                >
                  {e.ativo ? "Ativa" : "Inativa"}
                </span>
              </td>
              <td className="py-2 px-2 text-right space-x-2">
                <button
                  onClick={() => onEdit(e)}
                  className="px-3 py-1 text-xs rounded-lg bg-blue-600 text-white"
                >
                  Editar
                </button>
                <button
                  onClick={() => onDelete(e)}
                  className="px-3 py-1 text-xs rounded-lg bg-red-600 text-white"
                >
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
