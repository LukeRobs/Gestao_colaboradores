import { Badge, Button } from "./UIComponents";

function formatTime(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d)) return "-";
  return d.toISOString().slice(11, 16);
}

export default function TurnoTable({ turnos, onEdit, onDelete }) {
  if (!turnos?.length) {
    return <div className="p-8 text-center text-[#BFBFC3]">Nenhum turno cadastrado</div>;
  }

  return (
    <div className="w-full">
      {/* DESKTOP */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#1A1A1C] border-b border-[#3D3D40]">
            <tr className="text-xs uppercase text-[#BFBFC3]">
              <th className="px-5 py-4 text-left font-semibold">Nome</th>
              <th className="px-5 py-4 text-left font-semibold">Início</th>
              <th className="px-5 py-4 text-left font-semibold">Fim</th>
              <th className="px-5 py-4 text-left font-semibold">Status</th>
              <th className="px-5 py-4 text-right font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {turnos.map((t, i) => (
              <tr key={t.idTurno} className={`${i % 2 === 0 ? "bg-[#1A1A1C]" : "bg-[#2A2A2C]"} hover:bg-[#242426] transition`}>
                <td className="px-5 py-4 font-medium text-white">{t.nomeTurno}</td>
                <td className="px-5 py-4 text-[#BFBFC3]">{formatTime(t.horarioInicio)}</td>
                <td className="px-5 py-4 text-[#BFBFC3]">{formatTime(t.horarioFim)}</td>
                <td className="px-5 py-4">
                  <Badge.Status variant={t.ativo ? "success" : "danger"}>
                    {t.ativo ? "Ativo" : "Inativo"}
                  </Badge.Status>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button.Secondary size="sm" onClick={() => onEdit(t)}>Editar</Button.Secondary>
                    <Button.IconButton size="sm" variant="danger" onClick={() => onDelete(t)}>Excluir</Button.IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MOBILE */}
      <div className="md:hidden space-y-4 p-4">
        {turnos.map((t) => (
          <div key={t.idTurno} className="bg-[#1A1A1C] border border-[#3D3D40] rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white font-semibold text-sm">{t.nomeTurno}</p>
                <p className="text-xs text-[#BFBFC3] mt-1">{formatTime(t.horarioInicio)} — {formatTime(t.horarioFim)}</p>
              </div>
              <Badge.Status variant={t.ativo ? "success" : "danger"}>{t.ativo ? "Ativo" : "Inativo"}</Badge.Status>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[#2F2F33]">
              <Button.Secondary size="sm" onClick={() => onEdit(t)}>Editar</Button.Secondary>
              <Button.IconButton size="sm" variant="danger" onClick={() => onDelete(t)}>Excluir</Button.IconButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
