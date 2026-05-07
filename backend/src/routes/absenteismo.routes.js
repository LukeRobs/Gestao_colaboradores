const express = require("express");
const router  = express.Router();
const { withCache, TTL } = require("../middlewares/cache.middleware");

const {
  getResumoAbsenteismo,
  getDistribuicoesAbsenteismo,
  getTendenciaAbsenteismo,
  getColaboradoresAbsenteismo,
} = require("../controllers/absenteismo.controller");

/* ===============================
   DASHBOARD • ABSENTEISMO
================================ */
router.get("/resumo",        withCache("absenteismo-resumo",        TTL.REPORT), getResumoAbsenteismo);
router.get("/distribuicoes", withCache("absenteismo-distribuicoes", TTL.REPORT), getDistribuicoesAbsenteismo);
router.get("/tendencia",     withCache("absenteismo-tendencia",     TTL.REPORT), getTendenciaAbsenteismo);
router.get("/colaboradores", withCache("absenteismo-colaboradores", TTL.ANALYTICS), getColaboradoresAbsenteismo);

module.exports = router;
