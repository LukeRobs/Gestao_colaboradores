import { Button } from "../components/UIComponents";

export default function RegionalTable({ regionais, onEdit, onDelete }) {
  if (!regionais?.length) {
    return (
      <div className="p-8 text-center text-[#BFBFC3]">
        Nenhuma regional cadastrada
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      {/* ===== HEADER ===== */}
      <thead className="bg-[#1A1A1C] border-b border-[#3D3D40]">
        <tr className="text-xs uppercase text-[#BFBFC3]">
          {["Regional", "Empresa", ""].map((h) => (
            <th
              key={h}
              className={`px-5 py-4 font-semibold ${
                h === "" ? "text-right" : "text-left"
              }`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>

      {/* ===== BODY ===== */}
      <tbody>
        {regionais.map((r, index) => (
          <tr
            key={r.idRegional}
            className={`
              ${index % 2 === 0 ? "bg-[#1A1A1C]" : "bg-[#2A2A2C]"}
              hover:bg-[#242426] transition
            `}
          >
            {/* Regional */}
            <td className="px-5 py-4 font-medium text-white">
              {r.nome}
            </td>

            {/* Empresa */}
            <td className="px-5 py-4 text-[#BFBFC3]">
              {r.empresa?.razaoSocial}
            </td>

            {/* Ações */}
            <td className="px-5 py-4 text-right">
              <div className="flex justify-end gap-2">
                <Button.Secondary size="sm" onClick={() => onEdit(r)}>
                  Editar
                </Button.Secondary>

                <Button.IconButton
                  size="sm"
                  variant="danger"
                  onClick={() => onDelete(r)}
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
