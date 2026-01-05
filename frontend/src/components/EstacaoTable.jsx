import { Button } from "../components/UIComponents";

export default function EstacaoTable({ estacoes, onEdit, onDelete }) {
  if (!estacoes?.length) {
    return (
      <div className="p-8 text-center text-[#BFBFC3]">
        Nenhuma estação cadastrada
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      {/* ===== HEADER ===== */}
      <thead className="bg-[#1A1A1C] border-b border-[#3D3D40]">
        <tr className="text-xs uppercase text-[#BFBFC3]">
          {["Estação", "Regional", "Empresas", ""].map((h) => (
            <th
              key={h}
              className={`px-5 py-4 font-semibold ${
                h === "Empresas"
                  ? "text-center"
                  : h === ""
                  ? "text-right"
                  : "text-left"
              }`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>

      {/* ===== BODY ===== */}
      <tbody>
        {estacoes.map((e, index) => (
          <tr
            key={e.idEstacao}
            className={`
              ${index % 2 === 0 ? "bg-[#1A1A1C]" : "bg-[#2A2A2C]"}
              hover:bg-[#242426] transition
            `}
          >
            {/* Estação */}
            <td className="px-5 py-4 font-medium text-white">
              {e.nomeEstacao}
            </td>

            {/* Regional */}
            <td className="px-5 py-4 text-[#BFBFC3]">
              {e.regional?.nome}
            </td>

            {/* Empresas (contador) */}
            <td className="px-5 py-4 text-center text-white">
              {e.empresasCount ?? 1}
            </td>

            {/* Ações */}
            <td className="px-5 py-4 text-right">
              <div className="flex justify-end gap-2">
                <Button.Secondary size="sm" onClick={() => onEdit(e)}>
                  Editar
                </Button.Secondary>

                <Button.IconButton
                  size="sm"
                  variant="danger"
                  onClick={() => onDelete(e)}
                >
                  Excluir
                </Button.IconButton>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
