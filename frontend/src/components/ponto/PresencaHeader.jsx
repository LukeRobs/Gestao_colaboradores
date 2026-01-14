export default function PresencaHeader({ dias, ano, mes }) {
  function isWeekend(dia) {
    const date = new Date(ano, mes - 1, dia);
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  return (
    <thead className="sticky top-0 z-30 bg-[#1A1A1C]">
      <tr>
        <th className="bg-[#1A1A1C] px-4 py-3 border-r border-[#2A2A2C] text-left">
          Colaborador
        </th>

        {dias.map((dia) => {
          const weekend = isWeekend(dia);

          return (
            <th
              key={dia}
              className={`
                px-2 py-3 text-center border-r border-[#2A2A2C] text-xs
                bg-[#1A1A1C]
                ${weekend
                  ? "bg-[#141416] text-[#FA4C00] font-semibold"
                  : "text-[#BFBFC3]"}
              `}
            >
              {dia}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
