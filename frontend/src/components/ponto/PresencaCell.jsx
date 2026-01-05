import { useMemo, useState } from "react";
import clsx from "clsx";
import PresencaTooltip from "./PresencaTooltip";

/* ================= STATUS CONFIG ================= */
const STATUS_CONFIG = {
  P:   { label: "Presente", short: "P", bg: "bg-emerald-600/20", text: "text-emerald-400" },
  F:   { label: "Falta", short: "F", bg: "bg-red-600/20", text: "text-red-400" },
  DSR: { label: "DSR", short: "DSR", bg: "bg-zinc-600/20", text: "text-zinc-400" },
  AM:  { label: "Atestado Médico", short: "AM", bg: "bg-blue-600/20", text: "text-blue-400" },
  AA:  { label: "Atest. Acompanh.", short: "AA", bg: "bg-cyan-600/20", text: "text-cyan-400" },
  FE:  { label: "Férias", short: "FE", bg: "bg-purple-600/20", text: "text-purple-400" },
  LM:  { label: "Lic. Maternidade", short: "LM", bg: "bg-pink-600/20", text: "text-pink-400" },
  LP:  { label: "Lic. Paternidade", short: "LP", bg: "bg-indigo-600/20", text: "text-indigo-400" },
  AFA: { label: "Afastado", short: "AFA", bg: "bg-orange-600/20", text: "text-orange-400" },
  BH:  { label: "Banco de Horas", short: "BH", bg: "bg-yellow-600/20", text: "text-yellow-400" },
  FO:  { label: "Folga", short: "FO", bg: "bg-slate-600/20", text: "text-slate-400" },
  T:   { label: "Transferido", short: "T", bg: "bg-neutral-600/20", text: "text-neutral-400" },
  S1:  { label: "Sinergia", short: "S1", bg: "bg-lime-600/20", text: "text-lime-400" },
};

/* ================= HELPERS ================= */
function fmtHora(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}


function isDSR(dateISO, escala) {
  if (!dateISO || !escala) return false;

  // força data local (evita bug de UTC)
  const date = new Date(`${dateISO}T00:00:00`);
  const day = date.getDay(); // 0=Dom, 3=Qua

  const DSR_BY_ESCALA = {
    A: [0, 3], // Domingo e Quarta
    B: [1, 4],
    C: [2, 5],
  };

  return DSR_BY_ESCALA[escala]?.includes(day);
}

/* ================= COMPONENT ================= */
export default function PresencaCell({
  dia,
  registro,
  colaborador,
  onEdit,
  canEdit = false,
}) {
  const [hover, setHover] = useState(false);

  /* ================= STATUS ================= */
  const status = useMemo(() => {
    // 1️⃣ Registro explícito sempre vence
    if (registro?.status) return registro.status;

    // 2️⃣ DSR automático pela escala
    if (isDSR(dia?.date, colaborador?.escala)) {
      return "DSR";
    }

    // 3️⃣ Fallback
    return "F";
  }, [registro, dia?.date, colaborador?.escala]);

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.F;
  const disabled = status === "DSR" && !canEdit;

  function handleClick() {
    if (!canEdit) return;
    onEdit?.({ colaborador, dia, registro });
  }

  const horaEntrada = fmtHora(registro?.horaEntrada);
  const horaSaida = fmtHora(registro?.horaSaida);

  return (
    <td className="border-r border-[#2A2A2C]">
      <div
        className={clsx(
          "relative px-2 py-2 text-center cursor-pointer select-none transition",
          cfg.bg,
          cfg.text,
          disabled && "opacity-40 cursor-not-allowed",
          canEdit && "hover:ring-1 hover:ring-[#FA4C00]"
        )}
        onClick={handleClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <span className="text-xs font-semibold">{cfg.short}</span>

        <PresencaTooltip open={hover}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{cfg.label}</span>
              <span className="text-[#BFBFC3]">
                {dia?.label || dia?.date || ""}
              </span>
            </div>

            <div className="h-px bg-[#2A2A2C]" />

            <div className="space-y-1 text-[#BFBFC3]">
              <div>
                <span className="text-[#EDEDED]">Colab:</span>{" "}
                {colaborador?.nome || "-"}
              </div>

              {(horaEntrada || horaSaida) && (
                <div>
                  <span className="text-[#EDEDED]">Ponto:</span>{" "}
                  {horaEntrada ? `Entrada ${horaEntrada}` : ""}
                  {horaEntrada && horaSaida ? " • " : ""}
                  {horaSaida ? `Saída ${horaSaida}` : ""}
                </div>
              )}

              {registro?.registradoPor && (
                <div>
                  <span className="text-[#EDEDED]">Registrado por:</span>{" "}
                  {registro.registradoPor}
                </div>
              )}

              {registro?.justificativa && (
                <div className="pt-1">
                  <span className="text-[#EDEDED]">Justificativa:</span>{" "}
                  {registro.justificativa}
                </div>
              )}

              {canEdit && (
                <div className="pt-2 text-[11px] text-[#FA4C00]">
                  Clique para ajustar
                </div>
              )}
            </div>
          </div>
        </PresencaTooltip>
      </div>
    </td>
  );
}
