import { useState, useEffect } from "react";
import { Button } from "../components/UIComponents";

export default function EmployeeModal({ employee, onClose, onSave }) {
  const formatHorario = (value) => {
    if (!value) return "";
    const d = new Date(value);
    return `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
  };

  const [form, setForm] = useState({
    opsId: employee?.opsId || "",
    nomeCompleto: employee?.nomeCompleto || "",
    cpf: employee?.cpf || "",
    telefone: employee?.telefone || "",
    email: employee?.email || "",
    genero: employee?.genero || "",
    matricula: employee?.matricula || "",
    dataAdmissao: employee?.dataAdmissao?.split("T")[0] || "",
    horarioInicioJornada: formatHorario(employee?.horarioInicioJornada),

    idEmpresa: employee?.empresa?.idEmpresa || "",
    idCargo: employee?.cargo?.idCargo || "",
    idSetor: employee?.setor?.idSetor || "",
    idLider: employee?.lider?.opsId || "",
    idEstacao: employee?.estacao?.idEstacao || "",
    idContrato: employee?.contrato?.idContrato || "",
    idEscala: employee?.escala?.idEscala || "",
    idTurno: employee?.turno?.idTurno || "",
    status: employee?.status || "ATIVO",
  });

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // 🔥 Bloqueia scroll do body
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 sm:px-6">
      
      {/* OVERLAY */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* MODAL */}
      <div
        className="
          relative z-10
          w-full
          max-w-5xl
          max-h-[92vh]
          bg-surface
          border border-border
          rounded-t-2xl sm:rounded-xl
          shadow-2xl
          flex flex-col
        "
      >
        {/* HEADER */}
        <div className="px-4 sm:px-6 py-4 border-b border-border">
          <h2 className="text-lg sm:text-xl font-semibold text-text">
            {employee ? "Editar Colaborador" : "Novo Colaborador"}
          </h2>
        </div>

        {/* CONTENT SCROLLÁVEL */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              ["opsId", "OPS ID"],
              ["nomeCompleto", "Nome Completo"],
              ["cpf", "CPF"],
              ["telefone", "Telefone"],
              ["email", "E-mail"],
              ["genero", "Gênero"],
              ["matricula", "Matrícula"],
            ].map(([field, label]) => (
              <div key={field}>
                <label className="block text-xs sm:text-sm text-muted mb-1">
                  {label}
                </label>

                <input
                  value={form[field]}
                  onChange={(e) => update(field, e.target.value)}
                  className="
                    w-full px-3 sm:px-4 py-2.5 sm:py-3
                    rounded-lg
                    bg-surfaceHover
                    border border-border
                    text-text text-sm
                    focus:outline-none focus:ring-1 focus:ring-[#FA4C00]
                  "
                />
              </div>
            ))}
          </div>
        </div>

        {/* FOOTER FIXO */}
        <div className="px-4 sm:px-6 py-4 border-t border-border flex flex-col sm:flex-row justify-end gap-3">
          <Button.Secondary
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button.Secondary>

          <Button.Primary
            onClick={() => onSave(form)}
            className="w-full sm:w-auto"
          >
            Salvar
          </Button.Primary>
        </div>
      </div>
    </div>
  );
}