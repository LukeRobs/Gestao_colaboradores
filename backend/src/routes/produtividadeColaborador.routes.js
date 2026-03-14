const express = require("express");
const router = express.Router();
const { carregarProdutividadeColaborador } = require("../controllers/produtividadeColaborador.controller");

router.get("/", carregarProdutividadeColaborador);

module.exports = router;