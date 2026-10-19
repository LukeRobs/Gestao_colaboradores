const express = require("express");
const router = express.Router();
const { obter } = require("../controllers/stageIn.controller");
const { adminAltaGestaoLideranca } = require("../utils/roles");

// Cada estação vê só o Stage IN da própria estação (ver o controller); a tela é de ADMIN, ALTA_GESTAO e LIDERANCA.
router.get("/", adminAltaGestaoLideranca, obter);

module.exports = router;
