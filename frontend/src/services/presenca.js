import api from "./api";

/**
 * Deletar registro de frequência (ADMIN)
 */
export async function deletarFrequencia(idFrequencia) {
  const res = await api.delete(`/frequencias/${idFrequencia}`);
  return res.data;
}

/**
 * Ajuste manual de presença (LIDER / GESTÃO)
 */
export async function ajustarPresencaManual(payload) {
  /**
   * payload esperado:
   * {
   *   opsId: string,
   *   dataReferencia: "YYYY-MM-DD",
   *   status: "P" | "F" | "FJ" | "AM" | ...
   *   justificativa: "ESQUECIMENTO_MARCACAO" | ...
   *   horaEntrada?: "HH:mm" | null
   *   horaSaida?: "HH:mm" | null
   * }
   */

  const res = await api.post("/ponto/ajuste-manual", {
    opsId: payload.opsId,
    dataReferencia: payload.dataReferencia,
    status: payload.status,
    justificativa: payload.justificativa,
    horaEntrada: payload.horaEntrada || null,
    horaSaida: payload.horaSaida || null,
  });

  return res.data;
}
