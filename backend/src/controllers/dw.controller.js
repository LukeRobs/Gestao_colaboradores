const { buscarDwPlanejado } = require('../services/googleSheetsDW.service');

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

module.exports = {
  buscarDwPlanejadoAutomatico
};
