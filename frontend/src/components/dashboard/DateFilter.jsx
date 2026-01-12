import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { Calendar, Check, X } from "lucide-react";

/* ================= HELPERS ================= */
function pad(n) {
  return String(n).padStart(2, "0");
}

function toISO(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  return `${y}-${m}-${d}`; // ⚠️ SEM toISOString
}

function fromISO(iso) {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/* ================= COMPONENT ================= */
export default function DateFilter({ value = {}, onApply }) {
  const [open, setOpen] = useState(false);

  const initialRange = useMemo(() => {
    // prioridade: data única
    if (value.data) {
      const d = fromISO(value.data);
      return { from: d, to: undefined };
    }

    return {
      from: fromISO(value.dataInicio),
      to: fromISO(value.dataFim),
    };
  }, [value.data, value.dataInicio, value.dataFim]);

  const [range, setRange] = useState(initialRange);

  useEffect(() => {
    setRange(initialRange);
  }, [initialRange]);

  const label = useMemo(() => {
    if (!range?.from) return "Selecionar período";

    if (range.from && !range.to) {
      return range.from.toLocaleDateString("pt-BR");
    }

    if (range.from && range.to) {
      return `${range.from.toLocaleDateString("pt-BR")} → ${range.to.toLocaleDateString("pt-BR")}`;
    }

    return "Selecionar período";
  }, [range]);

  /* ================= APPLY CORRETO ================= */
  function apply() {
    if (!range?.from) return;

    // 📅 DIA ÚNICO
    if (!range.to) {
      onApply({ data: toISO(range.from) });
      setOpen(false);
      return;
    }

    // 📅 INTERVALO REAL
    onApply({
      dataInicio: toISO(range.from),
      dataFim: toISO(range.to),
    });

    setOpen(false);
  }

  function clear() {
    setRange({ from: undefined, to: undefined });
    onApply({ dataInicio: "", dataFim: "", data: "" });
    setOpen(false);
  }

  return (
    <div className="relative">
      {/* BOTÃO */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl px-4 py-3 text-sm text-[#E5E5EA] hover:border-[#3A3A3C]"
      >
        <Calendar size={18} className="text-[#BFBFC3]" />
        <span>{label}</span>
      </button>

      {/* POPOVER */}
      {open && (
        <div className="absolute z-50 mt-3 w-[360px] rounded-2xl border border-[#2A2A2C] bg-[#121214] shadow-xl p-3">
          <div className="text-xs text-[#BFBFC3] px-2 pb-2">
            Selecione um dia ou intervalo
          </div>

          <div className="rounded-xl overflow-hidden border border-[#2A2A2C] bg-[#0D0D0D] p-2">
            <DayPicker
              mode="range"
              selected={range}
              onSelect={setRange}
              numberOfMonths={1}
              weekStartsOn={0}
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            <button
              onClick={clear}
              className="flex items-center gap-1 text-sm text-[#BFBFC3] hover:text-white"
            >
              <X size={14} />
              Limpar
            </button>

            <button
              onClick={apply}
              disabled={!range?.from}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium bg-[#FA4C00] text-white disabled:opacity-40"
            >
              <Check size={16} />
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
