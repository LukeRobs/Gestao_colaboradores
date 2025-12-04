// src/components/EmployeeTable.jsx
import React from "react";

export default function EmployeeTable({ employees = [], onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px]">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Nome</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Cargo</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Departamento</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Empresa</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Admissão</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Ações</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {employees.length === 0 && (
            <tr>
              <td colSpan="7" className="p-6 text-center text-gray-500">Nenhum colaborador encontrado.</td>
            </tr>
          )}

          {employees.map((emp) => {
            // possível estrutura das relações: cargo: { nomeCargo }, setor/nomeSetor, empresa/razaoSocial
            const nome = emp.nomeCompleto || emp.nome || "-";
            const cargo = (emp.cargo && (emp.cargo.nomeCargo || emp.cargo.nome || emp.cargo)) || emp.cargo || "-";
            const dept = (emp.setor && (emp.setor.nomeSetor || emp.setor.nome)) || emp.departamento || "-";
            const empresa = (emp.empresa && (emp.empresa.razaoSocial || emp.empresa.nome)) || emp.empresa || "-";
            const dataAdmissao = emp.dataAdmissao ? new Date(emp.dataAdmissao).toLocaleDateString() : "-";
            const status = emp.status || (emp.ativo ? (emp.ativo === true ? "ATIVO" : "INATIVO") : "-");

            return (
              <tr key={emp.opsId || emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold">
                      {String(nome).charAt(0) || "?"}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{nome}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{emp.email || emp.matricula || emp.opsId}</div>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{cargo}</td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{dept}</td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{empresa}</td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{dataAdmissao}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium ${status === "ATIVO" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"}`}>
                    {status}
                  </span>
                </td>

                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => onEdit(emp)} className="px-3 py-1 text-xs rounded-lg bg-blue-600 text-white">Editar</button>
                    <button onClick={() => onDelete(emp)} className="px-3 py-1 text-xs rounded-lg bg-red-600 text-white">Excluir</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
