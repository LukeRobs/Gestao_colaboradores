"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Calendar } from "lucide-react";

export default function DateFilter({ value, onApply }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState(value || {});
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const buttonRef = useRef(null);
  const calendarRef = useRef(null);

  /* =====================================================
     POSIÇÃO (PORTAL)
  ===================================================== */
  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();

      setPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 320,
      });
    }
  }, [open]);

  /* =====================================================
     CLICK OUTSIDE
  ===================================================== */
  useEffect(() => {
    function handleClick(e) {
      if (
        calendarRef.current &&
        !calendarRef.current.contains(e.target) &&
        !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }

    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  /* =====================================================
     HELPERS
  ===================================================== */
  function formatDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function applyRange(inicio, fim) {
    const newRange = { inicio, fim };
    setRange(newRange);
    onApply?.(newRange);
    setOpen(false);
  }

  function handleQuick(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    applyRange(formatDate(start), formatDate(end));
  }

  /* =====================================================
     UI
  ===================================================== */
  return (
    <>
      {/* BOTÃO */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 h-11 rounded-xl bg-[#1C1C1F] border border-white/10 text-sm hover:border-white/20 transition"
      >
        <Calendar size={16} className="text-white" />
        {range?.inicio && range?.fim
          ? `${range.inicio} → ${range.fim}`
          : "Selecionar período"}
      </button>

      {/* PORTAL */}
      {open &&
        createPortal(
          <div
            ref={calendarRef}
            className="fixed z-[9999] w-[320px] bg-[#141416] border border-white/10 rounded-2xl shadow-2xl p-4 animate-[fadeUp_.2s_ease]"
            style={{
              top: position.top,
              left: position.left,
            }}
          >
            {/* HEADER */}
            <p className="text-xs text-white/40 mb-3">
              Selecione um período
            </p>

            {/* QUICK ACTIONS */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => handleQuick(0)}
                className="px-3 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-xs"
              >
                Hoje
              </button>
              <button
                onClick={() => handleQuick(7)}
                className="px-3 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-xs"
              >
                Últimos 7 dias
              </button>
              <button
                onClick={() => handleQuick(30)}
                className="px-3 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-xs"
              >
                Últimos 30 dias
              </button>
              <button
                onClick={() => handleQuick(90)}
                className="px-3 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-xs"
              >
                3 meses
              </button>
            </div>

            {/* INPUTS */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] text-white/40">
                  Data início
                </label>
                <input
                  type="date"
                  value={range?.inicio || ""}
                  onChange={(e) =>
                    setRange((r) => ({
                      ...r,
                      inicio: e.target.value,
                    }))
                  }
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-[#0F0F10] border border-white/10 text-sm text-white"
                  style={{ colorScheme: "dark" }}
                />
              </div>

              <div>
                <label className="text-[10px] text-white/40">
                  Data fim
                </label>
                <input
                  type="date"
                  value={range?.fim || ""}
                  onChange={(e) =>
                    setRange((r) => ({
                      ...r,
                      fim: e.target.value,
                    }))
                  }
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-[#0F0F10] border border-white/10 text-sm text-white"
                  style={{ colorScheme: "dark" }}
                />
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-xs text-white/40 hover:text-white"
              >
                Cancelar
              </button>

              <button
                onClick={() =>
                  applyRange(range.inicio, range.fim)
                }
                className="px-4 py-2 rounded-lg bg-[#E8410A] hover:bg-[#c93509] text-white text-xs font-medium"
              >
                Aplicar
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}