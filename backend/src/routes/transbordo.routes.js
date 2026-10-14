const express = require("express");
const router = express.Router();
const { listarTransbordo } = require("../controllers/transbordo.controller");
const { adminAltaGestaoLideranca } = require("../utils/roles");

// Cada estação vê só o transbordo da própria estação (ver o controller); a tela é de ADMIN, ALTA_GESTAO e LIDERANCA.
router.get("/", adminAltaGestaoLideranca, listarTransbordo);

module.exports = router;
