// Constantes e formatação das telas do Planning Inbound (Previsão de recebimento, Viagens e Mapa da frota).
import { FUSO, fmtDuracao } from "./filaUtils";

export { FUSO, fmtDuracao };

// Situação da viagem: o que o backend calcula (viagens.service) com a cor de cada uma.
export const SITUACOES = {
  RECEBIDA: { rotulo: "Recebida", cor: "#22C55E" },
  NO_PATIO: { rotulo: "No pátio", cor: "#8B5CF6" },
  EM_TRANSITO: { rotulo: "Em trânsito", cor: "#3B82F6" },
  PROGRAMADA: { rotulo: "Programada", cor: "#8B8B93" },
  CANCELADA: { rotulo: "Cancelada", cor: "#FF453A" },
  NO_SHOW: { rotulo: "No show", cor: "#F59E0B" },
  SEM_PROGRAMACAO: { rotulo: "Sem programação", cor: "#8B8B93" },
};

export const CLASSES_ETA = {
  NO_PRAZO: { rotulo: "No prazo", cor: "#22C55E" },
  ADIANTADA: { rotulo: "Adiantada", cor: "#3B82F6" },
  ATRASADA: { rotulo: "Atrasada", cor: "#FF453A" },
};

export const TURNOS = ["T1", "T2", "T3"];
export const TIPOS_ORIGEM = ["SOC", "FMH", "HUB", "XPT", "FBS"];
export const COR_PREVISTO = "#8B8B93";
export const COR_RECEBIDO = "#FA4C00";
export const LEGENDA_PREV_REC = [
  { cor: COR_PREVISTO, rotulo: "Previsto" },
  { cor: COR_RECEBIDO, rotulo: "Recebido" },
];

/** ISO -> "HH:mm" (horário de Brasília). */
export const fmtHoraIso = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO }) : "—";

/** ISO -> "dd/MM HH:mm". */
export function fmtDataHora(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: FUSO });
  return `${dia} ${fmtHoraIso(iso)}`;
}

/** "YYYY-MM-DD" -> "dd/MM/YYYY". */
export const fmtDia = (dia) => (dia ? dia.split("-").reverse().join("/") : "—");

/** Minutos (positivo = depois do previsto) -> "+1h20m" / "-35min". */
export function fmtDesvio(min) {
  if (min === null || min === undefined) return "—";
  if (min === 0) return "0min";
  return `${min > 0 ? "+" : "-"}${fmtDuracao(Math.abs(min))}`;
}

/** "há 12 min" / "há 3 h" / "há 2 d" a partir de minutos. */
export function fmtIdade(min) {
  if (min === null || min === undefined) return "—";
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 48 * 60) return `há ${Math.floor(min / 60)} h`;
  return `há ${Math.floor(min / 1440)} d`;
}

export const nomePlacas = (placas) => (placas?.length ? placas.join(" · ") : "—");

// Perfil de pacote (PP/P/M/G…) na ordem de exibição.
export const PERFIS_PACOTE = [
  { chave: "pp", rotulo: "PP" },
  { chave: "p", rotulo: "P" },
  { chave: "m", rotulo: "M" },
  { chave: "g", rotulo: "G" },
  { chave: "bulky", rotulo: "Bulky" },
  { chave: "ultraBulky", rotulo: "Ultra bulky" },
  { chave: "semPerfil", rotulo: "Sem perfil" },
];

export const FAIXAS_SPP = ["0–20", "21–30", "31–40", "41–50", "51–60", ">60"];
