// src/components/Pagination.jsx
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

export default function Pagination({
  page,
  totalPages,
  totalItems,
  limit,
  onPageChange,
  onLimitChange,
}) {
  const isFirst = page <= 1;
  const effectiveTotalPages = Math.max(1, totalPages);
  const isLast = page >= effectiveTotalPages;

  return (
    <div
      className="
        mt-6
        bg-surface-2
        border border-default
        rounded-2xl
        p-4
        space-y-4
      "
    >
      {/* ================= MOBILE LAYOUT ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

        {/* INFO */}
        <div className="text-sm text-muted text-center sm:text-left">
          Total: <span className="text-white font-medium">{totalItems}</span>{" "}
          registros
        </div>

        {/* LIMIT */}
        <div className="flex items-center justify-center sm:justify-end gap-2 text-sm">
          <span className="text-muted">Mostrar</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="
              bg-surface
              border border-default
              rounded-lg
              px-3 py-1.5
              text-page
              outline-none
              focus:ring-1 focus:ring-[#FA4C00]
            "
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={100}>100</option>
          </select>
          <span className="text-muted">por página</span>
        </div>
      </div>

      {/* ================= CONTROLES ================= */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">

        <div className="flex items-center gap-2">

          {/* PRIMEIRA */}
          <IconButton
            disabled={isFirst}
            onClick={() => onPageChange(1)}
          >
            <ChevronsLeft size={16} />
          </IconButton>

          {/* ANTERIOR */}
          <IconButton
            disabled={isFirst}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft size={16} />
          </IconButton>

          {/* PÁGINA ATUAL */}
          <div className="px-4 py-2 text-sm bg-surface rounded-xl border border-default">
            Página <span className="text-white font-semibold">{page}</span> de{" "}
            <span className="text-white font-semibold">
              {effectiveTotalPages}
            </span>
          </div>

          {/* PRÓXIMA */}
          <IconButton
            disabled={isLast}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight size={16} />
          </IconButton>

          {/* ÚLTIMA */}
          <IconButton
            disabled={isLast}
            onClick={() => onPageChange(effectiveTotalPages)}
          >
            <ChevronsRight size={16} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

/* ================= BOTÃO PADRÃO ================= */

function IconButton({ disabled, onClick, children }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`
        w-9 h-9
        flex items-center justify-center
        rounded-xl
        border border-default
        transition-all
        ${
          disabled
            ? "opacity-40 cursor-not-allowed"
            : "hover:bg-surface-2 hover:border-[#FA4C00]/50"
        }
      `}
    >
      {children}
    </button>
  );
}