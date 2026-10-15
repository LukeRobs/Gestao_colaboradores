const express = require("express");
const router = express.Router();
const { listarFila, listarRecebidos } = require("../controllers/filaRecebimento.controller");
const { adminAltaGestaoLideranca } = require("../utils/roles");

// Cada estação vê só a fila da própria estação (ver o controller); a tela é de ADMIN, ALTA_GESTAO e LIDERANCA.
router.get("/", adminAltaGestaoLideranca, listarFila);
router.get("/recebidos", adminAltaGestaoLideranca, listarRecebidos);

module.exports = router;
