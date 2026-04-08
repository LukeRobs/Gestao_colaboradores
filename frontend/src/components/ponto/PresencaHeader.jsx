export default function PresencaHeader({ dias = [], ano, mes }) {

  function isWeekend(dia) {
    if (!ano || !mes) return false;

    const date = new Date(ano, mes - 1, dia);
    const day = date.getDay();

    return day === 0 || day === 6;
  }

  return (
    <thead className="sticky top-0 z-30 bg-surface">
      <tr>
        <th className="sticky left-0 z-40 bg-surface px-4 py-3 border-r border-default text-left min-w-[220px] sm:min-w-[260px]">
          Colaborador
        </th>

        {dias.map((dia) => {
          const weekend = isWeekend(dia);

          return (
            <th
              key={`dia-${dia}`}
              className={`
                px-2 py-3 text-center border-r border-default text-xs min-w-12 sm:min-w-14
                bg-surface
                ${
                  weekend
                    ? "bg-[#141416] text-[#FA4C00] font-semibold"
                    : "text-muted"
                }
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