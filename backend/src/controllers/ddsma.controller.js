const { buscarDadosDDSMA, sincronizarDDSMA } = require('../services/googleSheetsDDSMA.service');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * GET /api/ddsma
 * Buscar dados do DDSMA com filtros
 */
const getDadosDDSMA = async (req, res) => {
  try {
    const { periodo, turno, semana } = req.query;

    console.log('📊 ===== GET /api/ddsma =====');
    console.log('📊 Filtros recebidos:', { periodo, turno, semana });
    console.log('📊 User:', req.user?.email);

    const filtros = { periodo, turno };
    
    if (semana) filtros.semana = semana;

    console.log('📊 Chamando buscarDadosDDSMA...');
    const resultado = await buscarDadosDDSMA(filtros);
    console.log('📊 Resultado obtido:', {
      totalInspecoes: resultado.data.totalInspecoes,
      realizadas: resultado.data.realizadas,
      pendentes: resultado.data.pendentes,
    });

    return successResponse(res, resultado.data, 'Dados do DDSMA carregados com sucesso');

  } catch (error) {
    console.error('❌ ===== ERRO GET /api/ddsma =====');
    console.error('❌ Mensagem:', error.message);
    console.error('❌ Stack:', error.stack);
    return errorResponse(res, 'Erro ao carregar dados do DDSMA', 500, error.message);
  }
};

/**
 * GET /api/ddsma/:id
 * Buscar detalhes de um registro específico
 */
const getRegistroById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('📊 GET /api/ddsma/:id - ID:', id);

    const resultado = await buscarDadosDDSMA({});
    const registro = resultado.data.registros[parseInt(id)];

    if (!registro) {
      return errorResponse(res, 'Registro não encontrado', 404);
    }

    return successResponse(res, registro, 'Registro encontrado');

  } catch (error) {
    console.error('❌ Erro ao buscar registro:', error);
    return errorResponse(res, 'Erro ao buscar registro', 500, error.message);
  }
};

/**
 * POST /api/ddsma/sync
 * Sincronizar dados do Google Sheets manualmente
 */
const sincronizarManual = async (req, res) => {
  try {
    console.log('🔄 POST /api/ddsma/sync - Sincronização manual');

    const resultado = await sincronizarDDSMA();

    return successResponse(res, resultado.data, 'Sincronização realizada com sucesso');

  } catch (error) {
    console.error('❌ Erro ao sincronizar DDSMA:', error);
    return errorResponse(res, 'Erro ao sincronizar dados', 500, error.message);
  }
};

/**
 * GET /api/ddsma/export
 * Exportar dados do DDSMA
 */
const exportarDados = async (req, res) => {
  try {
    const { periodo, turno, semana } = req.query;

    console.log('📥 GET /api/ddsma/export - Filtros:', { periodo, turno, semana });

    const filtros = { periodo, turno };
    
    if (semana) filtros.semana = semana;

    const resultado = await buscarDadosDDSMA(filtros);

    return successResponse(res, resultado.data, 'Dados exportados com sucesso');

  } catch (error) {
    console.error('❌ Erro ao exportar dados:', error);
    return errorResponse(res, 'Erro ao exportar dados', 500, error.message);
  }
};

module.exports = {
  getDadosDDSMA,
  getRegistroById,
  sincronizarManual,
  exportarDados,
};
