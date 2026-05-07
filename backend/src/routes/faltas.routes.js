const express = require("express");
const router = express.Router();
const { withCache, TTL } = require("../middlewares/cache.middleware");

const {
  getResumoFaltas,
  getDistribuicoesFaltas,
  getTendenciaFaltas,
  getColaboradoresFaltas,
} = require("../controllers/faltas.controller");

/* ===============================
   DASHBOARD • FALTAS
================================ */

router.get("/resumo",        withCache("faltas-resumo",        TTL.REPORT),    getResumoFaltas);
router.get("/distribuicoes", withCache("faltas-distribuicoes", TTL.REPORT),    getDistribuicoesFaltas);
router.get("/tendencia",     withCache("faltas-tendencia",     TTL.REPORT),    getTendenciaFaltas);
router.get("/colaboradores", withCache("faltas-colaboradores", TTL.ANALYTICS), getColaboradoresFaltas)

module.exports = router;