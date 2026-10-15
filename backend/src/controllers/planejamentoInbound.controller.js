const { prisma } = require("../config/database");
const { successResponse, errorResponse, notFoundResponse } = require("../utils/response");
const { ESTACOES, obterViagem } = require("../services/planejamentoInbound/viagens.service");
const planejamento = require("../services/planejamentoInbound/previsao.service");

/**
 * Planning Inbound (viagens, previsão de recebimento e mapa da frota), vindo da planilha de monitoramento.
 * Cada estação vê só as suas viagens: vale o req.dbContext.estacaoId (a do usuário ou a do seletor de estações
 * irmãs) e a planilha só tem as estações mapeadas em ESTACOES (hoje Jaboatão e Recife 04).
 */

async function estacaoDaRequisicao(req) {
  const idEstacao = req.dbContext?.estacaoId ?? 1;
  const estacao = await prisma.estacao.findUnique({ where: { idEstacao }, select: { spxStationId: true } });
  return estacao?.spxStationId && ESTACOES[estacao.spxStationId] ? estacao.spxStationId : null;
}

const SEM_ESTACAO = "Este módulo não está disponível para a sua estação.";

function rota(nomeErro, fn) {
  return async (req, res) => {
    try {
      const spx = await estacaoDaRequisicao(req);
      if (!spx) return errorResponse(res, SEM_ESTACAO, 403);
      return await fn(req, res, spx);
    } catch (err) {
      console.error(`❌ [PLANNING-INBOUND] ${nomeErro}:`, err.message);
      const semAcesso = err.code === 403 || /permission|PERMISSION_DENIED/i.test(err.message || "");
      return errorResponse(res, semAcesso ? "Sem acesso à planilha do Planning Inbound." : `Erro ao carregar ${nomeErro}`, 500);
    }
  };
}

exports.previsao = rota("a previsão de recebimento", async (req, res, spx) => successResponse(res, await planejamento.previsao(spx, req.query.data, req.query.turno)));

exports.viagens = rota("as viagens", async (req, res, spx) => successResponse(res, await planejamento.viagensDoPeriodo(spx, req.query.de, req.query.ate)));

exports.viagem = rota("a viagem", async (req, res, spx) => {
  const d = await obterViagem(spx, String(req.params.lh));
  return d ? successResponse(res, d) : notFoundResponse(res, "Viagem não encontrada");
});

exports.mapa = rota("o mapa da frota", async (req, res, spx) => successResponse(res, await planejamento.mapa(spx)));
