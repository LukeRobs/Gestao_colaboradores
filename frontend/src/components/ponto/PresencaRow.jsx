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
      <td className="bg-[#1A1A1C] px-4 py-3 border-r border-[#2A2A2C] whitespace-nowrap">
        <div className="font-medium">
          {colaborador.nome || colaborador.nomeCompleto}
        </div>
        <div className="text-xs text-[#BFBFC3]">
          {colaborador.turno} • {colaborador.escala}
        </div>
      </td>

      {/* DIAS */}
      {dias.map((diaNumero) => {
        const dataISO = `${colaborador.ano}-${String(colaborador.mes).padStart(2, "0")}-${String(diaNumero).padStart(2, "0")}`;
        const registro = colaborador.dias[dataISO] || null;

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
