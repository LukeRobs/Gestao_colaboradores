const { buscarDwPlanejado } = require('../services/googleSheetsDW.service');
const { buscarDwPlanejadoCalculadora } = require('../services/googleSheetsCalculadora.service');
const { salvarDwPlanejado, buscarDwPlanejadoBanco } = require('../services/dwPlanejado.service');

const buscarDwPlanejadoAutomatico = async (req, res) => {
  try {
    const { turno, data } = req.body;

    if (!turno || !data) {
      return res.status(400).json({
        success: false,
        message: 'Turno e data são obrigatórios'
      });
    }

    const resultado = await buscarDwPlanejado(turno, data);

    res.json({
      success: true,
      message: 'DW Planejado carregado com sucesso',
      data: resultado.data
    });

  } catch (error) {
    console.error('Erro DW Planejado:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * POST /api/dw/planejado/manual
 * Salvar planejado manual (estações != 1)
 */
const postDwPlanejadoManual = async (req, res) => {
  try {
    const { data, idTurno, idEstacao, quantidade } = req.body;

    if (!data || !idTurno || !idEstacao || quantidade === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: data, idTurno, idEstacao, quantidade'
      });
    }

    if (Number(idEstacao) === 1) {
      return res.status(400).json({
        success: false,
        message: 'Estação 1 usa planejado automático via Sheets'
      });
    }

    const result = await salvarDwPlanejado({
      data,
      idTurno: Number(idTurno),
      idEstacao: Number(idEstacao),
      quantidade: Number(quantidade)
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Erro ao salvar DW Planejado manual:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/dw/planejado/manual?data=&idTurno=&idEstacao=
 * Buscar planejado manual do banco
 */
const getDwPlanejadoManual = async (req, res) => {
  try {
    const { data, idTurno, idEstacao, estacaoId } = req.query;
    const estacao = Number(idEstacao || estacaoId);

    if (!data || !idTurno || !estacao) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: data, idTurno, idEstacao'
      });
    }

    const registro = await buscarDwPlanejadoBanco({
      data,
      idTurno: Number(idTurno),
      idEstacao: estacao
    });

    res.json({ success: true, data: registro });
  } catch (error) {
    console.error('❌ Erro ao buscar DW Planejado manual:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/dw/planejado/calculadora?data=&idTurno=
 * Buscar planejado da estação 1 na aba Calculadora do Sheets
 */
const getDwPlanejadoCalculadora = async (req, res) => {
  try {
    const { data, idTurno } = req.query;

    if (!data || !idTurno) {
      return res.status(400).json({ success: false, message: 'data e idTurno são obrigatórios' });
    }

    const quantidade = await buscarDwPlanejadoCalculadora(data, Number(idTurno));
    res.json({ success: true, data: { quantidade } });
  } catch (error) {
    console.error('❌ Erro ao buscar DW Planejado Calculadora:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  buscarDwPlanejadoAutomatico,
  postDwPlanejadoManual,
  getDwPlanejadoManual,
  getDwPlanejadoCalculadora
};
