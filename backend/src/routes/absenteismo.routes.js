const express = require("express");
const router  = express.Router();

const {
  getResumoAbsenteismo,
  getDistribuicoesAbsenteismo,
  getTendenciaAbsenteismo,
  getColaboradoresAbsenteismo,
} = require("../controllers/absenteismo.controller");

/* ===============================
   DASHBOARD • ABSENTEISMO
================================ */
router.get("/resumo",        getResumoAbsenteismo);
router.get("/distribuicoes", getDistribuicoesAbsenteismo);
router.get("/tendencia",     getTendenciaAbsenteismo);
router.get("/colaboradores", getColaboradoresAbsenteismo);

module.exports = router;
