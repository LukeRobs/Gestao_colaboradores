const { prisma } = require("../config/database");
const { successResponse, errorResponse } = require("../utils/response");
const { MODULO } = require("../services/spxIngest/spxIngest.service");
const { juntar } = require("../services/spxIngest/filaRecebimento.service");
const veiculosRecebidos = require("../services/spxIngest/veiculosRecebidos.service");

/**
 * Fila de veículos (Queue List) da estação do usuário: junta as viagens ao vivo e a fila do pátio (ver
 * filaRecebimento.service). Cada estação vê só a sua: vale o req.dbContext.estacaoId (a do usuário, ou a do
 * seletor de estações irmãs).
 */

const sync = (linha) => (linha ? { ultimoFetchedAt: linha.ultimoFetchedAt === null ? null : Number(linha.ultimoFetchedAt), ultimoRecebimento: linha.ultimoRecebimento } : null);

const listarFila = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const estacao = await prisma.estacao.findUnique({
      where: { idEstacao },
      select: { idEstacao: true, nomeEstacao: true, spxStationId: true },
    });
    if (!estacao?.spxStationId) {
      return errorResponse(res, "Este módulo não está disponível para a sua estação.", 403);
    }

    const [viagens, fila, stFila, stViagens] = await Promise.all([
      prisma.spxTripLista.findUnique({ where: { idEstacao } }),
      prisma.spxQueueLista.findUnique({ where: { idEstacao } }),
      prisma.spxIngestStatus.findUnique({ where: { idEstacao_modulo: { idEstacao, modulo: MODULO.QUEUE_LIST } } }),
      prisma.spxIngestStatus.findUnique({ where: { idEstacao_modulo: { idEstacao, modulo: MODULO.TRIP_LIST } } }),
    ]);

    const listaViagens = Array.isArray(viagens?.payload?.list) ? viagens.payload.list : [];
    const listaFila = Array.isArray(fila?.payload?.list) ? fila.payload.list : [];

    return successResponse(res, {
      estacao: { idEstacao: estacao.idEstacao, nome: estacao.nomeEstacao },
      itens: juntar(listaViagens, listaFila),
      sincronizacao: { fila: sync(stFila), viagens: sync(stViagens) },
    });
  } catch (err) {
    console.error("❌ Erro ao listar fila de recebimento:", err);
    return errorResponse(res, "Erro ao carregar a fila", 500);
  }
};

/** GET /fila-recebimento/recebidos?data=YYYY-MM-DD — veículos que já finalizaram, no dia operacional (06:00 às 05:59). */
const listarRecebidos = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const estacao = await prisma.estacao.findUnique({
      where: { idEstacao },
      select: { idEstacao: true, nomeEstacao: true, spxStationId: true },
    });
    if (!estacao?.spxStationId) {
      return errorResponse(res, "Este módulo não está disponível para a sua estação.", 403);
    }
    const [dados, stFila, stHistorico] = await Promise.all([
      veiculosRecebidos.listar(idEstacao, req.query.data),
      prisma.spxIngestStatus.findUnique({ where: { idEstacao_modulo: { idEstacao, modulo: MODULO.QUEUE_LIST } } }),
      prisma.spxIngestStatus.findUnique({ where: { idEstacao_modulo: { idEstacao, modulo: MODULO.TRIP_HISTORY } } }),
    ]);
    return successResponse(res, {
      estacao: { idEstacao: estacao.idEstacao, nome: estacao.nomeEstacao },
      ...dados,
      sincronizacao: { fila: sync(stFila), historico: sync(stHistorico) },
    });
  } catch (err) {
    console.error("❌ Erro ao listar veículos recebidos:", err);
    return errorResponse(res, "Erro ao carregar os veículos recebidos", 500);
  }
};

module.exports = { listarFila, listarRecebidos };
