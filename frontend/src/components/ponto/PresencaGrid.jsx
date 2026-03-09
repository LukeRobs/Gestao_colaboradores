import PresencaHeader from "./PresencaHeader";
import PresencaRow from "./PresencaRow";

export default function PresencaGrid({
  dias = [],
  colaboradores = [],
  onEditCell,
  canEdit = false,
}) {
  const ano = colaboradores?.[0]?.ano ?? null;
  const mes = colaboradores?.[0]?.mes ?? null;

  return (
    <div className="overflow-auto max-h-[70vh] rounded-2xl border border-[#2A2A2C] touch-pan-x touch-pan-y">
      <table className="w-max min-w-full text-sm border-separate border-spacing-0">
        <PresencaHeader
          dias={dias}
          ano={ano}
          mes={mes}
        />

        <tbody>
          {colaboradores.map((col) => (
            <PresencaRow
              key={`${col.opsId}-${ano}-${mes}`}
              colaborador={col}
              dias={dias}
              onEditCell={onEditCell}
              canEdit={canEdit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}