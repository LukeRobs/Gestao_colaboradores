const { prisma } = require("../config/database");
const { successResponse, errorResponse } = require("../utils/response");
const { getTurnoOperacionalAtual, instanteSP, partesSP } = require("../utils/turnoMapaOperacional");

/**
 * Transbordo (TOs com cd_flag) da estação do usuário. Cada estação enxerga só os dados da própria
 * estação: vale o req.dbContext.estacaoId (a do usuário, ou a do seletor de estações irmãs). Admin sem
 * estação selecionada cai na estação 1, como na Label. O dia operacional (06:00 a 05:59) e o turno são
 * calculados aqui, em horário de Brasília, e não dependem do fuso do navegador.
 */

const turnoDaHora = (h) => (h >= 6 && h < 14 ? "T1" : h >= 14 && h < 22 ? "T2" : "T3");

function janelaDoDia(diaStr) {
  const [y, m, d] = diaStr.split("-").map(Number);
  return {
    inicio: instanteSP(y, m, d, 6),
    fim: instanteSP(y, m, d + 1, 6),
    inicioAnterior: instanteSP(y, m, d - 1, 6),
  };
}

const listarTransbordo = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const estacao = await prisma.estacao.findUnique({
      where: { idEstacao },
      select: { idEstacao: true, nomeEstacao: true, spxStationId: true },
    });
    if (!estacao?.spxStationId) {
      return errorResponse(res, "Este módulo não está disponível para a sua estação.", 403);
    }

    const atual = getTurnoOperacionalAtual();
    const dia = /^\d{4}-\d{2}-\d{2}$/.test(req.query.data || "") ? req.query.data : atual.diaOperacionalStr;
    const { inicio, fim, inicioAnterior } = janelaDoDia(dia);

    const [linhas, contagemAnterior, status] = await Promise.all([
      prisma.spxTransbordoCd.findMany({
        where: { idEstacao, unloadedAt: { gte: inicio, lt: fim } },
        orderBy: { unloadedAt: "desc" },
      }),
      prisma.spxTransbordoCd.count({ where: { idEstacao, unloadedAt: { gte: inicioAnterior, lt: inicio } } }),
      prisma.spxIngestStatus.findUnique({ where: { idEstacao_modulo: { idEstacao, modulo: "TRANSBORDO" } } }),
    ]);

    const lista = linhas.map((l) => {
      const p = l.unloadedAt ? partesSP(l.unloadedAt) : null;
      return {
        toNumber: l.toNumber,
        packTypeName: l.packTypeName,
        parcels: l.parcels,
        weightG: l.weightG,
        loadedStationName: l.loadedStationName,
        unloadedStationName: l.unloadedStationName,
        dockNumber: l.dockNumber,
        operator: l.operator,
        tripNumber: l.tripNumber,
        vehicleNumber: l.vehicleNumber,
        driverName: l.driverName,
        abnormalLabels: l.abnormalLabels,
        scanEm: l.unloadedAt ? l.unloadedAt.toISOString() : null,
        hora: p ? p.hora : null,
        minuto: p ? p.minuto : null,
        turno: p ? turnoDaHora(p.hora) : null,
      };
    });

    return successResponse(res, {
      estacao: { idEstacao: estacao.idEstacao, nome: estacao.nomeEstacao },
      dia,
      diaOperacionalAtual: atual.diaOperacionalStr,
      lista,
      contagemDiaAnterior: contagemAnterior,
      sincronizacao: status
        ? { ultimoFetchedAt: status.ultimoFetchedAt === null ? null : Number(status.ultimoFetchedAt), ultimoRecebimento: status.ultimoRecebimento }
        : null,
    });
  } catch (err) {
    console.error("❌ Erro ao listar transbordo:", err);
    return errorResponse(res, "Erro ao carregar o transbordo", 500);
  }
};

module.exports = { listarTransbordo };
