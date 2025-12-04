const express = require("express");
const router = express.Router();
const { registrarPontoCPF } = require("../controllers/ponto.controller");

// ATENÇÃO: ponto não exige login do colaborador
router.post("/registrar", registrarPontoCPF);

module.exports = router;
