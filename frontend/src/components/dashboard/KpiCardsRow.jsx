import KpiCard from "./KpiCard";

export default function KpiCardsRow({ items = [] }) {
  if (!items.length) return null;

  return (
    <div className="bg-surface rounded-2xl p-4 sm:p-6">
      <div
        className="
          grid
          gap-4
          sm:gap-5
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-3
          xl:grid-cols-4
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