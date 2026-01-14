import PresencaHeader from "./PresencaHeader";
import PresencaRow from "./PresencaRow";

export default function PresencaGrid({
  dias = [],
  colaboradores = [],
  onEditCell,
  canEdit = false,
}) {
  return (
    <div className="overflow-auto max-h-[70vh] rounded-2xl border border-[#2A2A2C]">
      <table className="min-w-full text-sm border-separate border-spacing-0">
        <PresencaHeader
          dias={dias}
          ano={colaboradores[0]?.ano}
          mes={colaboradores[0]?.mes}
        />

        <tbody>
          {colaboradores.map((col) => (
            <PresencaRow
              key={col.opsId}
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
