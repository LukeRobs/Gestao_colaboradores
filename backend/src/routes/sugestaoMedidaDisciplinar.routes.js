const express = require("express");
const router = express.Router();

const controller = require("../controllers/sugestaoMedidaDisciplinar.controller");
const { authorizeRoles } = require("../middlewares/authorizeRoles");

/* =====================================================
   CONTADORES
===================================================== */
router.get(
  "/contadores",
  authorizeRoles("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  controller.getContadores
);

/* =====================================================
   LISTAR SUGESTÕES
   ADMIN, ALTA_GESTAO e LIDERANÇA podem visualizar
===================================================== */
router.get(
  "/",
  authorizeRoles("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  controller.getAllSugestoes
);

/* =====================================================
   CRIAR SUGESTÃO MANUAL
   ADMIN e ALTA_GESTAO
===================================================== */
router.post(
  "/",
  authorizeRoles("ADMIN", "ALTA_GESTAO"),
  controller.createSugestao
);

/* =====================================================
   APROVAR SUGESTÃO
   ADMIN, ALTA_GESTAO e LIDERANÇA
===================================================== */
router.post(
  "/:id/aprovar",
  authorizeRoles("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  controller.aprovarSugestao
);

/* =====================================================
   REJEITAR SUGESTÃO
   ADMIN, ALTA_GESTAO e LIDERANÇA
===================================================== */
router.post(
  "/:id/rejeitar",
  authorizeRoles("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  controller.rejeitarSugestao
);

/* =====================================================
   BACKFILL — processar datas passadas
   ADMIN e ALTA_GESTAO
===================================================== */
router.post(
  "/backfill",
  authorizeRoles("ADMIN", "ALTA_GESTAO"),
  controller.backfillFaltas
);

/* =====================================================
   BACKFILL ONBOARDING — gera ON para colaboradores sem ON
   ADMIN e ALTA_GESTAO
===================================================== */
router.post(
  "/backfill-onboarding",
  authorizeRoles("ADMIN", "ALTA_GESTAO"),
  controller.backfillOnboarding
);

module.exports = router;