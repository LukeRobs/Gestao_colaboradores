import { X, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ajustarPresencaManual, deletarFrequencia } from "../../services/presenca";

/* =============================
   STATUS PERMITIDOS
============================= */
const STATUS_OPTIONS = [
  { code: "AFA", label: "Afastamento" },
  { code: "BH", label: "Banco de horas" },
  { code: "DSR", label: "DSR", adminOnly: true },
  { code: "DF", label: "Desligamento Forçado"},
  { code: "DV", label: "Desligamento Voluntario"},
  { code: "FE", label: "Férias" },
  { code: "FO", label: "Folga" },
  { code: "F", label: "Falta não justificada" },
  { code: "LM", label: "Licença maternidade" },
  { code: "LP", label: "Licença paternidade" },
  { code: "NC", label: "Não contratado"},
  { code: "P", label: "Presente", adminOnly: true },
  { code: "S1", label: "Sinergia enviada" },
  { code: "SU", label: "Suspensão" },
  { code: "TR", label: "Transferido" },
  { code: "ON", label: "Onboarding" },
  { code: "AB", label: "Licença - Atestado de Óbito" },
  { code: "JE", label: "Licença - Justiça Eleitoral" },
];

/* =============================
   JUSTIFICATIVAS PADRÃO
============================= */
const JUSTIFICATIVAS = [
  { code: "BANCO_DE_HORAS", label: "Banco de Horas" },
  { code: "ESQUECIMENTO_MARCACAO", label: "Esquecimento da marcação" },
  { code: "ALTERACAO_PONTO", label: "Alteração de ponto" },
  { code: "MARCACAO_INDEVIDA", label: "Marcação indevida" },
  { code: "ATESTADO_MEDICO", label: "Atestado médico" },
  { code: "SINERGIA_ENVIADA", label: "Sinergia enviada" },
  { code: "LICENCA", label: "Licença" },
  { code: "HORA_EXTRA", label: "Hora Extra"},
  { code: "FALTA_INJUSTIFICADA", label: "Falta injustificada" },
];

// Status que NÃO mostram campos de hora (justificativa automática)
const STATUS_SEM_HORARIO = ["BH", "S1", "AB", "JE"];

// Status que habilitam edição de hora (demais mostram campos mas desabilitados)
const STATUS_COM_HORARIO = ["P"];

// Status abonados: não contam como presença nem ausência, sem campo de justificativa manual
const STATUS_ABONADOS = ["AB", "JE"];

function autoJustificativa(status) {
  if (status === "ON") return "ON";
  if (status === "F") return "FALTA_INJUSTIFICADA";
  if (status === "S1") return "SINERGIA_ENVIADA";
  if (status === "BH") return "BANCO_DE_HORAS";
  if (status === "AB") return "ATESTADO_OBITO";
  if (status === "JE") return "JUSTICA_ELEITORAL";
  return "BANCO_DE_HORAS";
}

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
  isAdmin = false,
  onSuccess,
  onDelete,
}) {
  const [status, setStatus] = useState("");
  const [renderKey, setRenderKey] = useState(0);
  const [horaEntrada, setHoraEntrada] = useState("");
  const [horaSaida, setHoraSaida] = useState("");
  const [justificativa, setJustificativa] = useState("BANCO_DE_HORAS");
  const [loading, setLoading] = useState(false);
  const isOnboarding = status === "ON";
  const isFaltaInjustificada = status === "F";
  const isFolga = status === "FO";
  const isSuspensao = status === "SU";
  const isAbonado = STATUS_ABONADOS.includes(status);
  const mostrarHorario = !STATUS_SEM_HORARIO.includes(status) && status !== "";
  const permiteHorario = status === "P";

  /* =============================
     INIT
  ============================= */
  useEffect(() => {
    if (!open) return;
    const statusInicial = registro?.status && registro.status !== "-"
      ? registro.status
      : (registro?.entrada ? "P" : "");
    setStatus(statusInicial);
    setHoraEntrada(toHHMM(registro?.entrada));
    setHoraSaida(toHHMM(registro?.saida));
    setJustificativa(autoJustificativa(statusInicial));
    setRenderKey((k) => k + 1);
  }, [open, registro]);

  useEffect(() => {
    setJustificativa(autoJustificativa(status));
    if (STATUS_SEM_HORARIO.includes(status)) {
      setHoraEntrada("");
      setHoraSaida("");
      setRenderKey((k) => k + 1);
    } else if (isFaltaInjustificada) {
      setJustificativa("FALTA_INJUSTIFICADA");
    } else if (isFolga) {
      setJustificativa("FOLGA");
    } else if (isSuspensao) {
      setJustificativa("SUSPENSAO");
    } else if (isAbonado) {
      setJustificativa(autoJustificativa(status));
    }
  }, [status]);

  if (!open) return null;

  async function handleDelete() {
    if (!registro?.idFrequencia) return;
    if (!window.confirm("Apagar este registro de frequência? Esta ação não pode ser desfeita.")) return;

    try {
      setLoading(true);
      await deletarFrequencia(registro.idFrequencia);
      alert("Registro apagado com sucesso");
      onDelete?.({ opsId: colaborador.opsId, dataReferencia: dia.date });
      onClose();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Erro ao apagar registro");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!status) {
      alert("Status é obrigatório");
      return;
    }

    if (!justificativa && !isFolga && !isSuspensao && !isAbonado) {
      alert("Justificativa é obrigatória");
      return;
    }

    if (mostrarHorario && permiteHorario) {
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
        let minutos = (hS * 60 + mS) - (hE * 60 + mE);
        if (minutos < 0) minutos += 24 * 60;
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
        horaEntrada: (mostrarHorario && permiteHorario) ? horaEntrada || null : null,
        horaSaida: (mostrarHorario && permiteHorario) ? horaSaida || null : null,
      });

      alert("Presença ajustada com sucesso");

      onSuccess?.({
        opsId: colaborador.opsId,
        dataReferencia: dia.date,
        status,
        horaEntrada: (mostrarHorario && permiteHorario) ? horaEntrada || null : null,
        horaSaida: (mostrarHorario && permiteHorario) ? horaSaida || null : null,
      });

      onClose();

    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Erro ao ajustar presença");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center pt-10 sm:pt-0 p-4">
      <div
        className="
          w-full
          max-w-md
          max-h-[90vh]
          overflow-y-auto
          bg-surface
          rounded-2xl
          shadow-xl
          p-6
          space-y-6
        "
      >

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ajustar Presença</h2>
          <button onClick={onClose} disabled={loading}>
            <X size={20} />
          </button>
        </div>

        {/* INFO */}
        <div className="text-sm text-muted space-y-1">
          <div><b>Colaborador:</b> {colaborador?.nome || "-"}</div>
          <div><b>Data:</b> {dia.label}</div>
        </div>

        {/* STATUS */}
        <div>
          <label className="text-xs text-muted">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-surface-2 border border-default rounded-xl px-4 py-2"
          >
            <option value="">Selecione um status</option>
            {STATUS_OPTIONS.filter((s) => !s.adminOnly || isAdmin).map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* HORÁRIOS — oculto para BH e S1 */}
        {mostrarHorario && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted">
                Hora Entrada
                {status === "P" && <span className="text-red-400 ml-1">*</span>}
              </label>
              <input
                key={`entrada-${renderKey}`}
                type="time"
                value={horaEntrada}
                disabled={!permiteHorario}
                onChange={(e) => setHoraEntrada(e.target.value)}
                className={`w-full bg-surface-2 border rounded-xl px-4 py-2 disabled:opacity-40 ${
                  status === "P" && !horaEntrada ? "border-red-400" : "border-default"
                }`}
              />
            </div>
            <div>
              <label className="text-xs text-muted">Hora Saída</label>
              <input
                key={`saida-${renderKey}`}
                type="time"
                value={horaSaida}
                disabled={!permiteHorario}
                onChange={(e) => setHoraSaida(e.target.value)}
                className="w-full bg-surface-2 border border-default rounded-xl px-4 py-2 disabled:opacity-40"
              />
            </div>
          </div>
        )}

        {/* JUSTIFICATIVA */}
        {!isFolga && !isSuspensao && !isAbonado && (
          <div>
            <label className="text-xs text-muted">
              Justificativa <span className="text-red-400">*</span>
            </label>
            <select
              value={justificativa}
              disabled={isOnboarding || isFaltaInjustificada}
              onChange={(e) => setJustificativa(e.target.value)}
              className="w-full bg-surface-2 border border-default rounded-xl px-4 py-2 disabled:opacity-50"
            >
              <option value="">Selecione uma justificativa</option>
              {JUSTIFICATIVAS.map((j) => (
                <option key={j.code} value={j.code}>
                  {j.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-surface-2"
          >
            Cancelar
          </button>

          {isAdmin && registro?.idFrequencia && (
            <button
              onClick={handleDelete}
              disabled={loading}
              title="Apagar registro"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-700 hover:bg-red-600 rounded-lg font-medium disabled:opacity-60"
            >
              <Trash2 size={13} />
              {loading ? "Apagando..." : "Apagar"}
            </button>
          )}

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
