import { useRef, useCallback } from "react";
import PresencaHeader from "./PresencaHeader";
import PresencaRow from "./PresencaRow";

export default function PresencaGrid({
  dias = [],
  colaboradores = [],
  onEditCell,
  canEdit = false,
  isAdmin = false,
}) {
  const ano = colaboradores?.[0]?.ano ?? null;
  const mes = colaboradores?.[0]?.mes ?? null;

  const containerRef = useRef(null);
  const drag = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  const onMouseDown = useCallback((e) => {
    const el = containerRef.current;
    if (!el) return;
    drag.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";

    function onMove(ev) {
      if (!drag.current.active) return;
      const dx = ev.clientX - drag.current.startX;
      const dy = ev.clientY - drag.current.startY;
      el.scrollLeft = drag.current.scrollLeft - dx;
      el.scrollTop = drag.current.scrollTop - dy;
    }

    function onUp() {
      drag.current.active = false;
      el.style.cursor = "grab";
      el.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-2xl border border-[#2A2A2C] touch-pan-x touch-pan-y w-full scrollbar-hide"
      style={{ cursor: "grab" }}
      onMouseDown={onMouseDown}
    >
      <table className="w-max min-w-full text-sm border-separate border-spacing-0">
        <PresencaHeader dias={dias} ano={ano} mes={mes} />
        <tbody>
          {colaboradores.map((col) => (
            <PresencaRow
              key={`${col.opsId}-${ano}-${mes}`}
              colaborador={col}
              dias={dias}
              onEditCell={onEditCell}
              canEdit={canEdit}
              isAdmin={isAdmin}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
