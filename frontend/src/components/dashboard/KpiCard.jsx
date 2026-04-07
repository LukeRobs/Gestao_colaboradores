export default function KpiCard({
  icon: Icon,
  label,
  value,
  color = "#FFFFFF",
  bgColor,
  suffix,
  tooltip,
}) {
  // No light mode, white icons (#FFFFFF) ficam invisíveis — usa text-muted como fallback
  const isDefaultWhite = color === "#FFFFFF";

  return (
    <div
      className="
        bg-surface
        border border-default
        rounded-2xl
        p-4
        flex items-center gap-4
        min-h-[90px]
        transition
        hover:border-default-2
      "
    >
      {/* ICON */}
      <div
        className={`
          w-11 h-11
          rounded-xl
          bg-surface-2
          flex items-center justify-center
          shrink-0
          ${isDefaultWhite && !bgColor ? "text-muted" : ""}
        `}
        style={
          bgColor
            ? { backgroundColor: bgColor, color }
            : !isDefaultWhite
            ? { color }
            : undefined
        }
        title={tooltip}
      >
        {Icon && <Icon size={20} />}
      </div>

      {/* CONTENT */}
      <div className="min-w-0">
        <p className="text-xs sm:text-sm text-muted truncate">
          {label}
        </p>

        <p
          className="text-2xl sm:text-3xl font-semibold leading-tight text-page"
          style={color !== "#FFFFFF" ? { color } : undefined}
        >
          {value}
          {suffix && (
            <span className="text-base font-medium ml-1">
              {suffix}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}