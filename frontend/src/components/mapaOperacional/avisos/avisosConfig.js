// Avisos da Label (estilo Waze): constantes e funções puras (sem JSX, pro fast refresh).

export const MOTIVOS_AVISO = [
  { value: "LOTADO", label: "Lotado" },
  { value: "PARADO", label: "Parado" },
  { value: "FALTA_PESSOAL", label: "Falta de pessoal" },
  { value: "FALTA_MATERIAL", label: "Falta de material" },
  { value: "PROBLEMA", label: "Problema" },
  { value: "OUTRO", label: "Outro" },
];

export const GRAVIDADES = {
  ATENCAO: { cor: "#F59E0B", rotulo: "Atenção" },
  CRITICO: { cor: "#FF453A", rotulo: "Crítico" },
};

export const DURACOES_AVISO = [
  { valor: 15, rotulo: "15 min" },
  { valor: 30, rotulo: "30 min" },
  { valor: 60, rotulo: "1 hora" },
  { valor: 120, rotulo: "2 horas" },
];

export const DURACAO_PADRAO = 30;

export const rotuloMotivo = (motivo) => MOTIVOS_AVISO.find((m) => m.value === motivo)?.label || motivo;

export const corDoAviso = (aviso) => (GRAVIDADES[aviso.severidade] || GRAVIDADES.ATENCAO).cor;

/** O mais grave (crítico antes de atenção); empate: o mais recente. */
export function maisGrave(lista) {
  if (!lista?.length) return null;
  return [...lista].sort(
    (a, b) => (b.severidade === "CRITICO") - (a.severidade === "CRITICO") || new Date(b.criadoEm) - new Date(a.criadoEm)
  )[0];
}

/** Minutos que faltam para o aviso sair da tela (arredonda para cima, nunca negativo). */
export const minutosRestantes = (aviso, agora = Date.now()) => Math.max(0, Math.ceil((new Date(aviso.expiraEm).getTime() - agora) / 60000));

export function haQuanto(iso, agora = Date.now()) {
  const min = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  return `há ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

export const chaveBraco = (braco, lado) => `${braco}-${lado}`;

/** { "3-A": [avisos] } só com os avisos de braço da esteira. */
export function avisosPorBraco(avisos, idEsteira) {
  const mapa = {};
  avisos
    .filter((a) => a.alvoTipo === "BRACO" && String(a.idEsteira) === String(idEsteira))
    .forEach((a) => (mapa[chaveBraco(a.braco, a.lado)] ||= []).push(a));
  return mapa;
}

/** Descrição curta do alvo: "Braço 3A", "Gol", "Doca 12". `nomesLabor` mapeia o valor da função ao rótulo. */
export function rotuloAlvo(aviso, nomesLabor = {}) {
  if (aviso.alvoTipo === "DOCA") return `Doca ${aviso.numeroDoca}`;
  if (aviso.alvoTipo === "BRACO") return `Braço ${aviso.braco}${aviso.lado}`;
  return nomesLabor[aviso.labor] || aviso.labor;
}

/** Texto único do aviso: "Gol lotado" ou "Braço 3A: Falta de material — texto". */
export function descricaoAviso(aviso, nomesLabor = {}) {
  const base = `${rotuloAlvo(aviso, nomesLabor)}: ${rotuloMotivo(aviso.motivo)}`;
  return aviso.texto ? `${base} — ${aviso.texto}` : base;
}

/** Texto de apoio (tooltip / leitor de tela): quem sinalizou, quando e quanto falta pra sair. */
export function detalheDoAviso(aviso, nomesLabor) {
  const partes = [descricaoAviso(aviso, nomesLabor)];
  if (aviso.nomePessoa) partes.push(`Pessoa: ${aviso.nomePessoa}`);
  if (aviso.criadoPorNome) partes.push(`Por ${aviso.criadoPorNome}, ${haQuanto(aviso.criadoEm)}`);
  partes.push(`Some em ${minutosRestantes(aviso)} min`);
  return partes.join(". ");
}
