const express = require("express");
const router = express.Router();

const {
  registrarPontoCPF,
  getControlePresenca,
  ajusteManualPresenca,
  exportarPresencaSheets,
} = require("../controllers/ponto.controller");

// colaborador
router.post("/registrar", registrarPontoCPF);

// gestão
router.get("/controle", getControlePresenca);
router.post("/ajuste-manual", ajusteManualPresenca);
router.get("/exportar-sheets", exportarPresencaSheets); // Mudado para GET

module.exports = router;
