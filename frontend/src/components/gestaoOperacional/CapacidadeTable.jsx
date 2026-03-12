import React from "react";

export default function CapacidadeTable({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-center py-8 text-[#BFBFC3]">Sem dados disponíveis</div>;
  }

  // Ordenar por hora
  const dadosOrdenados = [...data].sort((a, b) => parseInt(a.hora) - parseInt(b.hora));
  
  // Função para determinar cor baseada no percentual
  const getPerformanceColor = (percentual) => {
    if (percentual >= 100) return "text-green-400";
    if (percentual >= 95) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#2A2A2C]">
            <th className="border border-[#3A3A3C] p-3 text-center font-semibold text-white">Hora</th>
            <th className="border border-[#3A3A3C] p-3 text-center font-semibold text-white">Capacidade</th>
            <th className="border border-[#3A3A3C] p-3 text-center font-semibold text-white">Realizado</th>
            <th className="border border-[#3A3A3C] p-3 text-center font-semibold text-white">Porcentagem Alcançado</th>
          </tr>
        </thead>
        <tbody>
          {dadosOrdenados.map((item, index) => (
            <tr key={index} className="hover:bg-[#242426]">
              <td className="border border-[#3A3A3C] p-3 text-center text-white">{item.hora}</td>
              <td className="border border-[#3A3A3C] p-3 text-center text-white">
                {item.capacidade.toLocaleString("pt-BR")}
              </td>
              <td className="border border-[#3A3A3C] p-3 text-center text-white">
                {item.realizado.toLocaleString("pt-BR")}
              </td>
              <td className={`border border-[#3A3A3C] p-3 text-center font-semibold ${getPerformanceColor(item.percentual)}`}>
                {item.percentual.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
