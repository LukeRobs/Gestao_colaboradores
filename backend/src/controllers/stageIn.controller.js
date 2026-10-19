const { prisma } = require("../config/database");
const { successResponse, errorResponse } = require("../utils/response");
const { MODULO } = require("../services/spxIngest/spxIngest.service");
const stageIn = require("../services/spxIngest/stageIn.service");

/**
 * Stage IN (Inbound Staging Area) da estação do usuário: as ruas vêm do SPX (Tampermonkey), o detalhe por TO vem
 * da planilha "Report Real Time" da estação e o perfil de pacote vem da planilha de perfil (cruzado pelo número da TO).
 * Cada estação vê só a sua: vale o req.dbContext.estacaoId (a do usuário, ou a do seletor de estações irmãs).
 */

const sync = (linha) => (linha ? { ultimoFetchedAt: linha.ultimoFetchedAt === null ? null : Number(linha.ultimoFetchedAt), ultimoRecebimento: linha.ultimoRecebimento } : null);

const obter = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const estacao = await prisma.estacao.findUnique({
      where: { idEstacao },
      select: { idEstacao: true, nomeEstacao: true, spxStationId: true },
    });
    if (!estacao?.spxStationId) {
      return errorResponse(res, "Este módulo não está disponível para a sua estação.", 403);
    }

    const [snapshot, st, relatorio, perfilBruto] = await Promise.all([
      prisma.spxStageInLista.findUnique({ where: { idEstacao } }),
      prisma.spxIngestStatus.findUnique({ where: { idEstacao_modulo: { idEstacao, modulo: MODULO.STAGE_IN } } }),
      stageIn.relatorio(estacao.spxStationId),
      stageIn.perfil(),
    ]);

    // Só as TOs que estão no Report desta estação (a planilha de perfil traz as de todas).
    let perfil = { disponivel: false, erro: perfilBruto.erro };
    if (perfilBruto.disponivel && relatorio.disponivel) {
      const porTo = {};
      Object.values(relatorio.tosPorRua).forEach((tos) =>
        tos.forEach((t) => {
          if (perfilBruto.porTo[t.to]) porTo[t.to] = perfilBruto.porTo[t.to];
        })
      );
      perfil = { disponivel: true, porTo };
    }

    const lista = Array.isArray(snapshot?.payload?.list) ? snapshot.payload.list : [];
    return successResponse(res, {
      estacao: { idEstacao: estacao.idEstacao, nome: estacao.nomeEstacao },
      ruas: lista,
      relatorio,
      perfil,
      sincronizacao: sync(st),
    });
  } catch (err) {
    console.error("❌ Erro ao carregar o Stage IN:", err);
    return errorResponse(res, "Erro ao carregar o Stage IN", 500);
  }
};

module.exports = { obter };
