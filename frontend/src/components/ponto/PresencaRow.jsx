import React from "react";
import PresencaCell from "./PresencaCell";

function PresencaRow({
  colaborador,
  dias,
  canEdit,
  onEditCell,
}) {
  const { ano, mes } = colaborador;

  return (
    <tr className="border-t border-[#2A2A2C]">
      
      {/* COLABORADOR */}
      <td className="bg-[#1A1A1C] px-4 py-3 border-r border-[#2A2A2C] whitespace-nowrap min-w-[220px] sm:min-w-[260px]">
        <div className="font-medium">
          {colaborador.nome || colaborador.nomeCompleto}
        </div>

        <div className="text-xs text-[#BFBFC3]">
          {colaborador.turno} • {colaborador.escala}
        </div>
      </td>

      {/* DIAS */}
      {dias.map((diaNumero) => {
        const dataISO =
          `${ano}-${String(mes).padStart(2, "0")}-${String(diaNumero).padStart(2, "0")}`;

        const registro = colaborador.dias?.[dataISO] || null;

        return (
          <PresencaCell
            key={`${colaborador.opsId}-${dataISO}`}
            dia={{ date: dataISO, label: String(diaNumero) }}
            registro={registro}
            colaborador={colaborador}
            canEdit={canEdit}
            onEdit={onEditCell}
          />
        );
      })}
    </tr>
  );
}

export default React.memo(PresencaRow);