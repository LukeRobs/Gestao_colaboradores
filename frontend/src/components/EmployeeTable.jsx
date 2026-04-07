import { useContext } from "react";
import { Button, Badge } from "../components/UIComponents";
import { ThemeContext } from "../context/ThemeContext";

const ESCALA_DARK = {
  A: "bg-[#1E293B] border-[#334155] text-[#E5E7EB]",
  B: "bg-[#3A2F1B] border-[#5C3B10] text-[#FFE8C7]",
  C: "bg-[#2A1E3B] border-[#443366] text-[#E9D5FF]",
};

const ESCALA_LIGHT = {
  A: { background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E40AF" },
  B: { background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E" },
  C: { background: "#F5F3FF", border: "1px solid #DDD6FE", color: "#5B21B6" },
};

export default function EmployeeTable({ employees = [], onView }) {
  const { isDark } = useContext(ThemeContext);

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
            <tr className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
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
                    ${index % 2 === 0 ? "bg-surface" : "bg-surface-3"}
                    hover:bg-surface-3
                  `}
                >
                  <td className="px-5 py-4 font-medium text-page">
                    {emp.nomeCompleto}
                  </td>

                  <td className="px-5 py-4 text-muted">
                    {emp.cargo?.nomeCargo || "-"}
                  </td>

                  <td className="px-5 py-4 text-muted">
                    {emp.setor?.nomeSetor || "-"}
                  </td>

                  <td className="px-5 py-4 text-muted">
                    {emp.empresa?.razaoSocial || "-"}
                  </td>

                  <td className="px-5 py-4">
                    {escala ? (
                      isDark ? (
                        <span
                          title={escala.descricao}
                          className={`inline-flex items-center justify-center min-w-7 px-2 py-1 text-xs font-semibold rounded-lg border ${
                            ESCALA_DARK[escala.nomeEscala] || "bg-surface-2 border-default text-page"
                          }`}
                        >
                          {escala.nomeEscala}
                        </span>
                      ) : (
                        <span
                          title={escala.descricao}
                          className="inline-flex items-center justify-center min-w-7 px-2 py-1 text-xs font-semibold rounded-lg"
                          style={ESCALA_LIGHT[escala.nomeEscala] || { background: "#F3F4F6", border: "1px solid #D1D5DB", color: "#374151" }}
                        >
                          {escala.nomeEscala}
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>

                  <td className="px-5 py-4 text-muted">
                    {emp.turno?.nomeTurno || "-"}
                  </td>

                  <td className="px-5 py-4 text-muted">
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
                  <p className="text-page font-semibold text-sm">
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
                  {isDark ? (
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-lg border ${
                        ESCALA_DARK[escala.nomeEscala] || "bg-surface-2 border-default text-page"
                      }`}
                    >
                      Escala {escala.nomeEscala}
                    </span>
                  ) : (
                    <span
                      className="inline-flex px-2 py-1 text-xs font-semibold rounded-lg"
                      style={ESCALA_LIGHT[escala.nomeEscala] || { background: "#F3F4F6", border: "1px solid #D1D5DB", color: "#374151" }}
                    >
                      Escala {escala.nomeEscala}
                    </span>
                  )}
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