export default function InputsManuaisTable({ data = {} }) {
  const { total = 0, porColaborador = [], porJustificativa = [] } = data;

  const cellCls = "px-4 py-2.5 text-sm text-[#E5E5E5]";
  const headCls = "px-4 py-2.5 text-xs font-semibold text-[#BFBFC3] uppercase tracking-wide text-left";

  return (
    <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-2xl p-5 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">
          Inputs Manuais — Controle de Absenteísmo
        </h3>
        <span className="text-xs text-[#BFBFC3] bg-[#2A2A2C] px-3 py-1 rounded-full">
          {total} total
        </span>
      </div>

      {total === 0 ? (
        <p className="text-sm text-[#BFBFC3]">Nenhum input manual no período</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* MOTIVOS */}
          <div>
            <p className="text-xs text-[#BFBFC3] mb-3 uppercase tracking-wide">Principais motivos</p>
            <div className="overflow-x-auto rounded-xl border border-[#2A2A2C]">
              <table className="w-full">
                <thead className="bg-[#111111]">
                  <tr>
                    <th className={headCls}>Motivo</th>
                    <th className={`${headCls} text-right`}>Qtd</th>
                    <th className={`${headCls} text-right`}>%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2C]">
                  {porJustificativa.map((row, i) => (
                    <tr key={i} className="hover:bg-[#111111] transition">
                      <td className={cellCls}>{row.motivo}</td>
                      <td className={`${cellCls} text-right tabular-nums`}>{row.quantidade}</td>
                      <td className={`${cellCls} text-right tabular-nums text-[#FA4C00]`}>{row.percentual}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* OPERADORES */}
          <div>
            <p className="text-xs text-[#BFBFC3] mb-3 uppercase tracking-wide">Quem mais fez inputs</p>
            <div className="overflow-x-auto rounded-xl border border-[#2A2A2C]">
              <table className="w-full">
                <thead className="bg-[#111111]">
                  <tr>
                    <th className={headCls}>Lider</th>
                    <th className={`${headCls} text-right`}>Qtd</th>
                    <th className={`${headCls} text-right`}>%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2C]">
                  {porColaborador.map((row, i) => (
                    <tr key={i} className="hover:bg-[#111111] transition">
                      <td className={cellCls}>{row.operador}</td>
                      <td className={`${cellCls} text-right tabular-nums`}>{row.quantidade}</td>
                      <td className={`${cellCls} text-right tabular-nums text-[#FA4C00]`}>{row.percentual}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
