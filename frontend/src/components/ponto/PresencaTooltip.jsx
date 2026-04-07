export default function PresencaTooltip({ open, children, above = false }) {
  if (!open) return null;

  return (
    <div
      className={`
        absolute z-50
        left-1/2 -translate-x-1/2
        ${above ? "bottom-full mb-2" : "top-full mt-2"}
        w-64 max-w-[260px]
        rounded-xl
        border border-default
        bg-[#121214]
        shadow-xl
        p-3
        text-xs
        text-page
        wrap-break-words whitespace-normal
        pointer-events-none
      `}
      role="tooltip"
    >
      {/* seta */}
      <div
        className={`
          absolute left-1/2 -translate-x-1/2
          w-0 h-0
          border-l-8 border-l-transparent
          border-r-8 border-r-transparent
          ${above
            ? "-bottom-2 border-t-8 border-t-[#121214]"
            : "-top-2 border-b-8 border-b-[#121214]"
          }
        `}
      />

      {children}
    </div>
  );
}