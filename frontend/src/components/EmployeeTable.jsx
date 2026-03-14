import { Button, Badge } from "../components/UIComponents";

const ESCALA_STYLE = {
  A: "bg-[#1E293B] border-[#334155] text-[#E5E7EB]",
  B: "bg-[#3A2F1B] border-[#5C3B10] text-[#FFE8C7]",
  C: "bg-[#2A1E3B] border-[#443366] text-[#E9D5FF]",
};

export default function EmployeeTable({ employees = [], onView }) {
  if (!employees.length) {
    return (
      <div className="p-8 text-center text-muted">
        Nenhum colaborador encontrado
      </div>
    );
  }

  return (
    <div className="w-full">

      {/* ================= DESKTOP TABLE ================= */}
      <div className="hidden md:block overflow-x-auto rounded-xl bg-surface">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="bg-[#121214] text-xs uppercase tracking-wide text-textSecondary">
              {[
                "Nome",
                "Cargo",
                "Setor",
                "Empresa",
                "Escala",
                "Turno",
                "Admissão",
                "Status",
                "",
              ].map((h) => (
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

          <tbody>
            {employees.map((emp, index) => {
              const status =
                emp.status || (emp.ativo ? "ATIVO" : "INATIVO");
              const escala = emp.escala;

              return (
                <tr
                  key={emp.opsId}
                  className={`
                    transition-colors
                    ${index % 2 === 0 ? "bg-surface" : "bg-[#1E1E20]"}
                    hover:bg-[#242426]
                  `}
                >
                  <td className="px-5 py-4 font-medium text-text">
                    {emp.nomeCompleto}
                  </td>

                  <td className="px-5 py-4 text-textSecondary">
                    {emp.cargo?.nomeCargo || "-"}
                  </td>

                  <td className="px-5 py-4 text-textSecondary">
                    {emp.setor?.nomeSetor || "-"}
                  </td>

                  <td className="px-5 py-4 text-textSecondary">
                    {emp.empresa?.razaoSocial || "-"}
                  </td>

                  <td className="px-5 py-4">
                    {escala ? (
                      <span
                        title={escala.descricao}
                        className={`inline-flex items-center justify-center min-w-7 px-2 py-1 text-xs font-semibold rounded-lg border ${
                          ESCALA_STYLE[escala.nomeEscala] ||
                          "bg-[#2A2A2C] border-[#3D3D40] text-white"
                        }`}
                      >
                        {escala.nomeEscala}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>

                  <td className="px-5 py-4 text-textSecondary">
                    {emp.turno?.nomeTurno || "-"}
                  </td>

                  <td className="px-5 py-4 text-textSecondary">
                    {emp.dataAdmissao
                      ? new Date(emp.dataAdmissao).toLocaleDateString()
                      : "-"}
                  </td>

                  <td className="px-5 py-4">
                    <Badge.Status
                      variant={status === "ATIVO" ? "success" : "danger"}
                    >
                      {status}
                    </Badge.Status>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <Button.Secondary size="sm" onClick={() => onView(emp)}>
                      Ver Perfil
                    </Button.Secondary>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ================= MOBILE CARD VIEW ================= */}
      <div className="md:hidden space-y-4">
        {employees.map((emp) => {
          const status =
            emp.status || (emp.ativo ? "ATIVO" : "INATIVO");
          const escala = emp.escala;

          return (
            <div
              key={emp.opsId}
              className="bg-surface border border-border rounded-xl p-4 space-y-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white font-semibold text-sm">
                    {emp.nomeCompleto}
                  </p>

                  <p className="text-xs text-muted mt-1">
                    {emp.cargo?.nomeCargo || "-"}
                  </p>
                </div>

                <Badge.Status
                  variant={status === "ATIVO" ? "success" : "danger"}
                >
                  {status}
                </Badge.Status>
              </div>

              <div className="text-xs text-muted space-y-1">
                <p>Setor: {emp.setor?.nomeSetor || "-"}</p>
                <p>Empresa: {emp.empresa?.razaoSocial || "-"}</p>
                <p>Turno: {emp.turno?.nomeTurno || "-"}</p>

                <p>
                  Admissão:{" "}
                  {emp.dataAdmissao
                    ? new Date(emp.dataAdmissao).toLocaleDateString()
                    : "-"}
                </p>
              </div>

              {escala && (
                <div>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-lg border ${
                      ESCALA_STYLE[escala.nomeEscala] ||
                      "bg-[#2A2A2C] border-[#3D3D40] text-white"
                    }`}
                  >
                    Escala {escala.nomeEscala}
                  </span>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-border">
                <Button.Secondary size="sm" onClick={() => onView(emp)}>
                  Ver Perfil
                </Button.Secondary>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}