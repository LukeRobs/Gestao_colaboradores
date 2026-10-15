const { prisma } = require("../config/database");
const { successResponse, errorResponse, notFoundResponse } = require("../utils/response");
const { notificarAvisoLabel, notificarAvisoResolvido } = require("../services/seatalkLabel.service");

/* =====================================================
   AVISOS DA LABEL (estilo Waze)
   O líder sinaliza uma ocorrência (gol lotado, braço hiperlotado, doca com problema...) e
   todos que veem a Label enxergam o aviso. Ele some sozinho em `expiraEm` ou quando alguém
   encerra. Sinalizar de novo o mesmo alvo e motivo só renova o prazo ("continua aí").
===================================================== */

const MOTIVOS = ["LOTADO", "PARADO", "FALTA_PESSOAL", "FALTA_MATERIAL", "PROBLEMA", "OUTRO"];
const SEVERIDADES = ["ATENCAO", "CRITICO"];
// Mesmas funções manuais da esteira (sem braço) — ver LABORS_MANUAIS_SEM_BRACO no mapaOperacional.controller.
const LABORS = ["PESCA", "GOL", "ENDERECAMENTO", "INDUCAO", "ABASTECEDOR", "MONTAGEM_SCUTTLE", "VOLANTE", "LOG_II"];
const DURACAO_PADRAO_MIN = 30;
const DURACAO_MIN = 5;
const DURACAO_MAX = 240;
const TEXTO_MAX = 200;

const ativos = (idEstacao) => ({ idEstacao, encerradoEm: null, expiraEm: { gt: new Date() } });

function formatar(a) {
  return {
    idAviso: a.idAviso,
    alvoTipo: a.alvoTipo,
    idEsteira: a.idEsteira,
    braco: a.braco,
    lado: a.lado,
    labor: a.labor,
    numeroDoca: a.numeroDoca,
    motivo: a.motivo,
    severidade: a.severidade,
    texto: a.texto,
    opsId: a.opsId,
    nomePessoa: a.nomePessoa,
    criadoPorNome: a.criadoPorNome,
    criadoEm: a.criadoEm,
    expiraEm: a.expiraEm,
  };
}

/** GET /avisos — todos os avisos ativos da estação (esteiras e docas). */
const listarAvisos = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const avisos = await prisma.mapaAviso.findMany({
      where: ativos(idEstacao),
      orderBy: [{ criadoEm: "desc" }],
    });
    return successResponse(res, avisos.map(formatar));
  } catch (err) {
    console.error("❌ Erro ao listar avisos:", err);
    return errorResponse(res, "Erro ao listar avisos", 500);
  }
};

/** Valida o alvo e devolve os campos que identificam o alvo (ou { erro }). */
async function resolverAlvo(idEstacao, corpo) {
  const alvoTipo = String(corpo.alvoTipo || "").toUpperCase();

  if (alvoTipo === "DOCA") {
    const numeroDoca = Number(corpo.numeroDoca);
    if (!Number.isInteger(numeroDoca) || numeroDoca < 1 || numeroDoca > 999) return { erro: "Doca inválida." };
    return { alvo: { alvoTipo, numeroDoca, idEsteira: null, braco: null, lado: null, labor: null } };
  }

  if (alvoTipo !== "BRACO" && alvoTipo !== "FUNCAO") return { erro: "Informe onde é a ocorrência (braço, função ou doca)." };

  const idEsteira = Number(corpo.idEsteira);
  if (!Number.isInteger(idEsteira)) return { erro: "Informe a esteira." };
  const esteira = await prisma.mapaEsteira.findFirst({ where: { idEsteira, idEstacao, ativo: true } });
  if (!esteira) return { erro: "Esteira não encontrada.", status: 404 };

  if (alvoTipo === "FUNCAO") {
    const labor = String(corpo.labor || "").toUpperCase();
    if (!LABORS.includes(labor)) return { erro: "Função inválida." };
    return { alvo: { alvoTipo, idEsteira, labor, braco: null, lado: null, numeroDoca: null } };
  }

  const braco = Number(corpo.braco);
  const lado = String(corpo.lado || "").toUpperCase();
  if (!Number.isInteger(braco) || !["A", "B"].includes(lado)) return { erro: "Braço ou lado inválido." };
  const existe = await prisma.mapaEsteiraBraco.findFirst({ where: { idEsteira, numero: braco, lado, habilitado: true } });
  if (!existe) return { erro: "Braço não encontrado nesta esteira.", status: 404 };
  return { alvo: { alvoTipo, idEsteira, braco, lado, labor: null, numeroDoca: null } };
}

/** POST /avisos */
const criarAviso = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const motivo = String(req.body.motivo || "").toUpperCase();
    const severidade = String(req.body.severidade || "ATENCAO").toUpperCase();
    const texto = String(req.body.texto || "").trim().slice(0, TEXTO_MAX) || null;
    const duracao = Math.min(DURACAO_MAX, Math.max(DURACAO_MIN, Number(req.body.duracaoMin) || DURACAO_PADRAO_MIN));
    const opsId = String(req.body.opsId || "").trim().slice(0, 50) || null;
    const nomePessoa = opsId ? String(req.body.nomePessoa || "").trim().slice(0, 120) || null : null;

    if (!MOTIVOS.includes(motivo)) return errorResponse(res, "Informe o que está acontecendo.", 400);
    if (!SEVERIDADES.includes(severidade)) return errorResponse(res, "Gravidade inválida.", 400);
    if (motivo === "OUTRO" && !texto) return errorResponse(res, "Descreva a ocorrência.", 400);

    const { alvo, erro, status } = await resolverAlvo(idEstacao, req.body);
    if (erro) return status === 404 ? notFoundResponse(res, erro) : errorResponse(res, erro, 400);

    const expiraEm = new Date(Date.now() + duracao * 60 * 1000);

    // Mesmo alvo e mesmo motivo já ativos: só renova (e atualiza gravidade/texto), sem duplicar o aviso.
    const existente = await prisma.mapaAviso.findFirst({
      where: { ...ativos(idEstacao), ...alvo, motivo, opsId },
    });
    if (existente) {
      const atualizado = await prisma.mapaAviso.update({
        where: { idAviso: existente.idAviso },
        data: { expiraEm, severidade, texto: texto ?? existente.texto },
      });
      return successResponse(res, { ...formatar(atualizado), renovado: true }, "Aviso renovado");
    }

    const criado = await prisma.mapaAviso.create({
      data: {
        idEstacao,
        ...alvo,
        motivo,
        severidade,
        texto,
        opsId,
        nomePessoa,
        criadoPorId: req.user?.id ?? null,
        criadoPorNome: req.user?.name ?? null,
        expiraEm,
      },
    });
    // Report no grupo do Seatalk só na ocorrência nova (renovar "ainda acontece" não repete). Não espera: se falhar, só loga.
    notificarAvisoLabel(criado);
    return successResponse(res, { ...formatar(criado), renovado: false }, "Aviso criado", 201);
  } catch (err) {
    console.error("❌ Erro ao criar aviso:", err);
    return errorResponse(res, "Erro ao criar aviso", 500);
  }
};

/** DELETE /avisos/:idAviso — encerra (resolvido). O registro fica, só deixa de aparecer. */
const encerrarAviso = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const aviso = await prisma.mapaAviso.findFirst({ where: { idAviso: req.params.idAviso, idEstacao } });
    if (!aviso) return notFoundResponse(res, "Aviso não encontrado");
    if (aviso.encerradoEm) return successResponse(res, null, "Aviso já estava encerrado");
    const encerrado = await prisma.mapaAviso.update({
      where: { idAviso: aviso.idAviso },
      data: { encerradoEm: new Date(), encerradoPorId: req.user?.id ?? null, encerradoPorNome: req.user?.name ?? null },
    });
    // Avisa o grupo que foi resolvido (só se ainda estava valendo: um aviso que já expirou sozinho não "resolve" nada).
    if (aviso.expiraEm > new Date()) notificarAvisoResolvido(encerrado);
    return successResponse(res, null, "Aviso encerrado");
  } catch (err) {
    console.error("❌ Erro ao encerrar aviso:", err);
    return errorResponse(res, "Erro ao encerrar aviso", 500);
  }
};

module.exports = { listarAvisos, criarAviso, encerrarAviso, MOTIVOS, SEVERIDADES, LABORS };
