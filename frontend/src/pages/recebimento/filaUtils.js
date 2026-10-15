// Formatação e regras de cor compartilhadas pelas telas de Recebimento > Fila de veículos e Veículos recebidos.

export const FUSO = "America/Sao_Paulo";

/** Epoch em segundos -> "HH:mm" (horário de Brasília, não o do navegador). */
export const fmtHora = (sec) =>
  sec ? new Date(sec * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO }) : "—";

/** ISO (ou Date) -> "HH:mm", ou "dd/MM HH:mm" com `comData`. */
export function fmtInstante(valor, { comData = false } = {}) {
  if (!valor) return "—";
  const d = new Date(valor);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO });
  if (!comData) return hora;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: FUSO })} ${hora}`;
}

export function fmtDuracao(min) {
  if (!min || min <= 0) return "—";
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}m`;
}

export function fmtPeso(g) {
  if (!g) return "—";
  const kg = g / 1000;
  return kg >= 1000 ? `${(kg / 1000).toFixed(2).replace(".", ",")} t` : `${kg.toFixed(1).replace(".", ",")} kg`;
}

// Tempo parado esperando: verde até 30 min, depois amarelo, laranja (1h) e vermelho (2h).
export function corEspera(min) {
  if (!min || min < 30) return "#22C55E";
  if (min < 60) return "#F59E0B";
  if (min < 120) return "#FA4C00";
  return "#FF453A";
}
