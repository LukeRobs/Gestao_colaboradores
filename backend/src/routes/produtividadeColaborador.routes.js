const express = require("express");
const router = express.Router();
const { carregarProdutividadeColaborador, triggerSalvamento } = require("../controllers/produtividadeColaborador.controller");
const { adminAltaGestaoLideranca } = require("../utils/roles");
const onlyEstacao = require("../middlewares/onlyEstacao");

// Exclusivo estação 1 — ADMIN global passa direto
router.use(adminAltaGestaoLideranca, onlyEstacao([1]));

router.get("/", carregarProdutividadeColaborador);
router.post("/trigger-salvamento", triggerSalvamento);

module.exports = router;