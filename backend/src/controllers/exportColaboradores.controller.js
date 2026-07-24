const { prisma } = require("../config/database");
const { executarExport } = require("../jobs/exportColaboradores.job");
const { successResponse, errorResponse } = require("../utils/response");

const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${
  process.env.SHEETS_COLABORADORES_SPREADSHEET_ID || "1KV1aZh5k2moYIaUQRWPguf1hjB2nJT44sybzkk0Ki7U"
}`;

const getStatus = async (req, res) => {
  try {
    const config = await prisma.exportColaboradoresConfig.findUnique({ where: { id: 1 } });

    return successResponse(res, {
      ultimaExecucao: config?.ultimaExecucao ?? null,
      proximaExecucao: config?.proximaExecucao ?? null,
      status: config?.status ?? null,
      totalRegistros: config?.totalRegistros ?? null,
      spreadsheetUrl: SPREADSHEET_URL,
    });
  } catch (error) {
    return errorResponse(res, "Erro ao buscar status da exportação", 500);
  }
};

const exportarAgora = async (req, res) => {
  try {
    const resultado = await executarExport();
    return successResponse(res, resultado.data, "Exportação concluída com sucesso");
  } catch (error) {
    return errorResponse(res, error.message || "Erro ao exportar colaboradores", 500);
  }
};

module.exports = {
  getStatus,
  exportarAgora,
};
