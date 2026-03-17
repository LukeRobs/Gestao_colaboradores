const express = require("express");
const router = express.Router();
const { carregarProdutividadeColaborador, triggerSalvamento } = require("../controllers/produtividadeColaborador.controller");

router.get("/", carregarProdutividadeColaborador);
router.post("/trigger-salvamento", triggerSalvamento);

module.exports = router;