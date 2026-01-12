import KpiCard from "./KpiCard";

export default function KpiCardsRow({ items = [] }) {
  if (!items.length) return null;

  return (
    <div className="bg-[#1A1A1C] rounded-2xl p-6">
      <div
        className="
          grid
          gap-4
          grid-cols-[repeat(auto-fit,minmax(160px,1fr))]
        "
      >
        {items.map((item, i) => (
          <KpiCard
            key={i}
            icon={item.icon}
            label={item.label}
            value={item.value}
            color={item.color}
            suffix={item.suffix}
            tooltip={item.tooltip}
          />
        ))}
      </div>
    </div>
  );
}
