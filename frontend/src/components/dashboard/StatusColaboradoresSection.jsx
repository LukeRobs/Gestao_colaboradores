export default function StatusColaboradoresSection({
  title = "Status dos Colaboradores",
  items = [], // [{ label, value }] OU [{ status, quantidade }]
  footer = "",
  percentual = null,
}) {
  if (!items || items.length === 0) return null;

  const footerColor =
    typeof percentual === "number"
      ? percentual > 10
        ? "#FF453A"
        : percentual > 5
        ? "#FF9F0A"
        : "#34C759"
      : "#BFBFC3";

  return (
    <div className="bg-[#1A1A1C] rounded-2xl p-6">
      {title && (
        <h2 className="text-sm font-semibold text-[#BFBFC3] mb-4 uppercase">
          {title}
        </h2>
      )}

      <div className="space-y-3">
        {items.map((item, i) => {
          const label = item.label ?? item.status ?? "-";
          const value = item.value ?? item.quantidade ?? 0;

          return (
            <div
              key={`${label}-${i}`}
              className="flex justify-between items-center"
            >
              <span className="text-[#BFBFC3] text-sm">
                {label}
              </span>

              <span className="text-2xl font-semibold text-white">
                {value}
              </span>
            </div>
          );
        })}
      </div>

      {/* 🔍 INSIGHT FINAL */}
      {footer && (
        <div className="mt-4 pt-3 border-t border-[#2A2A2C]">
          <p
            className="text-sm font-medium"
            style={{ color: footerColor }}
          >
            {footer}
          </p>
        </div>
      )}
    </div>
  );
}
