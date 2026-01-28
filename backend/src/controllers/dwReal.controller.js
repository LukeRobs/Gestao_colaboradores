const {
  salvarDwReal,
  listarDwRealPorTurno
} = require('../services/dwReal.service');

/**
 * POST /api/dw/real
 * Criar ou atualizar DW Real
 */
const postDwReal = async (req, res) => {
  try {
    const { data, idTurno, idEmpresa, quantidade, observacao } = req.body;

    if (!data || !idTurno || !idEmpresa || quantidade === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: data, idTurno, idEmpresa, quantidade'
      });
    }

    const result = await salvarDwReal({
      data,
      idTurno: Number(idTurno),
      idEmpresa: Number(idEmpresa),
      quantidade: Number(quantidade),
      observacao: observacao || null
    });

    res.json({
      success: true,
      message: 'DW Real salvo com sucesso',
      data: result
    });

  } catch (error) {
    console.error('❌ Erro ao salvar DW Real:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao salvar DW Real'
    });
  }
};

/**
 * GET /api/dw/real
 * Listar DW Real por data + turno
 */
const getDwReal = async (req, res) => {
  try {
    const { data, idTurno } = req.query;

    if (!data || !idTurno) {
      return res.status(400).json({
        success: false,
        message: 'data e idTurno são obrigatórios'
      });
    }

    const registros = await listarDwRealPorTurno({
      data,
      idTurno: Number(idTurno)
    });

    res.json({
      success: true,
      data: registros
    });

  } catch (error) {
    console.error('❌ Erro ao buscar DW Real:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar DW Real'
    });
  }
};

module.exports = {
  postDwReal,
  getDwReal
};
