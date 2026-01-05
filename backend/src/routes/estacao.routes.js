const express = require("express");
const router = express.Router();

const {
  listarEstacoes,
  criarEstacao,
  atualizarEstacao,
} = require("../controllers/estacao.controller");

router.get("/", listarEstacoes);
router.post("/", criarEstacao);
router.put("/:idEstacao", atualizarEstacao);

module.exports = router;
