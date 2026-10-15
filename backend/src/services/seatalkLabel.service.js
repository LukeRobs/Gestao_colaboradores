const { prisma } = require("../config/database");
const { sendTextToGroup } = require("./seatalk.service");
const { partesSP, getTurnoOperacionalAtual } = require("../utils/turnoMapaOperacional");

// Grupo que recebe o report das ocorrências da Label. Provisório (teste): trocar só pela env, sem mexer no código.
const GRUPO_PADRAO = "NTQ1MzI3OTM3MTAz";

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

function rotuloAlvo(aviso, esteiraNome) {
  if (aviso.alvoTipo === "DOCA") return `Doca ${aviso.numeroDoca}`;
  const onde = esteiraNome ? `${esteiraNome} · ` : "";
  if (aviso.alvoTipo === "BRACO") return `${onde}Braço ${aviso.braco}${aviso.lado}`;
  return `${onde}${LABORS[aviso.labor] || aviso.labor}`;
}

/** Monta o texto (markdown do Seatalk) do report de uma ocorrência. */
function montarTexto(aviso, { esteiraNome, estacaoNome }) {
  const critico = aviso.severidade === "CRITICO";
  const duracaoMin = Math.max(1, Math.round((new Date(aviso.expiraEm) - new Date(aviso.criadoEm)) / 60000));
  const { turno } = getTurnoOperacionalAtual(new Date(aviso.criadoEm));

  const linhas = [
    `${critico ? "🔴" : "🟠"} **Ocorrência na Label — ${critico ? "CRÍTICO" : "ATENÇÃO"}**`,
    "",
    `**Estação:** ${estacaoNome || aviso.idEstacao}`,
    `**Local:** ${rotuloAlvo(aviso, esteiraNome)}`,
    `**Ocorrência:** ${MOTIVOS[aviso.motivo] || aviso.motivo}`,
  ];
  if (aviso.texto) linhas.push(`**Descrição:** ${aviso.texto}`);
  if (aviso.nomePessoa) linhas.push(`**Pessoa:** ${aviso.nomePessoa}${aviso.opsId ? ` (${aviso.opsId})` : ""}`);
  linhas.push(
    `**Turno:** ${turno}`,
    `**Sinalizado por:** ${aviso.criadoPorNome || "—"}`,
    `**Horário:** ${horaSP(aviso.criadoEm)}`,
    `**Fica no mapa por:** ${duracaoMin} min`
  );
  return linhas.join("\n");
}

/**
 * Envia o report da ocorrência ao grupo do Seatalk. Best-effort: nunca derruba a criação do aviso
 * (quem chama não deve esperar nem tratar erro; aqui só loga).
 */
async function notificarAvisoLabel(aviso) {
  try {
    const groupId = process.env.SEATALK_LABEL_GROUP_ID || GRUPO_PADRAO;

    const [esteira, estacao] = await Promise.all([
      aviso.idEsteira ? prisma.mapaEsteira.findUnique({ where: { idEsteira: aviso.idEsteira }, select: { nome: true } }) : null,
      prisma.estacao.findUnique({ where: { idEstacao: aviso.idEstacao }, select: { nomeEstacao: true } }),
    ]);

    const texto = montarTexto(aviso, { esteiraNome: esteira?.nome, estacaoNome: estacao?.nomeEstacao });
    await sendTextToGroup(groupId, texto);
  } catch (err) {
    console.error("⚠️ [SEATALK-LABEL] Falha ao enviar report da ocorrência:", err.response?.data || err.message);
  }
}

module.exports = { notificarAvisoLabel, montarTexto };
