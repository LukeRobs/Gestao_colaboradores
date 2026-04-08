export default function StatCard({
  title,
  value,
  icon: Icon,
  highlight = false,
}) {
  return (
    <div
      className={`
        bg-surface
        border border-border
        rounded-2xl
        p-4 sm:p-6
        transition-all
        hover:border-brand/40
        hover:shadow-lg
        hover:shadow-brand/5
        ${highlight ? "border-brand/50" : ""}
      `}
    >
      {/* Ícone */}
      {Icon && (
        <div
          className="
            w-9 h-9 sm:w-10 sm:h-10
            bg-brand/15
            text-brand
            rounded-xl
            flex items-center justify-center
            mb-3 sm:mb-4
          "
        >
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      )}

      {/* Valor */}
      <p className="text-2xl sm:text-3xl font-bold text-text truncate">
        {value}
      </p>

      {/* Título */}
      <p className="text-xs sm:text-sm text-muted mt-1 truncate">
        {title}
      </p>
    </div>
  );
}