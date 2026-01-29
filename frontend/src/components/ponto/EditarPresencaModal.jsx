import { X, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { ajustarPresencaManual } from "../../services/presenca";

/* =============================
   STATUS PERMITIDOS
============================= */
const STATUS_OPTIONS = [
  { code: "AA", label: "Atestado acompanhamento" },
  { code: "AM", label: "Atestado médico" },
  { code: "AFA", label: "Afastamento" },
  { code: "BH", label: "Banco de horas" },
  { code: "DSR", label: "DSR" },
  { code: "DF", label: "Desligamento Forçado"},
  { code: "DV", label: "Desligamento Voluntario"},
  { code: "FE", label: "Férias" },
  { code: "FO", label: "Folga" },
  { code: "F", label: "Falta não justificada" },
  { code: "FJ", label: "Falta justificada" },
  { code: "LM", label: "Licença maternidade" },
  { code: "LP", label: "Licença paternidade" },
  { code: "NC", label: "Não contratado"},
  { code: "P", label: "Presente" },
  { code: "S1", label: "Sinergia enviada" },
  { code: "TR", label: "Transferido" },
];


/* =============================
   JUSTIFICATIVAS PADRÃO
============================= */
const JUSTIFICATIVAS = [
  { code: "ESQUECIMENTO_MARCACAO", label: "Esquecimento da marcação" },
  { code: "ALTERACAO_PONTO", label: "Alteração de ponto" },
  { code: "MARCACAO_INDEVIDA", label: "Marcação indevida" },
  { code: "ATESTADO_MEDICO", label: "Atestado médico" },
  { code: "SINERGIA_ENVIADA", label: "Sinergia enviada" },
  { code: "LICENCA", label: "Licença" },
  { code: "HORA_EXTRA", label: "Hora Extra"},
];

const STATUS_COM_HORARIO = ["P", "BH"];


function toHHMM(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}


export default function EditarPresencaModal({
  open,
  onClose,
  colaborador,
  dia,
  registro,
  onSuccess, // opcional: recarregar grade
}) {
  const [status, setStatus] = useState("") ;
  const [renderKey, setRenderKey] = useState(0);
  const [horaEntrada, setHoraEntrada] = useState("");
  const [horaSaida, setHoraSaida] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [loading, setLoading] = useState(false);

  /* =============================
     INIT
  ============================= */
  useEffect(() => {
    if (!open) return;

    setStatus(registro?.status || "");
    setHoraEntrada(toHHMM(registro?.entrada));
    setHoraSaida(toHHMM(registro?.saida));
    setJustificativa("");

    // 🔑 FORÇA REMOUNT DOS INPUTS
    setRenderKey((k) => k + 1);
  }, [open, registro]);

  if (!open) return null;

  const permiteHorario = STATUS_COM_HORARIO.includes(status);

  async function handleSave() {
    if (!justificativa) {
      alert("Justificativa é obrigatória");
      return;
    }

    if (permiteHorario) {
      // 🔒 VALIDAÇÃO: Status P (Presente) OBRIGA horário de entrada
      if (status === "P" && !horaEntrada) {
        alert("Horário de entrada é obrigatório para status 'Presente'");
        return;
      }

      if (horaSaida && !horaEntrada) {
        alert("Hora de saída não pode existir sem hora de entrada");
        return;
      }

      if (horaEntrada && horaSaida) {
      const [hE, mE] = horaEntrada.split(":").map(Number);
      const [hS, mS] = horaSaida.split(":").map(Number);

      let entradaMin = hE * 60 + mE;
      let saidaMin = hS * 60 + mS;

      let minutos = saidaMin - entradaMin;

      // 🔑 VIRADA DE DIA (T3)
      if (minutos < 0) {
        minutos += 24 * 60;
      }

      // 🔒 REGRA DE SEGURANÇA
      if (minutos <= 0 || minutos > 16 * 60) {
        alert("Jornada inválida. Verifique os horários informados.");
        return;
      }
    }
    }

    try {
      setLoading(true);

      await ajustarPresencaManual({
        opsId: colaborador.opsId,
        dataReferencia: dia.date,
        status,
        justificativa,
        horaEntrada: permiteHorario ? horaEntrada || null : null,
        horaSaida: permiteHorario ? horaSaida || null : null,
      });

      alert("Presença ajustada com sucesso");

      onSuccess?.({
        opsId: colaborador.opsId,
        dataReferencia: dia.date,
        status,
        horaEntrada: permiteHorario ? horaEntrada || null : null,
        horaSaida: permiteHorario ? horaSaida || null : null,
      });

      onClose();

    } catch (err) {
      console.error(err);
      alert(
        err?.response?.data?.message ||
          "Erro ao ajustar presença"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md bg-[#1A1A1C] rounded-2xl shadow-xl p-6 space-y-6">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ajustar Presença</h2>
          <button onClick={onClose} disabled={loading}>
            <X size={20} />
          </button>
        </div>

        {/* INFO */}
        <div className="text-sm text-[#BFBFC3] space-y-1">
          <div><b>Colaborador:</b> {colaborador?.nome || "-"}</div>
          <div><b>Data:</b> {dia.label}</div>
        </div>

        {/* STATUS */}
        <div>
          <label className="text-xs text-[#BFBFC3]">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-[#2A2A2C] border border-[#3D3D40] rounded-xl px-4 py-2"
          >
            <option value="">Selecione um status</option>

            {STATUS_OPTIONS.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* HORÁRIOS */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#BFBFC3]">
              Hora Entrada
              {status === "P" && <span className="text-red-400 ml-1">*</span>}
            </label>
            <input
              key={`entrada-${renderKey}`}
              type="time"
              value={horaEntrada}
              disabled={!permiteHorario}
              onChange={(e) => setHoraEntrada(e.target.value)}
              className={`w-full bg-[#2A2A2C] border rounded-xl px-4 py-2 disabled:opacity-40 ${
                status === "P" && !horaEntrada 
                  ? "border-red-400" 
                  : "border-[#3D3D40]"
              }`}
            />
          </div>

          <div>
            <label className="text-xs text-[#BFBFC3]">Hora Saída</label>
            <input
              key={`saida-${renderKey}`}
              type="time"
              value={horaSaida}
              disabled={!permiteHorario}
              onChange={(e) => setHoraSaida(e.target.value)}
              className="w-full bg-[#2A2A2C] border border-[#3D3D40] rounded-xl px-4 py-2 disabled:opacity-40"
            />
          </div>
        </div>

        {/* JUSTIFICATIVA */}
        <div>
          <label className="text-xs text-[#BFBFC3]">
            Justificativa <span className="text-red-400">*</span>
          </label>
          <select
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            className="w-full bg-[#2A2A2C] border border-[#3D3D40] rounded-xl px-4 py-2"
          >
            <option value="">Selecione uma justificativa</option>
            {JUSTIFICATIVAS.map((j) => (
              <option key={j.code} value={j.code}>
                {j.label}
              </option>
            ))}
          </select>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-[#2A2A2C]"
          >
            Cancelar
          </button>

          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-[#FA4C00] rounded-xl font-medium disabled:opacity-60"
          >
            <Save size={16} />
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
