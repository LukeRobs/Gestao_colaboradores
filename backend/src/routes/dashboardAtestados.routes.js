const express = require("express");
const router = express.Router();

const {
  getResumoAtestados,
  getDistribuicoesAtestados,
  getTendenciaAtestados,
  getRiscoAtestados,
  getCidsAtestados,
  getColaboradoresAtestados,
} = require("../controllers/dashboardAtestados.controller");

/* ===============================
   DASHBOARD • ATESTADOS
================================ */

router.get("/resumo", getResumoAtestados);
router.get("/distribuicoes", getDistribuicoesAtestados);
router.get("/tendencia", getTendenciaAtestados);
router.get("/risco", getRiscoAtestados);
router.get("/cids", getCidsAtestados);
router.get("/colaboradores", getColaboradoresAtestados);

module.exports = router;
