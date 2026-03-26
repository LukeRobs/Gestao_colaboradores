const express = require("express");
const router = express.Router();

const controller = require("../controllers/sugestaoMedidaDisciplinar.controller");
const { authorizeRoles } = require("../middlewares/authorizeRoles");

/* =====================================================
   CONTADORES
===================================================== */
router.get(
  "/contadores",
  authorizeRoles("ADMIN", "LIDERANCA"),
  controller.getContadores
);

/* =====================================================
   LISTAR SUGESTÕES
   ADMIN e LIDERANÇA podem visualizar
===================================================== */
router.get(
  "/",
  authorizeRoles("ADMIN", "LIDERANCA"),
  controller.getAllSugestoes
);

/* =====================================================
   CRIAR SUGESTÃO MANUAL
   Apenas ADMIN
===================================================== */
router.post(
  "/",
  authorizeRoles("ADMIN"),
  controller.createSugestao
);

/* =====================================================
   APROVAR SUGESTÃO
   ADMIN e LIDERANÇA
===================================================== */
router.post(
  "/:id/aprovar",
  authorizeRoles("ADMIN", "LIDERANCA"),
  controller.aprovarSugestao
);

/* =====================================================
   REJEITAR SUGESTÃO
   ADMIN e LIDERANÇA
===================================================== */
router.post(
  "/:id/rejeitar",
  authorizeRoles("ADMIN", "LIDERANCA"),
  controller.rejeitarSugestao
);

module.exports = router;