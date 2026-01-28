const { buscarDwLista } = require("../services/dwLista.service");

const getDwLista = async (req, res) => {
  try {
    const { data, idTurno, idEmpresa } = req.query;

    const lista = await buscarDwLista({
      data,
      idTurno,
      idEmpresa
    });

    res.json({
      success: true,
      data: lista
    });

  } catch (error) {
    console.error("❌ Erro ao buscar lista DW:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar lista de DW"
    });
  }
};

module.exports = {
  getDwLista
};
