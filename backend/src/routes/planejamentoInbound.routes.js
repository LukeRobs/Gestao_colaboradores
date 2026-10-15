const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/planejamentoInbound.controller");
const { adminAltaGestaoLideranca } = require("../utils/roles");

// Viagens, previsão e mapa: ADMIN, ALTA_GESTAO e LIDERANCA, só da estação do usuário (ver o controller).
router.get("/previsao", adminAltaGestaoLideranca, ctrl.previsao);
router.get("/viagens", adminAltaGestaoLideranca, ctrl.viagens);
router.get("/viagens/:lh", adminAltaGestaoLideranca, ctrl.viagem);
router.get("/mapa", adminAltaGestaoLideranca, ctrl.mapa);

module.exports = router;
