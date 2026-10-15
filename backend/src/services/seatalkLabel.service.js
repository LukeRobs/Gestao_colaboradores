const { prisma } = require("../config/database");
const { sendTextToGroup } = require("./seatalk.service");
const { partesSP, getTurnoOperacionalAtual } = require("../utils/turnoMapaOperacional");

// Grupo que recebe o report das ocorrências da Label. Provisório (teste): trocar só pela env, sem mexer no código.
const GRUPO_PADRAO = "NTQ1MzI3OTM3MTAz";

// Quem é marcado (@) no report de ocorrência nova. O Seatalk marca pelo e-mail corporativo.
const MARCAR_POR_TURNO = {
  T1: [
    { nome: "Diego Alves", email: "diego.alves@shopee.com" },
    { nome: "Pollyana Araújo", email: "pollyana.araujo@shopee.com" },
  ],
  T2: [
    { nome: "Rhayanne Silva", email: "rhayanne.kedma@shopee.com" },
    { nome: "Laudenor Junior", email: "laudenor.junior@shopee.com" },
  ],
  T3: [
    { nome: "Alex Santos", email: "alex.santossilva@shopee.com" },
    { nome: "Alexandro Silva", email: "alexandro.silva@shopee.com" },
  ],
};

// Ocorrência CRÍTICA marca estes também, em qualquer turno.
const MARCAR_SE_CRITICO = [
  { nome: "Thaian Braga", email: "thaian.braga@shopee.com" },
  { nome: "Gustavo Motta", email: "gustavo.motta@shopee.com" },
];

const MOTIVOS = {
  LOTADO: "Lotado",
  PARADO: "Parado",
  FALTA_PESSOAL: "Falta de pessoal",
  FALTA_MATERIAL: "Falta de material",
  PROBLEMA: "Problema",
  OUTRO: "Outro",
};

const LABORS = {
  PESCA: "Pesca",
  GOL: "Gol",
  ENDERECAMENTO: "Endereçamento",
  INDUCAO: "Indução",
  ABASTECEDOR: "Abastecedor",
  MONTAGEM_SCUTTLE: "Montagem Scuttle",
  VOLANTE: "Volante",
  LOG_II: "Log II",
};

const pad2 = (n) => String(n).padStart(2, "0");

function horaSP(data) {
  const p = partesSP(data);
  return `${pad2(p.dia)}/${pad2(p.mes)}/${p.ano} ${pad2(p.hora)}:${pad2(p.minuto)}`;
}

function duracaoTexto(minutos) {
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)} h ${pad2(minutos % 60)} min`;
}

function rotuloAlvo(aviso, esteiraNome) {
  if (aviso.alvoTipo === "DOCA") return `Doca ${aviso.numeroDoca}`;
  const onde = esteiraNome ? `${esteiraNome} · ` : "";
  if (aviso.alvoTipo === "BRACO") return `${onde}Braço ${aviso.braco}${aviso.lado}`;
  return `${onde}${LABORS[aviso.labor] || aviso.labor}`;
}

/** Quem marcar (sem repetir e-mail) conforme o turno em que a ocorrência foi sinalizada e a gravidade. */
function quemMarcar(aviso) {
  const { turno } = getTurnoOperacionalAtual(new Date(aviso.criadoEm));
  const pessoas = [...(MARCAR_POR_TURNO[turno] || []), ...(aviso.severidade === "CRITICO" ? MARCAR_SE_CRITICO : [])];
  return [...new Map(pessoas.map((p) => [p.email, p])).values()];
}

function linhasOcorrencia(aviso, { esteiraNome, estacaoNome }) {
  const linhas = [
    `**Estação:** ${estacaoNome || aviso.idEstacao}`,
    `**Local:** ${rotuloAlvo(aviso, esteiraNome)}`,
    `**Ocorrência:** ${MOTIVOS[aviso.motivo] || aviso.motivo}`,
  ];
  if (aviso.texto) linhas.push(`**Descrição:** ${aviso.texto}`);
  if (aviso.nomePessoa) linhas.push(`**Pessoa:** ${aviso.nomePessoa}${aviso.opsId ? ` (${aviso.opsId})` : ""}`);
  return linhas;
}

/** Texto (markdown do Seatalk) do report de ocorrência nova. */
function montarTexto(aviso, contexto) {
  const critico = aviso.severidade === "CRITICO";
  const duracaoMin = Math.max(1, Math.round((new Date(aviso.expiraEm) - new Date(aviso.criadoEm)) / 60000));
  const { turno } = getTurnoOperacionalAtual(new Date(aviso.criadoEm));
  const marcados = quemMarcar(aviso);

  const linhas = [
    `${critico ? "🔴" : "🟠"} **Ocorrência na Label — ${critico ? "CRÍTICO" : "ATENÇÃO"}**`,
    "",
    ...linhasOcorrencia(aviso, contexto),
    `**Turno:** ${turno}`,
    `**Sinalizado por:** ${aviso.criadoPorNome || "—"}`,
    `**Horário:** ${horaSP(aviso.criadoEm)}`,
    `**Fica no mapa por:** ${duracaoTexto(duracaoMin)}`,
  ];
  // Em markdown o Seatalk só marca (@) quando a tag está no próprio texto; a lista de e-mails sozinha não funciona.
  if (marcados.length > 0) {
    linhas.push("", marcados.map((p) => `<mention-tag target="seatalk://user?email=${p.email}"/>`).join(" "));
  }
  return linhas.join("\n");
}

/** Texto do report de ocorrência resolvida. */
function montarTextoResolvido(aviso, contexto) {
  const inicio = new Date(aviso.criadoEm);
  const fim = new Date(aviso.encerradoEm);
  const duracaoMin = Math.max(1, Math.round((fim - inicio) / 60000));

  return [
    "✅ **Ocorrência na Label — RESOLVIDA**",
    "",
    ...linhasOcorrencia(aviso, contexto),
    `**Sinalizado por:** ${aviso.criadoPorNome || "—"} às ${horaSP(inicio)}`,
    `**Resolvido por:** ${aviso.encerradoPorNome || "—"} às ${horaSP(fim)}`,
    `**Tempo da ocorrência:** ${duracaoTexto(duracaoMin)}`,
  ].join("\n");
}

async function carregarContexto(aviso) {
  const [esteira, estacao] = await Promise.all([
    aviso.idEsteira ? prisma.mapaEsteira.findUnique({ where: { idEsteira: aviso.idEsteira }, select: { nome: true } }) : null,
    prisma.estacao.findUnique({ where: { idEstacao: aviso.idEstacao }, select: { nomeEstacao: true } }),
  ]);
  return { esteiraNome: esteira?.nome, estacaoNome: estacao?.nomeEstacao };
}

const grupoLabel = () => process.env.SEATALK_LABEL_GROUP_ID || GRUPO_PADRAO;

/**
 * Envia o report da ocorrência nova ao grupo do Seatalk, marcando as pessoas do turno (e a gestão se for
 * crítica). Best-effort: nunca derruba a criação do aviso (quem chama não espera; aqui só loga).
 */
async function notificarAvisoLabel(aviso) {
  try {
    const texto = montarTexto(aviso, await carregarContexto(aviso));
    await sendTextToGroup(grupoLabel(), texto);
  } catch (err) {
    console.error("⚠️ [SEATALK-LABEL] Falha ao enviar report da ocorrência:", err.response?.data || err.message);
  }
}

/** Report de ocorrência resolvida (sem marcar ninguém). `aviso` já com encerradoEm/encerradoPorNome. */
async function notificarAvisoResolvido(aviso) {
  try {
    const texto = montarTextoResolvido(aviso, await carregarContexto(aviso));
    await sendTextToGroup(grupoLabel(), texto);
  } catch (err) {
    console.error("⚠️ [SEATALK-LABEL] Falha ao enviar report de ocorrência resolvida:", err.response?.data || err.message);
  }
}

module.exports = { notificarAvisoLabel, notificarAvisoResolvido, montarTexto, montarTextoResolvido, quemMarcar };
