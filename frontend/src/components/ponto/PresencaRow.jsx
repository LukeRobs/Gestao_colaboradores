import PresencaCell from "./PresencaCell";

export default function PresencaRow({
  colaborador,
  dias,
  canEdit,
  onEditCell,
}) {
  return (
    <tr className="border-t border-[#2A2A2C]">
      {/* COLABORADOR */}
      <td className="sticky left-0 bg-[#1A1A1C] z-10 px-4 py-3 border-r border-[#2A2A2C] whitespace-nowrap">
        <div className="font-medium">{colaborador.nome}</div>
        <div className="text-xs text-[#BFBFC3]">
          {colaborador.turno} • {colaborador.escala}
        </div>
      </td>

      {/* DIAS */}
      {dias.map((diaNumero) => {
        /**
         * 🔑 Encontra a data ISO REAL vinda do backend
         * Ex: "2025-12-28"
         */
        const dataISO = `${colaborador.ano}-${String(colaborador.mes).padStart(2, "0")}-${String(diaNumero).padStart(2, "0")}`;

        const registro = colaborador.dias[dataISO] || null;

        return (
          <PresencaCell
            key={`${colaborador.opsId}-${dataISO || diaNumero}`}
            dia={{
              date: dataISO,
              label: String(diaNumero),
            }}
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
