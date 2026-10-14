// Avisos da Label (estilo Waze): constantes e funções puras (sem JSX, pro fast refresh).
import {
  ArrowDownToLine,
  ClipboardList,
  Fish,
  Hammer,
  MapPin,
  MessageSquareMore,
  OctagonAlert,
  PackagePlus,
  PackageX,
  PauseCircle,
  Shuffle,
  Target,
  TriangleAlert,
  UserMinus,
  Users,
  Wrench,
} from "lucide-react";

// Cada tipo de ocorrência tem ícone próprio: dá pra reconhecer de longe (mapa, lista, doca) sem ler.
// `gravidade` é só a sugestão inicial — o líder pode trocar em "Mais opções".
export const MOTIVOS_AVISO = [
  { value: "LOTADO", label: "Lotado", Icone: Users, gravidade: "ATENCAO", dica: "Gol, braço ou doca cheio" },
  { value: "PARADO", label: "Parado", Icone: PauseCircle, gravidade: "CRITICO", dica: "Operação parou" },
  { value: "FALTA_PESSOAL", label: "Falta de pessoal", Icone: UserMinus, gravidade: "ATENCAO", dica: "Precisa de gente" },
  { value: "FALTA_MATERIAL", label: "Falta de material", Icone: PackageX, gravidade: "ATENCAO", dica: "Sem sacas, caixas, etiqueta…" },
  { value: "PROBLEMA", label: "Problema", Icone: Wrench, gravidade: "CRITICO", dica: "Equipamento ou falha" },
  { value: "OUTRO", label: "Outro", Icone: MessageSquareMore, gravidade: "ATENCAO", dica: "Descreva em poucas palavras" },
];

// `fundo`/`texto`: selo cheio (preenchido), com contraste mínimo de 4,5:1 nos dois temas.
export const GRAVIDADES = {
  ATENCAO: { cor: "#F59E0B", fundo: "#F59E0B", texto: "#1F1300", rotulo: "Atenção", Icone: TriangleAlert },
  CRITICO: { cor: "#FF453A", fundo: "#DC2626", texto: "#FFFFFF", rotulo: "Crítico", Icone: OctagonAlert },
};

export const DURACOES_AVISO = [
  { valor: 15, rotulo: "15 min" },
  { valor: 30, rotulo: "30 min" },
  { valor: 60, rotulo: "1 h" },
  { valor: 120, rotulo: "2 h" },
];

export const DURACAO_PADRAO = 30;

// Ícone de cada função manual da esteira (mesmos valores de LABORS_MANUAIS).
export const ICONES_FUNCAO = {
  PESCA: Fish,
  GOL: Target,
  ENDERECAMENTO: MapPin,
  INDUCAO: ArrowDownToLine,
  ABASTECEDOR: PackagePlus,
  MONTAGEM_SCUTTLE: Hammer,
  VOLANTE: Shuffle,
  LOG_II: ClipboardList,
};

export const motivoDe = (motivo) => MOTIVOS_AVISO.find((m) => m.value === motivo) || MOTIVOS_AVISO[MOTIVOS_AVISO.length - 1];

export const rotuloMotivo = (motivo) => motivoDe(motivo).label;

export const gravidadeDe = (aviso) => GRAVIDADES[aviso.severidade] || GRAVIDADES.ATENCAO;

export const corDoAviso = (aviso) => gravidadeDe(aviso).cor;

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

/** Texto único do aviso: "Gol: Lotado" ou "Braço 3A: Falta de material — texto". */
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
