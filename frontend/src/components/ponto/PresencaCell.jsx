import { useMemo, useState } from "react";
import clsx from "clsx";
import PresencaTooltip from "./PresencaTooltip";

/* ================= STATUS CONFIG ================= */
const STATUS_CONFIG = {
  "-": { label: "Sem registro", short: "-", bg: "bg-transparent", text: "text-zinc-500"},
  P:   { label: "Presente", short: "P", bg: "bg-emerald-600/20", text: "text-emerald-400" },
  F:   { label: "Falta", short: "F", bg: "bg-red-600/20", text: "text-red-400" },

  FJ:  { label: "Falta Justificada", short: "FJ", bg: "bg-red-600/20", text: "text-red-400" },

  DF:  { label: "Desligamento Forçado", short: "DF", bg: "bg-red-800/20", text: "text-red-500" },
  DV:  { label: "Desligamento Voluntário", short: "DV", bg: "bg-red-800/20", text: "text-red-500" },
  DP:  { label: "Desligamento Planejado", short: "DP", bg: "bg-red-800/20", text: "text-red-500" },
  NC:  { label: "Não Contratado", short: "NC", bg: "bg-zinc-700/20", text: "text-zinc-400" },

  DSR: { label: "DSR", short: "DSR", bg: "bg-zinc-600/20", text: "text-zinc-400" },
  AM:  { label: "Atestado Médico", short: "AM", bg: "bg-blue-600/20", text: "text-blue-400" },
  AA:  { label: "Atest. Acompanh.", short: "AA", bg: "bg-cyan-600/20", text: "text-cyan-400" },
  FE:  { label: "Férias", short: "FE", bg: "bg-purple-600/20", text: "text-purple-400" },
  LM:  { label: "Lic. Maternidade", short: "LM", bg: "bg-pink-600/20", text: "text-pink-400" },
  LP:  { label: "Lic. Paternidade", short: "LP", bg: "bg-indigo-600/20", text: "text-indigo-400" },
  AFA: { label: "Afastado", short: "AFA", bg: "bg-orange-600/20", text: "text-orange-400" },
  BH:  { label: "Banco de Horas", short: "BH", bg: "bg-yellow-600/20", text: "text-yellow-400" },
  FO:  { label: "Folga", short: "FO", bg: "bg-slate-600/20", text: "text-slate-400" },
  TR:  { label: "Transferido", short: "TR", bg: "bg-neutral-600/20", text: "text-neutral-400" },
  S1:  { label: "Sinergia", short: "S1", bg: "bg-pink-600/40", text: "text-red-400" },
  ON:  { label: "Onboarding", short: "ON", bg: "bg-orange-600/20", text: "text-orange-400" },
};


/* ================= HELPERS ================= */
function fmtHora(iso) {
  if (!iso) return null;

  try {
    const d = new Date(iso);
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return null;
  }
}


function isWeekend(dateISO) {
  if (!dateISO) return false;
  const d = new Date(`${dateISO}T00:00:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
}


function isDSR(dateISO, escala) {
  if (!dateISO || !escala) return false;

  const date = new Date(`${dateISO}T00:00:00`);
  const day = date.getDay();

  const DSR_BY_ESCALA = {
    A: [0, 3],
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
  const weekend = isWeekend(dia?.date);

  /* ================= STATUS ================= */
  const status = useMemo(() => {
    if (registro?.status) return registro.status;
    if (isDSR(dia?.date, colaborador?.escala)) return "DSR";
    return "-";
  }, [registro, dia?.date, colaborador?.escala]);

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.F;
  const disabled = status === "DSR" && !canEdit;

  /* ================= PENDÊNCIA DE SAÍDA ================= */
  const semSaida =
    status === "P" &&
    (registro?.entrada || registro?.horaEntrada) &&
    !registro?.saida &&
    !registro?.horaSaida;

  function handleClick() {
    if (!canEdit) return;
    onEdit?.({ colaborador, dia, registro });
  }

  const horaEntrada = fmtHora(registro?.entrada || registro?.horaEntrada);
  const horaSaida = fmtHora(registro?.saida || registro?.horaSaida);
  const showTooltip = hover && (canEdit || registro);

  return (
    <td className="border-r border-[#2A2A2C] min-w-12 sm:min-w-14">
      <div
        className={clsx(
          "relative px-2 py-2 text-center cursor-pointer select-none transition",
          cfg.bg,
          cfg.text,
          weekend && status === "-" && "bg-[#141416]",
          disabled && "opacity-40 cursor-not-allowed",
          canEdit && "hover:ring-1 hover:ring-[#FA4C00]"
        )}
        onClick={handleClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <span className="text-xs font-semibold whitespace-nowrap">{cfg.short}</span>

        {/* ⚠ WARNING: entrada sem saída */}
        {semSaida && (
          <span className="absolute top-0 right-0 text-[12px] leading-none text-red-900">
            ⚠
          </span>
        )}

        <PresencaTooltip open={showTooltip}>
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

              {/* ⚠ Aviso no tooltip */}
              {semSaida && (
                <div className="text-amber-400 text-[11px] font-medium">
                  ⚠ Saída não registrada
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