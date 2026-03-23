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
  const drag = useRef({
    active: false,
    startX: 0, startY: 0,
    scrollLeft: 0, scrollTop: 0,
    velX: 0, velY: 0,
    lastX: 0, lastY: 0,
    rafId: null,
  });

  const onMouseDown = useCallback((e) => {
    const el = containerRef.current;
    if (!el) return;

    // cancela inércia em andamento
    if (drag.current.rafId) cancelAnimationFrame(drag.current.rafId);

    drag.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      velX: 0, velY: 0,
      lastX: e.clientX, lastY: e.clientY,
      rafId: null,
    };
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";

    function onMove(ev) {
      if (!drag.current.active) return;
      const dx = ev.clientX - drag.current.startX;
      const dy = ev.clientY - drag.current.startY;
      // velocidade instantânea para inércia
      drag.current.velX = ev.clientX - drag.current.lastX;
      drag.current.velY = ev.clientY - drag.current.lastY;
      drag.current.lastX = ev.clientX;
      drag.current.lastY = ev.clientY;
      el.scrollLeft = drag.current.scrollLeft - dx;
      el.scrollTop  = drag.current.scrollTop  - dy;
    }

    function onUp() {
      drag.current.active = false;
      el.style.cursor = "grab";
      el.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);

      // inércia: continua deslizando com desaceleração
      let vx = -drag.current.velX;
      let vy = -drag.current.velY;
      const friction = 0.92;

      function glide() {
        if (Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) return;
        el.scrollLeft += vx;
        el.scrollTop  += vy;
        vx *= friction;
        vy *= friction;
        drag.current.rafId = requestAnimationFrame(glide);
      }
      drag.current.rafId = requestAnimationFrame(glide);
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
