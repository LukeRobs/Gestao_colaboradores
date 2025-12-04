import { useState } from "react";

export default function EmployeeModal({ employee, onClose, onSave }) {
  const [form, setForm] = useState({
    opsId: employee?.opsId || "",
    nomeCompleto: employee?.nomeCompleto || "",
    genero: employee?.genero || "",
    matricula: employee?.matricula || "",
    dataAdmissao: employee?.dataAdmissao?.split("T")[0] || "",
    horarioInicioJornada: employee?.horarioInicioJornada || "",
    idSetor: employee?.idSetor || "",
    idCargo: employee?.idCargo || "",
    idLider: employee?.idLider || "",
    idEstacao: employee?.idEstacao || "",
    idEmpresa: employee?.idEmpresa || "",
    idContrato: employee?.idContrato || "",
    idEscala: employee?.idEscala || "",
    idTurno: employee?.idTurno || "",
    status: employee?.status || "ATIVO",
  });

  const update = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-900 rounded-2xl max-w-3xl w-full p-6 shadow-xl">
        <h2 className="text-2xl font-bold mb-4">
          {employee ? "Editar Colaborador" : "Novo Colaborador"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ["opsId", "OPS ID"],
            ["nomeCompleto", "Nome Completo"],
            ["genero", "Gênero"],
            ["matricula", "Matrícula"],
            ["dataAdmissao", "Data de Admissão", "date"],
            ["horarioInicioJornada", "Hora Início Jornada"],
            ["idEmpresa", "Empresa (ID)"],
            ["idSetor", "Setor (ID)"],
            ["idCargo", "Cargo (ID)"],
            ["idLider", "Líder (ID)"],
            ["idEstacao", "Estação (ID)"],
            ["idContrato", "Contrato (ID)"],
            ["idEscala", "Escala (ID)"],
            ["idTurno", "Turno (ID)"],
          ].map(([field, label, type]) => (
            <div key={field}>
              <label className="block text-sm mb-1">{label}</label>
              <input
                type={type || "text"}
                value={form[field]}
                onChange={(e) => update(field, e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => update("status", e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border"
            >
              <option value="ATIVO">ATIVO</option>
              <option value="INATIVO">INATIVO</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end mt-6 gap-3">
          <button onClick={onClose} className="px-6 py-3 bg-gray-200 rounded-xl">
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
