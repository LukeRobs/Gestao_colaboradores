const express = require("express");
const router = express.Router();
const { carregarGestaoOperacional, consultarHistoricoProducao } = require("../controllers/gestaoOperacional.controller");
const { buscarMetasProducao, limparCache } = require("../services/googleSheetsMetaProducao.service");
const { testarSalvamentoManual } = require("../jobs/salvarProducaoHistorico.job");

router.get("/", carregarGestaoOperacional);
router.get("/historico", consultarHistoricoProducao);

// Endpoint para verificar status dos salvamentos
router.get("/status-salvamentos", async (req, res) => {
  try {
    const { verificarStatusSalvamentos } = require("../controllers/gestaoOperacional.controller");
    const resultado = await verificarStatusSalvamentos();
    return res.json(resultado);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Endpoint para salvar manualmente (útil para testes)
router.post("/salvar-historico", async (req, res) => {
  try {
    const { turno } = req.body;
    
    if (!turno || !['T1', 'T2', 'T3'].includes(turno)) {
      return res.status(400).json({
        success: false,
        message: "Turno inválido. Use T1, T2 ou T3"
      });
    }
    
    const resultado = await testarSalvamentoManual(turno);
    
    return res.json(resultado);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Endpoint de teste
router.get("/test", async (req, res) => {
  try {
    const { turno = "T1", data = "2026-03-04" } = req.query;
    const result = await buscarMetasProducao(turno, data);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;

// Endpoint para limpar cache
router.post("/limpar-cache", (req, res) => {
  limparCache();
  res.json({ success: true, message: "Cache limpo com sucesso" });
});
