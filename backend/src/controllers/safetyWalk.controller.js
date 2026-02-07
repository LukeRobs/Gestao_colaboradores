const { buscarDadosSafetyWalk, sincronizarSafetyWalk } = require('../services/googleSheetsSafetyWalk.service');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * GET /api/safety-walk
 * Buscar dados do Safety Walk com filtros
 */
const getDadosSafetyWalk = async (req, res) => {
  try {
    const { periodo, turno, mes, ano } = req.query;

    console.log('📊 GET /api/safety-walk - Filtros:', { periodo, turno, mes, ano });

    const filtros = { periodo, turno };
    
    // Adicionar mês e ano se fornecidos
    if (mes) filtros.mes = parseInt(mes);
    if (ano) filtros.ano = parseInt(ano);

    const resultado = await buscarDadosSafetyWalk(filtros);

    return successResponse(res, resultado.data, 'Dados do Safety Walk carregados com sucesso');

  } catch (error) {
    console.error('❌ Erro ao buscar dados do Safety Walk:', error);
    return errorResponse(res, 'Erro ao buscar dados do Safety Walk', 500, error.message);
  }
};

/**
 * GET /api/safety-walk/:id
 * Buscar detalhes de uma inspeção específica
 */
const getInspecaoById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('📊 GET /api/safety-walk/:id - ID:', id);

    // Buscar todos os dados e filtrar pelo ID (índice)
    const resultado = await buscarDadosSafetyWalk({});
    const inspecao = resultado.data.registros[parseInt(id)];

    if (!inspecao) {
      return errorResponse(res, 'Inspeção não encontrada', 404);
    }

    return successResponse(res, inspecao, 'Inspeção encontrada');

  } catch (error) {
    console.error('❌ Erro ao buscar inspeção:', error);
    return errorResponse(res, 'Erro ao buscar inspeção', 500, error.message);
  }
};

/**
 * POST /api/safety-walk/sync
 * Sincronizar dados do Google Sheets manualmente
 */
const sincronizarManual = async (req, res) => {
  try {
    console.log('🔄 POST /api/safety-walk/sync - Sincronização manual');

    const resultado = await sincronizarSafetyWalk();

    return successResponse(res, resultado.data, 'Sincronização realizada com sucesso');

  } catch (error) {
    console.error('❌ Erro ao sincronizar Safety Walk:', error);
    return errorResponse(res, 'Erro ao sincronizar dados', 500, error.message);
  }
};

/**
 * GET /api/safety-walk/export
 * Exportar dados do Safety Walk (futuro: gerar Excel)
 */
const exportarDados = async (req, res) => {
  try {
    const { periodo, turno, mes, ano } = req.query;

    console.log('📥 GET /api/safety-walk/export - Filtros:', { periodo, turno, mes, ano });

    const filtros = { periodo, turno };
    
    // Adicionar mês e ano se fornecidos
    if (mes) filtros.mes = parseInt(mes);
    if (ano) filtros.ano = parseInt(ano);

    const resultado = await buscarDadosSafetyWalk(filtros);

    // Por enquanto, retorna JSON
    // Futuramente, pode gerar Excel com biblioteca como 'exceljs'
    return successResponse(res, resultado.data, 'Dados exportados com sucesso');

  } catch (error) {
    console.error('❌ Erro ao exportar dados:', error);
    return errorResponse(res, 'Erro ao exportar dados', 500, error.message);
  }
};

module.exports = {
  getDadosSafetyWalk,
  getInspecaoById,
  sincronizarManual,
  exportarDados,
};
