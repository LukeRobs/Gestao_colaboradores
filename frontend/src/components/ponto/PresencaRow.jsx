import React from "react";
import PresencaCell from "./PresencaCell";

function PresencaRow({
  colaborador,
  dias,
  canEdit,
  isAdmin = false,
  onEditCell,
}) {
  const { ano, mes } = colaborador;

  return (
    <tr className="border-t border-default">
      
      {/* COLABORADOR */}
      <td
        data-no-drag="true"
        className="sticky left-0 z-10 bg-surface px-4 py-3 border-r border-default whitespace-nowrap min-w-[220px] sm:min-w-[260px]"
      >
        <div className="font-medium">
          {colaborador.nome || colaborador.nomeCompleto}
        </div>

        <div className="text-xs text-muted">
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
            isAdmin={isAdmin}
            onEdit={onEditCell}
          />
        );
      })}
    </tr>
  );
}

export default React.memo(PresencaRow);